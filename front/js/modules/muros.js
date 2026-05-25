const MurosUI = (() => {
  const state = { filterAlcId: '', alcantarillas: [] };

  function escapeHTML(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function getFichaLabel(alcId) {
    const alc = state.alcantarillas.find(a => a.id == alcId);
    return alc ? `#${alc.ficha_numero} - ${alc.ubicacion || ''}` : `ID ${alcId}`;
  }

  async function load() {
    const tbody = document.getElementById('tbody-muros');
    if (!tbody) return;
    skeletonRows(tbody, 7, 5);
    try {
      const data = await API.getMuros(state.filterAlcId);
      renderRows(data || []);
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--color-danger)">${escapeHTML(err.message)}</td></tr>`;
      Toast.error(err.message);
    }
  }

  function renderRows(rows) {
    const tbody = document.getElementById('tbody-muros');
    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--color-text-muted)">Sin muros</td></tr>`;
      return;
    }
    tbody.innerHTML = rows.map(r => `
      <tr>
        <td>${escapeHTML(r.id)}</td>
        <td>${escapeHTML(getFichaLabel(r.alcantarilla_id))}</td>
        <td>${escapeHTML(r.materiales?.nombre ?? '—')}</td>
        <td>${escapeHTML(r.alto ?? '—')}</td>
        <td>${escapeHTML(r.longitud ?? '—')}</td>
        <td>${badgeEstado(r.estados?.nombre)}</td>
        <td>
          <div class="table-actions">
            <button class="btn btn-secondary btn-icon" title="Editar" onclick="MurosUI.edit(${r.id})"><i class="fa-solid fa-pen"></i></button>
            <button class="btn btn-danger btn-icon" title="Eliminar" onclick="MurosUI.remove(${r.id})"><i class="fa-solid fa-trash"></i></button>
          </div>
        </td>
      </tr>`).join('');
  }

  function formBody(row = {}, alcantarillas = [], estados = [], materiales = []) {
    const opcionesAlc = alcantarillas.map(a =>
      `<option value="${a.id}" ${a.id == row.alcantarilla_id ? 'selected' : ''}>#${a.ficha_numero} - ${a.ubicacion || 'Sin ubicación'}</option>`
    ).join('');

    const opcionesEst = estados.map(e =>
      `<option value="${e.id}" ${e.id == row.estado_id ? 'selected' : ''}>${e.nombre}</option>`
    ).join('');

    const opcionesMat = materiales.map(m =>
      `<option value="${m.id}" ${m.id == row.material_id ? 'selected' : ''}>${m.nombre}</option>`
    ).join('');

    return `
      <form id="muro-form">
        <div class="form-grid">
          <div class="form-group">
            <label class="form-label" for="alcantarilla_id">Alcantarilla <span class="required">*</span></label>
            <select class="form-control" id="alcantarilla_id" name="alcantarilla_id" required>
              <option value="">Seleccione...</option>
              ${opcionesAlc}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label" for="material_id">Material</label>
            <select class="form-control" id="material_id" name="material_id">
              <option value="">Seleccione...</option>
              ${opcionesMat}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label" for="estado_id">Estado</label>
            <select class="form-control" id="estado_id" name="estado_id">
              <option value="">Seleccione...</option>
              ${opcionesEst}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label" for="alto">Altura (m)</label>
            <input class="form-control" id="alto" name="alto" value="${escapeHTML(row.alto ?? '')}">
          </div>
          <div class="form-group">
            <label class="form-label" for="longitud">Longitud (m)</label>
            <input class="form-control" id="longitud" name="longitud" value="${escapeHTML(row.longitud ?? '')}">
          </div>
          <div class="form-group">
            <label class="form-label" for="ancho">Ancho (m)</label>
            <input class="form-control" id="ancho" name="ancho" value="${escapeHTML(row.ancho ?? '')}">
          </div>
          <div class="form-group">
            <label class="form-label" for="espesor">Espesor (m)</label>
            <input class="form-control" id="espesor" name="espesor" value="${escapeHTML(row.espesor ?? '')}">
          </div>
        </div>
      </form>`;
  }

  async function openForm(row = null) {
    let alcantarillas = [], estados = [], materiales = [];
    try {
      const [resAlc, resEst, resMat] = await Promise.all([
        API.getAlcantarillas({ per_page: 1000 }),
        API.getEstados(),
        API.getMateriales()
      ]);
      alcantarillas = resAlc.data;
      estados = resEst;
      materiales = resMat;
    } catch (e) {
      // listas vacías
    }

    const editing = Boolean(row?.id);
    Modal.create({
      id: 'muro-modal',
      title: editing ? 'Editar muro' : 'Nuevo muro',
      body: formBody(row || {}, alcantarillas, estados, materiales),
      footer: `<button class="btn btn-ghost" onclick="Modal.close('muro-modal')">Cancelar</button>
               <button class="btn btn-primary btn-submit" type="submit" form="muro-form"><i class="fa-solid fa-floppy-disk"></i> Guardar</button>`,
      onOpen: () => {
        document.getElementById('muro-form').addEventListener('submit', async e => {
          e.preventDefault();
          const form = e.target;
          const payload = Object.fromEntries(new FormData(form).entries());
          ['alcantarilla_id','material_id','estado_id'].forEach(k => { if(payload[k] !== '') payload[k] = Number(payload[k]); });
          ['alto','longitud','ancho','espesor'].forEach(k => { if(payload[k] !== '') payload[k] = Number(payload[k]); });
          Object.keys(payload).forEach(k => { if (payload[k] === '') delete payload[k]; });
          Modal.setLoading('muro-form', true);
          try {
            if (editing) {
              await API.updateMuro(row.id, payload);
              Toast.success('Muro actualizado');
            } else {
              await API.createMuro(payload);
              Toast.success('Muro creado');
            }
            Modal.close('muro-modal');
            load();
            if (typeof Dashboard !== 'undefined') Dashboard.reload();
          } catch (err) { Toast.error(err.message); }
          finally { Modal.setLoading('muro-form', false); }
        });
      }
    });
  }

  async function edit(id) {
    try {
      const data = await API.getMuro(id);
      openForm(data);
    } catch (err) {
      Toast.error('Error al cargar: ' + err.message);
    }
  }

  function remove(id) {
    Modal.confirm({
      title: 'Eliminar muro',
      message: '¿Estás seguro?',
      danger: true,
      onConfirm: async () => {
        try {
          await API.deleteMuro(id);
          Toast.success('Muro eliminado');
          load();
          if (typeof Dashboard !== 'undefined') Dashboard.reload();
        } catch (err) { Toast.error(err.message); }
      }
    });
  }

  async function populateAlcantarillaFilter() {
    try {
      const res = await API.getAlcantarillas({ per_page: 1000 });
      state.alcantarillas = res.data;
      const select = document.getElementById('filter-alcantarilla-muro');
      if (!select) return;
      select.innerHTML = '<option value="">Todas las alcantarillas</option>';
      res.data.forEach(a => {
        select.innerHTML += `<option value="${a.id}">#${a.ficha_numero} - ${a.ubicacion || ''}</option>`;
      });
      select.addEventListener('change', () => {
        state.filterAlcId = select.value;
        load();
      });
    } catch {}
  }

  document.addEventListener('DOMContentLoaded', () => {
    if (Auth.guard()) {
      Auth.populateUI();
      populateAlcantarillaFilter();
      load();
    }
    document.getElementById('btn-new-muro')?.addEventListener('click', () => openForm());
  });

  return { load, edit, remove };
})();