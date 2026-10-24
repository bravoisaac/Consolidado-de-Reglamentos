# Manual para agentes: instalar, ejecutar y distribuir Folio

Este archivo es el procedimiento operativo para una IA que reciba autorización del propietario para preparar Folio en Windows. No publiques el proyecto ni sus documentos. Usa únicamente datos ficticios en las pruebas. La autorización de instalación no permite leer reglamentos ajenos al trabajo ni subirlos a servicios externos.

## 1. Reglas que se deben conservar

- La IA de Ollama debe permanecer sin acceso a Internet. No desactives, borres ni reduzcas las reglas `Folio-Ollama-Offline-*` para resolver un error.
- No ejecutes `ollama pull`, no uses modelos cloud, no configures proxies para Ollama y no sustituyas `127.0.0.1` por un servidor remoto.
- Folio verifica el firewall antes de iniciar el motor y antes de enviarle pasajes. Un fallo de verificación es un bloqueo deliberado; corrige su causa y verifica otra vez.
- Las descargas de instaladores y paquetes las realizan WinGet/npm, durante la preparación y sin documentos del usuario. No son consultas de IA. En un entorno aislado, aprovisiona instaladores, paquete y modelo mediante un medio aprobado.
- Nunca incluyas `data/`, `%LOCALAPPDATA%\Folio\data`, `.env`, capturas, historiales, `output/`, `.git` o modelos personales en un archivo distribuible.
- No cambies políticas globales de ejecución, no desactives Defender/SmartScreen ni el firewall y no intentes aprobar UAC por el usuario.
- Usa PowerShell y rutas literales. No borres ni muevas recursivamente datos del usuario. El archivo de descarga debe existir antes de presentarlo como disponible.

## 2. Elegir cómo ejecutar

| Modalidad | Qué necesita | Inicio | Biblioteca |
|---|---|---|---|
| Escritorio descargable | Windows 10/11 x64; paquete Folio | `Folio-1.0.0-portable-x64.exe` o extraer ZIP y abrir `Folio.exe` | `%LOCALAPPDATA%\Folio\data` |
| Escritorio desde fuentes | Node.js ≥22.13, npm y dependencias fijadas | `npm run desktop` | `%LOCALAPPDATA%\Folio\data` |
| Navegador local desde fuentes | Node.js ≥22.13 y dependencias | `npm start` o `iniciar.cmd` | `data/` junto a las fuentes |

El paquete de escritorio incluye Chromium y su motor Node mediante Electron. No requiere Node, npm, Python, Java, Docker ni Visual Studio instalados para ejecutarse. La búsqueda no requiere Ollama. La IA opcional necesita Ollama, un modelo descargado y el bloqueo de firewall verificado. El OCR de capturas usa Windows.Media.Ocr y un idioma OCR de Windows. No instala Tesseract.

No migres automáticamente la biblioteca de la versión de navegador a la de escritorio. Usa **Agregar carpeta** con autorización del usuario o conserva las bibliotecas separadas. Los enlaces al original funcionan mientras esa instancia de Folio esté abierta; la versión de escritorio usa un puerto local dinámico.

## 3. Comprobar el equipo sin modificarlo

Desde la carpeta de fuentes:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\setup-windows.ps1 -Mode Check
```

El diagnóstico JSON informa Node, dependencias, Ollama, idiomas OCR y verificación del firewall. No imprime documentos ni secretos. `false` no equivale a una instalación completa. Revisa cada campo según la modalidad elegida. El script de instalación de desarrollo también prepara el binario de Electron; no basta con que exista su paquete JavaScript.

Comprobaciones adicionales:

```powershell
Get-Command node.exe,npm.cmd,ollama.exe,winget.exe -ErrorAction SilentlyContinue
Get-NetFirewallProfile -PolicyStore ActiveStore | Select-Object Name,Enabled
```

## 4. Instalar dependencias de desarrollo

Solo es necesario para trabajar desde el código o generar otra versión. La instalación requiere acceso a los repositorios oficiales y puede solicitar permisos de Windows.

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\setup-windows.ps1 -Mode Install -Development
```

Si falta Node, el script usa `winget install --id OpenJS.NodeJS.LTS --exact --source winget`. Después ejecuta `npm ci` usando `package-lock.json`; no actualiza versiones deliberadamente. Si Node existe pero es anterior a 22.13, actualízalo primero mediante el instalador oficial y vuelve a comprobarlo.

Alternativa manual:

```powershell
node --version
npm --version
npm ci --no-audit --no-fund
node node_modules/electron/install.js
npm test
npm run desktop
```

Dependencias directas de ejecución: `pdf-parse` y `mammoth`. Dependencias de empaquetado: `electron` y `electron-builder`. Las versiones exactas están fijadas en `package.json` y `package-lock.json`.

Si WinGet no está disponible, usa [Node.js oficial](https://nodejs.org/en/download) y [Ollama oficial](https://ollama.com/download/windows). No inventes enlaces de instaladores ni ejecutes scripts descargados de fuentes desconocidas. En otra arquitectura o sistema operativo, no declares compatible el paquete x64 de Windows sin recompilar y probar.

## 5. Preparar la IA sin darle Internet

Si Ollama falta, puede instalarse con:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\setup-windows.ps1 -Mode Install -WithAI
```

Este comando instala el programa mediante WinGet y no descarga modelos. Aplica el bloqueo antes de usarlo con documentos. No habilites la IA hasta que la verificación sea positiva.

### Aplicar y verificar firewall

En una consola de PowerShell **ejecutada como administrador**:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\ollama-firewall.ps1 -Mode Install
```

Sin privilegios de administrador, puede usarse el clic derecho **Ejecutar como administrador** de `bloquear-internet-ia.cmd`. En la app descargada: menú **Folio → Configurar bloqueo de Internet de la IA…**. La solicitud UAC la acepta la persona; si no se aprueba, informa que la IA sigue deshabilitada y conserva la búsqueda local.

Verificación posterior:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\ollama-firewall.ps1 -Mode Verify
```

Solo `"verified": true` confirma que las reglas esperadas están activas. El script cubre todos los `.exe` de la instalación de Ollama, todos los perfiles/protocolos y direcciones fuera de loopback. También afecta a otras sesiones de esa instalación y bloquea descargas de modelos. Si se actualiza Ollama y cambian sus ejecutables, reaplica las reglas y verifica; no ignores el error.

### Modelos

Usa preferentemente los modelos locales existentes, que aparecen al activar **IA local**. En el equipo de desarrollo se verificó `qwen3.5:4b-q4_K_M`; otro equipo puede no tenerlo.

Si no hay modelos, pide al propietario un **GGUF local obtenido por un medio aprobado**. No se incluye ningún modelo en el instalador. Para importar el GGUF, usa Ollama con el firewall ya aplicado y una conexión estrictamente local. Ejemplo, ajustando una ruta real autorizada:

```powershell
$folioModelPath = (Resolve-Path -LiteralPath 'C:\Modelos\modelo.gguf').Path
if ($folioModelPath.Contains('"') -or $folioModelPath.Contains("`n")) { throw 'Ruta no admitida' }
$folioModelfile = Join-Path $env:TEMP 'Folio-Modelfile'
[IO.File]::WriteAllText($folioModelfile, 'FROM "' + $folioModelPath + '"', [Text.UTF8Encoding]::new($false))
$env:OLLAMA_HOST = '127.0.0.1:11434'
$env:OLLAMA_NO_CLOUD = '1'
ollama create folio-local -f $folioModelfile
Remove-Item -LiteralPath $folioModelfile
```

El servicio local de Ollama debe estar iniciado. Si no lo está, inicia `ollama serve` con `OLLAMA_HOST=127.0.0.1:11434` y `OLLAMA_NO_CLOUD=1`, manteniendo las reglas. Verifica el resultado de `ollama create`; el modelo debe ser compatible con la versión de Ollama. No uses `FROM nombre-remoto` ni comandos que descarguen un modelo. El agente debe informar claramente cuando falta el archivo GGUF y no declarar lista la IA.

## 6. Preparar OCR

El diagnóstico muestra los idiomas disponibles. Si falta español, un administrador puede ejecutar:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\setup-windows.ps1 -Mode Install -InstallSpanishOcr
```

Esto instala la capacidad `Language.OCR~~~es-ES~0.0.1.0` desde Windows Update. No desactives controles corporativos si la instalación está restringida. En ese caso informa el pendiente; el usuario puede pegar texto manualmente. Los PDF escaneados aún necesitan una capa OCR previa: el OCR integrado se usa para capturas, no para convertir automáticamente todos los PDF.

## 7. Construir el archivo descargable

Desde fuentes con dependencias instaladas:

```powershell
npm test
npm run dist
```

El empaquetado puede descargar componentes de Electron/NSIS; no se publican archivos en Internet (`--publish never`). Produce:

- `dist/Folio-1.0.0-portable-x64.exe`: abre Folio sin instalación tradicional.
- `dist/Folio-1.0.0-win-x64.zip`: extraer completamente y ejecutar `Folio.exe`; no ejecutar el EXE dentro del ZIP.
- `dist/SHA256SUMS.txt`: hashes SHA-256 de los paquetes.
- `dist/MANUAL-IA.md`: copia de este manual.

`scripts/release.mjs` revisa la raíz de los archivos empaquetados y rechaza carpetas privadas o de pruebas. No empaquetes toda la carpeta del proyecto manualmente. Actualiza los nombres del README si cambias la versión. El botón de descarga usa archivos locales reales; no hay una publicación pública ni enlace de GitHub Releases a menos que el propietario la solicite.

Verifica integridad:

```powershell
Get-FileHash -Algorithm SHA256 -LiteralPath .\dist\Folio-1.0.0-portable-x64.exe
Get-Content -LiteralPath .\dist\SHA256SUMS.txt
```

El hash detecta diferencias con el archivo generado; no reemplaza una firma de editor. Esta distribución no cuenta con certificado de firma de código. Windows puede advertir sobre un editor desconocido. No desactives SmartScreen; en equipos administrados sigue el procedimiento de TI.

## 8. Verificación funcional con datos ficticios

1. Abrir el ejecutable y comprobar que no requiere navegador externo ni Node del sistema.
2. Importar un PDF con texto, un DOCX y una carpeta pequeña de prueba. Verificar duplicados, errores y número de documentos.
3. Preguntar por un dato literal de la prueba. Revisar pasaje, página/párrafo y apertura del original.
4. Cargar un PNG ficticio y revisar su OCR. La captura de ventanas requiere selección explícita; nunca captures correos reales sin autorización.
5. Activar IA local: debe habilitarse solo si el firewall se verifica y existe un modelo. Probar una consulta ficticia y revisar sus citas.
6. Cerrar Folio y comprobar que termina su servidor y su proceso privado de Ollama. No cierres el Ollama habitual del usuario ni otros proyectos.
7. Conservar la biblioteca del usuario; las pruebas deben usar carpetas separadas.

Prueba automática del paquete en una carpeta temporal independiente:

```powershell
$env:FOLIO_SMOKE_DIR = Join-Path (Get-Location) 'output\desktop-smoke'
New-Item -ItemType Directory -Force -Path $env:FOLIO_SMOKE_DIR | Out-Null
$folioTest = Start-Process -FilePath '.\dist\win-unpacked\Folio.exe' -ArgumentList '--smoke-test' -WindowStyle Hidden -PassThru
$folioTest.WaitForExit(60000)
Get-Content -LiteralPath (Join-Path $env:FOLIO_SMOKE_DIR 'smoke-result.json')
Remove-Item Env:\FOLIO_SMOKE_DIR
```

La prueba usa un PDF sintético, comprueba el aislamiento del renderer, extracción con el motor incluido, cita de página, enlace y rechazo de peticiones externas desde la ventana. Elimina su documento de prueba y cierra la app. No prueba un modelo nuevo ni sustituye la verificación de firewall de Ollama. Revisa `ok:true`; la existencia del archivo por sí sola no demuestra éxito.

## 9. Errores frecuentes

| Síntoma | Acción |
|---|---|
| IA no habilitada | Ejecutar Verify; revisar permisos, firewall activo, ejecutables nuevos o reglas de empresa. No saltar la comprobación. |
| No hay modelos locales | Proporcionar GGUF autorizado o usar búsqueda. No ejecutar `ollama pull`. |
| Puerto privado 11439 ocupado | Cerrar la otra instancia de Folio que usa IA. No terminar procesos desconocidos. |
| PDF sin texto | Preparar OCR previamente o usar documento con capa de texto. |
| Captura no disponible | Cargar PNG o pegar texto; revisar idioma OCR. |
| App de escritorio muestra biblioteca vacía | Es independiente de `data/` de la versión web; importar documentos con autorización. |
| No se instala una dependencia | Guardar código de error y usar repositorio oficial; no rebajar seguridad ni introducir instaladores desconocidos. |
| Fallo de empaquetado | Conservar originales y biblioteca; revisar el error de Electron/NSIS y repetir solo la generación de `dist/`. |

## 10. Entrega del agente

Reporta la ruta y hash del paquete, dependencias detectadas/instaladas, resultado del firewall, disponibilidad de modelos y OCR, pruebas ejecutadas y pendientes concretos. Nunca afirmes que el bloqueo está activo sin una verificación positiva, ni que la app está publicada cuando solo existe un archivo local.

Fuentes técnicas: [Electron: seguridad](https://www.electronjs.org/docs/latest/tutorial/security), [Electron: motor Node incluido](https://www.electronjs.org/docs/latest/api/environment-variables/), [electron-builder para Windows](https://www.electron.build/docs/win/), [WinGet install](https://learn.microsoft.com/en-us/windows/package-manager/winget/install), [Windows Firewall](https://learn.microsoft.com/en-us/powershell/module/netsecurity/new-netfirewallrule).
