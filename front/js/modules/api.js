const API = (() => {
  const BASE = '';

  async function _request(method, path, body = null, isFormData = false) {
    const headers = {};
    if (!isFormData) headers['Content-Type'] = 'application/json';
    const token = localStorage.getItem('access_token');
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const opts = { method, headers };
    if (body) opts.body = isFormData ? body : JSON.stringify(body);

    let res;
    try { res = await fetch(BASE + path, opts); }
    catch (err) { throw new Error('Error de red. Verifica tu conexión.'); }

    if (res.status === 401) {
      const refreshed = await _tryRefresh();
      if (refreshed) return _request(method, path, body, isFormData);
      Auth.logout();
      return;
    }

    let data;
    try { data = await res.json(); } catch { data = {}; }
    if (!res.ok) { const msg = data.detail || data.error || `Error ${res.status}`; throw new Error(msg); }
    return data;
  }

  async function _tryRefresh() {
    const rt = localStorage.getItem('refresh_token');
    if (!rt) return false;
    try {
      const res = await fetch(BASE + '/api/auth/refresh', { method: 'POST', headers: { 'Authorization': `Bearer ${rt}` } });
      if (!res.ok) return false;
      const d = await res.json();
      localStorage.setItem('access_token', d.access_token);
      return true;
    } catch { return false; }
  }

  return {
    get: (path, params = {}) => {
      const qs = Object.keys(params).length ? '?' + new URLSearchParams(params).toString() : '';
      return _request('GET', path + qs);
    },
    post: (path, body) => _request('POST', path, body),
    put: (path, body) => _request('PUT', path, body),
    delete: (path) => _request('DELETE', path),
    upload: (path, formData) => _request('POST', path, formData, true),

    // Catálogos
    getEstados: () => API.get('/api/estados'),
    getMateriales: () => API.get('/api/materiales'),

    // Alcantarillas
    getAlcantarillas: (params) => API.get('/api/alcantarillas', params),
    getAlcantarilla: (id) => API.get(`/api/alcantarillas/${id}`),
    createAlcantarilla: (body) => API.post('/api/alcantarillas', body),
    updateAlcantarilla: (id, body) => API.put(`/api/alcantarillas/${id}`, body),
    deleteAlcantarilla: (id) => API.delete(`/api/alcantarillas/${id}`),

    // Tuberías
    getTuberias: (alc_id) => API.get('/api/tuberias', { alcantarilla_id: alc_id }),
    getTuberia: (id) => API.get(`/api/tuberias/${id}`),
    createTuberia: (body) => API.post('/api/tuberias', body),
    updateTuberia: (id, body) => API.put(`/api/tuberias/${id}`, body),
    deleteTuberia: (id) => API.delete(`/api/tuberias/${id}`),

    // Muros
    getMuros: (alc_id) => API.get('/api/muros', { alcantarilla_id: alc_id }),
    getMuro: (id) => API.get(`/api/muros/${id}`),
    createMuro: (body) => API.post('/api/muros', body),
    updateMuro: (id, body) => API.put(`/api/muros/${id}`, body),
    deleteMuro: (id) => API.delete(`/api/muros/${id}`),

    // Pozos
    getPozos: (alc_id) => API.get('/api/pozos_recoleccion', { alcantarilla_id: alc_id }),
    getPozo: (id) => API.get(`/api/pozos_recoleccion/${id}`),
    createPozo: (body) => API.post('/api/pozos_recoleccion', body),
    updatePozo: (id, body) => API.put(`/api/pozos_recoleccion/${id}`, body),
    deletePozo: (id) => API.delete(`/api/pozos_recoleccion/${id}`),

    // Inspecciones
    getInspecciones: (alc_id) => API.get('/api/inspecciones', alc_id ? { alcantarilla_id: alc_id } : {}),
    getInspeccion: (id) => API.get(`/api/inspecciones/${id}`),
    createInspeccion: (body) => API.post('/api/inspecciones', body),
    updateInspeccion: (id, body) => API.put(`/api/inspecciones/${id}`, body),
    deleteInspeccion: (id) => API.delete(`/api/inspecciones/${id}`),

    // Archivos adjuntos
    getArchivos: (alc_id) => API.get('/api/archivos_adjuntos', { alcantarilla_id: alc_id }),
    createArchivo: (body) => API.post('/api/archivos_adjuntos', body),
    deleteArchivo: (id) => API.delete(`/api/archivos_adjuntos/${id}`),

    // Dashboard
    getKPIs: () => API.get('/api/dashboard/kpis'),

    // Mapa
    getMapaPuntos: (params) => API.get('/api/mapa/puntos', params || {}),

    // Auditoría
    getAuditLogs: (params) => API.get('/api/audit', params || {}),
    getAuditStats: () => API.get('/api/audit/stats'),

    exportExcel: () => window.open('/api/export/alcantarillas/excel', '_blank'),
    exportPDF: () => window.open('/api/export/alcantarillas/pdf', '_blank'),
  };
})();