const { BrowserWindow, screen } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const assert = (value, message) => { if (!value) throw new Error(message); };
async function until(check, message) {
  for (let i = 0; i < 100; i++) { if (await check()) return; await pause(50); }
  throw new Error(message);
}
exports.run = async (mainWindow, pet, localRoot) => {
  const js = code => pet.window.webContents.executeJavaScript(code);
  assert(await js('typeof process === "undefined" && typeof require === "undefined"'), 'Node expuesto en mascota.');
  assert(await js('(async()=>{try {await fetch("https://folio-test.invalid/");return false;}catch{return true;}})()'), 'La mascota permitió red externa.');
  assert(await js('(async()=>{try {await window.folioPet.action("delete");return false;}catch{return true;}})()'), 'La mascota aceptó una acción desconocida.');
  const rogue = new BrowserWindow({ show: false, webPreferences: { preload: path.join(__dirname, 'pet-preload.cjs'), contextIsolation: true, sandbox: true, nodeIntegration: false, session: pet.window.webContents.session } });
  try {
    await rogue.loadFile(path.join(__dirname, 'pet.html'));
    assert(await rogue.webContents.executeJavaScript('(async()=>{try {await window.folioPet.action("open");return false;}catch{return true;}})()'), 'Se aceptó IPC desde otra ventana.');
  } finally { rogue.destroy(); }
  const draft = await mainWindow.webContents.executeJavaScript('document.querySelector("#question").value');
  await mainWindow.webContents.executeJavaScript('document.querySelector("#minimize-pet").click()');
  await until(() => pet.window.isVisible() && mainWindow.isMinimized(), 'No apareció la mascota.');
  await js('document.querySelector("#pet").click()');
  await until(() => js('!document.querySelector("#panel").hidden'), 'No se abrió el menú de la mascota.');
  const bounds = pet.window.getBounds(), work = screen.getDisplayMatching(bounds).workArea;
  assert(bounds.x >= work.x && bounds.y >= work.y && bounds.x + bounds.width <= work.x + work.width && bounds.y + bounds.height <= work.y + work.height, 'Menú fuera del área visible.');
  fs.writeFileSync(path.join(localRoot, 'pet-view.png'), (await pet.window.webContents.capturePage()).toPNG());
  await mainWindow.webContents.executeJavaScript('setBusy(true)');
  await until(() => js('document.querySelector("#quick-capture").disabled'), 'Captura habilitada durante trabajo pendiente.');
  await js('window.folioPet.action("capture")');
  await pause(100);
  assert(!BrowserWindow.getAllWindows().some(win => win.webContents.getURL().endsWith('/region.html')), 'Se capturó con Folio ocupado.');
  await mainWindow.webContents.executeJavaScript('setBusy(false)');
  await until(() => js('!document.querySelector("#quick-capture").disabled'), 'No se reactivó captura.');
  await js('window.folioPet.action("question")');
  await until(() => mainWindow.webContents.executeJavaScript('document.activeElement.id === "question"'), 'Consulta no recibió foco.');
  assert(!mainWindow.isMinimized() && mainWindow.isVisible() && !pet.window.isVisible(), 'No se restauró la ventana.');
  assert(await mainWindow.webContents.executeJavaScript('document.querySelector("#question").value') === draft, 'Minimizar borró el borrador.');
  mainWindow.minimize();
  await until(() => pet.window.isVisible(), 'Minimizar nativo no mostró la mascota.');
  await js('window.folioPet.action("library")');
  await until(() => mainWindow.webContents.executeJavaScript('document.activeElement.id === "upload"'), 'Biblioteca no recibió foco.');
  await require('./region-smoke.cjs').run(mainWindow, pet);
  // Keep an existing review dialog intact when the pet is used again.
  await mainWindow.webContents.executeJavaScript('document.querySelector("#privacy").click()');
  pet.minimize();
  await until(() => pet.window.isVisible(), 'No se mostró mascota con diálogo pendiente.');
  await js('window.folioPet.action("capture")');
  await until(() => mainWindow.isVisible() && !mainWindow.isMinimized(), 'No volvió al diálogo pendiente.');
  assert(!BrowserWindow.getAllWindows().some(win => win.webContents.getURL().endsWith('/region.html')), 'Se abrió captura encima de un diálogo pendiente.');
  await mainWindow.webContents.executeJavaScript('document.querySelector("#close-privacy").click()');
  return { petMinimize: true, petRestore: true, petMenu: true, petBusy: true, petNavigation: true, petCaptureOcr: true, petCancel: true, petDialogGuard: true, petRendererIsolated: true, petRemoteBlocked: true, petSenderValidation: true };
};
