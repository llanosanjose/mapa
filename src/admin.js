import { supabase } from './supabase.js';
import { isLoggedIn, getUser, getRol, esPres, puedeGestionar, logout, cambiarPassword } from './auth.js';
import { toast } from './toast.js';

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
    this.usersSection = null;
    this._addressPickerResolve = null;

    this._assignRefs();
    this._bindEvents();
  }

  // ── DOM refs ──────────────────────────────────────────────────────────────
  _assignRefs() {
    this.panel        = document.getElementById('admin-panel');
    this.adminList    = document.getElementById('admin-list');
    this.formWrap     = document.getElementById('admin-form-wrap');
    this.memberCard   = document.getElementById('member-card');
    this.usersSection = document.getElementById('admin-users-section');
  }

  // ── Events ────────────────────────────────────────────────────────────────
  _bindEvents() {
    document.getElementById('admin-logout').addEventListener('click', () => logout());
    document.getElementById('close-admin').addEventListener('click', () => this.close());
    document.getElementById('admin-add-btn').addEventListener('click', () => this._showForm(null));
    document.getElementById('admin-tabs').addEventListener('click', e => {
      const tab = e.target.dataset.tab;
      if (tab) this._switchTab(tab);
    });
    document.getElementById('admin-export-btn').addEventListener('click', () => this._exportCSV());
    document.getElementById('admin-import-btn').addEventListener('click', () =>
      document.getElementById('admin-import-input').click());
    document.getElementById('admin-import-input').addEventListener('change', e => {
      if (e.target.files[0]) this._importCSV(e.target.files[0]);
      e.target.value = '';
    });
    document.getElementById('admin-search-input').addEventListener('input', e => {
      this._filter = e.target.value.toLowerCase();
      this._renderList();
    });
    document.getElementById('admin-pwd-btn').addEventListener('click', () => this._togglePwdForm());
  }

  // ── Panel open/close ──────────────────────────────────────────────────────
  async open() {
    const rol = getRol();
    document.getElementById('admin-user-email').textContent =
      `${getUser()?.email ?? ''} · ${rol ?? '?'}`;
    document.getElementById('admin-add-btn').classList.toggle('hidden', !puedeGestionar());
    document.getElementById('admin-csv-toolbar').classList.toggle('hidden', !puedeGestionar());
    document.getElementById('admin-tabs').classList.toggle('hidden', !esPres());
    this.panel.classList.remove('panel-closed');
    this._adminBtn?.classList.add('active');
    this._switchTab('socios');
  }

  close() {
    this.panel.classList.add('panel-closed');
    this._adminBtn?.classList.remove('active');
  }

  // ── Tab navigation ────────────────────────────────────────────────────────
  _switchTab(tab) {
    document.querySelectorAll('.admin-tab').forEach(btn =>
      btn.classList.toggle('active', btn.dataset.tab === tab));

    if (tab === 'socios') {
      this.formWrap.classList.add('hidden');
      this.usersSection.classList.add('hidden');
      document.querySelector('.admin-toolbar').classList.remove('hidden');
      document.getElementById('admin-csv-toolbar').classList.toggle('hidden', !puedeGestionar());
      this.adminList.parentElement.classList.remove('hidden');
      this._loadMembers();
    } else if (tab === 'usuarios') {
      this.formWrap.classList.add('hidden');
      this.adminList.parentElement.classList.add('hidden');
      document.querySelector('.admin-toolbar').classList.add('hidden');
      document.getElementById('admin-csv-toolbar').classList.add('hidden');
      this.usersSection.classList.remove('hidden');
      this._loadUsers();
    }
  }

  // ── Load / render users ───────────────────────────────────────────────────
  async _loadUsers() {
    this.usersSection.innerHTML = '<div class="admin-empty">Cargando…</div>';
    const { data, error } = await supabase
      .from('perfiles')
      .select('id, rol, email')
      .order('rol');
    if (error) {
      this.usersSection.innerHTML =
        `<div class="admin-form-error">${error.message}</div>`;
      return;
    }
    this._renderUsers(data);
  }

  _renderUsers(users) {
    const ROLES = ['presidente', 'administrativo', 'vocal'];
    this.usersSection.innerHTML = '';

    if (!users.length) {
      const empty = document.createElement('div');
      empty.className = 'admin-empty';
      empty.textContent = 'No hay usuarios registrados';
      this.usersSection.appendChild(empty);
      return;
    }

    const currentUserId = getUser()?.id;

    users.forEach(u => {
      const row = document.createElement('div');
      row.className = 'admin-member-row';

      const identity = document.createElement('span');
      identity.className = 'admin-member-name';
      identity.textContent = u.email ?? (u.id.slice(0, 8) + '…');
      if (u.id === currentUserId) identity.textContent += ' (tú)';

      const rolSelect = document.createElement('select');
      rolSelect.className = 'admin-rol-select';
      ROLES.forEach(r => {
        const opt = document.createElement('option');
        opt.value = r;
        opt.textContent = r;
        opt.selected = r === u.rol;
        rolSelect.appendChild(opt);
      });
      if (u.id === currentUserId) rolSelect.disabled = true;

      rolSelect.addEventListener('change', async () => {
        const prev = u.rol;
        if (prev === 'presidente' && rolSelect.value !== 'presidente') {
          const otrosPresidentes = users.filter(x => x.id !== u.id && x.rol === 'presidente');
          if (!otrosPresidentes.length) {
            rolSelect.value = prev;
            alert('No se puede degradar al único presidente.');
            return;
          }
        }
        const { error } = await supabase
          .from('perfiles').update({ rol: rolSelect.value }).eq('id', u.id);
        if (error) {
          rolSelect.value = prev;
          toast('Error al cambiar rol: ' + error.message, 'err');
        } else {
          u.rol = rolSelect.value;
          toast('Rol actualizado');
        }
      });

      const btns = document.createElement('div');
      btns.className = 'admin-row-btns';

      if (u.id !== currentUserId) {
        const delBtn = document.createElement('button');
        delBtn.className = 'admin-btn-sm admin-btn-del';
        delBtn.textContent = 'Quitar';
        delBtn.title = 'Quitar acceso al panel';
        delBtn.addEventListener('click', async () => {
          if (!confirm(`¿Quitar acceso a ${u.email ?? u.id}?`)) return;
          const { error } = await supabase
            .from('perfiles').delete().eq('id', u.id);
          if (error) { toast('Error: ' + error.message, 'err'); return; }
          toast('Acceso revocado');
          await this._loadUsers();
        });
        btns.appendChild(delBtn);
      }

      row.appendChild(identity);
      row.appendChild(rolSelect);
      row.appendChild(btns);
      this.usersSection.appendChild(row);
    });
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

      const gestionar = puedeGestionar();

      const editBtn = document.createElement('button');
      editBtn.className = 'admin-btn-sm';
      editBtn.textContent = gestionar ? 'Editar' : 'Ver';
      editBtn.addEventListener('click', e => { e.stopPropagation(); this._showForm(m); });
      btns.appendChild(editBtn);

      if (gestionar) {
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
        btns.appendChild(toggleBtn);
      }
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
    const isEdit   = member != null;
    const soloVer  = !puedeGestionar();
    const readOnly = soloVer ? 'readonly' : '';
    const disabled = soloVer ? 'disabled' : '';
    this.formWrap.innerHTML = `
      <div class="admin-form-header">
        <span>${soloVer ? 'VER SOCIO' : isEdit ? 'EDITAR SOCIO' : 'NUEVO SOCIO'}</span>
        <button class="admin-form-back" id="admin-form-back">← Volver</button>
      </div>
      <div class="admin-form-body">
        <div class="admin-field">
          <label>Nombre</label>
          <input id="f-nombre" type="text" value="${member?.nombre ?? ''}" ${readOnly} />
        </div>
        <div class="admin-field">
          <label>Apellidos</label>
          <input id="f-apellidos" type="text" value="${member?.apellidos ?? ''}" ${readOnly} />
        </div>
        <div class="admin-field">
          <label>Teléfono</label>
          <input id="f-telefono" type="text" value="${member?.telefono ?? ''}" ${readOnly} />
        </div>
        <div class="admin-field">
          <label>Email</label>
          <input id="f-email" type="email" value="${member?.email ?? ''}" ${readOnly} />
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
          ${soloVer ? '' : `<button class="admin-btn-primary" id="admin-form-save">Guardar</button>`}
          <button class="admin-btn-sm" id="admin-form-cancel">Cerrar</button>
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
      const payload = {
        nombre,
        apellidos,
        telefono:     document.getElementById('f-telefono').value.trim() || null,
        email:        document.getElementById('f-email').value.trim()    || null,
        kcalle:       pickedKcalle   || null,
        num_poli:     pickedNumPoli  || null,
        dir_display:  pickedDisplay  || null,
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

      toast(isEdit ? 'Socio actualizado' : 'Socio creado');
      await this._loadMembers();
      this._showList();
    });
  }

  // ── Dar de baja ───────────────────────────────────────────────────────────
  async _darDeBaja(member) {
    const hoy = new Date().toISOString().slice(0, 10);
    const { error } = await supabase
      .from('socios').update({ fecha_baja: hoy }).eq('id', member.id);
    if (error) { toast('Error: ' + error.message, 'err'); return; }
    toast('Socio dado de baja');
    await this._loadMembers();
  }

  // ── Reactivar ─────────────────────────────────────────────────────────────
  async _reactivar(member) {
    const { error } = await supabase
      .from('socios').update({ fecha_baja: null }).eq('id', member.id);
    if (error) { toast('Error: ' + error.message, 'err'); return; }
    toast('Socio reactivado');
    await this._loadMembers();
  }

  // ── Export CSV ────────────────────────────────────────────────────────────
  _exportCSV() {
    const FIELDS = ['id','nombre','apellidos','telefono','email','kcalle','num_poli',
                    'dir_display','fecha_alta','cuota_pagada','anno_cuota','fecha_baja','notas'];
    const esc = v => (v == null ? '' : String(v).replace(/\|/g, '/'));
    const rows = [FIELDS.join('|')];
    this._members.forEach(m => rows.push(FIELDS.map(f => esc(m[f])).join('|')));
    const blob = new Blob([rows.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `socios_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast(`${this._members.length} socios exportados`);
  }

  // ── Import CSV ────────────────────────────────────────────────────────────
  async _importCSV(file) {
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) { toast('CSV vacío o sin datos', 'err'); return; }

    const parseRow = line => line.split('|');

    const headers = parseRow(lines[0]);
    const records = lines.slice(1).map(l => {
      const vals = parseRow(l);
      const obj = {};
      headers.forEach((h, i) => { obj[h] = vals[i] ?? null; });
      return obj;
    });

    // Normalizar tipos
    const toNull = v => (v === '' || v == null) ? null : v;
    const payload = records.map(r => ({
      ...(r.id ? { id: r.id } : {}),
      nombre:       toNull(r.nombre),
      apellidos:    toNull(r.apellidos),
      telefono:     toNull(r.telefono),
      email:        toNull(r.email),
      kcalle:       r.kcalle ? parseInt(r.kcalle, 10) : null,
      num_poli:     toNull(r.num_poli),
      dir_display:  toNull(r.dir_display),
      fecha_alta:   toNull(r.fecha_alta),
      cuota_pagada: r.cuota_pagada === 'true',
      anno_cuota:   r.anno_cuota ? parseInt(r.anno_cuota, 10) : null,
      fecha_baja:   toNull(r.fecha_baja),
      notas:        toNull(r.notas),
    }));

    const { error } = await supabase.from('socios').upsert(payload);
    if (error) { toast('Error al importar: ' + error.message, 'err'); return; }
    toast(`${payload.length} socios importados`);
    await this._loadMembers();
  }

  // ── Cambio de contraseña ──────────────────────────────────────────────────
  _togglePwdForm() {
    const existing = document.getElementById('pwd-form-wrap');
    if (existing) { existing.remove(); return; }

    const wrap = document.createElement('div');
    wrap.id = 'pwd-form-wrap';
    wrap.className = 'pwd-form';
    wrap.innerHTML = `
      <div class="pwd-form-title">Cambiar contraseña</div>
      <input class="pwd-new"     type="password" placeholder="Nueva contraseña" />
      <input class="pwd-confirm" type="password" placeholder="Confirmar contraseña" />
      <div class="pwd-error admin-form-error hidden"></div>
      <div class="pwd-form-btns">
        <button class="admin-btn-primary pwd-save">Guardar</button>
        <button class="admin-btn-sm pwd-cancel">Cancelar</button>
      </div>`;

    this.panel.appendChild(wrap);

    wrap.addEventListener('click', async (e) => {
      if (e.target.classList.contains('pwd-cancel')) { wrap.remove(); return; }
      if (!e.target.classList.contains('pwd-save')) return;

      const errorEl = wrap.querySelector('.pwd-error');
      const nueva   = wrap.querySelector('.pwd-new').value;
      const confirm = wrap.querySelector('.pwd-confirm').value;
      errorEl.classList.add('hidden');

      if (nueva.length < 6) {
        errorEl.textContent = 'La contraseña debe tener al menos 6 caracteres.';
        errorEl.classList.remove('hidden'); return;
      }
      if (nueva !== confirm) {
        errorEl.textContent = 'Las contraseñas no coinciden.';
        errorEl.classList.remove('hidden'); return;
      }
      try {
        await cambiarPassword(nueva);
        wrap.innerHTML = '<div class="pwd-ok">✓ Contraseña cambiada correctamente</div>';
        setTimeout(() => wrap.remove(), 3000);
      } catch (err) {
        errorEl.textContent = 'Error: ' + err.message;
        errorEl.classList.remove('hidden');
      }
    });
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
