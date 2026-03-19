/**
 * Estilos OpenLayers para la cartografia basica municipal de Elche
 * Generado automaticamente desde:
 * https://geoportal.elche.es/arcgis/rest/services/web/web_cartografia_basica_municipal/MapServer
 *
 * Uso:
 *   import { getStyleFunction, style_termino_municipal } from './estilos_ol.js';
 *
 *   const vectorLayer = new VectorLayer({
 *     source: new VectorSource({ url: 'termino_municipal.geojson', format: new GeoJSON() }),
 *     style: getStyleFunction('termino_municipal'),
 *   });
 */

import { Style, Fill, Stroke, Text } from 'ol/style';

// === Término municipal (capa 0) ===
export function style_termino_municipal(feature, resolution) {
  const style = new Style({
      fill: new Fill({ color: 'rgba(0,0,0,0.000)' }),
      stroke: new Stroke({ color: 'rgba(0,0,0,1.000)', width: 0.4 }),
    });
  if (resolution <= 132.31 && resolution >= 39.69) {
    style.setText(
      new Text({
          text: String(feature.get('nomtermo') ?? ''),
          font: 'bold 12px Arial',
          fill: new Fill({ color: 'rgba(0,0,0,1.000)' }),
          stroke: new Stroke({ color: 'rgba(255,255,255,0.8)', width: 2 }),
          overflow: true,
        })
    );
  }
  return style;
}

// === Partidas rurales (capa 1) ===
export function style_partidas_rurales(feature, resolution) {
  const style = new Style({
      fill: new Fill({ color: 'rgba(255,255,255,0.000)' }),
      stroke: new Stroke({ color: 'rgba(0,0,0,1.000)', width: 0.8 }),
    });
  if (resolution <= 39.69 && resolution >= 0.03) {
    style.setText(
      new Text({
          text: String(feature.get('entsingul') ?? ''),
          font: 'bold 8px Calibri',
          fill: new Fill({ color: 'rgba(130,130,130,1.000)' }),
          stroke: new Stroke({ color: 'rgba(255,255,255,0.8)', width: 2 }),
          overflow: true,
        })
    );
  }
  return style;
}

// === Núcleos de población (capa 2) ===
// Valores reales del campo tiponucdis: 'NÚCLEO' y 'DISEMINADO'
const _nucleo_fill   = new Style({ fill: new Fill({ color: 'rgba(0,0,0,0.000)' }), stroke: new Stroke({ color: 'rgba(255,0,0,1.000)', width: 2 }) });
const _diseminado_fill = new Style({ fill: new Fill({ color: 'rgba(0,0,0,0.000)' }), stroke: new Stroke({ color: 'rgba(200,100,0,1.000)', width: 1.5 }) });

export function style_nucleos_poblacion(feature, resolution) {
  const val = String(feature.get('tiponucdis') ?? '');
  const style = val === 'NÚCLEO' ? _nucleo_fill : _diseminado_fill;
  if (resolution <= 13.23 && resolution >= 0.03) {
    return [
      style,
      new Style({
        text: new Text({
          text: String(feature.get('denomina') ?? ''),
          font: 'normal 8px Verdana',
          fill: new Fill({ color: 'rgba(235,0,63,1.000)' }),
          stroke: new Stroke({ color: 'rgba(255,255,255,1.000)', width: 2 }),
          overflow: true,
        }),
      }),
    ];
  }
  return style;
}

// === Humedales, Cauces y Barrancos (capa 3) ===
const _styles_humedales_cauces_barrancos = {
  'Paraje Natural Municipal': new Style({
        fill: new Fill({ color: 'rgba(0,230,169,1.000)' }),
        stroke: new Stroke({ color: 'rgba(0,115,76,1.000)', width: 1 }),
      }),
  'Parque Natural': new Style({
        fill: new Fill({ color: 'rgba(0,230,169,1.000)' }),
        stroke: new Stroke({ color: 'rgba(0,115,76,1.000)', width: 1 }),
      }),
  'Embalse': new Style({
        fill: new Fill({ color: 'rgba(0,169,230,1.000)' }),
        stroke: new Stroke({ color: 'rgba(110,110,110,1.000)', width: 0.4 }),
      }),
  'Cauce': new Style({
        fill: new Fill({ color: 'rgba(179,226,252,1.000)' }),
        stroke: new Stroke({ color: 'rgba(0,112,255,1.000)', width: 1 }),
      }),
  'Barranco': new Style({
        fill: new Fill({ color: 'rgba(190,232,255,1.000)' }),
        stroke: new Stroke({ color: 'rgba(0,112,255,1.000)', width: 1 }),
      }),
  'Saladar': new Style({
        fill: new Fill({ color: 'rgba(190,232,255,1.000)' }),
        stroke: new Stroke({ color: 'rgba(115,178,255,1.000)', width: 0.4 }),
      }),
  'Zonas Húmedas': new Style({
        fill: new Fill({ color: 'rgba(0,169,230,1.000)' }),
        stroke: new Stroke({ color: 'rgba(110,110,110,1.000)', width: 0.4 }),
      })
};
const _default_humedales_cauces_barrancos = new Style({});

export function style_humedales_cauces_barrancos(feature, resolution) {
  const val = String(feature.get('tipo') ?? '');
  const style = _styles_humedales_cauces_barrancos[val] ?? _default_humedales_cauces_barrancos;
  style.setText(
    new Text({
          text: String(feature.get('denominaci') ?? ''),
          font: 'normal 9px Arial',
          fill: new Fill({ color: 'rgba(0,92,230,1.000)' }),
          stroke: new Stroke({ color: 'rgba(255,255,255,0.8)', width: 2 }),
          overflow: true,
        })
  );
  return style;
}

// === Cartografía núcleos (1:500 - 1:1.000) (capa 4) ===
const _styles_cartografia_nucleos = {
  '1': new Style({
        fill: new Fill({ color: 'rgba(255,190,190,1.000)' }),
        stroke: new Stroke({ color: 'rgba(130,130,130,1.000)', width: 0.2 }),
      }),
  '2': new Style({
        fill: new Fill({ color: 'rgba(245,122,122,1.000)' }),
        stroke: new Stroke({ color: 'rgba(110,110,110,1.000)', width: 0.4 }),
      }),
  '3': new Style({
        fill: new Fill({ color: 'rgba(255,187,128,1.000)' }),
        stroke: new Stroke({ color: 'rgba(110,110,110,1.000)', width: 0.4 }),
      }),
  '4': new Style({
        fill: new Fill({ color: 'rgba(179,179,179,1.000)' }),
        stroke: new Stroke({ color: 'rgba(110,110,110,1.000)', width: 0.4 }),
      }),
  '5': new Style({
        fill: new Fill({ color: 'rgba(255,174,0,1.000)' }),
        stroke: new Stroke({ color: 'rgba(110,110,110,1.000)', width: 0.4 }),
      }),
  '6': new Style({
        fill: new Fill({ color: 'rgba(255,128,128,1.000)' }),
        stroke: new Stroke({ color: 'rgba(110,110,110,1.000)', width: 0.4 }),
      }),
  '7': new Style({
        fill: new Fill({ color: 'rgba(255,115,223,1.000)' }),
        stroke: new Stroke({ color: 'rgba(255,0,197,1.000)', width: 0.4 }),
      }),
  '8': new Style({
        fill: new Fill({ color: 'rgba(208,255,115,1.000)' }),
        stroke: new Stroke({ color: 'rgba(110,110,110,1.000)', width: 0.4 }),
      }),
  '9': new Style({
        fill: new Fill({ color: 'rgba(56,168,0,1.000)' }),
        stroke: new Stroke({ color: 'rgba(0,115,76,1.000)', width: 1 }),
      }),
  '10': new Style({
        fill: new Fill({ color: 'rgba(255,255,191,1.000)' }),
        stroke: new Stroke({ color: 'rgba(110,110,110,1.000)', width: 0.4 }),
      }),
  '12': new Style({
        fill: new Fill({ color: 'rgba(179,179,179,1.000)' }),
        stroke: new Stroke({ color: 'rgba(110,110,110,1.000)', width: 0.4 }),
      }),
  '13': new Style({
        fill: new Fill({ color: 'rgba(130,130,130,1.000)' }),
        stroke: new Stroke({ color: 'rgba(110,110,110,1.000)', width: 0.4 }),
      }),
  '15': new Style({
        fill: new Fill({ color: 'rgba(204,204,204,1.000)' }),
        stroke: new Stroke({ color: 'rgba(110,110,110,1.000)', width: 0.4 }),
      }),
  '16': new Style({
        fill: new Fill({ color: 'rgba(223,115,255,1.000)' }),
        stroke: new Stroke({ color: 'rgba(169,0,230,1.000)', width: 0.4 }),
      }),
  '18': new Style({
        fill: new Fill({ color: 'rgba(230,76,0,1.000)' }),
        stroke: new Stroke({ color: 'rgba(110,110,110,1.000)', width: 0.4 }),
      }),
  '19': new Style({
        fill: new Fill({ color: 'rgba(195,0,255,1.000)' }),
        stroke: new Stroke({ color: 'rgba(110,110,110,1.000)', width: 0.4 }),
      }),
  '20': new Style({
        fill: new Fill({ color: 'rgba(255,255,191,1.000)' }),
        stroke: new Stroke({ color: 'rgba(110,110,110,1.000)', width: 0.4 }),
      }),
  '21': new Style({
        fill: new Fill({ color: 'rgba(151,219,242,1.000)' }),
        stroke: new Stroke({ color: 'rgba(64,101,235,1.000)', width: 0.4 }),
      }),
  '22': new Style({
        fill: new Fill({ color: 'rgba(255,235,176,1.000)' }),
        stroke: new Stroke({ color: 'rgba(110,110,110,1.000)', width: 0.4 }),
      }),
  '23': new Style({
        fill: new Fill({ color: 'rgba(222,158,102,1.000)' }),
        stroke: new Stroke({ color: 'rgba(0,0,0,1.000)', width: 0.4 }),
      }),
  '24': new Style({
        fill: new Fill({ color: 'rgba(255,255,191,1.000)' }),
        stroke: new Stroke({ color: 'rgba(110,110,110,1.000)', width: 0.4 }),
      }),
  '25': new Style({
        fill: new Fill({ color: 'rgba(255,255,191,1.000)' }),
        stroke: new Stroke({ color: 'rgba(110,110,110,1.000)', width: 0.4 }),
      }),
  '26': new Style({
        fill: new Fill({ color: 'rgba(204,204,204,1.000)' }),
        stroke: new Stroke({ color: 'rgba(110,110,110,1.000)', width: 0.4 }),
      }),
  '27': new Style({
        fill: new Fill({ color: 'rgba(0,111,255,1.000)' }),
        stroke: new Stroke({ color: 'rgba(110,110,110,1.000)', width: 0.4 }),
      }),
  '28': new Style({
        fill: new Fill({ color: 'rgba(0,156,101,1.000)' }),
        stroke: new Stroke({ color: 'rgba(110,110,110,1.000)', width: 0.4 }),
      }),
  '29': new Style({
        fill: new Fill({ color: 'rgba(215,158,158,1.000)' }),
        stroke: new Stroke({ color: 'rgba(110,110,110,1.000)', width: 0.4 }),
      }),
  '51': new Style({
        fill: new Fill({ color: 'rgba(217,238,255,1.000)' }),
        stroke: new Stroke({ color: 'rgba(156,156,156,1.000)', width: 0.4 }),
      })
};
const _default_cartografia_nucleos = new Style({
      fill: new Fill({ color: 'rgba(212,207,199,0.000)' }),
      stroke: new Stroke({ color: 'rgba(0,0,0,1)', width: 1 }),
    });

export function style_cartografia_nucleos(feature, resolution) {
  const val = String(feature.get('tipo') ?? '');
  const style = _styles_cartografia_nucleos[val] ?? _default_cartografia_nucleos;
  return style;
}

// === Cartografía diseminado (1:5.000) (capa 5) ===
const _styles_cartografia_diseminado = {
  '1': new Style({
        fill: new Fill({ color: 'rgba(255,190,190,1.000)' }),
        stroke: new Stroke({ color: 'rgba(255,0,0,1.000)', width: 0.4 }),
      }),
  '2': new Style({
        fill: new Fill({ color: 'rgba(247,237,156,1.000)' }),
        stroke: new Stroke({ color: 'rgba(110,110,110,1.000)', width: 0.4 }),
      }),
  '3': new Style({
        fill: new Fill({ color: 'rgba(178,178,178,1.000)' }),
        stroke: new Stroke({ color: 'rgba(110,110,110,1.000)', width: 0.4 }),
      }),
  '4': new Style({
        fill: new Fill({ color: 'rgba(214,180,77,1.000)' }),
        stroke: new Stroke({ color: 'rgba(110,110,110,1.000)', width: 0.4 }),
      }),
  '5': new Style({
        fill: new Fill({ color: 'rgba(232,190,255,1.000)' }),
        stroke: new Stroke({ color: 'rgba(110,110,110,1.000)', width: 0.4 }),
      }),
  '7': new Style({
        fill: new Fill({ color: 'rgba(255,190,232,1.000)' }),
        stroke: new Stroke({ color: 'rgba(0,0,0,1.000)', width: 0.4 }),
      }),
  '8': new Style({
        fill: new Fill({ color: 'rgba(76,230,0,1.000)' }),
        stroke: new Stroke({ color: 'rgba(110,110,110,1.000)', width: 0.4 }),
      }),
  '9': new Style({
        fill: new Fill({ color: 'rgba(87,235,148,1.000)' }),
        stroke: new Stroke({ color: 'rgba(110,110,110,1.000)', width: 0.4 }),
      }),
  '12': new Style({
        fill: new Fill({ color: 'rgba(179,179,179,1.000)' }),
        stroke: new Stroke({ color: 'rgba(110,110,110,1.000)', width: 0.4 }),
      }),
  '13': new Style({
        fill: new Fill({ color: 'rgba(156,156,156,1.000)' }),
        stroke: new Stroke({ color: 'rgba(110,110,110,1.000)', width: 0.4 }),
      }),
  '14': new Style({
        fill: new Fill({ color: 'rgba(204,204,204,1.000)' }),
        stroke: new Stroke({ color: 'rgba(110,110,110,1.000)', width: 0.4 }),
      }),
  '16': new Style({
        fill: new Fill({ color: 'rgba(223,115,255,1.000)' }),
        stroke: new Stroke({ color: 'rgba(104,104,104,1.000)', width: 0.4 }),
      }),
  '20': new Style({
        fill: new Fill({ color: 'rgba(255,234,190,1.000)' }),
        stroke: new Stroke({ color: 'rgba(204,204,204,1.000)', width: 0.4 }),
      }),
  '21': new Style({
        fill: new Fill({ color: 'rgba(111,184,247,1.000)' }),
        stroke: new Stroke({ color: 'rgba(110,110,110,1.000)', width: 0.4 }),
      }),
  '22': new Style({
        fill: new Fill({ color: 'rgba(219,145,192,1.000)' }),
        stroke: new Stroke({ color: 'rgba(110,110,110,1.000)', width: 0.4 }),
      }),
  '23': new Style({
        fill: new Fill({ color: 'rgba(168,74,69,1.000)' }),
        stroke: new Stroke({ color: 'rgba(110,110,110,1.000)', width: 0.4 }),
      }),
  '24': new Style({
        fill: new Fill({ color: 'rgba(77,110,112,1.000)' }),
        stroke: new Stroke({ color: 'rgba(110,110,110,1.000)', width: 0.4 }),
      }),
  '25': new Style({
        fill: new Fill({ color: 'rgba(140,115,83,1.000)' }),
        stroke: new Stroke({ color: 'rgba(110,110,110,1.000)', width: 0.4 }),
      }),
  '26': new Style({
        fill: new Fill({ color: 'rgba(225,225,225,1.000)' }),
        stroke: new Stroke({ color: 'rgba(0,0,0,1.000)', width: 0.4 }),
      }),
  '27': new Style({
        fill: new Fill({ color: 'rgba(255,0,0,1.000)' }),
        stroke: new Stroke({ color: 'rgba(110,110,110,1.000)', width: 0.4 }),
      }),
  '28': new Style({
        fill: new Fill({ color: 'rgba(227,227,178,1.000)' }),
        stroke: new Stroke({ color: 'rgba(215,194,158,1.000)', width: 0.4 }),
      }),
  '31': new Style({
        fill: new Fill({ color: 'rgba(227,227,178,1.000)' }),
        stroke: new Stroke({ color: 'rgba(215,194,158,1.000)', width: 0.4 }),
      }),
  '29': new Style({
        fill: new Fill({ color: 'rgba(69,138,112,1.000)' }),
        stroke: new Stroke({ color: 'rgba(110,110,110,1.000)', width: 0.4 }),
      }),
  '30': new Style({
        fill: new Fill({ color: 'rgba(0,111,255,1.000)' }),
        stroke: new Stroke({ color: 'rgba(110,110,110,1.000)', width: 0.4 }),
      }),
  '51': new Style({
        fill: new Fill({ color: 'rgba(158,219,215,1.000)' }),
        stroke: new Stroke({ color: 'rgba(110,110,110,1.000)', width: 0.4 }),
      })
};
const _default_cartografia_diseminado = new Style({});

export function style_cartografia_diseminado(feature, resolution) {
  const val = String(feature.get('tipo') ?? '');
  const style = _styles_cartografia_diseminado[val] ?? _default_cartografia_diseminado;
  return style;
}

// === Provincia Alicante (capa 6) ===
export function style_provincia_alicante(feature, resolution) {
  const style = new Style({
      fill: new Fill({ color: 'rgba(243,237,211,1.000)' }),
      stroke: new Stroke({ color: 'rgba(224,210,184,1.000)', width: 0.6 }),
    });
  if (resolution <= 132.31 && resolution >= 66.16) {
    style.setText(
      new Text({
          text: String(feature.get('municipio') ?? ''),
          font: 'bold 5px Calibri',
          fill: new Fill({ color: 'rgba(137,112,68,1.000)' }),
          stroke: new Stroke({ color: 'rgba(255,255,255,0.8)', width: 2 }),
          overflow: true,
        })
    );
  }
  return style;
}

// === Mar Mediterráneo (capa 7) ===
export function style_mar_mediterraneo(feature, resolution) {
  const style = new Style({
      fill: new Fill({ color: 'rgba(115,178,255,1.000)' }),
      stroke: new Stroke({ color: 'rgba(0,77,168,1.000)', width: 1 }),
    });
  style.setText(
    new Text({
          text: String(feature.get('nombre') ?? ''),
          font: 'bold 6.5px Verdana',
          fill: new Fill({ color: 'rgba(0,92,230,1.000)' }),
          stroke: new Stroke({ color: 'rgba(255,255,255,0.8)', width: 2 }),
          overflow: true,
        })
  );
  return style;
}

// Mapa de nombre de capa -> funcion de estilo
export const layerStyles = {
  'termino_municipal': style_termino_municipal,
  'partidas_rurales': style_partidas_rurales,
  'nucleos_poblacion': style_nucleos_poblacion,
  'humedales_cauces_barrancos': style_humedales_cauces_barrancos,
  'cartografia_nucleos': style_cartografia_nucleos,
  'cartografia_diseminado': style_cartografia_diseminado,
  'provincia_alicante': style_provincia_alicante,
  'mar_mediterraneo': style_mar_mediterraneo,
};

/**
 * Devuelve la funcion de estilo OL para una capa por su nombre.
 * @param {string} layerName
 * @returns {Function}
 */
export function getStyleFunction(layerName) {
  return layerStyles[layerName] ?? (() => new Style({}));
}
