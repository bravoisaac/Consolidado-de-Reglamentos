const $ = selector => document.querySelector(selector);
const csrf = $('meta[name="csrf-token"]').content;
if (window.folioDesktop) $('#storage-description').textContent = 'Los originales y el índice se guardan en %LOCALAPPDATA%\\Folio\\data. Abre esa carpeta desde el menú Folio. Puedes eliminar documentos desde la biblioteca.';
if (window.folioDesktop?.captureRegion) { $('#capture').textContent = '▣ Seleccionar zona'; $('#capture-window').hidden = false; }
let busy = false, toastTimer, previewUrl, stopImport = false;
function notice(message) {
  $('#status').textContent = message; $('#status').hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { $('#status').hidden = true; }, 8500);
}
function element(tag, className, text) { const el = document.createElement(tag); if (className) el.className = className; if (text !== undefined) el.textContent = text; return el; }
function setBusy(value) {
  busy = value;
  window.folioDesktop?.setBusy(value).catch(() => {});
  for (const selector of ['#send', '#capture', '#capture-window', '#upload', '#upload-folder', '#ai', '#image-upload', '#clear', '.delete-document']) document.querySelectorAll(selector).forEach(el => { el.disabled = value; });
  $('#send').textContent = value ? 'Procesando…' : 'Consultar ↗';
}
async function api(route, data, method = 'POST') {
  const response = await fetch(route, { method, headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf }, body: data === undefined ? undefined : JSON.stringify(data) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'No se pudo completar la solicitud.');
  return result;
}
async function refresh() {
  const { documents } = await api('/api/documents', undefined, 'GET');
  const scope = $('#scope').value;
  $('#documents').replaceChildren(); $('#scope').replaceChildren(new Option('Toda la biblioteca', ''));
  $('#doc-count').textContent = documents.length;
  if (!documents.length) $('#documents').append(element('p', 'empty-library', 'Todavía no hay reglamentos.\nAgrega el primero para comenzar.'));
  for (const doc of documents) {
    const row = element('div', 'document-item');
    row.append(element('span', 'file-icon', doc.kind.toUpperCase()));
    const info = element('div');
    const link = element('a', '', doc.name); link.href = `/documents/${doc.id}`; link.target = '_blank'; link.rel = 'noopener noreferrer';
    info.append(link, element('small', '', `${doc.passages} pasajes · ${(doc.bytes / 1024).toFixed(0)} KB`));
    if (doc.warnings.length) { const warning = element('small', 'warning', '⚠ Páginas sin texto'); warning.title = doc.warnings.join('\n'); info.append(warning); }
    const remove = element('button', 'delete-document', '×'); remove.setAttribute('aria-label', `Eliminar ${doc.name}`);
    remove.addEventListener('click', async () => {
      if (busy || !confirm(`¿Eliminar la copia local de «${doc.name}» y sus pasajes? El archivo del que lo importaste no se modifica.`)) return;
      setBusy(true);
      try { await api(`/api/documents/${doc.id}`, undefined, 'DELETE'); await refresh(); notice('Documento eliminado de la biblioteca.'); }
      catch (error) { notice(error.message); } finally { setBusy(false); }
    });
    row.append(info, remove); $('#documents').append(row); $('#scope').add(new Option(doc.name, doc.id));
  }
  if (documents.some(d => d.id === scope)) $('#scope').value = scope;
}
function base64(file) { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result.split(',')[1]); reader.onerror = () => reject(new Error('No se pudo leer el archivo.')); reader.readAsDataURL(file); }); }
$('#upload').addEventListener('click', () => $('#files').click());
$('#upload-folder').addEventListener('click', () => {
  if (!('webkitdirectory' in $('#folder-files'))) return notice('Este navegador no permite seleccionar carpetas. Abre Folio en Edge o Chrome, o usa Agregar reglamentos.');
  $('#folder-files').click();
});
$('#stop-import').addEventListener('click', () => {
  stopImport = true;
  $('#stop-import').disabled = true;
  $('#stop-import').textContent = 'Deteniendo al terminar el archivo actual…';
});
async function importFiles(event) {
  const files = Array.from(event.target.files || []);
  if (busy || !files.length) { event.target.value = ''; return; }
  setBusy(true); stopImport = false;
  let count = 0, duplicates = 0, unsupported = 0, errors = 0, completed = 0;
  const folder = files[0].webkitRelativePath?.split('/')[0];
  $('#import-panel').hidden = false;
  $('#import-title').textContent = folder ? `Carpeta: ${folder}` : 'Archivos seleccionados';
  $('#import-progress').max = files.length; $('#import-progress').value = 0;
  $('#import-details').hidden = true; $('#import-details').open = false; $('#import-issues').replaceChildren();
  $('#stop-import').hidden = false; $('#stop-import').disabled = false; $('#stop-import').textContent = 'Detener después de este archivo';
  const issue = text => { $('#import-details').hidden = false; $('#import-issues').append(element('li', '', text)); };
  try {
    for (const file of files) {
      if (stopImport) break;
      const label = file.webkitRelativePath || file.name;
      $('#import-status').textContent = `Revisando ${completed + 1} de ${files.length}: ${label}`;
      if (!/\.(pdf|docx|txt|md)$/i.test(file.name)) { unsupported++; }
      else if (file.name.startsWith('~$')) { unsupported++; }
      else if (file.size > 15 * 1024 * 1024) { errors++; issue(`${label}: supera el límite de 15 MB.`); }
      else {
        try {
          const { document } = await api('/api/documents', { name: file.name, data: await base64(file) });
          count++;
          if (document.warnings.length) issue(`${label}: importado con advertencias. ${document.warnings.join(' ')}`);
        } catch (error) {
          if (error.message === 'Este documento ya está en la biblioteca.') { duplicates++; issue(`${label}: ya estaba cargado; se omitió la copia.`); }
          else { errors++; issue(`${label}: ${error.message}`); }
        }
      }
      completed++; $('#import-progress').value = completed;
      // Yield even when many unsupported files are skipped so the stop button remains usable.
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    await refresh();
  } catch (error) { issue(`No se pudo actualizar la biblioteca: ${error.message}`); }
  finally {
    const pending = files.length - completed;
    const summary = `${count} importados · ${duplicates} duplicados · ${unsupported} no compatibles o temporales · ${errors} con error${pending ? ` · ${pending} pendientes` : ''}.`;
    $('#import-status').textContent = `${pending ? 'Importación detenida.' : 'Importación finalizada.'} ${summary}`;
    $('#stop-import').hidden = true;
    notice(count ? `Se agregaron ${count} reglamentos. Revisa el resumen de importación.` : 'No se agregaron documentos nuevos. Revisa el resumen de importación.');
    event.target.value = ''; setBusy(false);
  }
}
$('#files').addEventListener('change', importFiles);
$('#folder-files').addEventListener('change', importFiles);
function appendMessage(text, type) {
  $('#welcome').hidden = true;
  const message = element('div', `message message-${type}`);
  message.append(element('span', 'message-label', type === 'user' ? 'Tu consulta' : 'Folio · búsqueda con fuentes'), element('div', 'message-text', text));
  $('#conversation').append(message); message.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  return message;
}
function appendSources(message, sources) {
  for (const source of sources) {
    const card = element('section', 'source-card');
    const link = element('a', 'source-title', `[${source.citation}] ${source.name} ↗`); link.href = source.href; link.target = '_blank'; link.rel = 'noopener noreferrer';
    card.append(link, element('p', 'source-location', `${source.location.label} · Pasaje ${source.index + 1}`));
    if (source.text.length > 650) {
      card.append(element('blockquote', '', source.text.slice(0, 650) + '…'));
      const details = element('details'); details.append(element('summary', '', 'Ver pasaje completo'), element('blockquote', '', source.text)); card.append(details);
    } else card.append(element('blockquote', '', source.text));
    message.append(card);
  }
}
$('#ask-form').addEventListener('submit', async event => {
  event.preventDefault(); if (busy) return;
  const question = $('#question').value.trim(); if (!question) return $('#question').focus();
  if (!Number($('#doc-count').textContent)) return notice('Agrega al menos un reglamento para consultar.');
  const input = { question, documentId: $('#scope').value, mode: $('#ai').checked ? 'ai' : 'search', model: $('#model').value };
  appendMessage(question, 'user'); $('#question').value = ''; setBusy(true);
  const response = appendMessage(input.mode === 'ai' ? 'Buscando fuentes y preparando el borrador local. Puede tardar unos minutos…' : 'Buscando en tus reglamentos…', 'ai');
  try {
    const result = await api('/api/ask', input);
    response.querySelector('.message-text').textContent = result.answer;
    response.querySelector('.message-label').textContent = result.mode === 'ai' ? 'Folio · borrador de IA local · verifica las fuentes' : 'Folio · pasajes del reglamento';
    if (result.warning) response.append(element('p', 'warning', result.warning));
    appendSources(response, result.sources);
    response.scrollIntoView({ block: 'start', behavior: 'smooth' });
  } catch (error) { response.querySelector('.message-text').textContent = error.message; $('#question').value = question; }
  finally { setBusy(false); }
});
$('#question').addEventListener('keydown', event => { if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) $('#ask-form').requestSubmit(); });
$('#ai').addEventListener('change', async event => {
  const enabled = event.target.checked; $('#model-row').hidden = !enabled;
  if (!enabled) { $('#mode-label').textContent = 'BÚSQUEDA LOCAL'; return; }
  setBusy(true); notice('Verificando el bloqueo de Internet de Ollama en Windows…');
  try {
    const { models } = await api('/api/models', {});
    if (!models.length) throw new Error('No se encontraron modelos locales descargados. Puedes usar el buscador.');
    $('#model').replaceChildren(...models.map(name => new Option(name, name)));
    const preferred = models.find(name => name.startsWith('qwen')); if (preferred) $('#model').value = preferred;
    $('#mode-label').textContent = 'IA LOCAL · OLLAMA'; notice('Bloqueo de Internet verificado. IA local disponible.');
  } catch (error) { $('#ai').checked = false; $('#model-row').hidden = true; notice(error.message); }
  finally { setBusy(false); }
});
$('#clear').addEventListener('click', () => {
  document.querySelectorAll('.message').forEach(el => el.remove()); $('#welcome').hidden = false; $('#question').value = ''; $('#question').focus();
});
async function readCapture(blob) {
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = URL.createObjectURL(blob); $('#capture-preview').src = previewUrl;
  $('#ocr-text').value = ''; $('#ocr-state').textContent = 'Leyendo texto con el OCR de Windows…'; $('#use-ocr').disabled = true;
  $('#capture-dialog').showModal(); setBusy(true);
  try {
    const result = await api('/api/ocr', { data: await base64(blob) });
    $('#ocr-text').value = result.text.slice(0, 8000);
    $('#ocr-state').textContent = result.text.trim() ? `Texto detectado (${result.language}). Revísalo y corrígelo antes de usarlo.${result.text.length > 8000 ? ' Se muestran los primeros 8.000 caracteres.' : ''}` : 'No se encontró texto. Puedes escribirlo o intentar con una captura más nítida.';
  } catch (error) { $('#ocr-state').textContent = error.message; }
  finally { $('#use-ocr').disabled = false; setBusy(false); }
}
$('#capture').addEventListener('click', async () => {
  if (window.folioDesktop?.captureRegion) {
    if (busy) return;
    setBusy(true);
    try {
      const data = await window.folioDesktop.captureRegion();
      if (data) await readCapture(new Blob([Uint8Array.from(atob(data), c => c.charCodeAt(0))], { type: 'image/png' }));
    } catch { notice('No se pudo leer esa zona. Vuelve a seleccionar dentro de una sola pantalla o carga una captura PNG.'); }
    finally { setBusy(false); }
    return;
  }
  let stream;
  try {
    if (!navigator.mediaDevices?.getDisplayMedia) { notice('Este navegador no permite capturar ventanas. Selecciona una imagen PNG.'); return $('#image-file').click(); }
    stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
    const video = document.createElement('video'); video.srcObject = stream; video.muted = true; await video.play();
    await new Promise(resolve => video.requestVideoFrameCallback ? video.requestVideoFrameCallback(resolve) : setTimeout(resolve, 250));
    const canvas = document.createElement('canvas');
    const scale = Math.min(1, 3500 / Math.max(video.videoWidth, video.videoHeight));
    canvas.width = Math.round(video.videoWidth * scale); canvas.height = Math.round(video.videoHeight * scale);
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    stream.getTracks().forEach(track => track.stop()); video.srcObject = null;
    if (!blob) throw new Error('No se pudo crear la captura.');
    await readCapture(blob);
  } catch (error) { if (error.name !== 'NotAllowedError') notice('No se pudo capturar la pantalla. Puedes cargar una captura PNG.'); }
  finally { stream?.getTracks().forEach(track => track.stop()); }
});
$('#capture-window').addEventListener('click', async () => {
  if (busy || !window.folioDesktop) return;
  try {
    const sources = await window.folioDesktop.captureSources();
    if (!sources.length) return notice('No hay ventanas disponibles. Puedes cargar una imagen PNG.');
    $('#desktop-source').replaceChildren(...sources.map(source => new Option(source.name, source.id)));
    $('#desktop-capture-dialog').showModal();
  } catch { notice('No se pudieron listar las ventanas. Puedes cargar una captura PNG.'); }
});
$('#cancel-desktop-capture').addEventListener('click', () => $('#desktop-capture-dialog').close());
$('#take-desktop-capture').addEventListener('click', async () => {
  const id = $('#desktop-source').value;
  $('#desktop-capture-dialog').close();
  setBusy(true);
  try {
    const data = await window.folioDesktop.capture(id);
    await readCapture(new Blob([Uint8Array.from(atob(data), c => c.charCodeAt(0))], { type: 'image/png' }));
  } catch { notice('No se pudo capturar esa ventana. Selecciónala nuevamente o carga una imagen PNG.'); }
  finally { setBusy(false); }
});
$('#image-upload').addEventListener('click', () => $('#image-file').click());
$('#image-file').addEventListener('change', async event => { const file = event.target.files[0]; if (file) { if (file.size > 15 * 1024 * 1024) notice('La imagen supera 15 MB.'); else await readCapture(file); } event.target.value = ''; });
$('#close-capture').addEventListener('click', () => $('#capture-dialog').close());
$('#capture-dialog').addEventListener('close', () => { if (previewUrl) URL.revokeObjectURL(previewUrl); previewUrl = undefined; $('#capture-preview').removeAttribute('src'); $('#ocr-text').value = ''; });
$('#use-ocr').addEventListener('click', () => { const text = $('#ocr-text').value.trim(); if (!text) return notice('Escribe o corrige el texto primero.'); $('#question').value = text; $('#capture-dialog').close(); $('#question').focus(); });
$('#privacy').addEventListener('click', () => $('#privacy-dialog').showModal());
$('#close-privacy').addEventListener('click', () => $('#privacy-dialog').close());
if (window.folioDesktop?.minimize) {
  $('#minimize-pet').hidden = false;
  $('#minimize-pet').addEventListener('click', () => window.folioDesktop.minimize().catch(() => notice('No se pudo minimizar Folio.')));
  window.folioDesktop.onAction(async action => {
    try {
      if (action === 'capture' && !busy && !document.querySelector('dialog[open]')) {
        $('#capture').click();
        return;
      }
      await window.folioDesktop.show();
      if (document.querySelector('dialog[open]')) return;
      if (action === 'capture') return notice('Espera a que termine la operación actual para capturar.');
      const target = action === 'library' ? $('#upload') : $('#question');
      target.scrollIntoView({ block: 'center', behavior: 'smooth' }); target.focus();
    } catch { notice('No se pudo abrir la acción de la mascota.'); }
  });
}
refresh().catch(error => notice(error.message));
