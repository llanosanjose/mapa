import '@fontsource/rajdhani/400.css';
import '@fontsource/rajdhani/500.css';
import '@fontsource/rajdhani/600.css';
import '@fontsource/rajdhani/700.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import '@fontsource/ibm-plex-mono/600.css';

import Map from 'ol/Map';
import View from 'ol/View';
import { fromLonLat, toLonLat } from 'ol/proj';
import { ScaleLine, defaults as defaultControls } from 'ol/control';

import { LAYER_DEFS, highlightLayer, highlightSource } from './layers.js';
import { MeasureTool } from './measure.js';
import { StreetSearch } from './search.js';

// ── Mapa ───────────────────────────────────────────────────────────────────
const map = new Map({
  target: 'map',
  layers: LAYER_DEFS.map(d => d.layer).concat(highlightLayer),
  view: new View({
    center: fromLonLat([-0.7425036435362692, 38.25367737126443]),
    zoom: 17,
    minZoom: 8,
    maxZoom: 20,
  }),
  controls: defaultControls({ attribution: true, zoom: true, rotate: false }),
});
window.__map = map;

// ── Loading bar ────────────────────────────────────────────────────────────
const loadingBar = document.createElement('div');
loadingBar.id = 'loading-bar';
document.body.appendChild(loadingBar);

let loadingCount = 0;
function setLoading(inc) {
  loadingCount += inc;
  loadingBar.classList.toggle('visible', loadingCount > 0);
}

LAYER_DEFS.forEach(({ layer }) => {
  const src = layer.getSource?.();
  if (!src) return;
  src.on?.('featuresloadstart', () => setLoading(1));
  src.on?.('featuresloadend',   () => setLoading(-1));
  src.on?.('featuresloaderror', () => setLoading(-1));
});

// ── Scale bar ──────────────────────────────────────────────────────────────
map.addControl(new ScaleLine({ units: 'metric', className: 'ol-scale-line' }));

// ── Coordinates display ────────────────────────────────────────────────────
const coordsEl = document.getElementById('coords');
map.on('pointermove', (evt) => {
  const [lon, lat] = toLonLat(evt.coordinate);
  coordsEl.textContent =
    'Lat ' + lat.toFixed(6) + '   Lon ' + lon.toFixed(6);
});

// ── Panel de capas ─────────────────────────────────────────────────────────
const layersPanel = document.getElementById('layers-panel');
const layersList  = document.getElementById('layers-list');

// Panel de capas con opacidad y reordenación
const layerOrder = [...LAYER_DEFS];

function swapLayers(i, j) {
  const zi = layerOrder[i].layer.getZIndex() ?? 0;
  const zj = layerOrder[j].layer.getZIndex() ?? 0;
  layerOrder[i].layer.setZIndex(zj);
  layerOrder[j].layer.setZIndex(zi);
  [layerOrder[i], layerOrder[j]] = [layerOrder[j], layerOrder[i]];
  renderLayersList();
}

function renderLayersList() {
  layersList.innerHTML = '';
  let currentGroup = null;
  const n = layerOrder.length;

  layerOrder.forEach(({ label, group, color, zoomHint, layer }, idx) => {
    if (group !== currentGroup) {
      currentGroup = group;
      const g = document.createElement('div');
      g.className = 'layer-group';
      g.textContent = group;
      layersList.appendChild(g);
    }

    const item = document.createElement('label');
    item.className = 'layer-item';

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = layer.getVisible();
    cb.addEventListener('change', () => layer.setVisible(cb.checked));

    const dot = document.createElement('span');
    dot.className = 'layer-dot';
    dot.style.background = color;

    const name = document.createElement('span');
    name.className = 'layer-name';
    name.textContent = label;

    item.appendChild(cb);
    item.appendChild(dot);
    item.appendChild(name);

    if (zoomHint) {
      const zh = document.createElement('span');
      zh.className = 'layer-zoom';
      zh.textContent = zoomHint;
      item.appendChild(zh);
    }

    // Reorder buttons
    const reorder = document.createElement('div');
    reorder.className = 'layer-reorder';

    const btnUp = document.createElement('button');
    btnUp.className = 'layer-reorder-btn';
    btnUp.title = 'Subir capa';
    btnUp.textContent = '▲';
    btnUp.disabled = idx === 0;
    btnUp.addEventListener('click', (e) => { e.preventDefault(); swapLayers(idx, idx - 1); });

    const btnDown = document.createElement('button');
    btnDown.className = 'layer-reorder-btn';
    btnDown.title = 'Bajar capa';
    btnDown.textContent = '▼';
    btnDown.disabled = idx === n - 1;
    btnDown.addEventListener('click', (e) => { e.preventDefault(); swapLayers(idx, idx + 1); });

    reorder.appendChild(btnUp);
    reorder.appendChild(btnDown);
    item.appendChild(reorder);

    layersList.appendChild(item);

    // Opacity row for every layer
    const opacityRow = document.createElement('div');
    opacityRow.className = 'layer-opacity-row';
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = 0; slider.max = 100;
    slider.value = Math.round(layer.getOpacity() * 100);
    slider.className = 'layer-opacity-slider';
    slider.title = 'Opacidad';
    const pct = document.createElement('span');
    pct.className = 'layer-opacity-pct';
    pct.textContent = slider.value + '%';
    slider.addEventListener('input', () => {
      layer.setOpacity(slider.value / 100);
      pct.textContent = slider.value + '%';
    });
    opacityRow.appendChild(slider);
    opacityRow.appendChild(pct);
    layersList.appendChild(opacityRow);
  });
}

renderLayersList();

document.getElementById('btn-layers').addEventListener('click', () => {
  layersPanel.classList.toggle('panel-closed');
  document.getElementById('btn-layers').classList.toggle('active',
    !layersPanel.classList.contains('panel-closed'));
});
document.getElementById('close-layers').addEventListener('click', () => {
  layersPanel.classList.add('panel-closed');
  document.getElementById('btn-layers').classList.remove('active');
});

// ── Herramienta de medición ────────────────────────────────────────────────
const measureTool = new MeasureTool(map);
document.getElementById('btn-measure').addEventListener('click', () => measureTool.toggle());


// ── Buscador ───────────────────────────────────────────────────────────────
const search = new StreetSearch(map, highlightSource);

// ── Atajos de teclado ──────────────────────────────────────────────────────
document.addEventListener('keydown', (e) => {
  if (document.activeElement.tagName === 'INPUT') return;
  if (e.key === 'l' || e.key === 'L') {
    layersPanel.classList.toggle('panel-closed');
    document.getElementById('btn-layers').classList.toggle('active',
      !layersPanel.classList.contains('panel-closed'));
  }
  if (e.key === 'f' || e.key === 'F') {
    document.getElementById('search-input').focus();
  }
});

// ── Toggle de tema claro / oscuro ──────────────────────────────────────────
const root = document.documentElement;

// Restaurar preferencia guardada (o respetar prefers-color-scheme)
const saved = localStorage.getItem('sigelx-theme');
if (saved) {
  root.setAttribute('data-theme', saved);
} else if (window.matchMedia('(prefers-color-scheme: light)').matches) {
  root.setAttribute('data-theme', 'light');
}

document.getElementById('btn-theme').addEventListener('click', () => {
  const next = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
  root.setAttribute('data-theme', next);
  localStorage.setItem('sigelx-theme', next);
});
