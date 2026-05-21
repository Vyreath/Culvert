const PozosUI = (() => {
  const state = { filterAlcId: '' };

  async function load() {
    const tbody = document.getElementById('tbody-pozos');
    if (!tbody) return;
    skeletonRows(tbody, 6, 5);
    try {
      const data = await API.getPozos(state.filterAlcId);
      renderRows(data || []);
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--color-danger)">${err.message}</td></tr>`;
      Toast.error(err.message);
    }
  }

  function renderRows(rows) {
    const tbody = document.getElementById('tbody-pozos');
    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--color-text-muted)">Sin pozos</td></tr>`;
      return;
    }
    tbody.innerHTML = rows.map(r => `
      <tr>
        <td>${r.id}</td>
        <td>${r.alcantarilla_id || '—'}</td>
        <td>${r.profundidad || '—'}</td>
        <td>${r.diametro || '—'}</td>
        <td>${badgeEstado(r.estados?.nombre)}</td>
        <td>
          <div class="table-actions">
            <button class="btn btn-secondary btn-icon" title="Editar" onclick="PozosUI.edit(${r.id})"><i class="fa-solid fa-pen"></i></button>
            <button class="btn btn-danger btn-icon" title="Eliminar" onclick="PozosUI.remove(${r.id})"><i class="fa-solid fa-trash"></i></button>
          </div>
        </td>
      </tr>`).join('');
  }

  function formBody(row = {}) {
    return `
      <form id="pozo-form">
        <div class="form-grid">
          <div class="form-group">
            <label class="form-label" for="alcantarilla_id">Alcantarilla ID</label>
            <input class="form-control" id="alcantarilla_id" name="alcantarilla_id" type="number" value="${row.alcantarilla_id || ''}" required>
          </div>
          <div class="form-group">
            <label class="form-label" for="estado_id">Estado ID</label>
            <input class="form-control" id="estado_id" name="estado_id" type="number" value="${row.estado_id || ''}">
          </div>
          <div class="form-group">
            <label class="form-label" for="profundidad">Profundidad</label>
            <input class="form-control" id="profundidad" name="profundidad" value="${row.profundidad || ''}">
          </div>
          <div class="form-group">
            <label class="form-label" for="diametro">Diámetro</label>
            <input class="form-control" id="diametro" name="diametro" value="${row.diametro || ''}">
          </div>
        </div>
      </form>`;
  }

  function openForm(row = null) {
    const editing = Boolean(row?.id);
    Modal.create({
      id: 'pozo-modal',
      title: editing ? 'Editar pozo' : 'Nuevo pozo',
      body: formBody(row || {}),
      footer: `<button class="btn btn-ghost" onclick="Modal.close('pozo-modal')">Cancelar</button>
               <button class="btn btn-primary btn-submit" type="submit" form="pozo-form"><i class="fa-solid fa-floppy-disk"></i> Guardar</button>`,
      onOpen: () => {
        document.getElementById('pozo-form').addEventListener('submit', async e => {
          e.preventDefault();
          const form = e.target;
          const payload = Object.fromEntries(new FormData(form).entries());
          ['alcantarilla_id','estado_id'].forEach(k => { if(payload[k]) payload[k] = Number(payload[k]); });
          Modal.setLoading('pozo-form', true);
          try {
            if (editing) {
              await API.updatePozo(row.id, payload);
              Toast.success('Pozo actualizado');
            } else {
              await API.createPozo(payload);
              Toast.success('Pozo creado');
            }
            Modal.close('pozo-modal');
            load();
            if (typeof Dashboard !== 'undefined') Dashboard.reload();
          } catch (err) { Toast.error(err.message); }
          finally { Modal.setLoading('pozo-form', false); }
        });
      }
    });
  }

  async function edit(id) {
    try {
      const res = await fetch(`/api/pozos_recoleccion/${id}`, {
        headers: { Authorization: `Bearer ${Auth.getToken()}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Error');
      openForm(data);
    } catch (err) { Toast.error('Error al cargar: ' + err.message); }
  }

  function remove(id) {
    Modal.confirm({
      title: 'Eliminar pozo',
      message: '¿Estás seguro?',
      danger: true,
      onConfirm: async () => {
        try {
          await API.deletePozo(id);
          Toast.success('Pozo eliminado');
          load();
          if (typeof Dashboard !== 'undefined') Dashboard.reload();
        } catch (err) { Toast.error(err.message); }
      }
    });
  }

  async function populateAlcantarillaFilter() {
    try {
      const res = await API.getAlcantarillas({ per_page: 1000 });
      const select = document.getElementById('filter-alcantarilla-pozo');
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
    document.getElementById('btn-new-pozo')?.addEventListener('click', () => openForm());
  });

  return { load, edit, remove };
})();