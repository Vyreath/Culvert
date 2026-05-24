/**
 * app.js — Inicialización global: sidebar, topbar, búsqueda global, helpers
 */

document.addEventListener('DOMContentLoaded', () => {

  /* ── Protección de ruta ── */
  if (!Auth.guard()) return;

  /* ── Poblar UI con datos del usuario ── */
  Auth.populateUI();

  /* ── Sidebar toggle ── */
  const sidebar      = document.getElementById('sidebar');
  const toggleBtn    = document.getElementById('sidebar-toggle');
  const toggleIcon   = document.getElementById('toggle-icon');

  if (toggleBtn && sidebar) {
    toggleBtn.addEventListener('click', () => {
      sidebar.classList.toggle('collapsed');
      const collapsed = sidebar.classList.contains('collapsed');
      if (toggleIcon) {
        toggleIcon.className = collapsed
          ? 'fa-solid fa-angles-right'
          : 'fa-solid fa-angles-left';
      }
      localStorage.setItem('sidebar_collapsed', collapsed ? '1' : '0');
    });

    // Restaurar estado
    if (localStorage.getItem('sidebar_collapsed') === '1') {
      sidebar.classList.add('collapsed');
      if (toggleIcon) toggleIcon.className = 'fa-solid fa-angles-right';
    }
  }

  /* ── Navegación activa y breadcrumb ── */
  const currentPath = window.location.pathname;
  document.querySelectorAll('.sidebar-nav a.nav-item').forEach(link => {
    if (link.getAttribute('href') === currentPath) {
      link.classList.add('active');
    }
  });
  const breadcrumb = document.querySelector('.topbar-breadcrumb-current');
  const breadcrumbMap = {
    '/': 'Dashboard',
    '/dashboard': 'Dashboard',
    '/alcantarillas': 'Alcantarillas',
    '/mapa': 'Mapa GIS',
    '/auditoria': 'Auditoría',
  };
  if (breadcrumb) {
    breadcrumb.textContent = breadcrumbMap[currentPath] || 'Inicio';
  }

  /* ── Dropdown usuario ── */
  window.toggleDropdown = function () {
    document.getElementById('user-dropdown')?.classList.toggle('open');
  };
  window.openSection = function (section) {
    Toast.info(`Función de sección '${section}' aún no disponible`);
  };
  window.openUsersModal = function () {
    Toast.info('Función de usuarios aún no disponible');
  };
  document.addEventListener('click', e => {
    const container = document.getElementById('user-dropdown-container');
    const menu      = document.getElementById('user-dropdown');
    if (container && menu && !container.contains(e.target)) {
      menu.classList.remove('open');
    }
  });

  /* ── Logout global ── */
  window.logout = () => Auth.logout();

  /* ── Búsqueda global (debounce) ── */
  const globalSearch = document.getElementById('global-search');
  if (globalSearch) {
    let debounceTimer;
    globalSearch.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        const q = globalSearch.value.trim();
        // Si hay una función de tabla activa en la página, invocarla
        if (typeof window.tableSearch === 'function') {
          window.tableSearch(q);
        }
      }, 320);
    });
  }

  /* ── Exportar desde topbar (CORREGIDO: fetch + blob con autenticación) ── */
  window.exportExcel = async () => {
    try {
      const token = Auth.getToken();
      const res = await fetch('/api/export/alcantarillas/excel', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: `Error ${res.status}` }));
        throw new Error(err.detail || 'Error al generar Excel');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'alcantarillas.xlsx';
      a.click();
      URL.revokeObjectURL(url);
      Toast.success('Excel descargado');
    } catch (err) {
      Toast.error(err.message);
    }
  };

  window.exportPDF = async () => {
    try {
      const token = Auth.getToken();
      const res = await fetch('/api/export/alcantarillas/pdf', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: `Error ${res.status}` }));
        throw new Error(err.detail || 'Error al generar PDF');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'alcantarillas.pdf';
      a.click();
      URL.revokeObjectURL(url);
      Toast.success('PDF descargado');
    } catch (err) {
      Toast.error(err.message);
    }
  };

  /* ── Escape cierra modales ── */
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay.open').forEach(m => {
        m.classList.remove('open');
        document.body.style.overflow = '';
      });
    }
  });

});

/* ══════════════════════════════════════════════
   Helpers globales reutilizables en todas las páginas
══════════════════════════════════════════════ */

/** Formatea fecha ISO a DD/MM/YYYY */
function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('es-EC', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/** Badge HTML según estado */
function badgeEstado(nombre) {
  if (!nombre) return '<span class="badge badge-default">Sin estado</span>';
  const map = { 'Bueno': 'bueno', 'Regular': 'regular', 'Malo': 'malo' };
  const cls = map[nombre] || 'default';
  const dot = { bueno: '●', regular: '●', malo: '●', default: '●' };
  return `<span class="badge badge-${cls}">${dot[cls]} ${nombre}</span>`;
}

/** Skeleton rows para tabla mientras carga */
function skeletonRows(tbody, cols = 8, rows = 6) {
  tbody.innerHTML = Array.from({ length: rows }, () =>
    `<tr>${Array.from({ length: cols }, () =>
      `<td><div class="skeleton" style="height:14px;border-radius:3px"></div></td>`
    ).join('')}</tr>`
  ).join('');
}

/** Formatear número con comas */
function fmtNum(n) {
  if (n == null) return '—';
  return Number(n).toLocaleString('es-EC');
}

/** Construir query string desde objeto */
function toQS(obj) {
  return Object.entries(obj)
    .filter(([, v]) => v !== '' && v != null)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&');
}