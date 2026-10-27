# Folio · Reglamentos locales

Aplicación para Windows que busca en reglamentos privados y devuelve pasajes, ubicación y enlaces al original. Incluye chat, OCR de capturas y borradores opcionales con Ollama local.

## Descargar la app de escritorio

[![Descargar Folio para Windows x64](desktop/descargar.svg)](dist/Folio-1.1.0-portable-x64.exe)

**[Descargar ZIP alternativo](dist/Folio-1.1.0-win-x64.zip)** · **[Verificar SHA-256](dist/SHA256SUMS.txt)** · **[Manual para instalar con una IA](MANUAL-IA.md)**

El archivo portable abre una ventana propia de Folio e incluye el motor de ejecución: no requiere instalar Node.js. Windows 10/11 x64. La búsqueda funciona sin Ollama; la IA opcional requiere Ollama, un modelo local y el firewall verificado. No incluye reglamentos ni modelos. Los paquetes están disponibles en esta carpeta; no se han publicado en Internet.

También puedes extraer el ZIP completo y abrir `Folio.exe`. Los documentos del escritorio se guardan en `%LOCALAPPDATA%\Folio\data`, separados de la biblioteca de la versión web. Esta versión no tiene firma de editor; Windows puede mostrar una advertencia. No desactives la protección del equipo.

En el menú **Folio** de la app puedes abrir la carpeta de datos o solicitar la configuración del bloqueo de Internet de la IA.

## Abrir desde el código

1. Requiere Node.js 22.13 o posterior. En este equipo hay Node.js 24.
2. Si las dependencias no están instaladas, ejecuta `instalar.cmd` (esta instalación sí requiere Internet).
3. Haz doble clic en `iniciar.cmd`: abre http://127.0.0.1:4318 cuando el servidor está listo.
4. Agrega tus reglamentos, escribe una pregunta y revisa las fuentes.
5. Deja abierta la consola mientras usas la app; Ctrl+C la detiene.

También puedes ejecutar `npm start` y `npm test` desde esta carpeta.

## Consultar y capturar

- **Agregar carpeta** importa los PDF, DOCX, TXT y MD de la carpeta seleccionada y sus subcarpetas. El navegador puede pedir confirmar la selección: los archivos se envían únicamente al servidor local de Folio. También se mantiene **Agregar reglamentos** para seleccionar archivos individuales.
- La importación muestra progreso y un resumen de importados, duplicados, formatos omitidos y errores. Omite copias con el mismo contenido y archivos temporales de Word (`~$`). Un archivo inválido o de más de 15 MB no impide importar los demás. **Detener** termina el archivo actual y deja el resto pendiente; puedes seleccionar nuevamente la carpeta para continuar sin duplicar los documentos ya cargados.
- Se importan copias: la carpeta de origen no se modifica ni queda sincronizada automáticamente. El selector de carpetas requiere un navegador compatible, como Edge o Chrome.
- PDF con texto: se conserva el número real de página del archivo, no necesariamente la numeración impresa.
- DOCX: párrafos del texto extraído, incluidas tablas; no se inventan páginas de Word. El original se descarga al abrir el enlace.
- TXT/MD: UTF-8, párrafos separados por líneas en blanco.
- Cargas de hasta 15 MB. No admite DOC antiguo ni PDF cifrado sin acceso al texto.
- Un PDF escaneado necesita una capa OCR previa. La app avisa si detecta páginas con poco texto; no interpreta imágenes ni diagramas del reglamento.
- **Seleccionar zona**, en la app de escritorio, oculta Folio y permite arrastrar un rectángulo sobre el texto, como en LeerTexto. Al soltar el mouse vuelve la app con el recorte y el texto reconocido. **Esc** o clic derecho cancelan. Selecciona dentro de un solo monitor; se admiten sus distintas escalas de pantalla. Una zona menor de 8 píxeles lógicos no se captura.
- **Ventana completa** conserva el selector de ventanas y pantallas. En el navegador, **Capturar pantalla** usa el selector del navegador y toma un único fotograma.
- El selector de zona procesa solo el recorte con OCR de Windows. La imagen completa de pantalla se usa transitoriamente en memoria para recortar y no se guarda. Revisa la vista previa y el texto antes de pulsar **Usar texto**; no se envía automáticamente una consulta a la IA.
- Puedes cargar una captura PNG. Windows reconoce el texto localmente; se intenta español y luego el idioma disponible del usuario. Revisa el texto antes de usarlo. También puedes pegar texto manualmente.
- Se eliminan las capturas temporales después del OCR; tras un cierre inesperado, se limpian las pendientes al volver a iniciar. Borrar archivos no equivale a borrado forense del disco.
- Ctrl+Enter envía la consulta. Cada pregunta busca de forma independiente; no usa preguntas anteriores como contexto.

## Dos modos

**Búsqueda local (predeterminada):** recuperación por palabras sin acentos, con ponderación de términos y pasajes de hasta 1.500 caracteres. Devuelve citas textuales y enlaces. No hace interpretación jurídica, no comprende sinónimos automáticamente y puede omitir información relevante. Las consultas muy largas funcionan mejor si se reducen al tema central.

**IA local:** activa el interruptor. La app inicia un proceso propio de Ollama en `127.0.0.1:11439` con `OLLAMA_NO_CLOUD=1`. Solo ofrece modelos GGUF ya descargados, rechaza metadatos remotos y no instala ni descarga modelos. No cambia el servidor habitual ni la configuración global. No acepta una instancia desconocida que ya ocupe ese puerto.

Para habilitar la IA ahora es obligatorio verificar primero el bloqueo de red descrito a continuación. La búsqueda local no requiere Ollama ni este paso.

La IA recibe únicamente la pregunta y hasta cinco pasajes recuperados. Sus respuestas se muestran como borradores y deben citar IDs de fuentes existentes; si faltan o son inválidas, se vuelve a los pasajes. Esa comprobación **no demuestra** que la interpretación esté respaldada semánticamente: verifica siempre el texto original. El contenido de documentos no debe considerarse instrucciones para el modelo. No se conectan correo, herramientas, navegación web ni acciones externas.

## Bloquear el acceso a Internet de la IA

Folio ofrece una app de escritorio y una versión local en el navegador; ambas usan el mismo buscador y la misma protección de Ollama. Usar localhost o desactivar la nube de Ollama por sí solos no bloquea las conexiones a Internet del proceso.

1. Haz clic derecho en `bloquear-internet-ia.cmd` y elige **Ejecutar como administrador**. Windows exige permisos de administrador para crear las reglas.
2. El script agrega reglas de salida para los ejecutables de la instalación de Ollama (incluido el motor llama-server), en todos los protocolos y perfiles. Bloquea direcciones fuera de loopback y conserva la comunicación dentro del equipo.
3. Espera el mensaje **Bloqueo verificado**. Si no aparece, no se ha confirmado el bloqueo.
4. Activa **IA local** en Folio. La app comprueba las reglas efectivas y los tres perfiles del firewall antes de iniciar el motor y antes de enviarle evidencia. Si falla la comprobación, no realiza la consulta de IA.

Este bloqueo afecta también a otras sesiones que usen esa misma instalación de Ollama: no podrán descargar modelos ni acceder a servicios de nube. No cambia las reglas de otros programas, la configuración global de Ollama ni la conectividad de Windows. Tras actualizar o reinstalar Ollama, puede ser necesario ejecutar de nuevo el archivo si aparecen nuevos ejecutables o cambia su ubicación. Un administrador puede modificar el firewall; esto no sustituye la protección del equipo.

**Estado verificado el 24 de octubre de 2026:** se instalaron y verificaron cinco reglas activas para los ejecutables de Ollama. Una prueba saliente del propio `ollama.exe` hacia la dirección reservada para documentación `203.0.113.1` fue rechazada por Windows con un error de permisos de socket. El proceso privado siguió accediendo localmente a los modelos descargados. Esta prueba no usó reglamentos del usuario ni envió consultas a servicios externos. Folio vuelve a verificar la política antes de usar la IA; si el firewall se desactiva o las reglas dejan de coincidir, no la habilita.

Con las reglas activas, `qwen3.5:4b-q4_K_M` respondió una consulta sobre un reglamento ficticio e incluyó la referencia `[1]`. También se comprobó que un borrador sin citas se rechaza. No se usaron reglamentos reales para estas pruebas.

Referencia: [reglas de bloqueo por programa en Windows Firewall](https://learn.microsoft.com/en-us/powershell/module/netsecurity/new-netfirewallrule).

## Privacidad y alcance

- El servidor escucha exclusivamente en `127.0.0.1`; no se publica en Internet ni en la red local.
- HTML, CSS y JavaScript locales; sin fuentes externas, CDN, telemetría ni servicios de IA externos.
- Se comprueban Host, Origin, metadatos de navegación, cookie local HttpOnly/SameSite y token CSRF; no hay CORS permisivo.
- Los originales y el texto extraído se almacenan sin cifrado propio en `data/` junto al código (versión web) o `%LOCALAPPDATA%\Folio\data` (escritorio). La biblioteca permite eliminar cada copia y su índice. No se modifica el original del que se importó.
- El chat no se persiste en el servidor ni en localStorage. No se escriben preguntas, respuestas ni capturas en logs de la aplicación. El navegador, el sistema operativo, la memoria virtual y herramientas externas tienen sus propias políticas.
- Mantén esta carpeta fuera de OneDrive, Dropbox u otras carpetas sincronizadas y restringe el acceso a tu cuenta de Windows. El programa no modifica estas configuraciones ni puede garantizar ausencia absoluta de filtraciones si el equipo está comprometido.
- Los enlaces de fuente son locales y requieren la app abierta. No funcionarán para otra persona al copiarlos a un correo.
- Es una app personal, no un servidor multiusuario ni un gestor de vigencia normativa. Consulta versiones, excepciones y autoridad del reglamento antes de usar una respuesta.

## Estructura

`server.mjs` coordina API y controles locales; `lib/` contiene extracción, búsqueda y Ollama; `public/` contiene la interfaz; `scripts/ocr.ps1` usa Windows.Media.Ocr. El mapa y superficies de seguridad están en `MAPA.md`. Las pruebas usan documentos sintéticos, sin reglamentos reales.

## Validación realizada

- Catorce pruebas automatizadas: recuperación, referencias, fragmentación, PDF, Word, rechazo de archivos inválidos, flujo HTTP y geometría del recorte con distintas escalas y coordenadas de monitor.
- OCR de Windows probado en español con una imagen sintética; revisión y uso del texto comprobados en Edge. Carpeta temporal vacía tras procesar.
- Borrador real generado con `qwen3.5:4b-q4_K_M`, evidencia ficticia y cita `[1]`, mediante el proceso privado de Ollama.
- `npm audit --omit=dev`: cero vulnerabilidades conocidas reportadas al 24 de octubre de 2026; no constituye una auditoría integral de seguridad.
- Prueba de escritorio con imagen ficticia: arrastre real en el selector, recorte a escala 200%, OCR, revisión del texto, cancelación con Esc y rechazo de mensajes desde una ventana no autorizada. No utiliza reglamentos reales. La captura del escritorio físico no quedó validada con el panel de prueba; la prueba automatizada suministra una imagen sintética. Pendiente comprobar manualmente varias pantallas físicas.

## Referencias técnicas

- [Extracción de PDF con pdf-parse](https://www.npmjs.com/package/pdf-parse)
- [Extracción de texto DOCX con Mammoth](https://github.com/mwilliamson/mammoth.js/)
- [OCR de Windows](https://learn.microsoft.com/en-us/uwp/api/windows.media.ocr.ocrengine.trycreatefromuserprofilelanguages)
- [Ollama: funciones de nube y modo local](https://github.com/ollama/ollama/blob/main/docs/faq.mdx)
