const selection = document.querySelector('#selection');
let start, committed = false;
const position = event => ({ x: Math.max(0, Math.min(innerWidth, event.clientX)), y: Math.max(0, Math.min(innerHeight, event.clientY)) });
const rectangle = (a, b) => ({ x: Math.min(a.x,b.x), y: Math.min(a.y,b.y), width: Math.abs(a.x-b.x), height: Math.abs(a.y-b.y) });
function draw(rect) {
  selection.hidden = false;
  Object.assign(selection.style, { left: `${rect.x}px`, top: `${rect.y}px`, width: `${rect.width}px`, height: `${rect.height}px` });
  document.querySelector('#size').textContent = `${Math.round(rect.width)} × ${Math.round(rect.height)}`;
}
window.addEventListener('pointerdown', event => {
  if (event.button !== 0 || committed) return;
  start = position(event); document.body.classList.add('dragging');
  document.body.setPointerCapture(event.pointerId); draw(rectangle(start, start));
});
window.addEventListener('pointermove', event => { if (start && !committed) draw(rectangle(start, position(event))); });
window.addEventListener('pointerup', event => {
  if (event.button !== 0 || !start || committed) return;
  const rect = rectangle(start, position(event)); start = undefined;
  if (document.body.hasPointerCapture(event.pointerId)) document.body.releasePointerCapture(event.pointerId);
  if (rect.width < 8 || rect.height < 8) {
    selection.hidden = true; document.body.classList.remove('dragging');
    document.querySelector('#instruction').textContent = 'La zona es muy pequeña. Arrastra un rectángulo más grande o pulsa Esc.';
    return;
  }
  committed = true; window.folioRegion.finish(rect);
});
window.addEventListener('keydown', event => { if (event.key === 'Escape') { event.preventDefault(); window.folioRegion.cancel(); } });
window.addEventListener('contextmenu', event => { event.preventDefault(); window.folioRegion.cancel(); });
window.addEventListener('pointercancel', () => { start = undefined; selection.hidden = true; document.body.classList.remove('dragging'); });
