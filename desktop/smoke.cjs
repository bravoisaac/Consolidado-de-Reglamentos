const fs = require('node:fs');
const path = require('node:path');
function pdf() {
  const stream = 'BT /F1 14 Tf 60 700 Td (Reglamento de prueba. El horario de ingreso es a las nueve de la manana.) Tj ET';
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`];
  let result = '%PDF-1.4\n'; const offsets = [];
  objects.forEach((obj,i) => { offsets.push(Buffer.byteLength(result)); result += `${i+1} 0 obj\n${obj}\nendobj\n`; });
  const xref = Buffer.byteLength(result);
  result += `xref\n0 6\n0000000000 65535 f \n${offsets.map(n => String(n).padStart(10,'0') + ' 00000 n \n').join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(result).toString('base64');
}
exports.runSmokeTest = async ({ mainWindow, localRoot, pet }) => {
  const result = await mainWindow.webContents.executeJavaScript(`(async () => {
    const assert = (condition, message) => { if (!condition) throw new Error(message); };
    assert(typeof process === 'undefined' && typeof require === 'undefined', 'Node expuesto en interfaz');
    assert(!!window.folioDesktop, 'Falta puente de captura');
    const csrf = document.querySelector('meta[name="csrf-token"]').content;
    const call = async (route, body, method = 'POST') => {
      const response = await fetch(route,{method,headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},body:body===undefined?undefined:JSON.stringify(body)});
      const data = await response.json(); assert(response.ok, data.error || 'Error HTTP'); return data;
    };
    const loaded = await call('/api/documents',{name:'Prueba escritorio.pdf', data:${JSON.stringify(pdf())}});
    const answer = await call('/api/ask',{question:'¿Cuál es el horario de ingreso?', mode:'search'});
    assert(answer.sources.length > 0, 'Sin fuentes');
    assert(answer.sources[0].location.number === 1 && answer.sources[0].href.endsWith('#page=1'), 'Página incorrecta');
    const original = await fetch(answer.sources[0].href); assert(original.ok, 'Original inaccesible');
    await refresh();
    document.querySelector('#question').value = '¿Cuál es el horario de ingreso?';
    document.querySelector('#ask-form').requestSubmit();
    for(let i=0; i<100 && !document.querySelector('.source-card'); i++) await new Promise(r=>setTimeout(r,100));
    assert(!!document.querySelector('.source-card'), 'Sin cita visible');
    let remoteBlocked = false; try { await fetch('https://folio-test.invalid/'); } catch { remoteBlocked = true; }
    assert(remoteBlocked, 'Solicitud externa permitida');
    await call('/api/documents/'+loaded.document.id,undefined,'DELETE');
    return {ok:true,rendererIsolated:true,bundledExtraction:true,pdfCitation:true,originalLink:true,remoteBlocked:true,documentsCleaned:true};
  })()`);
  Object.assign(result, await require('./region-smoke.cjs').run(mainWindow));
  Object.assign(result, await require('./pet-smoke.cjs').run(mainWindow, pet, localRoot));
  fs.writeFileSync(path.join(localRoot, 'smoke-result.json'), JSON.stringify(result, null, 2));
  await new Promise(resolve => setTimeout(resolve, 1500));
  try {
    fs.writeFileSync(path.join(localRoot, 'smoke-view.png'), (await mainWindow.webContents.capturePage(undefined, { stayHidden: true, stayAwake: true })).toPNG());
    result.screenshot = true;
  } catch (error) { result.screenshot = false; result.screenshotError = error.message; }
  fs.writeFileSync(path.join(localRoot, 'smoke-result.json'), JSON.stringify(result, null, 2));
};
