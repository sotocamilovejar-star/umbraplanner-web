// supabase.js — Módulo de autenticación compartido de CronosPlanner
// ─────────────────────────────────────────────────────────────────
// CONFIGURACIÓN: reemplaza las dos líneas de abajo con tus credenciales
// de Supabase (Settings → API en tu proyecto).
//
//   SUPABASE_URL  → "https://xxxxxxxxxxxx.supabase.co"
//   SUPABASE_ANON → "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
//
// ─────────────────────────────────────────────────────────────────

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'

// ── PEGA AQUÍ TUS CREDENCIALES ────────────────────────────────────
const SUPABASE_URL  = 'PEGA_TU_PROJECT_URL_AQUI'
const SUPABASE_ANON = 'PEGA_TU_ANON_KEY_AQUI'
// ─────────────────────────────────────────────────────────────────

/** Cliente Supabase — singleton compartido por toda la plataforma */
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON)

// ── AUTH HELPERS ──────────────────────────────────────────────────

/** Retorna la sesión activa o null si no hay sesión */
export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession()
  return session
}

/**
 * Registra un usuario nuevo con email + contraseña.
 * Lanza error si el email ya existe o si la contraseña es muy corta.
 */
export async function signUp(email, password) {
  const { data, error } = await supabase.auth.signUp({ email, password })
  if (error) throw error
  return data
}

/**
 * Inicia sesión con email + contraseña.
 * Lanza error si las credenciales son incorrectas.
 */
export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

/** Cierra la sesión activa y redirige a la landing page */
export async function signOut() {
  await supabase.auth.signOut()
  window.location.href = '/cronos-web/index.html'
}

/**
 * Protege una página privada.
 * Si no hay sesión activa → redirige a login.html y retorna null.
 * Si hay sesión → la retorna para que la página pueda usarla.
 */
export async function requireAuth() {
  const session = await getSession()
  if (!session) {
    window.location.href = '/cronos-web/login.html'
    return null
  }
  return session
}
