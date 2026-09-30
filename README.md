# Clínica Veterinaria — App móvil (Android)

App Android que maneja **los mismos datos del programa de escritorio** de la clínica (repositorio `Vet`): usa el mismo archivo `vetclinic-data.json`, con las mismas colecciones, campos y numeración. Un archivo pasa del computador al móvil y de vuelta sin conversiones.

Los datos se guardan solo en el teléfono, en el almacenamiento privado de la app. No hay servidor ni nube de por medio.

## Descargar e instalar el APK

1. Desde el teléfono abre la página **Releases** de este repositorio y descarga el último **`ClinicaVeterinaria.apk`**
   (enlace directo: `https://github.com/servivetgomez-cyber/App_Movil_Vet/releases/latest/download/ClinicaVeterinaria.apk`).
2. Ábrelo. Android pedirá permitir *"instalar apps de fuentes desconocidas"* para el navegador o el gestor de archivos: acéptalo.
3. Las versiones nuevas se instalan encima de la anterior y **conservan los datos**.

Requiere Android 7.0 o superior.

## Qué se puede hacer desde el móvil

| Módulo | En el móvil |
|---|---|
| **Panel** | Citas de hoy, vacunas vencidas y próximas, stock bajo, accesos rápidos. Aviso (notificación) al abrir la app si hay citas o vacunas pendientes. |
| **Agenda** | Citas por día con tira semanal; crear, editar, marcar atendida/cancelada, recordatorio por WhatsApp. |
| **Pacientes y tutores** | Buscar, ficha completa (resumen, vacunas, consultas, citas), foto con la cámara, crear/editar. El n.º de historia clínica se genera igual que en el escritorio (documento del tutor + consecutivo). Llamar / WhatsApp / correo al tutor. |
| **Vacunas** | Pendientes, vencidas, próximas e historial. Registrar, aplicar la dosis agendada (encadenando la siguiente del esquema), volver a pendiente, descuento automático del inventario — mismas reglas del escritorio. |
| **Historias clínicas** | Consultas con anamnesis y examen físico, tratamientos/receta y controles de evolución. |
| **Inventario** | Stock, entradas y salidas con su movimiento, historial de precios, alertas de stock bajo. |
| **Facturas y certificados** | Consulta (la facturación, caja y contabilidad se siguen llevando en el escritorio). |
| **Calculadora de dosis** | Con los medicamentos importados del Excel en el escritorio (viajan dentro del mismo archivo). |
| **Sedes** | Filtrar todo por sede o ver todas. |

## Pasar los datos entre el computador y el móvil

En la app: **Más → Datos**.

### Google Drive (recomendado, igual que el programa de escritorio)

Si el programa de escritorio tiene su carpeta de datos en Google Drive (*Configuración → Dónde viven los datos*), el móvil puede usar **ese mismo archivo**:

1. Instala la app de Google Drive en el teléfono con la misma cuenta.
2. En la app: **Abrir desde Google Drive** (en la bienvenida) o **Más → Datos → Vincular archivo de Drive**.
3. En el selector abre el menú ☰ → **Drive**, entra a la carpeta de datos y toca `vetclinic-data.json`.

Desde ahí la app lee el archivo cada vez que se abre o se vuelve a ella, y guarda en él cada cambio a los pocos segundos (sin internet queda pendiente y se sube después). El ícono ☁️ de la barra superior muestra el estado. Si el archivo cambió en los dos lados a la vez, la app pregunta qué versión conservar.

> Deja cerrado el programa del computador mientras trabajas en el móvil, y viceversa: el programa guarda lo que tiene en memoria y pisaría los cambios del otro lado.

La app solo recibe permiso sobre ese archivo (no pide la cuenta de Google ni ve el resto del Drive).

### Copia manual (sin Drive)

- **Del computador al móvil:** copia el `vetclinic-data.json` del programa de escritorio (Configuración → Respaldo de datos → Abrir carpeta de datos) o un respaldo `.json` / `.vetenc` cifrado, envíalo al teléfono (Drive, WhatsApp, correo, cable) y toca **Importar archivo**. Los respaldos cifrados se abren con la misma contraseña de acceso del escritorio.
- **Del móvil al computador:** toca **Exportar** y compártelo (Drive, WhatsApp, correo...). En el computador, con el programa cerrado, reemplaza `vetclinic-data.json` de la carpeta de datos por el exportado. También se puede exportar cifrado (`.vetenc`, AES-256-GCM, mismo formato que los respaldos del escritorio).
- Al importar se guarda una copia de lo que había en el móvil: **Deshacer la última importación** la recupera.

> Trabaja en un solo lugar a la vez: importar un archivo reemplaza por completo los datos del otro lado.

## Estructura

```
www/                 Interfaz (HTML/CSS/JS sin empaquetador)
  js/db.js           Motor de datos: puerto de src/db.js del escritorio (mismo JSON)
  js/storage.js      Guardado en el teléfono (Capacitor Filesystem) y compartir archivos
  js/cifrado.js      Respaldos .vetenc compatibles con el escritorio (scrypt + AES-GCM)
  js/views/*.js      Pantallas
android/             Proyecto Android (Capacitor 8)
.github/workflows/   Compilación automática del APK y publicación en Releases
```

## Compilar

Cada `push` compila el APK en GitHub Actions y lo publica en **Releases**. Para compilar en un PC con Android Studio / Android SDK y JDK 21:

```bash
npm install
npm run apk:release     # android/app/build/outputs/apk/release/app-release.apk
```

Para probar la interfaz en el navegador: `npm run serve` y abre http://localhost:8080.

### Llave de firma

Android solo acepta una actualización si viene firmada con la misma llave que la versión instalada. El repositorio incluye una llave (`android/app/firma-apk.keystore`) para que todas las compilaciones salgan con la misma firma. Como el repositorio es público, para una firma privada crea tu propia llave y guárdala en *Settings → Secrets and variables → Actions*:

| Secreto | Valor |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | el `.keystore` en base64 (`base64 -w0 mi.keystore`) |
| `ANDROID_KEYSTORE_PASSWORD` | contraseña del keystore |
| `ANDROID_KEY_ALIAS` | alias de la llave |
| `ANDROID_KEY_PASSWORD` | contraseña de la llave |

Al cambiar de llave hay que desinstalar una vez la app anterior (exporta antes los datos).
