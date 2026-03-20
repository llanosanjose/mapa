import GeoJSON from 'ol/format/GeoJSON';
import Feature from 'ol/Feature';
import { Point, LineString } from 'ol/geom';

const fmt = new GeoJSON({ featureProjection: 'EPSG:3857' });

/**
 * Buscador de calles y números de policía.
 * Carga VIARIO + ndpu directamente vía fetch para que esté
 * disponible independientemente del zoom del mapa.
 */
export class StreetSearch {
  constructor(map, highlightSource) {
    this.map             = map;
    this.highlightSource = highlightSource;

    /** @type {Map<number, {nomvia:string, tipcalle:string, geom:object, ndpu:Map<string,object>}>} */
    this.index = new Map(); // kcalle → entry (coordenadas GeoJSON raw)

    this._selectedKcalle = null;
    this._ready = false;
    this._onAddressResolved = null; // callback(kcalle, numPoli)

    // DOM refs
    this.inputEl     = document.getElementById('search-input');
    this.clearBtn    = document.getElementById('search-clear');
    this.resultsList = document.getElementById('search-results');
    this.numberWrap  = document.getElementById('search-number-wrap');
    this.streetLabel = document.getElementById('search-street-label');
    this.numberInput = document.getElementById('search-number');
    this.goBtn       = document.getElementById('search-go');
    this.resetBtn    = document.getElementById('search-reset');

    this._bindEvents();
    this._loadData();
  }

  getIndex() { return this.index; }

  async _loadData() {
    try {
      const base = import.meta.env.BASE_URL;
      const [viario, ndpu] = await Promise.all([
        fetch(base + 'cartografia_elche/viario.geojson').then(r => r.json()),
        fetch(base + 'cartografia_elche/ndpu.geojson').then(r => r.json()),
      ]);

      // Indexar viario
      viario.features.forEach(f => {
        const p = f.properties;
        if (p.kcalle == null) return;
        this.index.set(p.kcalle, {
          nomvia:   (p.nomvia   || '').trim(),
          tipcalle: (p.tipcalle || '').trim(),
          feature:  fmt.readFeature(f),
          ndpu:     new Map(),
        });
      });

      // Indexar ndpu
      ndpu.features.forEach(f => {
        const p = f.properties;
        const entry = this.index.get(p.cod_calle);
        if (!entry) return;
        const num = String(p.num_poli || '').trim();
        entry.ndpu.set(num, fmt.readFeature(f));
      });

      this._ready = true;
      console.log('[Search] Listo:', this.index.size, 'calles,',
        [...this.index.values()].reduce((s, e) => s + e.ndpu.size, 0), 'números');
    } catch (e) {
      console.warn('[Search] Error cargando datos:', e);
    }
  }

  _bindEvents() {
    this.inputEl.addEventListener('input', () => this._onInput());
    this.inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.preventDefault(); this._clearAll(); }
      if (e.key === 'ArrowDown') {
        const first = this.resultsList.querySelector('li');
        if (first) { e.preventDefault(); first.focus(); }
      }
    });

    this.clearBtn.addEventListener('click', () => this._clearAll());
    this.goBtn.addEventListener('click', () => this._goToNumber());
    this.resetBtn.addEventListener('click', () => this._clearAll());

    this.numberInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this._goToNumber();
      if (e.key === 'Escape') this._clearAll();
    });

    this.resultsList.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); (e.target.nextElementSibling || e.target).focus(); }
      if (e.key === 'ArrowUp')   { e.preventDefault(); (e.target.previousElementSibling || this.inputEl).focus(); }
      if (e.key === 'Escape')    { this._clearAll(); }
    });
  }

  _onInput() {
    const q = this.inputEl.value.trim();
    if (!this._ready) {
      this._showMessage('Cargando datos…');
      return;
    }
    if (q.length < 2) { this._hideResults(); return; }
    this._showResults(this._search(q), q);
  }

  _search(query) {
    const q = query.toLowerCase();
    const matches = [];
    for (const [kcalle, entry] of this.index) {
      if (entry.nomvia.toLowerCase().includes(q)) matches.push({ kcalle, ...entry });
    }
    return matches.sort((a, b) => {
      const aStart = a.nomvia.toLowerCase().startsWith(q) ? 0 : 1;
      const bStart = b.nomvia.toLowerCase().startsWith(q) ? 0 : 1;
      return aStart !== bStart ? aStart - bStart : a.nomvia.localeCompare(b.nomvia, 'es');
    }).slice(0, 25);
  }

  _showResults(results, query) {
    this.resultsList.innerHTML = '';
    if (results.length === 0) {
      const li = this._resultItem('<em style="color:var(--text-3)">Sin resultados</em>', '');
      li.style.cursor = 'default';
      this.resultsList.appendChild(li);
      return;
    }
    const q = query.toLowerCase();
    results.forEach(entry => {
      const idx = entry.nomvia.toLowerCase().indexOf(q);
      let html = entry.nomvia;
      if (idx >= 0) {
        html = entry.nomvia.slice(0, idx)
          + '<mark>' + entry.nomvia.slice(idx, idx + q.length) + '</mark>'
          + entry.nomvia.slice(idx + q.length);
      }
      const li = this._resultItem(
        '<span class="street-name">' + html + '</span>',
        entry.tipcalle ? '<span class="street-type">' + entry.tipcalle + '</span>' : '',
      );
      li.addEventListener('click', () => this._selectStreet(entry));
      li.addEventListener('keydown', e => { if (e.key === 'Enter') this._selectStreet(entry); });
      this.resultsList.appendChild(li);
    });
  }

  _resultItem(leftHtml, rightHtml) {
    const li = document.createElement('li');
    li.tabIndex = 0;
    li.innerHTML = leftHtml + rightHtml;
    return li;
  }

  _showMessage(msg) {
    this.resultsList.innerHTML = '';
    const li = document.createElement('li');
    li.style.color = 'var(--text-3)';
    li.textContent = msg;
    this.resultsList.appendChild(li);
  }

  _hideResults() {
    this.resultsList.innerHTML = '';
  }

  _selectStreet(entry) {
    this._selectedKcalle = entry.kcalle;
    this._hideResults();

    this.highlightSource.clear();
    this.highlightSource.addFeature(entry.feature);

    const ext = entry.feature.getGeometry().getExtent();
    this.map.getView().fit(ext, { padding: [80, 80, 80, 80], maxZoom: 18, duration: 600 });

    this.streetLabel.textContent = entry.nomvia;
    this.numberWrap.classList.remove('hidden');
    this.inputEl.value = entry.nomvia;
    this.numberInput.value = '';
    setTimeout(() => this.numberInput.focus(), 300);
  }

  _goToNumber() {
    const raw = this.numberInput.value.trim();
    if (!raw || this._selectedKcalle == null) return;

    const entry = this.index.get(this._selectedKcalle);
    if (!entry) return;

    // Intentar con cero-padded (0003), sin ceros (3) y tal cual
    const padded   = raw.padStart(4, '0');
    const unpadded = String(parseInt(raw, 10) || raw);
    const resolvedKey = entry.ndpu.has(padded)   ? padded
                      : entry.ndpu.has(raw)      ? raw
                      : entry.ndpu.has(unpadded) ? unpadded
                      : null;
    const feat = resolvedKey ? entry.ndpu.get(resolvedKey) : null;

    if (!feat) {
      this.numberInput.style.borderColor = 'var(--red)';
      setTimeout(() => { this.numberInput.style.borderColor = ''; }, 1500);
      return;
    }

    this.highlightSource.clear();
    this.highlightSource.addFeature(feat);
    const coord = feat.getGeometry().getCoordinates();
    this.map.getView().animate({ center: coord, zoom: 19, duration: 700 });

    this._onAddressResolved?.(this._selectedKcalle, resolvedKey);
  }

  _clearAll() {
    this.inputEl.value = '';
    this._hideResults();
    this.numberWrap.classList.add('hidden');
    this.numberInput.value = '';
    this._selectedKcalle = null;
    this.highlightSource.clear();
    this.inputEl.focus();
  }
}
