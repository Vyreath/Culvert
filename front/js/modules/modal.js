/**
 * modal.js — Sistema de modales reutilizable
 */

const Modal = (() => {
  /* ── Abrir modal por ID ── */
  function open(id) {
    const overlay = document.getElementById(id);
    if (!overlay) return;
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
    // Foco en primer input
    setTimeout(() => {
      const first = overlay.querySelector('input:not([type=hidden]), select, textarea');
      if (first) first.focus();
    }, 100);
  }

  /* ── Cerrar modal por ID ── */
  function close(id) {
    const overlay = document.getElementById(id);
    if (!overlay) return;
    overlay.classList.remove('open');
    document.body.style.overflow = '';
  }

  /* ── Cerrar al hacer clic en el overlay ── */
  function initOverlayClose() {
    document.addEventListener('click', e => {
      if (e.target.classList.contains('modal-overlay')) {
        e.target.classList.remove('open');
        document.body.style.overflow = '';
      }
    });
  }

  /* ── Modal de confirmación dinámico ── */
  function confirm({ title = '¿Confirmar acción?', message = '', danger = false, onConfirm }) {
    // Eliminar anterior si existe
    const prev = document.getElementById('_confirm-modal');
    if (prev) prev.remove();

    const btnClass = danger ? 'btn-danger' : 'btn-primary';
    const html = `
      <div class="modal-overlay" id="_confirm-modal">
        <div class="modal" style="max-width:420px">
          <div class="modal-header">
            <h3 class="modal-title">${title}</h3>
            <button class="modal-close" onclick="Modal.close('_confirm-modal')">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>
          <div class="modal-body">
            <p style="color:var(--color-text-muted);font-size:0.875rem">${message}</p>
          </div>
          <div class="modal-footer">
            <button class="btn btn-ghost" onclick="Modal.close('_confirm-modal')">Cancelar</button>
            <button class="btn ${btnClass}" id="_confirm-ok">Confirmar</button>
          </div>
        </div>
      </div>`;

    document.body.insertAdjacentHTML('beforeend', html);
    open('_confirm-modal');

    document.getElementById('_confirm-ok').addEventListener('click', async () => {
      close('_confirm-modal');
      if (typeof onConfirm === 'function') await onConfirm();
    });
  }

  /* ── Crear modal dinámicamente ── */
  function create({ id, title, size = '', body = '', footer = '', onOpen }) {
    const prev = document.getElementById(id);
    if (prev) prev.remove();

    const html = `
      <div class="modal-overlay" id="${id}">
        <div class="modal ${size ? 'modal-' + size : ''}">
          <div class="modal-header">
            <h3 class="modal-title">${title}</h3>
            <button class="modal-close" onclick="Modal.close('${id}')">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>
          <div class="modal-body" id="${id}-body">${body}</div>
          ${footer ? `<div class="modal-footer" id="${id}-footer">${footer}</div>` : ''}
        </div>
      </div>`;

    document.body.insertAdjacentHTML('beforeend', html);
    open(id);
    if (typeof onOpen === 'function') onOpen(document.getElementById(id));
  }

  /* ── Formulario dentro de modal con loading en submit ── */
  function setLoading(formId, loading) {
    const form = document.getElementById(formId);
    if (!form) return;
    const btn = form.querySelector('button[type=submit], .btn-submit');
    if (!btn) return;
    if (loading) {
      btn.disabled = true;
      btn._origText = btn.innerHTML;
      btn.innerHTML = '<span class="spinner" style="width:16px;height:16px;border-width:2px"></span>';
    } else {
      btn.disabled = false;
      if (btn._origText) btn.innerHTML = btn._origText;
    }
  }

  /* Init */
  document.addEventListener('DOMContentLoaded', initOverlayClose);

  return { open, close, confirm, create, setLoading };
})();