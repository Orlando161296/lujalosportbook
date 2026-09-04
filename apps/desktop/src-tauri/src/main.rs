// Punto de entrada de la app de escritorio.
//
// Al arrancar se abre UNA sola ventana, la taquilla. La pizarra ya no está
// declarada en tauri.conf.json y no nace con la app: la crea el botón
// «Pizarra ↗» del remate cuando el operador la pide (ver abrirPizarra en
// TaquillaApp.tsx). Tenerla prendida toda la jornada era un webview entero
// con su propio React y su propia conexión de socket ocupando la PC del
// local para mostrar un tablero que muchas veces nadie estaba mirando.
//
// Compila y corre contra tauri 2.11.5 (la versión fijada en Cargo.lock).

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
// Sin esto Windows abre una consola negra detrás de la app: es un binario de
// consola salvo que se diga lo contrario. En debug se deja, que es donde los
// println del arranque sirven para algo.

use serde::{Deserialize, Serialize};
use std::fs;
use std::net::{SocketAddr, TcpStream};
use std::path::PathBuf;
use std::process::{Child, Command};
use std::sync::Mutex;
use std::time::{Duration, Instant};
use tauri::path::BaseDirectory;
use tauri::{Manager, RunEvent};

/// El puerto del backend. Igual que en apps/backend/src/main.ts.
const PUERTO: u16 = 3210;

/// El backend vivo, para poder matarlo al cerrar.
///
/// Sin esto el proceso de Node queda huérfano: la ventana se cierra, el
/// usuario cree que salió, y al volver a abrir la app el puerto está tomado
/// por el backend anterior —con la base todavía abierta— y no arranca nada.
struct Backend(Mutex<Option<Child>>);

fn backend_responde() -> bool {
    let dir: SocketAddr = ([127, 0, 0, 1], PUERTO).into();
    TcpStream::connect_timeout(&dir, Duration::from_millis(300)).is_ok()
}

/// Arranca el backend empaquetado y espera a que atienda.
///
/// Si el puerto ya está ocupado no lanza nada: es el caso de `tauri dev`, con
/// el backend corriendo aparte en otra terminal, y también el de una segunda
/// instancia de la app. Lanzar otro daría un EADDRINUSE y dos procesos
/// peleando por el mismo archivo de base.
fn arrancar_backend(app: &tauri::AppHandle) -> Option<Child> {
    if backend_responde() {
        println!("El backend ya está escuchando en {PUERTO}; no se lanza otro.");
        return None;
    }

    let recursos = match app.path().resolve("recursos/backend", BaseDirectory::Resource) {
        Ok(r) => r,
        Err(e) => {
            eprintln!("No se encontró el backend empaquetado: {e}");
            return None;
        }
    };

    let node = recursos.join(if cfg!(windows) { "node.exe" } else { "node" });
    let entrada = recursos.join("dist").join("main.js");
    if !node.exists() || !entrada.exists() {
        eprintln!("Falta el backend en {}: corré scripts/empaquetar.js", recursos.display());
        return None;
    }

    let datos = match preparar_datos(app, &recursos) {
        Ok(d) => d,
        Err(e) => {
            eprintln!("No se pudo preparar la carpeta de datos: {e}");
            return None;
        }
    };

    let mut cmd = Command::new(&node);
    cmd.arg(&entrada)
        .current_dir(&recursos)
        .env("PUERTO", PUERTO.to_string())
        // Rutas absolutas y explícitas: instalada, la app no corre desde
        // ninguna carpeta del repo y todo lo relativo al directorio de
        // trabajo apuntaría a Archivos de Programa, que es de sólo lectura.
        .env("DATABASE_URL", format!("file:{}", datos.join("lujalo.db").display()))
        .env("LUJALO_DATOS_DIR", &datos);

    #[cfg(windows)]
    {
        // CREATE_NO_WINDOW: sin esto cada arranque abre una consola de Node
        // encima de la taquilla.
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x0800_0000);
    }

    let hijo = match cmd.spawn() {
        Ok(h) => h,
        Err(e) => {
            eprintln!("No se pudo arrancar el backend: {e}");
            return None;
        }
    };

    // Esperarlo antes de mostrar la taquilla: si la ventana aparece primero,
    // la pantalla arranca con todas sus consultas en error y el operador ve
    // un tablero roto que se arregla solo unos segundos después.
    let limite = Instant::now() + Duration::from_secs(40);
    while Instant::now() < limite {
        if backend_responde() {
            println!("Backend listo.");
            return Some(hijo);
        }
        std::thread::sleep(Duration::from_millis(200));
    }

    eprintln!("El backend no respondió a tiempo; la app abre igual y reintenta sola.");
    Some(hijo)
}

/// Deja lista la carpeta de datos del usuario y devuelve su ruta.
///
/// Es AppData y no la carpeta de instalación porque en Windows Archivos de
/// Programa es de sólo lectura para un usuario común: la base, los avisos de
/// la pizarra y la configuración de la impresora tienen que poder escribirse
/// sin ejecutar la app como administrador.
///
/// La base sale de la plantilla que arma `empaquetar.js`, ya migrada y con el
/// admin sembrado. Copiarla es todo lo que hace falta la primera vez: el
/// instalador no lleva el CLI de Prisma ni corre migraciones en el local.
fn preparar_datos(app: &tauri::AppHandle, recursos: &PathBuf) -> std::io::Result<PathBuf> {
    let datos = app
        .path()
        .app_data_dir()
        .map_err(|e| std::io::Error::new(std::io::ErrorKind::NotFound, e.to_string()))?;
    fs::create_dir_all(&datos)?;

    let base = datos.join("lujalo.db");
    if !base.exists() {
        let plantilla = recursos.join("plantilla.db");
        if plantilla.exists() {
            fs::copy(&plantilla, &base)?;
            println!("Base creada en {}", base.display());
        } else {
            eprintln!("No hay plantilla.db en los recursos: la base va a arrancar vacía.");
        }
    }
    Ok(datos)
}

#[derive(Serialize, Deserialize, Default)]
struct ConfiguracionPantallas {
    monitor_taquilla: usize,
    monitor_pizarra: usize,
}

fn ruta_configuracion(app: &tauri::AppHandle) -> std::path::PathBuf {
    let dir = app
        .path()
        .app_config_dir()
        .expect("no se pudo resolver el directorio de configuración de la app");
    fs::create_dir_all(&dir).ok();
    dir.join("pantallas.json")
}

/**
 * A qué monitor va cada ventana cuando nadie lo configuró todavía.
 *
 * Se detecta en vez de asumir «taquilla en el 0, pizarra en el 1»: el orden
 * en que el sistema enumera los monitores no es el que uno espera, y si el
 * televisor quedaba primero la pizarra salía en la pantalla del operador y
 * la taquilla en el TV, a la vista del salón.
 *
 * El criterio es el del uso real: el operador trabaja en el monitor primario
 * —el que Windows marca como principal, donde está la barra de tareas—, y la
 * pizarra se va al primero que no sea ese, que es el televisor. Con una sola
 * pantalla los dos índices coinciden y `posicionar_ventanas` la trata como
 * ventana común.
 */
fn configuracion_detectada(app: &tauri::AppHandle) -> ConfiguracionPantallas {
    let monitores = app.available_monitors().unwrap_or_default();

    let primario = app.primary_monitor().ok().flatten();
    let monitor_taquilla = primario
        .as_ref()
        .and_then(|p| monitores.iter().position(|m| m.name() == p.name()))
        .unwrap_or(0);

    let monitor_pizarra = (0..monitores.len())
        .find(|i| *i != monitor_taquilla)
        .unwrap_or(monitor_taquilla);

    ConfiguracionPantallas { monitor_taquilla, monitor_pizarra }
}

fn leer_configuracion(app: &tauri::AppHandle) -> ConfiguracionPantallas {
    let ruta = ruta_configuracion(app);
    match fs::read_to_string(&ruta) {
        // Lo que el administrador haya guardado manda sobre la detección.
        Ok(contenido) => serde_json::from_str(&contenido)
            .unwrap_or_else(|_| configuracion_detectada(app)),
        Err(_) => configuracion_detectada(app),
    }
}

// Comando invocado desde la pantalla de Configuración (React) cuando el
// administrador guarda a qué monitor va cada ventana. A partir de ahí "el
// usuario no debería preocuparse más por Windows" — cada arranque siguiente
// lee este archivo y posiciona las ventanas solo.
#[tauri::command]
fn guardar_configuracion_pantallas(
    app: tauri::AppHandle,
    monitor_taquilla: usize,
    monitor_pizarra: usize,
) -> Result<(), String> {
    let config = ConfiguracionPantallas { monitor_taquilla, monitor_pizarra };
    let json = serde_json::to_string_pretty(&config).map_err(|e| e.to_string())?;
    fs::write(ruta_configuracion(&app), json).map_err(|e| e.to_string())?;
    posicionar_ventanas(&app, &config);
    Ok(())
}

fn posicionar_ventanas(app: &tauri::AppHandle, config: &ConfiguracionPantallas) {
    let monitores = app.available_monitors().unwrap_or_default();

    if let Some(ventana) = app.get_webview_window("taquilla") {
        if let Some(monitor) = monitores.get(config.monitor_taquilla) {
            let _ = ventana.set_position(*monitor.position());
        }
        // Maximizar DESPUÉS de moverla, y no confiar en `maximized: true` de
        // la config: mover una ventana la saca del estado maximizado, así que
        // quedaba con los 1280×720 fijos del archivo. En una laptop con
        // escalado de Windows eso es más grande que la pantalla y la ventana
        // se salía. Maximizada se ajusta al área de trabajo del monitor, que
        // además respeta la barra de tareas.
        let _ = ventana.maximize();
        let _ = ventana.show();
        let _ = ventana.set_focus();
    }

    // Al arrancar no hay pizarra que reubicar —la crea el botón del remate, ya
    // colocada— así que `get_webview_window` devuelve None y esto no corre.
    // Queda para `guardar_configuracion_pantallas`: si el administrador cambia
    // a qué monitor va cada ventana con la pizarra abierta, se mueve sola en
    // vez de obligar a cerrarla y volver a abrirla.
    if let Some(ventana) = app.get_webview_window("pizarra") {
        // La pizarra está pensada para el TV: sin bordes, fuera de la barra
        // de tareas y a pantalla completa en su propio monitor. Eso vale
        // sólo si ese monitor existe y no es el mismo donde está la
        // taquilla.
        let monitor_propio = monitores
            .get(config.monitor_pizarra)
            .filter(|_| config.monitor_pizarra != config.monitor_taquilla);

        match monitor_propio {
            Some(monitor) => {
                // El tamaño se fija ADEMÁS del fullscreen, y en unidades
                // físicas —que es lo que reporta el monitor—. La ventana
                // nace con los 1920×1080 de tauri.conf.json, y si el
                // fullscreen no llegaba a aplicarse (el error se descarta,
                // como todo acá) quedaba de ese tamaño sobre un televisor
                // más chico: el contenido se salía por abajo y por la
                // derecha. Calzándola al monitor primero, el resultado es
                // correcto aunque el fullscreen no haga nada.
                let _ = ventana.set_position(*monitor.position());
                let _ = ventana.set_size(*monitor.size());
                let _ = ventana.set_fullscreen(true);
            }
            None => {
                // Una sola pantalla — el caso de la laptop del operador
                // mientras configura o prueba. Sin bordes, sin barra de
                // tareas y a 1920×1080 la pizarra tapa la taquilla y no hay
                // forma de correrla ni de volver: queda la app inusable.
                // Acá deja de ser el TV y pasa a ser una ventana común, que
                // se puede mover, minimizar y alternar con Alt+Tab.
                let _ = ventana.set_fullscreen(false);
                let _ = ventana.set_decorations(true);
                let _ = ventana.set_skip_taskbar(false);
                let _ = ventana.set_resizable(true);
                // Achicada para que entre en una pantalla chica y corrida
                // para que no arranque justo encima de la taquilla.
                let _ = ventana.set_size(tauri::LogicalSize::new(1024.0, 640.0));
                let _ = ventana.set_position(tauri::LogicalPosition::new(60.0, 60.0));
            }
        }

        // Ya estaba visible —si llegó hasta acá es porque el operador la
        // abrió—, pero reposicionarla puede dejarla detrás de la taquilla.
        let _ = ventana.show();

        // Con un solo monitor el foco tiene que quedar en la taquilla, que
        // es donde el operador trabaja; `show()` de la pizarra se lo roba.
        if monitor_propio.is_none() {
            if let Some(taquilla) = app.get_webview_window("taquilla") {
                let _ = taquilla.set_focus();
            }
        }
    }
}

fn main() {
    let app = tauri::Builder::default()
        .manage(Backend(Mutex::new(None)))
        .invoke_handler(tauri::generate_handler![guardar_configuracion_pantallas])
        .setup(|app| {
            let handle = app.handle().clone();

            // Primero el backend, después la ventana: la taquilla no sirve de
            // nada sin él y verla vacía es peor que esperar un segundo.
            let hijo = arrancar_backend(&handle);
            *handle.state::<Backend>().0.lock().unwrap() = hijo;

            let config = leer_configuracion(&handle);
            posicionar_ventanas(&handle, &config);
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error armando la app Lujalo Sportsbook");

    app.run(|handle, evento| {
        // Cerrar la app tiene que cerrar el backend. `kill` y no una señal
        // amable: es un proceso propio, sin nada que guardar —SQLite ya
        // escribió cada transacción— y si quedara vivo, el arranque siguiente
        // se encuentra el puerto tomado.
        if let RunEvent::Exit = evento {
            if let Some(mut hijo) = handle.state::<Backend>().0.lock().unwrap().take() {
                let _ = hijo.kill();
                let _ = hijo.wait();
            }
        }
    });
}
