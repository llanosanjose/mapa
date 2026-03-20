import { supabase } from './supabase.js';

let _session = null;
let _rol     = null;
const _listeners = [];
const _recoveryListeners = [];

export function onPasswordRecovery(fn) { _recoveryListeners.push(fn); }

export function onAuthChange(fn) {
  _listeners.push(fn);
  fn(_session);
}

function _notify() {
  _listeners.forEach(fn => fn(_session));
}

async function _fetchRol(userId) {
  if (!userId) { _rol = null; return; }
  const { data } = await supabase
    .from('perfiles').select('rol').eq('id', userId).maybeSingle();
  _rol = data?.rol ?? null;
}

supabase.auth.getSession().then(async ({ data }) => {
  _session = data.session;
  await _fetchRol(_session?.user?.id);
  _notify();
});

supabase.auth.onAuthStateChange((_event, session) => {
  _session = session;
  _fetchRol(session?.user?.id).then(() => _notify());
  if (_event === 'PASSWORD_RECOVERY') {
    _recoveryListeners.forEach(fn => fn());
  }
});

export const isLoggedIn = () => _session != null;
export const getUser   = () => _session?.user ?? null;
export const getRol    = () => _rol;

// Helpers de permisos
export const esPres          = () => _rol === 'presidente';
export const puedeGestionar  = () => ['presidente', 'administrativo'].includes(_rol);
export const puedeVerFichaMapa = () => _rol !== 'administrativo';

export async function login(email, password) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function logout() {
  _session = null;
  _rol = null;
  _notify();
  supabase.auth.signOut({ scope: 'local' }).catch(() => {});
}

export async function cambiarPassword(nuevaPassword) {
  const { error } = await supabase.auth.updateUser({ password: nuevaPassword });
  if (error) throw error;
}
