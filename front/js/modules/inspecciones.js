const InspeccionesUI = (() => {
  const state = { filterAlcId: '' };

  async function load() {
    const tbody = document.getElementById('tbody-inspecciones-page');
    if (!tbody) return;
    skeletonRows(tbody, 6, 5);
    try {
      const data = await API.getInspecciones(state.filterAlcId);
      renderRows(data || []);
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--color-danger)">${err.message}</td></tr>`;
      Toast.error(err.message);
    }
  }

  function renderRows(rows) {
    const tbody = document.getElementById('tbody-inspecciones-page');
    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--color-text-muted)">Sin inspecciones</td></tr>`;
      return;
    }
    tbody.innerHTML = rows.map(r => `
      <tr>
        <td>${r.id}</td>
        <td>${r.alcantarilla_id || '—'}</td>
        <td>${fmtDate(r.fecha)}</td>
        <td>${r.inspector || '—'}</td>
        <td>${r.observaciones || '—'}</td>
        <td>
          <div class="table-actions">
            <button class="btn btn-secondary btn-icon" title="Editar" onclick="InspeccionesUI.edit(${r.id})"><i class="fa-solid fa-pen"></i></button>
            <button class="btn btn-danger btn-icon" title="Eliminar" onclick="InspeccionesUI.remove(${r.id})"><i class="fa-solid fa-trash"></i></button>
          </div>
        </td>
      </tr>`).join('');
  }

  function formBody(row = {}) {
    return `
      <form id="inspeccion-form">
        <div class="form-grid">
          <div class="form-group">
            <label class="form-label" for="alcantarilla_id">Alcantarilla ID <span class="required">*</span></label>
            <input class="form-control" id="alcantarilla_id" name="alcantarilla_id" type="number" value="${row.alcantarilla_id || ''}" required>
          </div>
          <div class="form-group">
            <label class="form-label" for="fecha">Fecha <span class="required">*</span></label>
            <input class="form-control" id="fecha" name="fecha" type="date" value="${row.fecha ? row.fecha.substring(0,10) : ''}"required>
          </div>
          <div class="form-group">
            <label class="form-label" for="inspector">Inspector</label>
            <input class="form-control" id="inspector" name="inspector" value="${row.inspector || ''}">
          </div>
          <div class="form-group full">
            <label class="form-label" for="observaciones">Observaciones</label>
            <textarea class="form-control" id="observaciones" name="observaciones" rows="3">${row.observaciones || ''}</textarea>
          </div>
        </div>
      </form>`;
  }

  function openForm(row = null) {
    const editing = Boolean(row?.id);
    Modal.create({
      id: 'inspeccion-modal',
      title: editing ? 'Editar inspección' : 'Nueva inspección',
      body: formBody(row || {}),
      footer: `<button class="btn btn-ghost" onclick="Modal.close('inspeccion-modal')">Cancelar</button>
               <button class="btn btn-primary btn-submit" type="submit" form="inspeccion-form"><i class="fa-solid fa-floppy-disk"></i> Guardar</button>`,
      onOpen: () => {
        document.getElementById('inspeccion-form').addEventListener('submit', async e => {
          e.preventDefault();
          const form = e.target;
          const payload = Object.fromEntries(new FormData(form).entries());
          if (payload.alcantarilla_id) payload.alcantarilla_id = Number(payload.alcantarilla_id);
          Modal.setLoading('inspeccion-form', true);
          try {
            if (editing) {
              await API.updateInspeccion(row.id, payload);
              Toast.success('Inspección actualizada');
            } else {
              await API.createInspeccion(payload);
              Toast.success('Inspección creada');
            }
            Modal.close('inspeccion-modal');
            load();
            if (typeof Dashboard !== 'undefined') Dashboard.reload();
          } catch (err) { Toast.error(err.message); }
          finally { Modal.setLoading('inspeccion-form', false); }
        });
      }
    });
  }

 async function edit(id) {
    try {
      const data = await API.get(`/api/inspecciones/${id}`);
      openForm(data);
    } catch (err) {
      Toast.error('Error al cargar: ' + err.message);
    }
  }

  function remove(id) {
    Modal.confirm({
      title: 'Eliminar inspección',
      message: '¿Estás seguro?',
      danger: true,
      onConfirm: async () => {
        try {
          await API.deleteInspeccion(id);
          Toast.success('Inspección eliminada');
          load();
          if (typeof Dashboard !== 'undefined') Dashboard.reload();
        } catch (err) { Toast.error(err.message); }
      }
    });
  }

  async function populateAlcantarillaFilter() {
    try {
      const res = await API.getAlcantarillas({ per_page: 1000 });
      const select = document.getElementById('filter-alcantarilla-inspeccion');
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
    document.getElementById('btn-new-inspeccion')?.addEventListener('click', () => openForm());
  });

  return { load, edit, remove };
})();