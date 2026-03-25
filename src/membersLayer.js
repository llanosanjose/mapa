import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import Feature from 'ol/Feature';
import { Point } from 'ol/geom';
import { Style, Fill, Stroke, Circle as CircleStyle, Text } from 'ol/style';
import { supabase } from './supabase.js';

export class MembersLayer {
  constructor() {
    this._source       = new VectorSource();
    this._filterText   = '';
    this._showInactive = false;
    this.layer         = new VectorLayer({
      source:  this._source,
      style:   (feature) => this._styleFeature(feature),
      zIndex:  200,
      visible: false,
    });
  }

  _styleFeature(feature) {
    const cuota    = feature.get('cuota_pagada');
    const inactive = feature.get('inactive');
    const label    = feature.get('label');
    const members  = feature.get('members');

    // Ocultar socios dados de baja si no están activados
    if (!this._showInactive && feature.get('inactive')) return null;

    // Cuando hay filtro activo, ocultar marcadores que no coinciden
    if (this._filterText) {
      const q = this._filterText;
      const matches = members?.some(m =>
        (m.nombre + ' ' + m.apellidos + ' ' + (m.dir_display ?? ''))
          .toLowerCase().includes(q)
      );
      if (!matches) return null;
    }

    const fill = inactive ? '#6b7280' : cuota ? '#22c55e' : '#ef4444';

    return new Style({
      image: new CircleStyle({
        radius: 8,
        fill:   new Fill({ color: fill }),
        stroke: new Stroke({ color: '#0d1017', width: 1.5 }),
      }),
      text: new Text({
        text:     label,
        font:     '700 12px Nunito, sans-serif',
        fill:     new Fill({ color: '#ffffff' }),
        stroke:   new Stroke({ color: '#0d1017', width: 3 }),
        offsetY:  18,
        overflow: true,
      }),
    });
  }

  /** Aplica un filtro de texto a los marcadores visibles en el mapa */
  applyFilter(filterText) {
    this._filterText = filterText;
    this._source.changed();
  }

  /** Controla si los socios dados de baja se muestran en el mapa */
  setShowInactive(show) {
    this._showInactive = show;
    this._source.changed();
  }

  /** Toggle visibilidad. Devuelve el nuevo estado visible. */
  async toggle(searchIndex) {
    const visible = !this.layer.getVisible();
    if (visible) {
      this._source.clear();
      await this._load(searchIndex);
    }
    this.layer.setVisible(visible);
    return visible;
  }

  hide() {
    this.layer.setVisible(false);
  }

  async _load(searchIndex) {
    const { data, error } = await supabase
      .from('socios')
      .select('nombre, apellidos, kcalle, num_poli, cuota_pagada, fecha_baja, telefono, email, dir_display, notas, anno_cuota');
    if (error) {
      console.error('[MembersLayer]', error);
      return 0;
    }

    // Agrupar socios por dirección para evitar superposición de etiquetas
    const byAddr = new Map();
    for (const m of data) {
      if (!m.kcalle || !m.num_poli) continue;
      const key = `${m.kcalle}|${m.num_poli}`;
      if (!byAddr.has(key)) byAddr.set(key, []);
      byAddr.get(key).push(m);
    }

    const features = [];
    for (const members of byAddr.values()) {
      const first = members[0];
      const entry = searchIndex.get(first.kcalle);
      if (!entry) continue;

      const ndpuFeat = this._resolveNdpu(entry, first.num_poli);
      if (!ndpuFeat) continue;

      const coord = ndpuFeat.getGeometry().getCoordinates();
      const f = new Feature({ geometry: new Point(coord) });

      f.set('label', members.map(m => m.nombre + ' ' + m.apellidos).join('\n'));

      const alguno = members.find(m => !m.fecha_baja) ?? members[0];
      f.set('cuota_pagada', alguno.cuota_pagada);
      f.set('inactive', members.every(m => !!m.fecha_baja));
      f.set('members', members);

      features.push(f);
    }

    this._source.addFeatures(features);
    console.log('[MembersLayer]', features.length, 'puntos cargados en el mapa');
    return features.length;
  }

  _resolveNdpu(entry, numPoli) {
    const raw         = String(numPoli || '').trim();
    const padded      = raw.padStart(4, '0');
    const alphaMatch  = raw.match(/^(\d+)([a-zA-Z].*)$/);
    const paddedAlpha = alphaMatch
      ? alphaMatch[1].padStart(4, '0') + alphaMatch[2].toUpperCase()
      : null;
    const rawUpper = raw.toUpperCase();
    const numOnly  = alphaMatch
      ? String(parseInt(alphaMatch[1], 10))
      : String(parseInt(raw, 10) || raw);

    const candidates = [raw, padded, paddedAlpha, rawUpper, numOnly].filter(Boolean);
    const key = candidates.find(k => entry.ndpu.has(k))
      ?? [...entry.ndpu.keys()].find(k => k.toLowerCase() === raw.toLowerCase())
      ?? null;
    return key ? entry.ndpu.get(key) : null;
  }
}
