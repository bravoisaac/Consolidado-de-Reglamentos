# Trabajar en Folio

- Lee `MAPA.md` para identificar el flujo afectado y `MANUAL-IA.md` para instalar, ejecutar, probar o distribuir la aplicación.
- La IA no debe tener Internet. Conserva la verificación obligatoria del firewall, las reglas de Ollama y la comunicación por loopback. No uses `ollama pull`, modelos cloud ni proxies como solución.
- No abras ni subas reglamentos reales para probar. Usa datos ficticios en una biblioteca separada. No incluyas `data/`, modelos, capturas ni otras carpetas privadas en paquetes de distribución.
- El paquete se genera con `npm run dist` y su lista explícita de archivos. No comprimas toda la carpeta de trabajo. Comprueba los archivos descargables y sus hashes antes de enlazarlos.
- Tras cambios de ejecución, ejecuta `npm test` y las comprobaciones pertinentes del manual. Describe con precisión las pruebas y los pendientes; no declares aplicado un bloqueo ni publicada una descarga sin verificarlo.
