/**
 * auth.js — Gestión de sesión, login/logout, protección de rutas
 */

const Auth = (() => {
  const PUBLIC_ROUTES = ['/login'];

  /* ── helpers de almacenamiento ── */
  function getToken()   { return localStorage.getItem('access_token'); }
  function getUser()    {
    try { return JSON.parse(localStorage.getItem('current_user') || 'null'); }
    catch { return null; }
  }
  function saveSession(data) {
    localStorage.setItem('access_token',   data.access_token);
    localStorage.setItem('refresh_token',  data.refresh_token || '');
    localStorage.setItem('current_user',   JSON.stringify(data.user));
  }
  function clearSession() {
    ['access_token','refresh_token','current_user'].forEach(k => localStorage.removeItem(k));
  }

  /* ── protección de ruta ── */
  function guard() {
    const path = window.location.pathname;
    const isPublic = PUBLIC_ROUTES.some(r => path.startsWith(r));
    if (!getToken() && !isPublic) {
      window.location.href = '/login';
      return false;
    }
    if (getToken() && isPublic) {
      window.location.href = '/';
      return false;
    }
    return true;
  }

  /* ── login ── */
  async function login(email, password) {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || data.detail || 'Credenciales inválidas');
    saveSession(data);
    return data;
  }

  /* ── logout ── */
  async function logout() {
    try {
      const token = getToken();
      if (token) {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
        });
      }
    } catch { /* siempre limpiar */ }
    clearSession();
    window.location.href = '/login';
  }

  /* ── permisos ── */
  function can(permiso) {
    const user = getUser();
    return user?.permisos?.[permiso] === true;
  }

  function isAdmin() {
    return getUser()?.role === 'administrador';
  }

  /* ── poblar UI con datos del usuario ── */
  function populateUI() {
    const user = getUser();
    if (!user) return;

    const initials = ((user.nombre || user.email || '?')[0]).toUpperCase();
    const fullName = user.nombre || user.email || 'Usuario';
    const rolLabel = { administrador: 'Administrador', inspector: 'Inspector', readonly: 'Solo lectura' };

    // Topbar
    const avatarTop  = document.getElementById('avatar-topbar');
    const nameTop    = document.getElementById('name-topbar');
    const roleTop    = document.getElementById('role-topbar');
    if (avatarTop) avatarTop.textContent   = initials;
    if (nameTop)   nameTop.textContent     = fullName;
    if (roleTop)   roleTop.textContent     = rolLabel[user.role] || user.role;

    // Sidebar
    const avatarSide = document.getElementById('avatar-sidebar');
    const nameSide   = document.getElementById('name-sidebar');
    const roleSide   = document.getElementById('role-sidebar');
    if (avatarSide) avatarSide.textContent = initials;
    if (nameSide)   nameSide.textContent   = fullName;
    if (roleSide)   roleSide.textContent   = rolLabel[user.role] || user.role;

    // Ocultar sección admin si no es admin
    if (!isAdmin()) {
      const adminSection = document.getElementById('admin-section');
      if (adminSection) adminSection.style.display = 'none';
    }
  }

  /* ── público ── */
  return { guard, login, logout, getUser, getToken, can, isAdmin, populateUI };
})();
