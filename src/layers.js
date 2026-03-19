import TileLayer from 'ol/layer/Tile';
import ImageLayer from 'ol/layer/Image';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import XYZ from 'ol/source/XYZ';
import ImageStatic from 'ol/source/ImageStatic';
import GeoJSON from 'ol/format/GeoJSON';
import { Style, Fill, Stroke, Circle as CircleStyle, Text } from 'ol/style';
import {
  style_termino_municipal,
  style_partidas_rurales,
  style_nucleos_poblacion,
  style_humedales_cauces_barrancos,
  style_cartografia_nucleos,
  style_cartografia_diseminado,
  style_provincia_alicante,
  style_mar_mediterraneo,
} from './estilos_ol.js';

// ── PNOA IGN (XYZ/WMTS KVP) ───────────────────────────────────────────────
const pnoaSource = new XYZ({
  url: 'https://www.ign.es/wmts/pnoa-ma'
    + '?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0'
    + '&LAYER=OI.OrthoimageCoverage&STYLE=default'
    + '&TILEMATRIXSET=GoogleMapsCompatible'
    + '&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}'
    + '&FORMAT=image%2Fjpeg',
  crossOrigin: 'anonymous',
  maxZoom: 20,
  attributions: '© <a href="https://www.ign.es" target="_blank">IGN</a> PNOA Max. Actual',
});

// ── GeoJSON format (reproject WGS84 → Web Mercator) ──────────────────────
export const fmt = new GeoJSON({ featureProjection: 'EPSG:3857' });

function geojsonSource(path) {
  return new VectorSource({ url: path, format: fmt });
}

// ── Callejero sources — loaded explicitly so search works at any zoom ─────
export const viarioSource = new VectorSource();
export const ndpuSource   = new VectorSource();

function loadSearchData() {
  fetch('/cartografia_elche/viario.geojson')
    .then(r => r.json())
    .then(data => {
      viarioSource.addFeatures(fmt.readFeatures(data));
      viarioSource.dispatchEvent('featuresloadend');
    })
    .catch(e => console.warn('[viario]', e));

  fetch('/cartografia_elche/ndpu.geojson')
    .then(r => r.json())
    .then(data => {
      ndpuSource.addFeatures(fmt.readFeatures(data));
      ndpuSource.dispatchEvent('featuresloadend');
    })
    .catch(e => console.warn('[ndpu]', e));
}
loadSearchData();

// ── Estilos callejero ──────────────────────────────────────────────────────
const viarioStyle = new Style({
  stroke: new Stroke({ color: '#f5c842', width: 1.8 }),
});

function ndpuStyle(feature) {
  return new Style({
    image: new CircleStyle({
      radius: 5,
      fill: new Fill({ color: '#c49230' }),
      stroke: new Stroke({ color: '#0d1017', width: 1.5 }),
    }),
    text: new Text({
      text: String(feature.get('num_poli') ?? '').replace(/^0+/, ''),
      font: 'bold 13px IBM Plex Mono, Inconsolata, monospace',
      fill: new Fill({ color: '#ffffff' }),
      stroke: new Stroke({ color: '#0d1017', width: 3 }),
      offsetY: -15,
      overflow: false,
    }),
  });
}

// ── Highlight layer para búsqueda ─────────────────────────────────────────
export const highlightSource = new VectorSource();
export const highlightLayer = new VectorLayer({
  source: highlightSource,
  style: function (feature) {
    const type = feature.getGeometry().getType();
    if (type === 'Point') {
      return new Style({
        image: new CircleStyle({
          radius: 10,
          fill: new Fill({ color: 'rgba(196,146,48,0.25)' }),
          stroke: new Stroke({ color: '#e8b84a', width: 2.5 }),
        }),
      });
    }
    return new Style({
      stroke: new Stroke({ color: '#e8b84a', width: 3.5 }),
      fill:   new Fill({ color: 'rgba(196,146,48,0.08)' }),
    });
  },
  zIndex: 999,
});

// ── Definición de todas las capas ──────────────────────────────────────────
// Orden: arriba del panel = encima en el mapa = zIndex más alto
export const LAYER_DEFS = [
  // ── Callejero ────────────────────────────────────────────────────────
  {
    group: 'Callejero',
    id: 'ndpu',
    label: 'Números de policía',
    color: '#c49230',
    zoomHint: '≥ z17',
    layer: new VectorLayer({
      source: ndpuSource,
      style: ndpuStyle,
      minZoom: 17,
      zIndex: 160,
    }),
  },
  {
    group: 'Callejero',
    id: 'viario',
    label: 'Callejero (viario)',
    color: '#f5c842',
    layer: new VectorLayer({
      source: viarioSource,
      style: viarioStyle,
      zIndex: 150,
    }),
  },
  // ── Fases de trabajo ────────────────────────────────────────────────
  {
    group: 'Fases',
    id: 'fase1',
    label: 'FASE 1',
    color: '#fe7b07',
    layer: new VectorLayer({
      source: geojsonSource('/cartografia_elche/fase_1.geojson'),
      style: [
        new Style({ stroke: new Stroke({ color: 'rgba(0,0,0,0.55)', width: 8 }) }),
        new Style({ stroke: new Stroke({ color: '#fe7b07', width: 4 }) }),
      ],
      zIndex: 140,
      visible: true,
    }),
  },
  {
    group: 'Fases',
    id: 'fase1b',
    label: 'FASE 1B',
    color: '#fe7b07',
    layer: new VectorLayer({
      source: geojsonSource('/cartografia_elche/fase_1b.geojson'),
      style: [
        new Style({ stroke: new Stroke({ color: 'rgba(0,0,0,0.55)', width: 8 }) }),
        new Style({ stroke: new Stroke({ color: '#fe7b07', width: 4, lineDash: [10, 8] }) }),
      ],
      zIndex: 130,
      visible: true,
    }),
  },
  // ── Cartografía ─────────────────────────────────────────────────────
  {
    group: 'Cartografía',
    id: 'termino',
    label: 'Término municipal',
    color: '#ffffff',
    layer: new VectorLayer({
      source: geojsonSource('/cartografia_elche/termino_municipal.geojson'),
      style: style_termino_municipal,
      zIndex: 120,
    }),
  },
  {
    group: 'Cartografía',
    id: 'nucleospob',
    label: 'Núcleos de población',
    color: '#ff4060',
    layer: new VectorLayer({
      source: geojsonSource('/cartografia_elche/nucleos_poblacion.geojson'),
      style: style_nucleos_poblacion,
      zIndex: 110,
    }),
  },
  {
    group: 'Cartografía',
    id: 'humedales',
    label: 'Humedales y cauces',
    color: '#00a9e6',
    layer: new VectorLayer({
      source: geojsonSource('/cartografia_elche/humedales_cauces_barrancos.geojson'),
      style: style_humedales_cauces_barrancos,
      zIndex: 100,
    }),
  },
  {
    group: 'Cartografía',
    id: 'partidas',
    label: 'Partidas rurales',
    color: '#aaaaaa',
    layer: new VectorLayer({
      source: geojsonSource('/cartografia_elche/partidas_rurales.geojson'),
      style: style_partidas_rurales,
      zIndex: 90,
    }),
  },
  // ── Núcleos urbanos ─────────────────────────────────────────────────
  {
    group: 'Núcleos — Cartografía',
    id: 'nucleos_resto',
    label: 'Núcleos (resto)',
    color: '#ffbebe',
    zoomHint: '≥ z15',
    layer: new VectorLayer({
      source: geojsonSource('/cartografia_elche/cartografia_nucleos_resto.geojson'),
      style: style_cartografia_nucleos,
      minZoom: 15,
      zIndex: 80,
      visible: true,
    }),
  },
  {
    group: 'Núcleos — Cartografía',
    id: 'nucleos_elche',
    label: 'Elche / Elx',
    color: '#ffaaaa',
    zoomHint: '≥ z15',
    layer: new VectorLayer({
      source: geojsonSource('/cartografia_elche/cartografia_nucleos_elche.geojson'),
      style: style_cartografia_nucleos,
      minZoom: 15,
      zIndex: 70,
      visible: false,
    }),
  },
  // ── Partidas rurales ─────────────────────────────────────────────────
  {
    group: 'Partidas — Cartografía',
    id: 'llano',
    label: 'Llano de San José',
    color: '#e6e6a0',
    zoomHint: '≥ z13',
    layer: new VectorLayer({
      source: geojsonSource('/cartografia_elche/cartografia_llano_san_jose.geojson'),
      style: style_cartografia_diseminado,
      minZoom: 13,
      zIndex: 60,
      visible: true,
    }),
  },
  {
    group: 'Partidas — Cartografía',
    id: 'matola',
    label: 'Matola',
    color: '#d4e6a0',
    zoomHint: '≥ z13',
    layer: new VectorLayer({
      source: geojsonSource('/cartografia_elche/cartografia_matola.geojson'),
      style: style_cartografia_diseminado,
      minZoom: 13,
      zIndex: 50,
      visible: true,
    }),
  },
  {
    group: 'Partidas — Cartografía',
    id: 'diseminado_resto',
    label: 'Resto de partidas',
    color: '#c8c8a0',
    zoomHint: '≥ z13',
    layer: new VectorLayer({
      source: geojsonSource('/cartografia_elche/cartografia_diseminado_resto.geojson'),
      style: style_cartografia_diseminado,
      minZoom: 13,
      zIndex: 40,
      visible: false,
    }),
  },
  // ── Contexto ─────────────────────────────────────────────────────────
  {
    group: 'Contexto',
    id: 'provincia',
    label: 'Provincia de Alicante',
    color: '#f3edd3',
    layer: new VectorLayer({
      source: geojsonSource('/cartografia_elche/provincia_alicante.geojson'),
      style: style_provincia_alicante,
      zIndex: 30,
    }),
  },
  {
    group: 'Contexto',
    id: 'mar',
    label: 'Mar Mediterráneo',
    color: '#73b2ff',
    layer: new VectorLayer({
      source: geojsonSource('/cartografia_elche/mar_mediterraneo.geojson'),
      style: style_mar_mediterraneo,
      zIndex: 20,
    }),
  },
  // ── Plan General A2 11-C (georreferenciado con QGIS) ────────────────────
  {
    group: 'Planos',
    id: 'plan_a2_11c',
    label: 'Plan General A2 11-C (1997)',
    color: '#a0522d',
    layer: new ImageLayer({
      source: new ImageStatic({
        url: '/plan_A2_11C_geo.jpg',
        imageExtent: [-83887, 4614524, -81329, 4615948],
        projection: 'EPSG:3857',
      }),
      opacity: 0.7,
      zIndex: 10,
      visible: true,
    }),
  },
  {
    group: 'Ortofotos',
    id: 'pnoa',
    label: 'PNOA Ortofoto (IGN)',
    color: '#4b8fc4',
    layer: new TileLayer({ source: pnoaSource, zIndex: 1, visible: false }),
  },
];
