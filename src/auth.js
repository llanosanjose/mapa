import { supabase } from './supabase.js';

let _session = null;
const _listeners = [];

export function onAuthChange(fn) {
  _listeners.push(fn);
  fn(_session);
}

function _notify() {
  _listeners.forEach(fn => fn(_session));
}

supabase.auth.getSession().then(({ data }) => {
  _session = data.session;
  _notify();
});

supabase.auth.onAuthStateChange((_event, session) => {
  _session = session;
  _notify();
});

export const isLoggedIn = () => _session != null;
export const getUser   = () => _session?.user ?? null;

export async function login(email, password) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function logout() {
  await supabase.auth.signOut();
}
