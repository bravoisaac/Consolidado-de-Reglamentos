# Mapa dinámico

## Mascota de escritorio (en desarrollo)
- Objetivo: minimizar Folio a una mascota flotante con captura, consultas y biblioteca.
- Framework/entrada: Electron; desktop/main.cjs y preload.cjs.
- Pantallas conectadas: nueva ventana local desktop/pet.*, public/app.js e index.html; estilos propios con la paleta verde de Folio.
- Servicios y estado: reutilizar selección de zona → OCR → revisión; eventos IPC limitados, estado ocupado y minimizar/restaurar. Sin API de red nueva.
- Patrones: ventanas aisladas, contenido local permitido explícitamente, sin Node en renderers; conservar conversación al minimizar.
- Candidatos revisados: main/preload, region-capture/region-smoke/smoke, app/index/styles, package y manual.
- Archivos a modificar: los anteriores necesarios para conectar mascota, pruebas funcionales y documentación; añadir módulo/ventana de mascota.
- No tocar: bibliotecas reales, reglas de firewall, motor Ollama y proyecto LeerTexto.
- Riesgo: medio (ciclo de ventanas, permisos IPC y visibilidad durante captura). Pruebas con biblioteca e imágenes ficticias.

- Objetivo: consultar reglamentos privados con pasajes, ubicación y enlaces locales; extraer preguntas de capturas.
- Framework: Node.js con HTTP nativo, HTML/CSS/JavaScript, OCR de Windows y Ollama opcional.
- Entrada: server.mjs; iniciar.cmd para Windows.
- Pantallas: public/index.html, public/app.js y public/styles.css (biblioteca, chat y captura).
- Servicios: lib/documents.mjs (extracción e índice), lib/extract-worker.mjs (extracción aislada con límite de memoria y tiempo), lib/search.mjs (recuperación), lib/ollama.mjs (IA local), scripts/ocr.ps1 (OCR).
- Estado: originales e índice en data/; conversación en memoria del navegador; capturas temporales eliminadas después del OCR.
- Rutas: /api/documents, /api/ask, /api/ocr, /api/models y /documents/:id.
- Patrones previos: carpeta vacía. Archivos candidatos revisados: ninguno.
- Cambios: nueva aplicación; sin migraciones ni servicios desplegados.
- Seguridad: escucha exclusiva en 127.0.0.1, comprobación Host/Origin, cookie HttpOnly/SameSite, token CSRF, CSP, sin CDN/telemetría, nombres internos UUID, límites de carga, SQL no usado.
- No tocar: archivos externos del usuario ni configuración global de Ollama.
- Riesgo: medio, manejo de documentos confidenciales. Disco sin cifrado propio; se requiere protección del equipo y carpeta fuera de sincronización en nube.
- Validación: diez pruebas de recuperación, citas, formatos y controles HTTP aprobadas; OCR con imagen sintética y borrador real con Qwen local verificados; interfaz revisada en Edge. Detalles y límites en README.md.

## Importación de carpetas
- Objetivo: seleccionar una carpeta y cargar los reglamentos de sus subcarpetas.
- Alcance: public/index.html, public/app.js y public/styles.css; documentación en README.md.
- Flujo: selector de carpeta → filtro PDF/DOCX/TXT/MD → cola secuencial → API de carga existente → resumen persistente.
- Estados: progreso, detención después del archivo actual, duplicados, formatos omitidos y errores por archivo; un error no interrumpe el lote.
- Seguridad: solo archivos seleccionados por el usuario, procesamiento local y límite existente de 15 MB por archivo. Sin nuevas dependencias ni rutas de acceso al disco.
- Riesgo: bajo; conserva carga individual, referencias y almacenamiento actuales.
- Validación: importación de carpeta con subcarpeta en Edge, sobre una biblioteca de prueba separada: 2 importados, 1 duplicado, 1 formato omitido y 2 errores (PDF inválido y archivo de más de 15 MB). Las diez pruebas existentes siguen aprobadas.

## IA sin acceso a Internet
- Requisito: bloqueo de red del motor de IA, además de desactivar servicios de nube.
- Alcance: scripts/ollama-firewall.ps1, bloquear-internet-ia.cmd, lib/ollama.mjs y mensajes de privacidad.
- Flujo: instalación de reglas con permisos de administrador → verificación de reglas efectivas en Windows antes de iniciar Ollama y antes de enviar evidencia → IA habilitada solo si la verificación pasa.
- Política: bloquear tráfico saliente fuera de loopback para todos los ejecutables encontrados dentro de la instalación de Ollama, en todos los perfiles y protocolos. No modificar el firewall de otras aplicaciones.
- Riesgo: cambio persistente en Windows solicitado por el usuario; también impide las descargas del Ollama instalado. Las actualizaciones que agreguen ejecutables requieren reaplicar la configuración. La IA queda bloqueada si no puede verificar reglas o firewall activo.
- Estado: cinco reglas instaladas y verificadas en ActiveStore. Prueba de salida con ollama.exe a 203.0.113.1 rechazada por permisos de socket; acceso a modelos locales confirmado. Verificado previamente el rechazo de activación sin reglas. Las diez pruebas de biblioteca/búsqueda siguen aprobadas. Servidor activo con comprobación obligatoria.

## Distribución de escritorio y manual de instalación
- Objetivo: entregar un paquete Windows real con acceso de descarga desde README y manual reproducible para otro agente.
- Arquitectura: ventana Electron aislada; servidor existente en proceso Node incluido; API ligada a loopback en puerto dinámico; biblioteca propia en LOCALAPPDATA/Folio/data.
- Alcance: desktop/, scripts de empaquetado/instalación, package.json/lock, README.md y MANUAL-IA.md; cambios limitados en servidor y captura para soportar escritorio.
- Seguridad: lista explícita de archivos distribuibles (excluye data, output, pruebas y configuraciones privadas); sin navegación externa ni Node en interfaz; bloqueo de Ollama sigue obligatorio; permisos de captura solo por selección explícita del usuario.
- Riesgo: medio. Nuevas dependencias de empaquetado autorizadas por la solicitud de app de escritorio. No migrar ni borrar la biblioteca actual.
- Validación: diez pruebas existentes aprobadas; paquete final ejecutado sin Node en PATH con resultado ok:true (aislamiento, extracción PDF, cita/página, enlace, bloqueo de peticiones externas, limpieza, cierre y captura visual). Diagnóstico del manual confirmó dependencias, firewall e idiomas OCR. npm audit y npm audit --omit=dev sin vulnerabilidades conocidas. Paquete revisado mediante lista explícita; hashes calculados por scripts/release.mjs al terminar la compresión.
- Entrega: dist/Folio-1.0.0-portable-x64.exe y dist/Folio-1.0.0-win-x64.zip, con SHA256SUMS.txt. El portable definitivo también pasó la prueba independiente sin Node en PATH y cerró correctamente. Cinco enlaces locales del README verificados. Paquetes sin firma de editor y sin publicación externa.

## Selección de una zona de pantalla
- Referencia leída: leertexto/main.js y renderer/selection.{html,css,js}; interacción de rectángulo por arrastre y Escape. No modificar ese proyecto.
- Objetivo: ocultar Folio, seleccionar una zona y procesar solamente el recorte con el OCR local existente.
- Archivos: desktop/region-* (selector aislado y geometría), desktop/main.cjs/preload.cjs, public/app.js/index.html/styles.css y documentación.
- Flujo: botón Seleccionar zona → una capa por monitor → arrastre dentro de un monitor → cerrar capas → captura en memoria del monitor identificado → recorte con relación píxeles/DIP → vista previa y OCR → revisión del usuario.
- Seguridad: IPC restringido a ventanas autorizadas; selector sin red; no persistir capturas completas; no capturar hasta confirmar selección; cancelar con Escape, cierre o tiempo límite. Conservar bloqueo de Ollama.
- Validación: 14 pruebas automatizadas aprobadas. Paquete 1.1.0 descomprimido probado sin Node en PATH: selección, recorte a 200%, OCR, uso del texto, cancelación con Esc, IPC autorizado y las comprobaciones previas, todo con datos ficticios. La prueba física no mostró el panel esperado y se descartó el recorte; queda pendiente comprobar manualmente varias pantallas físicas. Cinco reglas de firewall verificadas nuevamente en Windows.
- Riesgo: medio por DPI y varios monitores. El rectángulo se limita al monitor donde comienza el arrastre.
- Entrega: portable y ZIP 1.1.0 generados; portable final probado sin Node en PATH con todas las comprobaciones positivas y cierre correcto. Enlaces del README y hashes comprobados. SHA-256 portable: 87fa8b6ba05506e0a45683ab037d4adae5ed04337c360b45486ffa0c069b3f72. ZIP: 5bb7366813783ea78aed9ce1b5f2272728e9f7258ecf562605572544699a6a2d. Sin publicación externa.
