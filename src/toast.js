let _timer = null;

export function toast(msg, type = 'ok') {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.dataset.type = type;
  el.classList.add('toast-visible');
  clearTimeout(_timer);
  _timer = setTimeout(() => el.classList.remove('toast-visible'), 2500);
}
