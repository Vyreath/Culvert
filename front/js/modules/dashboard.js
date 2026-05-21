/**
 * dashboard.js — KPIs, gráficas y últimas inspecciones
 */

const Dashboard = (() => {
  const charts = {};

  async function reload({ redrawCharts = false } = {}) {
    renderSkeletonKPIs();

    try {
      const data = await API.getKPIs();
      renderKPIs(data);
      renderUltimasInspecciones(data.ultimas_inspecciones || []);

      if (redrawCharts) {
        renderChartEstados(data.por_estado || []);
        renderChartProvincias(data.por_provincia || []);
        renderChartMateriales(data.por_material || []);
      }
    } catch (err) {
      Toast.error('Error al cargar el dashboard: ' + err.message);
    }
  }

  document.addEventListener('DOMContentLoaded', () => reload({ redrawCharts: true }));

  return { reload, charts };
})();

/* ── Skeleton mientras carga ── */
function renderSkeletonKPIs() {
  ['kpi-total', 'kpi-bueno', 'kpi-regular', 'kpi-malo'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = '<div class="skeleton" style="height:32px;width:60%;border-radius:4px"></div>';
  });
}

/* ── Tarjetas KPI ── */
function renderKPIs(data) {
  const total   = data.total_alcantarillas || 0;
  const estados = data.por_estado || [];

  const cnt = nombre => (estados.find(e => e.estado === nombre) || {}).cantidad || 0;

  setKPI('kpi-total',   total);
  setKPI('kpi-bueno',   cnt('Bueno'));
  setKPI('kpi-regular', cnt('Regular'));
  setKPI('kpi-malo',    cnt('Malo'));
}

function setKPI(id, value) {
  const el = document.getElementById(id);

  if (!el) return;

  el.textContent = fmtNum(value);
}

/* ── Gráfica: estados ── */
function renderChartEstados(data) {
  const ctx = document.getElementById('chart-estados');
  if (!ctx || !data.length) return;

  const colors = {
    'Bueno':   '#3FB950',
    'Regular': '#D29922',
    'Malo':    '#F85149',
  };

  if (Dashboard.charts.estados) Dashboard.charts.estados.destroy();
  Dashboard.charts.estados = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: data.map(d => d.estado),
      datasets: [{
        data:            data.map(d => d.cantidad),
        backgroundColor: data.map(d => colors[d.estado] || '#58A6FF'),
        borderColor:     '#161B22',
        borderWidth:     3,
        hoverOffset:     6,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '68%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: '#8B949E', padding: 16, font: { size: 12 } },
        },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.label}: ${fmtNum(ctx.raw)} (${
              Math.round(ctx.raw / ctx.dataset.data.reduce((a,b) => a+b, 0) * 100)
            }%)`,
          },
        },
      },
    },
  });
}

/* ── Gráfica: provincias ── */
function renderChartProvincias(data) {
  const ctx = document.getElementById('chart-provincias');
  if (!ctx || !data.length) return;

  if (Dashboard.charts.provincias) Dashboard.charts.provincias.destroy();
  Dashboard.charts.provincias = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: data.map(d => d.provincia || 'N/D'),
      datasets: [{
        label:           'Alcantarillas',
        data:            data.map(d => d.cantidad),
        backgroundColor: 'rgba(63,177,255,0.25)',
        borderColor:     '#3FB1FF',
        borderWidth:     1.5,
        borderRadius:    4,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: 'y',
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: { label: ctx => ` ${fmtNum(ctx.raw)} registros` },
        },
      },
      scales: {
        x: {
          grid:  { color: '#21262D' },
          ticks: { color: '#8B949E', font: { size: 11 } },
        },
        y: {
          grid:  { display: false },
          ticks: { color: '#E6EDF3', font: { size: 11 } },
        },
      },
    },
  });
}

/* ── Gráfica: materiales ── */
function renderChartMateriales(data) {
  const ctx = document.getElementById('chart-materiales');
  if (!ctx || !data.length) return;

  const palette = ['#3FB1FF','#3FB950','#D29922','#F85149','#58A6FF','#79C0FF'];

  if (Dashboard.charts.materiales) Dashboard.charts.materiales.destroy();
  Dashboard.charts.materiales = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: data.map(d => d.material),
      datasets: [{
        label:           'Tuberías',
        data:            data.map(d => d.cantidad),
        backgroundColor: data.map((_, i) => palette[i % palette.length] + '33'),
        borderColor:     data.map((_, i) => palette[i % palette.length]),
        borderWidth:     1.5,
        borderRadius:    4,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
      },
      scales: {
        x: {
          grid:  { display: false },
          ticks: { color: '#8B949E', font: { size: 11 } },
        },
        y: {
          grid:  { color: '#21262D' },
          ticks: { color: '#8B949E', font: { size: 11 } },
        },
      },
    },
  });
}

/* ── Tabla últimas inspecciones ── */
function renderUltimasInspecciones(data) {
  const tbody = document.getElementById('tbody-inspecciones');
  if (!tbody) return;

  if (!data.length) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:var(--color-text-muted);padding:24px">
      Sin inspecciones recientes</td></tr>`;
    return;
  }

  tbody.innerHTML = data.map(i => `
    <tr>
      <td>
        <a href="/alcantarillas/${i.alcantarilla_id}"
           style="color:var(--color-accent);font-weight:600">
          #${i.ficha_numero || i.alcantarilla_id}
        </a>
      </td>
      <td style="color:var(--color-text-muted);font-size:0.8rem">${i.ubicacion || '—'}</td>
      <td>${i.inspector || '—'}</td>
      <td><span style="font-family:var(--font-mono);font-size:0.8rem">${fmtDate(i.fecha)}</span></td>
    </tr>`
  ).join('');
}
