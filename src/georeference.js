/**
 * Herramienta de georreferenciación interactiva para ImageStatic de OpenLayers.
 * Flujo: clic en mapa → clic en imagen del plano → repetir N veces → Aplicar.
 * Resuelve la transformación afín por mínimos cuadrados.
 */
import ImageStatic from 'ol/source/ImageStatic';
import Overlay from 'ol/Overlay';

const PLAN_URL = '/plan_A2_11C.jpg';
const STORAGE_KEY = 'plan_a2_11c_extent';

export class GeoreferenceTool {
  constructor(map, planLayer) {
    this.map = map;
    this.planLayer = planLayer;
    this.gcps = [];            // [{px_rel, py_rel, x_geo, y_geo}]
    this.pendingMapCoord = null;
    this.pendingImgCoord = null;  // {px_rel, py_rel} — image clicked first
    this.active = false;
    this.imgZoom = 1.0;
    this._mapMarkerOverlay = null;

    this._mapClickFn = this._onMapClick.bind(this);
    this._buildPanel();

    // Restaurar extent guardado
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const ext = JSON.parse(saved);
        this._applyExtent(ext);
        console.log('[georef] Extent restaurado desde localStorage:', ext);
      } catch (_) {}
    }
  }

  toggle() {
    this.active ? this.deactivate() : this.activate();
  }

  activate() {
    this.active = true;
    this._panel.classList.remove('hidden');
    this.map.on('singleclick', this._mapClickFn);
    this._setStatus('map');
  }

  deactivate() {
    this.active = false;
    this._panel.classList.add('hidden');
    this.map.un('singleclick', this._mapClickFn);
    this.map.getTargetElement().style.cursor = '';
    this.pendingMapCoord = null;
    this.pendingImgCoord = null;
    this._removeMapMarker();
  }

  // ── Panel UI ────────────────────────────────────────────────────────────────
  _buildPanel() {
    const panel = document.createElement('div');
    panel.id = 'georef-panel';
    panel.className = 'georef-panel hidden';
    panel.innerHTML = `
      <div class="georef-hdr">
        <span class="georef-title">GEORREFERENCIAR · Plan A2 11-C</span>
        <div class="georef-hdr-btns">
          <button id="georef-zoom-in"  title="Zoom +">+</button>
          <button id="georef-zoom-out" title="Zoom −">−</button>
          <button id="georef-close"    title="Cerrar">×</button>
        </div>
      </div>
      <div class="georef-status" id="georef-status"></div>
      <div class="georef-img-wrap" id="georef-img-wrap">
        <div class="georef-img-inner" id="georef-img-inner">
          <img id="georef-img" src="${PLAN_URL}" draggable="false" />
          <canvas id="georef-canvas"></canvas>
        </div>
      </div>
      <div class="georef-table-wrap">
        <table class="georef-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Geo X (m)</th>
              <th>Geo Y (m)</th>
              <th>Img X</th>
              <th>Img Y</th>
              <th></th>
            </tr>
          </thead>
          <tbody id="georef-tbody"></tbody>
        </table>
      </div>
      <div class="georef-footer">
        <button id="georef-clear">Limpiar</button>
        <button id="georef-apply" disabled>Aplicar (0 GCPs)</button>
      </div>
    `;
    document.body.appendChild(panel);
    this._panel = panel;

    // Listeners de botones
    panel.querySelector('#georef-close').onclick  = () => this.deactivate();
    panel.querySelector('#georef-clear').onclick  = () => this._clearGCPs();
    panel.querySelector('#georef-apply').onclick  = () => this._apply();
    panel.querySelector('#georef-zoom-in').onclick  = () => this._zoom(0.25);
    panel.querySelector('#georef-zoom-out').onclick = () => this._zoom(-0.25);

    // Clic en imagen del plano
    const img = panel.querySelector('#georef-img');
    img.addEventListener('click', (e) => this._onImgClick(e));

    // Scroll to zoom
    panel.querySelector('#georef-img-wrap').addEventListener('wheel', (e) => {
      e.preventDefault();
      this._zoom(e.deltaY < 0 ? 0.15 : -0.15);
    }, { passive: false });

    // Redibujar canvas cuando carga la imagen
    img.addEventListener('load', () => this._drawMarkers());
  }

  _zoom(delta) {
    this.imgZoom = Math.max(0.25, Math.min(4, this.imgZoom + delta));
    const inner = document.getElementById('georef-img-inner');
    inner.style.transform = `scale(${this.imgZoom})`;
    inner.style.transformOrigin = 'top left';
    this._drawMarkers();
  }

  // ── Lógica de clicks ────────────────────────────────────────────────────────
  _onMapClick(evt) {
    const coord = evt.coordinate.slice();

    if (this.pendingImgCoord !== null) {
      // Image was clicked first — complete the GCP now
      const { px_rel, py_rel } = this.pendingImgCoord;
      this.pendingImgCoord = null;
      this.gcps.push({ px_rel, py_rel, x_geo: coord[0], y_geo: coord[1] });
      this._removeMapMarker();
      this._drawMarkers();
      this._updateTable();
      this._setStatus('map');
      return;
    }

    if (this.pendingMapCoord !== null) return; // Already waiting for image click
    this.pendingMapCoord = coord;
    this._setStatus('plan');
    this._showMapMarker(coord);
  }

  _onImgClick(e) {
    const img = document.getElementById('georef-img');
    const rect = img.getBoundingClientRect();
    const px_rel = (e.clientX - rect.left) / rect.width;
    const py_rel = (e.clientY - rect.top) / rect.height;

    if (this.pendingMapCoord !== null) {
      // Map was clicked first — complete the GCP now
      const [x_geo, y_geo] = this.pendingMapCoord;
      this.pendingMapCoord = null;
      this.gcps.push({ px_rel, py_rel, x_geo, y_geo });
      this._removeMapMarker();
      this._drawMarkers();
      this._updateTable();
      this._setStatus('map');
      return;
    }

    // Image clicked first — store pending and wait for map click
    this.pendingImgCoord = { px_rel, py_rel };
    this._drawPendingImgMarker(px_rel, py_rel);
    this._setStatus('map-after-img');
  }

  _showMapMarker(coord) {
    this._removeMapMarker();
    const el = document.createElement('div');
    el.style.cssText = 'width:16px;height:16px;background:#e53935;border:2px solid #fff;border-radius:50%;transform:translate(-50%,-50%);pointer-events:none;box-shadow:0 0 6px rgba(0,0,0,0.6)';
    this._mapMarkerOverlay = new Overlay({ element: el, positioning: 'center-center', stopEvent: false });
    this.map.addOverlay(this._mapMarkerOverlay);
    this._mapMarkerOverlay.setPosition(coord);
  }

  _removeMapMarker() {
    if (this._mapMarkerOverlay) {
      this.map.removeOverlay(this._mapMarkerOverlay);
      this._mapMarkerOverlay = null;
    }
  }

  _drawPendingImgMarker(px_rel, py_rel) {
    const img = document.getElementById('georef-img');
    const canvas = document.getElementById('georef-canvas');
    const W = img.offsetWidth;
    const H = img.offsetHeight;
    if (!W || !H) return;
    canvas.width = W;
    canvas.height = H;
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, W, H);
    // Draw existing GCPs
    this.gcps.forEach((g, i) => {
      const x = g.px_rel * W, y = g.py_rel * H;
      ctx.beginPath(); ctx.arc(x, y, 9, 0, 2 * Math.PI);
      ctx.fillStyle = '#e53935'; ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(i + 1, x, y);
    });
    // Draw pending image point (dashed circle, waiting for map)
    const x = px_rel * W, y = py_rel * H;
    ctx.beginPath(); ctx.arc(x, y, 9, 0, 2 * Math.PI);
    ctx.setLineDash([4, 3]);
    ctx.strokeStyle = '#e53935'; ctx.lineWidth = 2; ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#e53935'; ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('?', x, y);
  }

  // ── Estado y UI ─────────────────────────────────────────────────────────────
  _setStatus(step) {
    const el = document.getElementById('georef-status');
    if (step === 'map') {
      el.textContent = '① Clic en el MAPA  —  o clic en el PLANO para empezar por la imagen';
      el.dataset.step = 'map';
      this.map.getTargetElement().style.cursor = 'crosshair';
    } else if (step === 'plan') {
      el.textContent = '② Ahora haz clic en el PLANO sobre el mismo punto';
      el.dataset.step = 'plan';
      this.map.getTargetElement().style.cursor = '';
    } else if (step === 'map-after-img') {
      el.textContent = '② Ahora haz clic en el MAPA sobre el mismo punto';
      el.dataset.step = 'plan';
      this.map.getTargetElement().style.cursor = 'crosshair';
    } else {
      el.textContent = step;
      el.dataset.step = 'done';
      this.map.getTargetElement().style.cursor = '';
    }
  }

  _updateTable() {
    const tbody = document.getElementById('georef-tbody');
    tbody.innerHTML = this.gcps.map((g, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${Math.round(g.x_geo)}</td>
        <td>${Math.round(g.y_geo)}</td>
        <td>${(g.px_rel * 100).toFixed(1)}%</td>
        <td>${(g.py_rel * 100).toFixed(1)}%</td>
        <td><button class="georef-del" data-i="${i}">✕</button></td>
      </tr>
    `).join('');
    tbody.querySelectorAll('.georef-del').forEach(btn =>
      btn.addEventListener('click', () => this._removeGCP(+btn.dataset.i))
    );
    const applyBtn = document.getElementById('georef-apply');
    applyBtn.disabled = this.gcps.length < 2;
    applyBtn.textContent = `Aplicar (${this.gcps.length} GCPs)`;
  }

  _drawMarkers() {
    const img    = document.getElementById('georef-img');
    const canvas = document.getElementById('georef-canvas');
    const W = img.offsetWidth;
    const H = img.offsetHeight;
    canvas.width  = W;
    canvas.height = H;
    canvas.style.width  = W + 'px';
    canvas.style.height = H + 'px';
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, W, H);
    this.gcps.forEach((g, i) => {
      const x = g.px_rel * W;
      const y = g.py_rel * H;
      ctx.beginPath();
      ctx.arc(x, y, 9, 0, 2 * Math.PI);
      ctx.fillStyle = '#e53935';
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(i + 1, x, y);
    });
    // Punto pendiente (sin confirmar en imagen)
    if (this.pendingMapCoord) {
      // crosshair en el plano para indicar que hay que clicar
    }
  }

  _removeGCP(i) {
    this.gcps.splice(i, 1);
    this._drawMarkers();
    this._updateTable();
  }

  _clearGCPs() {
    this.gcps = [];
    this.pendingMapCoord = null;
    this.pendingImgCoord = null;
    this._removeMapMarker();
    this._drawMarkers();
    this._updateTable();
    this._setStatus('map');
  }

  // ── Cálculo afín por mínimos cuadrados ──────────────────────────────────────
  // x_geo = a·px_rel + b    →  xmin=b, xmax=a+b
  // y_geo = c·py_rel + d    →  ymax=d, ymin=c+d
  _solveExtent() {
    const g = this.gcps;
    const n = g.length;

    function linReg(xs, ys) {
      const sx  = xs.reduce((a, v) => a + v, 0);
      const sy  = ys.reduce((a, v) => a + v, 0);
      const sx2 = xs.reduce((a, v) => a + v * v, 0);
      const sxy = xs.reduce((a, v, i) => a + v * ys[i], 0);
      const den = n * sx2 - sx * sx;
      const slope = den ? (n * sxy - sx * sy) / den : 0;
      const inter = (sy - slope * sx) / n;
      return [slope, inter];
    }

    const [a, b] = linReg(g.map(p => p.px_rel), g.map(p => p.x_geo));
    const [c, d] = linReg(g.map(p => p.py_rel), g.map(p => p.y_geo));

    const xmin = b;
    const xmax = a + b;
    const ymax = d;
    const ymin = c + d;
    return [xmin, ymin, xmax, ymax];
  }

  _apply() {
    if (this.gcps.length < 2) return;
    const extent = this._solveExtent();
    this._applyExtent(extent);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(extent));
    this._setStatus(`✅ Aplicado — extent: [${extent.map(v => v.toFixed(0)).join(', ')}]`);
    console.log('[georef] Extent aplicado y guardado:', extent);
  }

  _applyExtent(extent) {
    this.planLayer.setSource(new ImageStatic({
      url: PLAN_URL,
      imageExtent: extent,
      projection: 'EPSG:3857',
    }));
    this.map.render();
  }
}
