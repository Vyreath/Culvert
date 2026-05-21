const AuditoriaUI = (() => {
  let page = 1;
  let pages = 1;
  const perPage = 20;

  async function load() {
    const tbody = document.getElementById('tbody-auditoria');
    if (!tbody) return;
    skeletonRows(tbody, 5, 10);
    try {
      const res = await API.getAuditLogs({ page, per_page: perPage });
      pages = res.pages || 1;
      renderRows(res.data || []);
      renderPagination();
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--color-danger)">${err.message}</td></tr>`;
      Toast.error(err.message);
    }
  }

  function renderRows(rows) {
    const tbody = document.getElementById('tbody-auditoria');
    if (!tbody) return;
    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--color-text-muted)">No hay registros de auditoría</td></tr>`;
      return;
    }
    tbody.innerHTML = rows.map(r => `
      <tr>
        <td>${r.id}</td>
        <td>${r.usuario || '—'}</td>
        <td>${r.accion}</td>
        <td>${r.detalle}</td>
        <td>${new Date(r.fecha).toLocaleString('es-EC')}</td>
      </tr>`).join('');
  }

  function renderPagination() {
    const info = document.getElementById('auditoria-page-info');
    const current = document.getElementById('auditoria-current');
    const prev = document.getElementById('auditoria-prev');
    const next = document.getElementById('auditoria-next');

    if (info) {
      const start = (page - 1) * perPage + 1;
      // No tenemos total exacto, usamos páginas
      info.textContent = `Página ${page} de ${pages}`;
    }
    if (current) current.textContent = page;
    if (prev) prev.disabled = page <= 1;
    if (next) next.disabled = page >= pages;
  }

  document.addEventListener('DOMContentLoaded', () => {
    if (!Auth.isAdmin()) {
      Toast.error('Acceso denegado — solo administradores');
      window.location.href = '/';
      return;
    }
    Auth.populateUI();
    load();

    document.getElementById('auditoria-prev')?.addEventListener('click', () => {
      if (page > 1) { page--; load(); }
    });
    document.getElementById('auditoria-next')?.addEventListener('click', () => {
      if (page < pages) { page++; load(); }
    });
  });

  return {};
})();