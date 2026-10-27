const { BrowserWindow, ipcMain, nativeImage } = require('electron');
const { createCanvas } = require('@napi-rs/canvas');
let captureCalls = 0;
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const assert = (condition, message) => { if (!condition) throw new Error(message); };
function options() {
  captureCalls = 0;
  const canvas = createCanvas(1600,1200), ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0,0,1600,1200);
  ctx.fillStyle = '#000000'; ctx.font = '48px Arial'; ctx.fillText('VACACIONES QUINCE DIAS',220,275);
  const image = nativeImage.createFromBuffer(canvas.toBuffer('image/png'));
  return {
    getDisplays: () => [{id:987654321,bounds:{x:40,y:40,width:800,height:600},scaleFactor:2}],
    getSources: async () => { captureCalls++; return [{display_id:'987654321',thumbnail:image}]; },
    settleMs: 20
  };
}
async function overlay() {
  for (let i=0;i<100;i++) {
    const window = BrowserWindow.getAllWindows().find(win => win.webContents.getURL().endsWith('/region.html'));
    if (window && !window.webContents.isLoadingMainFrame()) { await pause(200); return window; }
    await pause(50);
  }
  throw new Error('No se abrió el selector de zona.');
}
async function drag(window, x, y, width, height) {
  window.webContents.sendInputEvent({type:'mouseDown',x,y,button:'left',clickCount:1});
  await pause(60);
  window.webContents.sendInputEvent({type:'mouseMove',x:x+width,y:y+height,button:'left'});
  await pause(60);
  window.webContents.sendInputEvent({type:'mouseUp',x:x+width,y:y+height,button:'left',clickCount:1});
}
async function run(mainWindow, pet) {
  const initialCalls = captureCalls;
  const begin = async () => {
    if (pet) {
      await mainWindow.webContents.executeJavaScript('window.folioDesktop.minimize()');
      for (let i=0;i<50 && !pet.window.isVisible();i++) await pause(50);
      assert(mainWindow.isMinimized() && pet.window.isVisible(), 'La mascota no apareció al minimizar.');
      await pet.window.webContents.executeJavaScript('document.querySelector("#quick-capture").click()');
    } else await mainWindow.webContents.executeJavaScript('document.querySelector("#capture").click()');
  };
  await begin();
  let selection = await overlay();
  assert(!mainWindow.isVisible(),'Folio no se ocultó durante la selección.');
  if (pet) assert(!pet.window.isVisible(), 'La mascota quedó visible durante la captura.');
  ipcMain.emit('folio-region:finish',{sender:mainWindow.webContents,senderFrame:mainWindow.webContents.mainFrame},{x:0,y:0,width:500,height:200});
  await pause(100);
  assert(captureCalls === initialCalls && !selection.isDestroyed(),'Se aceptó una selección de una ventana no autorizada.');
  await drag(selection,100,100,500,180);
  let state;
  for (let i=0;i<200;i++) {
    state = await mainWindow.webContents.executeJavaScript(`({open:document.querySelector('#capture-dialog').open,text:document.querySelector('#ocr-text').value,width:document.querySelector('#capture-preview').naturalWidth,height:document.querySelector('#capture-preview').naturalHeight,status:document.querySelector('#ocr-state').textContent,busy:document.querySelector('#send').disabled})`);
    if (state.open && !state.busy) break;
    await pause(100);
  }
  assert(state?.width === 1000 && state?.height === 360,'El recorte no coincide con la zona seleccionada a escala 200%.');
  assert(/VACACIONES\s+QUINCE\s+DIAS/i.test(state.text),`OCR del recorte ficticio no reconocido: ${state.status}`);
  assert(captureCalls === initialCalls + 1 && mainWindow.isVisible() && !mainWindow.isMinimized(),'No se restauró Folio o se capturó más de una vez.');
  if (pet) assert(!pet.window.isVisible(), 'La mascota no se ocultó al restaurar Folio.');
  await mainWindow.webContents.executeJavaScript('document.querySelector("#use-ocr").click()');
  const question = await mainWindow.webContents.executeJavaScript('document.querySelector("#question").value');
  assert(/VACACIONES/.test(question),'No se pudo usar el texto revisado.');
  await begin();
  selection = await overlay();
  await drag(selection,50,50,2,2);
  assert(!selection.isDestroyed() && captureCalls === initialCalls + 1,'Se capturó un rectángulo demasiado pequeño.');
  selection.webContents.sendInputEvent({type:'keyDown',keyCode:'ESC'});
  selection.webContents.sendInputEvent({type:'keyUp',keyCode:'ESC'});
  for (let i=0;i<50 && !mainWindow.isVisible();i++) await pause(50);
  assert(mainWindow.isVisible() && selection.isDestroyed() && captureCalls === initialCalls + 1,'Escape no canceló sin capturar.');
  assert(await mainWindow.webContents.executeJavaScript('document.querySelector("#question").value') === question,'Cancelar alteró la pregunta.');
  return {regionSelection:true,regionDpi:true,regionOcr:true,regionCancel:true,regionSenderValidation:true};
}
module.exports = {options,run};
