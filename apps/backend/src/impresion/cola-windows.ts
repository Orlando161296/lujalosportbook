// Impresión cruda por el spooler de Windows, por nombre de cola.
//
// El problema que resuelve: para mandarle ESC/POS a una térmica en Windows sin
// un driver nativo, hasta ahora había que COMPARTIR la impresora y escribirle
// al recurso `\\localhost\NOMBRE`. Compartir en Windows 10/11 es un trámite
// —pestaña Uso compartido, nombre sin espacios, a veces permisos de
// administrador— y era el paso donde se trababa la instalación.
//
// El spooler sí sabe mandar un trabajo «RAW» (bytes tal cual al dispositivo)
// a cualquier cola local, compartida o no. No hay comando de consola para
// eso, pero sí la API `winspool.drv` (OpenPrinter / StartDocPrinter con
// datatype RAW / WritePrinter). Se la llama desde un PowerShell de una sola
// vez con `Add-Type`, que es la receta de Microsoft (KB322091). Sin módulos
// nativos: el backend viaja embebido como sidecar y un `.node` compilado
// obligaría a cruzar-compilar en cada armado del instalador.
//
// Precio: cada impresión lanza un `powershell` (~0,5–1 s). Para un ticket de
// mostrador es tolerable; si algún día molesta, el reemplazo es un ejecutable
// nativo chico bundleado con la app.

import { execFile } from 'node:child_process';
import { writeFile, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * El helper P/Invoke. Se compila en el proceso de PowerShell con `Add-Type`.
 *
 * Es el `RawPrinterHelper` de la documentación de Microsoft, recortado a lo
 * que hace falta: abrir la cola por nombre, abrir un documento RAW, escribir
 * el buffer, cerrar. `Marshal.GetLastWin32Error()` sube en el mensaje para
 * que un «acceso denegado» o «cola inexistente» se distingan en el log.
 */
const HELPER_CSHARP = `
using System;
using System.Runtime.InteropServices;

public static class RawPrinterHelper {
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    public class DOCINFOW {
        [MarshalAs(UnmanagedType.LPWStr)] public string pDocName;
        [MarshalAs(UnmanagedType.LPWStr)] public string pOutputFile;
        [MarshalAs(UnmanagedType.LPWStr)] public string pDataType;
    }

    [DllImport("winspool.Drv", EntryPoint = "OpenPrinterW", SetLastError = true, CharSet = CharSet.Unicode, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool OpenPrinter(string src, out IntPtr hPrinter, IntPtr pd);

    [DllImport("winspool.Drv", EntryPoint = "ClosePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool ClosePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "StartDocPrinterW", SetLastError = true, CharSet = CharSet.Unicode, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern int StartDocPrinter(IntPtr hPrinter, int level, [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFOW di);

    [DllImport("winspool.Drv", EntryPoint = "EndDocPrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool EndDocPrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "StartPagePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool StartPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "EndPagePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool EndPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "WritePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, int dwCount, out int dwWritten);

    public static void SendBytes(string printerName, byte[] bytes) {
        IntPtr h;
        if (!OpenPrinter(printerName, out h, IntPtr.Zero))
            throw new Exception("OpenPrinter (" + Marshal.GetLastWin32Error() + ")");
        try {
            var di = new DOCINFOW { pDocName = "Lujalo ticket", pDataType = "RAW" };
            if (StartDocPrinter(h, 1, di) == 0)
                throw new Exception("StartDocPrinter (" + Marshal.GetLastWin32Error() + ")");
            try {
                if (!StartPagePrinter(h))
                    throw new Exception("StartPagePrinter (" + Marshal.GetLastWin32Error() + ")");
                IntPtr p = Marshal.AllocHGlobal(bytes.Length);
                try {
                    Marshal.Copy(bytes, 0, p, bytes.Length);
                    int written;
                    if (!WritePrinter(h, p, bytes.Length, out written))
                        throw new Exception("WritePrinter (" + Marshal.GetLastWin32Error() + ")");
                } finally { Marshal.FreeHGlobal(p); }
                EndPagePrinter(h);
            } finally { EndDocPrinter(h); }
        } finally { ClosePrinter(h); }
    }
}
`;

/**
 * El script que corre PowerShell.
 *
 * El nombre de la cola y la ruta del archivo llegan por variables de entorno
 * y NO interpoladas en el texto: un nombre de impresora puede tener comillas,
 * espacios o `$`, y así no hay forma de que se lea como código.
 *
 * El catch deja en stderr sólo el mensaje de más adentro —«OpenPrinter
 * (1801)»— sin el envoltorio de PowerShell («Excepción al llamar a…»), que
 * es ruido y encima viene traducido.
 */
const SCRIPT = `
$ErrorActionPreference = 'Stop'
try {
  Add-Type -TypeDefinition @'${HELPER_CSHARP}'@
  $bytes = [System.IO.File]::ReadAllBytes($env:LUJALO_TICKET_ARCHIVO)
  [RawPrinterHelper]::SendBytes($env:LUJALO_IMPRESORA_COLA, $bytes)
} catch {
  [Console]::Error.WriteLine($_.Exception.GetBaseException().Message)
  exit 1
}
`;

/**
 * Los códigos de error de Windows que valen un mensaje propio: son los que
 * el operador puede llegar a resolver sin llamar a nadie.
 */
function traducir(mensaje: string): string {
  const codigo = mensaje.match(/\((\d+)\)\s*$/)?.[1];
  const conocidos: Record<string, string> = {
    '1801': 'no hay ninguna impresora con ese nombre — puede haber cambiado en Windows',
    '5': 'Windows no dio permiso para imprimir en esa cola',
    '1722': 'el servicio «Cola de impresión» de Windows no está corriendo',
    '1804': 'la impresora rechazó el trabajo crudo (datatype RAW)',
    '63': 'la impresora está sin papel o desconectada',
  };
  return (codigo && conocidos[codigo]) || mensaje;
}

/**
 * Manda `bytes` a la cola `nombreCola` por el spooler, en crudo.
 *
 * Rechaza con el texto de error de PowerShell si el spooler no lo aceptó
 * —cola inexistente, sin permiso, impresora fuera de línea—. Quien llama lo
 * envuelve en ImpresionFallida.
 */
export function imprimirEnColaWindows(nombreCola: string, bytes: Buffer): Promise<void> {
  const archivo = join(tmpdir(), `lujalo-ticket-${Date.now()}-${process.pid}.bin`);

  return writeFile(archivo, bytes).then(
    () =>
      new Promise<void>((resolver, rechazar) => {
        execFile(
          'powershell',
          ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', SCRIPT],
          {
            windowsHide: true,
            timeout: 20_000,
            env: {
              ...process.env,
              LUJALO_IMPRESORA_COLA: nombreCola,
              LUJALO_TICKET_ARCHIVO: archivo,
            },
          },
          (error, _salida, errSalida) => {
            unlink(archivo).catch(() => {});
            if (error) {
              const crudo = (errSalida || error.message)
                .toString()
                .split('\n')
                .map((l) => l.trim())
                .filter(Boolean)[0];
              rechazar(new Error(traducir(crudo || 'PowerShell no devolvió detalle')));
            } else {
              resolver();
            }
          },
        );
      }),
    (causa) => {
      throw new Error(`no se pudo preparar el trabajo: ${(causa as Error).message}`);
    },
  );
}
