// Punto de entrada de la app de escritorio. Implementa la pieza central
// que discutimos: dos ventanas (Main = taquilla, Public = pizarra) cada
// una fijada a un monitor físico distinto, según la configuración que
// guarda el administrador la primera vez (pantalla 5 del wireframe:
// "Configuración de pantallas").
//
// Compila y corre contra tauri 2.11.5 (la versión fijada en Cargo.lock).

use serde::{Deserialize, Serialize};
use std::fs;
use tauri::Manager;

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
        let _ = ventana.show();
        let _ = ventana.set_focus();
    }

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
                let _ = ventana.set_position(*monitor.position());
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

        // La pizarra nunca debe mostrar el escritorio de Windows detrás —
        // se muestra recién acá, ya reposicionada, no antes.
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
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![guardar_configuracion_pantallas])
        .setup(|app| {
            let handle = app.handle().clone();
            let config = leer_configuracion(&handle);
            posicionar_ventanas(&handle, &config);
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error corriendo la app Lujalo Sportsbook");
}
