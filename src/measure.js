import Draw from 'ol/interaction/Draw';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import Overlay from 'ol/Overlay';
import { getLength } from 'ol/sphere';
import { unByKey } from 'ol/Observable';
import { Style, Fill, Stroke, Circle as CircleStyle } from 'ol/style';
import { LineString } from 'ol/geom';

const DRAW_STYLE = [
  new Style({
    stroke: new Stroke({ color: '#c49230', width: 2, lineDash: [6, 4] }),
    fill:   new Fill({ color: 'rgba(196,146,48,0.08)' }),
  }),
  new Style({
    image: new CircleStyle({
      radius: 5,
      fill:   new Fill({ color: '#c49230' }),
      stroke: new Stroke({ color: '#0d1017', width: 1.5 }),
    }),
    geometry: function (feature) {
      const geom = feature.getGeometry();
      if (geom instanceof LineString) {
        return new (geom.constructor)([geom.getLastCoordinate()]);
      }
      return geom;
    },
  }),
];

function formatLength(meters) {
  if (meters >= 1000) return (meters / 1000).toFixed(3) + ' km';
  return Math.round(meters) + ' m';
}

export class MeasureTool {
  constructor(map) {
    this.map    = map;
    this.active = false;
    this._draw  = null;
    this._listener = null;

    this._source = new VectorSource();
    this._layer  = new VectorLayer({
      source: this._source,
      style: DRAW_STYLE,
      zIndex: 500,
    });
    map.addLayer(this._layer);

    // Tooltip overlay
    this._tipEl = document.createElement('div');
    this._tipEl.className = 'measure-tooltip';
    this._overlay = new Overlay({
      element: this._tipEl,
      positioning: 'center-left',
      stopEvent: false,
    });
    map.addOverlay(this._overlay);

    // Final tooltip overlays (persistent)
    this._finalOverlays = [];

    // Keyboard shortcut
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.active) this.deactivate();
      if (e.key === 'm' || e.key === 'M') {
        if (document.activeElement.tagName !== 'INPUT') this.toggle();
      }
    });
  }

  toggle() {
    this.active ? this.deactivate() : this.activate();
  }

  activate() {
    this.active = true;
    document.getElementById('btn-measure').classList.add('active');
    document.getElementById('map').classList.add('measuring');
    document.getElementById('measure-hint').classList.remove('hidden');

    this._draw = new Draw({
      source: this._source,
      type: 'LineString',
      style: DRAW_STYLE,
    });
    this.map.addInteraction(this._draw);

    this._draw.on('drawstart', (evt) => {
      const sketch = evt.feature;
      this._tipEl.classList.remove('measure-tooltip-final');

      this._listener = sketch.getGeometry().on('change', (e) => {
        const geom = e.target;
        const len  = getLength(geom);
        this._tipEl.textContent = formatLength(len);
        const coords = geom.getCoordinates();
        this._overlay.setPosition(coords[coords.length - 1]);
      });
    });

    this._draw.on('drawend', (evt) => {
      // Create a permanent tooltip at the midpoint
      const geom = evt.feature.getGeometry();
      const len  = getLength(geom);
      const coords = geom.getCoordinates();
      const mid  = coords[Math.floor(coords.length / 2)];

      const finalEl = document.createElement('div');
      finalEl.className = 'measure-tooltip measure-tooltip-final';
      finalEl.textContent = formatLength(len);

      const finalOverlay = new Overlay({
        element: finalEl,
        positioning: 'center-left',
        stopEvent: false,
        offset: [10, 0],
      });
      this.map.addOverlay(finalOverlay);
      finalOverlay.setPosition(mid);
      this._finalOverlays.push(finalOverlay);

      // Hide running tooltip
      this._overlay.setPosition(undefined);
      unByKey(this._listener);
    });
  }

  deactivate() {
    this.active = false;
    document.getElementById('btn-measure').classList.remove('active');
    document.getElementById('map').classList.remove('measuring');
    document.getElementById('measure-hint').classList.add('hidden');

    if (this._draw) {
      this.map.removeInteraction(this._draw);
      this._draw = null;
    }
    if (this._listener) {
      unByKey(this._listener);
      this._listener = null;
    }

    // Clear everything
    this._source.clear();
    this._overlay.setPosition(undefined);
    this._tipEl.textContent = '';

    this._finalOverlays.forEach(o => this.map.removeOverlay(o));
    this._finalOverlays = [];
  }
}
