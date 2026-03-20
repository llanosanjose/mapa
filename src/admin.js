import { supabase } from './supabase.js';
import { isLoggedIn, getUser, logout } from './auth.js';

const CURRENT_YEAR = new Date().getFullYear();

export class AdminPanel {
  constructor(streetSearch, adminBtn) {
    this.search    = streetSearch;
    this._adminBtn = adminBtn;
    this._members = [];
    this._filter  = '';

    // DOM refs assigned in _assignRefs()
    this.panel        = null;
    this.adminList    = null;
    this.formWrap     = null;
    this.memberCard   = null;
    this._addressPickerResolve = null;

    this._assignRefs();
    this._bindEvents();
  }

  // ── DOM refs ──────────────────────────────────────────────────────────────
  _assignRefs() {
    this.panel      = document.getElementById('admin-panel');
    this.adminList  = document.getElementById('admin-list');
    this.formWrap   = document.getElementById('admin-form-wrap');
    this.memberCard = document.getElementById('member-card');
  }

  // ── Events ────────────────────────────────────────────────────────────────
  _bindEvents() {
    document.getElementById('admin-logout').addEventListener('click', () => logout());
    document.getElementById('close-admin').addEventListener('click', () => this.close());
    document.getElementById('admin-add-btn').addEventListener('click', () => this._showForm(null));
    document.getElementById('admin-search-input').addEventListener('input', e => {
      this._filter = e.target.value.toLowerCase();
      this._renderList();
    });
  }

  // ── Panel open/close ──────────────────────────────────────────────────────
  async open() {
    document.getElementById('admin-user-email').textContent = getUser()?.email ?? '';
    this.panel.classList.remove('panel-closed');
    this._adminBtn?.classList.add('active');
    this._showList();
    await this._loadMembers();
  }

  close() {
    this.panel.classList.add('panel-closed');
    this._adminBtn?.classList.remove('active');
  }

  // ── Load members ──────────────────────────────────────────────────────────
  async _loadMembers() {
    const { data, error } = await supabase
      .from('socios')
      .select('*')
      .order('apellidos');
    if (error) { console.error('[Admin] Error cargando socios:', error); return; }
    this._members = data;
    this._renderList();
  }

  // ── Render list ───────────────────────────────────────────────────────────
  _renderList() {
    const q = this._filter;
    const filtered = q
      ? this._members.filter(m =>
          (m.nombre + ' ' + m.apellidos + ' ' + m.dir_display).toLowerCase().includes(q))
      : this._members;

    this.adminList.innerHTML = '';

    if (filtered.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'admin-empty';
      empty.textContent = q ? 'Sin resultados' : 'No hay socios registrados';
      this.adminList.appendChild(empty);
      return;
    }

    filtered.forEach(m => {
      const row = document.createElement('div');
      row.className = 'admin-member-row';

      const cuota = document.createElement('span');
      cuota.className = 'admin-cuota-dot ' + (m.cuota_pagada ? 'cuota-ok' : 'cuota-ko');
      cuota.title = m.cuota_pagada ? `Cuota ${m.anno_cuota} pagada` : `Cuota ${m.anno_cuota} pendiente`;

      const name = document.createElement('span');
      name.className = 'admin-member-name';
      name.textContent = `${m.apellidos}, ${m.nombre}`;

      const addr = document.createElement('span');
      addr.className = 'admin-member-addr';
      addr.textContent = m.dir_display;

      const btns = document.createElement('div');
      btns.className = 'admin-row-btns';

      const inactive = !!m.fecha_baja;
      if (inactive) row.classList.add('admin-row-inactive');

      const editBtn = document.createElement('button');
      editBtn.className = 'admin-btn-sm';
      editBtn.textContent = 'Editar';
      editBtn.addEventListener('click', e => { e.stopPropagation(); this._showForm(m); });

      const toggleBtn = document.createElement('button');
      if (inactive) {
        toggleBtn.className = 'admin-btn-sm admin-btn-ok';
        toggleBtn.textContent = 'Reactivar';
        toggleBtn.addEventListener('click', e => { e.stopPropagation(); this._reactivar(m); });
      } else {
        toggleBtn.className = 'admin-btn-sm admin-btn-del';
        toggleBtn.textContent = 'Dar de baja';
        toggleBtn.addEventListener('click', e => { e.stopPropagation(); this._darDeBaja(m); });
      }

      btns.appendChild(editBtn);
      btns.appendChild(toggleBtn);
      row.appendChild(cuota);
      row.appendChild(name);
      row.appendChild(addr);
      row.appendChild(btns);
      this.adminList.appendChild(row);
    });
  }

  // ── Show/hide sections ────────────────────────────────────────────────────
  _showList() {
    this.formWrap.classList.add('hidden');
    this.adminList.parentElement.classList.remove('hidden'); // .admin-list-section
  }

  _showForm(member) {
    this.formWrap.classList.remove('hidden');
    this.adminList.parentElement.classList.add('hidden');
    this._renderForm(member);
  }

  // ── Form render ───────────────────────────────────────────────────────────
  _renderForm(member) {
    const isEdit = member != null;
    this.formWrap.innerHTML = `
      <div class="admin-form-header">
        <span>${isEdit ? 'EDITAR SOCIO' : 'NUEVO SOCIO'}</span>
        <button class="admin-form-back" id="admin-form-back">← Volver</button>
      </div>
      <div class="admin-form-body">
        <div class="admin-field">
          <label>Nombre</label>
          <input id="f-nombre" type="text" value="${member?.nombre ?? ''}" />
        </div>
        <div class="admin-field">
          <label>Apellidos</label>
          <input id="f-apellidos" type="text" value="${member?.apellidos ?? ''}" />
        </div>
        <div class="admin-field">
          <label>Teléfono</label>
          <input id="f-telefono" type="text" value="${member?.telefono ?? ''}" />
        </div>
        <div class="admin-field">
          <label>Email</label>
          <input id="f-email" type="email" value="${member?.email ?? ''}" />
        </div>
        <div class="admin-field">
          <label>Dirección</label>
          <div class="addr-picker">
            <div class="addr-display" id="addr-display">
              ${member?.dir_display
                ? `<span class="addr-ok">${member.dir_display}</span>`
                : '<span class="addr-placeholder">Sin dirección</span>'}
            </div>
            <button class="admin-btn-sm" id="addr-pick-btn">Buscar</button>
          </div>
          <div class="addr-search-wrap hidden" id="addr-search-wrap">
            <input id="addr-street-input" type="text" placeholder="Nombre de calle…" autocomplete="off" />
            <ul id="addr-street-results" class="addr-results"></ul>
            <div class="addr-num-row hidden" id="addr-num-row">
              <span id="addr-street-label" class="addr-street-label"></span>
              <input id="addr-num-input" type="text" placeholder="Nº" maxlength="6" />
              <button class="admin-btn-sm" id="addr-num-ok">OK</button>
            </div>
          </div>
        </div>
        <div class="admin-field">
          <label>Fecha de alta</label>
          <input id="f-fecha" type="date" value="${member?.fecha_alta ?? new Date().toISOString().slice(0,10)}" />
        </div>
        <div class="admin-field admin-field-row">
          <label>Cuota pagada</label>
          <input id="f-cuota" type="checkbox" ${member?.cuota_pagada ? 'checked' : ''} />
        </div>
        <div class="admin-field">
          <label>Año cuota</label>
          <input id="f-anno" type="number" value="${member?.anno_cuota ?? CURRENT_YEAR}" min="2000" max="2100" />
        </div>
        <div class="admin-field">
          <label>Fecha de baja <span style="color:var(--text-3);font-weight:400">(dejar vacío si está activo)</span></label>
          <input id="f-fecha-baja" type="date" value="${member?.fecha_baja ?? ''}" />
        </div>
        <div class="admin-field">
          <label>Notas</label>
          <textarea id="f-notas" rows="3">${member?.notas ?? ''}</textarea>
        </div>
        <div id="admin-form-error" class="admin-form-error hidden"></div>
        <div class="admin-form-footer">
          <button class="admin-btn-primary" id="admin-form-save">Guardar</button>
          <button class="admin-btn-sm" id="admin-form-cancel">Cancelar</button>
        </div>
      </div>`;

    // Address state
    let pickedKcalle  = member?.kcalle   ?? null;
    let pickedNumPoli = member?.num_poli ?? null;
    let pickedDisplay = member?.dir_display ?? null;

    // Address picker interactions
    const addrPickBtn    = document.getElementById('addr-pick-btn');
    const addrSearchWrap = document.getElementById('addr-search-wrap');
    const addrStreetInput  = document.getElementById('addr-street-input');
    const addrStreetResults = document.getElementById('addr-street-results');
    const addrNumRow     = document.getElementById('addr-num-row');
    const addrNumInput   = document.getElementById('addr-num-input');
    const addrNumOk      = document.getElementById('addr-num-ok');
    const addrStreetLabel = document.getElementById('addr-street-label');
    const addrDisplay    = document.getElementById('addr-display');

    let selectedEntry = null;

    addrPickBtn.addEventListener('click', () => {
      addrSearchWrap.classList.toggle('hidden');
      if (!addrSearchWrap.classList.contains('hidden')) addrStreetInput.focus();
    });

    addrStreetInput.addEventListener('input', () => {
      const q = addrStreetInput.value.trim().toLowerCase();
      addrStreetResults.innerHTML = '';
      addrNumRow.classList.add('hidden');
      selectedEntry = null;
      if (q.length < 2) return;

      const index = this.search.getIndex();
      const matches = [];
      for (const [kcalle, entry] of index) {
        if (entry.nomvia.toLowerCase().includes(q)) matches.push({ kcalle, ...entry });
      }
      matches.sort((a, b) => {
        const as = a.nomvia.toLowerCase().startsWith(q) ? 0 : 1;
        const bs = b.nomvia.toLowerCase().startsWith(q) ? 0 : 1;
        return as !== bs ? as - bs : a.nomvia.localeCompare(b.nomvia, 'es');
      }).slice(0, 20).forEach(entry => {
        const li = document.createElement('li');
        li.textContent = entry.nomvia + (entry.tipcalle ? ` (${entry.tipcalle})` : '');
        li.addEventListener('click', () => {
          selectedEntry = entry;
          addrStreetInput.value = entry.nomvia;
          addrStreetResults.innerHTML = '';
          addrStreetLabel.textContent = entry.nomvia;
          addrNumRow.classList.remove('hidden');
          addrNumInput.value = '';
          addrNumInput.focus();
        });
        addrStreetResults.appendChild(li);
      });
    });

    const confirmNum = () => {
      if (!selectedEntry) return;
      const raw = addrNumInput.value.trim();
      if (!raw) return;
      const padded   = raw.padStart(4, '0');
      const unpadded = String(parseInt(raw, 10) || raw);
      const resolvedKey = selectedEntry.ndpu.has(padded)   ? padded
                        : selectedEntry.ndpu.has(raw)      ? raw
                        : selectedEntry.ndpu.has(unpadded) ? unpadded
                        : null;
      if (!resolvedKey) {
        addrNumInput.style.borderColor = 'var(--red)';
        setTimeout(() => { addrNumInput.style.borderColor = ''; }, 1500);
        return;
      }
      pickedKcalle  = selectedEntry.kcalle;
      pickedNumPoli = resolvedKey;
      pickedDisplay = `${selectedEntry.nomvia} nº ${parseInt(resolvedKey, 10)}`;
      addrDisplay.innerHTML = `<span class="addr-ok">${pickedDisplay}</span>`;
      addrSearchWrap.classList.add('hidden');
      addrStreetInput.value = '';
      addrStreetResults.innerHTML = '';
      addrNumRow.classList.add('hidden');
    };

    addrNumOk.addEventListener('click', confirmNum);
    addrNumInput.addEventListener('keydown', e => { if (e.key === 'Enter') confirmNum(); });

    // Form navigation
    document.getElementById('admin-form-back').addEventListener('click', () => {
      this._showList();
    });
    document.getElementById('admin-form-cancel').addEventListener('click', () => {
      this._showList();
    });

    // Save
    document.getElementById('admin-form-save').addEventListener('click', async () => {
      const errorEl = document.getElementById('admin-form-error');
      errorEl.classList.add('hidden');

      const nombre    = document.getElementById('f-nombre').value.trim();
      const apellidos = document.getElementById('f-apellidos').value.trim();
      if (!nombre || !apellidos) {
        errorEl.textContent = 'Nombre y apellidos son obligatorios.';
        errorEl.classList.remove('hidden');
        return;
      }
      if (!pickedKcalle || !pickedNumPoli) {
        errorEl.textContent = 'Debes seleccionar una dirección válida.';
        errorEl.classList.remove('hidden');
        return;
      }

      const payload = {
        nombre,
        apellidos,
        telefono:     document.getElementById('f-telefono').value.trim() || null,
        email:        document.getElementById('f-email').value.trim()    || null,
        kcalle:       pickedKcalle,
        num_poli:     pickedNumPoli,
        dir_display:  pickedDisplay,
        fecha_alta:   document.getElementById('f-fecha').value,
        cuota_pagada: document.getElementById('f-cuota').checked,
        anno_cuota:   parseInt(document.getElementById('f-anno').value, 10),
        fecha_baja:   document.getElementById('f-fecha-baja').value || null,
        notas:        document.getElementById('f-notas').value.trim() || null,
      };

      const saveBtn = document.getElementById('admin-form-save');
      saveBtn.disabled = true;
      saveBtn.textContent = 'Guardando…';

      let error;
      if (isEdit) {
        ({ error } = await supabase.from('socios').update(payload).eq('id', member.id));
      } else {
        ({ error } = await supabase.from('socios').insert(payload));
      }

      saveBtn.disabled = false;
      saveBtn.textContent = 'Guardar';

      if (error) {
        errorEl.textContent = 'Error al guardar: ' + error.message;
        errorEl.classList.remove('hidden');
        return;
      }

      await this._loadMembers();
      this._showList();
    });
  }

  // ── Dar de baja ───────────────────────────────────────────────────────────
  async _darDeBaja(member) {
    const hoy = new Date().toISOString().slice(0, 10);
    const { error } = await supabase
      .from('socios').update({ fecha_baja: hoy }).eq('id', member.id);
    if (error) { alert('Error: ' + error.message); return; }
    await this._loadMembers();
  }

  // ── Reactivar ─────────────────────────────────────────────────────────────
  async _reactivar(member) {
    const { error } = await supabase
      .from('socios').update({ fecha_baja: null }).eq('id', member.id);
    if (error) { alert('Error: ' + error.message); return; }
    await this._loadMembers();
  }

  // ── Member card (shown from map search) ───────────────────────────────────
  async showMemberCard(kcalle, numPoli) {
    if (!isLoggedIn()) { this.hideMemberCard(); return; }

    // Try the padded key and the plain number
    const unpadded = String(parseInt(numPoli, 10) || numPoli);
    const { data } = await supabase
      .from('socios')
      .select('*')
      .eq('kcalle', kcalle)
      .in('num_poli', [numPoli, unpadded])
      .maybeSingle();

    if (!data) { this.hideMemberCard(); return; }

    this.memberCard.innerHTML = `
      <div class="mc-header">
        <span class="mc-title">${data.apellidos}, ${data.nombre}</span>
        <div style="display:flex;align-items:center;gap:8px;flex-shrink:0">
          <span class="mc-cuota ${data.cuota_pagada ? 'cuota-ok' : 'cuota-ko'}">
            ${data.cuota_pagada ? `Cuota ${data.anno_cuota} ✓` : `Cuota ${data.anno_cuota} pendiente`}
          </span>
          <button class="mc-close" title="Cerrar">×</button>
        </div>
      </div>
      ${data.telefono ? `<div class="mc-row">Tel: <strong>${data.telefono}</strong></div>` : ''}
      ${data.email    ? `<div class="mc-row">Email: <strong>${data.email}</strong></div>` : ''}
      <div class="mc-row mc-addr">${data.dir_display}</div>
      ${data.notas    ? `<div class="mc-notes">${data.notas}</div>` : ''}
    `;
    this.memberCard.querySelector('.mc-close').addEventListener('click', () => this.hideMemberCard());
    this.memberCard.classList.remove('hidden');
  }

  hideMemberCard() {
    this.memberCard.classList.add('hidden');
    this.memberCard.innerHTML = '';
  }
}
