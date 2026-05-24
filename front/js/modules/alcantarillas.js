/**
 * alcantarillas.js — CRUD de alcantarillas en el index.
 */

const AlcantarillasUI = (() => {
  const state = {
    page: 1,
    perPage: 10,
    pages: 1,
    total: 0,
    q: '',
  };

  const fields = [
    { name: 'ficha_numero', label: 'Ficha', type: 'number', required: true },
    { name: 'universidad', label: 'Universidad' },
    { name: 'ubicacion', label: 'Ubicación', required: true, full: true },
    { name: 'parroquia', label: 'Parroquia' },
    { name: 'canton', label: 'Cantón' },
    { name: 'provincia', label: 'Provincia' },
    { name: 'fecha', label: 'Fecha', type: 'date' },
    { name: 'tramo_vial', label: 'Tramo vial', full: true },
    { name: 'coordenada_este', label: 'Coordenada este', type: 'number', step: 'any' },
    { name: 'coordenada_norte', label: 'Coordenada norte', type: 'number', step: 'any' },
    { name: 'observaciones', label: 'Observaciones', textarea: true, full: true },
    { name: 'imagen_url', label: 'Link de imagen', full: true },
  ];

  function escapeHTML(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function valueOrDash(value) {
    return value || '—';
  }

  async function load() {
    const tbody = document.getElementById('tbody-alcantarillas');
    if (!tbody) return;

    skeletonRows(tbody, 9, 5);

    try {
      const response = await API.getAlcantarillas({
        page: state.page,
        per_page: state.perPage,
        q: state.q,
      });

      state.total = response.total || 0;
      state.pages = response.pages || 1;
      renderRows(response.data || []);
      renderPagination();
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:24px;color:var(--color-danger)">
        ${escapeHTML(err.message)}
      </td></tr>`;
      Toast.error('No se pudieron cargar las alcantarillas: ' + err.message);
    }
  }

  function renderRows(rows) {
    const tbody = document.getElementById('tbody-alcantarillas');
    if (!tbody) return;

    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:24px;color:var(--color-text-muted)">
        No hay alcantarillas para mostrar
      </td></tr>`;
      return;
    }

    tbody.innerHTML = rows.map(row => `
      <tr>
        <td>#${escapeHTML(row.ficha_numero ?? row.id)}</td>
        <td>${escapeHTML(valueOrDash(row.ubicacion))}</td>
        <td>${escapeHTML(valueOrDash(row.provincia))}</td>
        <td>${escapeHTML(valueOrDash(row.canton))}</td>
        <td>${escapeHTML(valueOrDash(row.parroquia))}</td>
        <td><span class="mono">${escapeHTML(fmtDate(row.fecha))}</span></td>
        <td>${escapeHTML(valueOrDash(row.tramo_vial))}</td>
        <td>
          ${row.imagen_url 
            ? `<a href="${escapeHTML(row.imagen_url)}" target="_blank" title="Ver imagen">
                 <img src="${escapeHTML(row.imagen_url)}" style="height:30px;border-radius:4px;object-fit:cover" onerror="this.style.display='none'">
               </a>` 
            : '—'}
        </td>
        <td>
          <div class="table-actions" style="opacity:1">
            <button class="btn btn-secondary btn-icon" title="Editar" onclick="AlcantarillasUI.edit(${row.id})">
              <i class="fa-solid fa-pen"></i>
            </button>
            <button class="btn btn-danger btn-icon" title="Eliminar" onclick="AlcantarillasUI.remove(${row.id}, '${escapeHTML(row.ficha_numero ?? row.id)}')">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
        </td>
      </tr>
    `).join('');
  }

  function renderPagination() {
    const info = document.getElementById('alcantarillas-page-info');
    const current = document.getElementById('alcantarillas-current');
    const prev = document.getElementById('alcantarillas-prev');
    const next = document.getElementById('alcantarillas-next');

    if (info) {
      const start = state.total ? ((state.page - 1) * state.perPage) + 1 : 0;
      const end = Math.min(state.page * state.perPage, state.total);
      info.textContent = `${start}-${end} de ${state.total} registros`;
    }
    if (current) current.textContent = state.page;
    if (prev) prev.disabled = state.page <= 1;
    if (next) next.disabled = state.page >= state.pages;
  }

  function formBody(row = {}) {
    return `
      <form id="alcantarilla-form">
        <div class="form-grid">
          ${fields.map(field => {
            const value = row[field.name] ?? '';
            const required = field.required ? 'required' : '';
            const full = field.full ? ' full' : '';
            const step = field.step ? ` step="${field.step}"` : '';
            const input = field.textarea
              ? `<textarea class="form-control" id="${field.name}" name="${field.name}" rows="3">${escapeHTML(value)}</textarea>`
              : `<input class="form-control" id="${field.name}" name="${field.name}" type="${field.type || 'text'}"${step} value="${escapeHTML(value)}" ${required}>`;

            return `
              <div class="form-group${full}">
                <label class="form-label" for="${field.name}">
                  ${field.label}${field.required ? ' <span class="required">*</span>' : ''}
                </label>
                ${input}
              </div>
            `;
          }).join('')}
        </div>
      </form>
    `;
  }

  function formFooter() {
    return `
      <button class="btn btn-ghost" type="button" onclick="Modal.close('alcantarilla-modal')">Cancelar</button>
      <button class="btn btn-primary btn-submit" type="submit" form="alcantarilla-form">
        <i class="fa-solid fa-floppy-disk"></i>
        Guardar
      </button>
    `;
  }

  function collectForm() {
    const form = document.getElementById('alcantarilla-form');
    const data = Object.fromEntries(new FormData(form).entries());

    ['ficha_numero'].forEach(key => {
      if (data[key] !== '') data[key] = Number(data[key]);
    });
    ['coordenada_este', 'coordenada_norte'].forEach(key => {
      if (data[key] !== '') data[key] = Number(data[key]);
    });

    Object.keys(data).forEach(key => {
      if (data[key] === '') delete data[key];
    });

    return data;
  }

  function openForm(row = null) {
    const editing = Boolean(row?.id);
    Modal.create({
      id: 'alcantarilla-modal',
      title: editing ? `Editar alcantarilla #${row.ficha_numero || row.id}` : 'Nueva alcantarilla',
      size: 'lg',
      body: formBody(row || {}),
      footer: formFooter(),
      onOpen: () => {
        const form = document.getElementById('alcantarilla-form');
        form.addEventListener('submit', async event => {
          event.preventDefault();
          Modal.setLoading('alcantarilla-form', true);
          try {
            const payload = collectForm();
            if (editing) {
              await API.updateAlcantarilla(row.id, payload);
              Toast.success('Alcantarilla actualizada');
            } else {
              await API.createAlcantarilla(payload);
              Toast.success('Alcantarilla creada');
              state.page = 1;
            }
            Modal.close('alcantarilla-modal');
            await load();
            refreshDashboard();
          } catch (err) {
            Toast.error(err.message);
          } finally {
            Modal.setLoading('alcantarilla-form', false);
          }
        });
      },
    });
  }

  async function edit(id) {
    try {
      const row = await API.getAlcantarilla(id);
      openForm(row);
    } catch (err) {
      Toast.error('No se pudo abrir el registro: ' + err.message);
    }
  }

  function remove(id, label) {
    Modal.confirm({
      title: 'Eliminar alcantarilla',
      message: `Se eliminará la alcantarilla #${escapeHTML(label)} y sus datos relacionados.`,
      danger: true,
      onConfirm: async () => {
        try {
          await API.deleteAlcantarilla(id);
          Toast.success('Alcantarilla eliminada');
          if (state.page > 1 && state.total - 1 <= (state.page - 1) * state.perPage) {
            state.page -= 1;
          }
          await load();
          refreshDashboard();
        } catch (err) {
          Toast.error('No se pudo eliminar: ' + err.message);
        }
      },
    });
  }

  async function refreshDashboard() {
    if (typeof Dashboard !== 'undefined' && typeof Dashboard.reload === 'function') {
      await Dashboard.reload();
    }
  }

  function bindEvents() {
    document.getElementById('btn-new-alcantarilla')?.addEventListener('click', () => openForm());
    document.getElementById('alcantarillas-prev')?.addEventListener('click', () => {
      if (state.page > 1) {
        state.page -= 1;
        load();
      }
    });
    document.getElementById('alcantarillas-next')?.addEventListener('click', () => {
      if (state.page < state.pages) {
        state.page += 1;
        load();
      }
    });

    const search = document.getElementById('alcantarillas-search');
    if (search) {
      let timer;
      search.addEventListener('input', () => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          state.q = search.value.trim();
          state.page = 1;
          load();
        }, 300);
      });
    }

    window.tableSearch = q => {
      const input = document.getElementById('alcantarillas-search');
      if (input && input.value !== q) input.value = q;
      state.q = q;
      state.page = 1;
      load();
    };
  }

  document.addEventListener('DOMContentLoaded', () => {
    bindEvents();
    load();
  });

  return { load, edit, remove };
})();