let expanded = false;
const pet = document.querySelector('#pet');
const state = document.querySelector('#state');
async function expand(value) {
  try {
    await window.folioPet.expand(value);
    expanded = value; document.querySelector('#panel').hidden = !value;
    pet.setAttribute('aria-expanded', String(value));
    if (!value) pet.focus();
  } catch { state.textContent = 'No se pudo cambiar el menú. Abre Folio desde la barra de tareas.'; }
}
pet.addEventListener('click', () => expand(!expanded));
document.querySelector('#collapse').addEventListener('click', () => expand(false));
document.addEventListener('keydown', event => { if (event.key === 'Escape') expand(false); });
document.querySelectorAll('[data-action]').forEach(button => button.addEventListener('click', async () => {
  try { await window.folioPet.action(button.dataset.action); }
  catch { state.textContent = 'No se pudo completar la acción. Abre Folio para continuar.'; await expand(true); }
}));
window.folioPet.onBusy(busy => {
  document.querySelectorAll('[data-action="capture"]').forEach(button => { button.disabled = busy; });
  state.textContent = busy ? 'Folio está procesando. Puedes abrir la app.' : 'Todo se procesa en tu equipo.';
});
