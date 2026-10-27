// Renderer coordinates are DIP, while the screenshot can have a different pixel size.
function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function cropRectangle(rect, bounds, imageSize) {
  if (!rect || !bounds || !imageSize) throw new Error('Selección inválida.');
  for (const object of [rect, bounds, imageSize]) {
    if (!Number.isFinite(object.width) || !Number.isFinite(object.height) || object.width <= 0 || object.height <= 0) throw new Error('Dimensiones inválidas.');
  }
  if (!Number.isFinite(rect.x) || !Number.isFinite(rect.y) || rect.x < 0 || rect.y < 0 || rect.x >= bounds.width || rect.y >= bounds.height) throw new Error('La selección está fuera de la pantalla.');
  const right = Math.min(bounds.width, rect.x + rect.width);
  const bottom = Math.min(bounds.height, rect.y + rect.height);
  if (right - rect.x < 8 || bottom - rect.y < 8) throw new Error('Selecciona una zona de al menos 8 × 8 píxeles.');
  const sx = imageSize.width / bounds.width, sy = imageSize.height / bounds.height;
  if (Math.abs(sx / sy - 1) > 0.02) throw new Error('La pantalla cambió de tamaño. Vuelve a seleccionar la zona.');
  const x = clamp(Math.floor(rect.x * sx), 0, imageSize.width - 1);
  const y = clamp(Math.floor(rect.y * sy), 0, imageSize.height - 1);
  return { x, y, width: clamp(Math.ceil(right * sx), x + 1, imageSize.width) - x, height: clamp(Math.ceil(bottom * sy), y + 1, imageSize.height) - y };
}
module.exports = { cropRectangle };
