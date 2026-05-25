// supabase.js — Módulo de autenticación compartido de UmbraPlanner

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'

const SUPABASE_URL  = 'https://fwlotorqfujhziojocey.supabase.co'
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ3bG90b3JxZnVqaHppb2pvY2V5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkzNzYxNDQsImV4cCI6MjA5NDk1MjE0NH0.RoDOyNUryUqRBVMjbIyEEmL7yU1rJDCLzWx9eKThnrI'

/** Cliente Supabase — singleton compartido por toda la plataforma */
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON)

// ── AUTH HELPERS ──────────────────────────────────────────────────

/** Retorna la sesión activa o null si no hay sesión */
export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession()
  return session
}

/** Registra un usuario nuevo con email + contraseña */
export async function signUp(email, password) {
  const { data, error } = await supabase.auth.signUp({ email, password })
  if (error) throw error
  return data
}

/** Inicia sesión con email + contraseña */
export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

/**
 * Inicia sesión con proveedor OAuth (google, facebook, twitter, apple).
 * Redirige al proveedor — al volver, Supabase redirige a app.html.
 */
export async function signInWithOAuth(provider) {
  const redirectTo = new URL('./app.html', window.location.href).href
  const { error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo } })
  if (error) throw error
}

/** Cierra la sesión activa y redirige a la landing */
export async function signOut() {
  await supabase.auth.signOut()
  window.location.href = new URL('./index.html', window.location.href).href
}

/**
 * Protege una página privada.
 * Si no hay sesión → redirige a login.html y retorna null.
 */
export async function requireAuth() {
  const session = await getSession()
  if (!session) {
    window.location.href = new URL('./login.html', window.location.href).href
    return null
  }
  return session
}
