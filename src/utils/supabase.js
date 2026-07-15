import { createClient } from '@supabase/supabase-js'

const SB_URL = import.meta.env.VITE_SUPABASE_URL
const SB_KEY = import.meta.env.VITE_SUPABASE_KEY

// Solo inicializa si las env vars están presentes
export const supabase = (SB_URL && SB_KEY) ? createClient(SB_URL, SB_KEY) : null

// ── localStorage fallback ─────────────────────────────────────────────────────
// Cuando no hay Supabase configurado, los proyectos se guardan en el browser.

const LS_INDEX  = 'qurable_projects'   // índice: array de metadata
const LS_PREFIX = 'qurable_project_'   // + id → datos completos del proyecto

function lsList() {
  try { return JSON.parse(localStorage.getItem(LS_INDEX) || '[]') } catch { return [] }
}

function lsSave({ id, userEmail, name, platform, formatKey, slides, thumbnail }) {
  const now = new Date().toISOString()
  const index = lsList()
  if (id) {
    // Actualizar existente
    const i = index.findIndex(p => p.id === id)
    if (i >= 0) index[i] = { ...index[i], name, platform, format_key: formatKey, thumbnail, updated_at: now }
    localStorage.setItem(LS_INDEX, JSON.stringify(index))
    const existing = JSON.parse(localStorage.getItem(LS_PREFIX + id) || '{}')
    localStorage.setItem(LS_PREFIX + id, JSON.stringify({ ...existing, name, platform, format_key: formatKey, data: { slides }, thumbnail, updated_at: now }))
    return id
  } else {
    // Crear nuevo
    const newId = 'local_' + Date.now()
    index.unshift({ id: newId, name, platform, format_key: formatKey, thumbnail, created_at: now, updated_at: now })
    localStorage.setItem(LS_INDEX, JSON.stringify(index))
    localStorage.setItem(LS_PREFIX + newId, JSON.stringify({ id: newId, user_email: userEmail, name, platform, format_key: formatKey, data: { slides }, thumbnail, created_at: now, updated_at: now }))
    return newId
  }
}

function lsLoad(id) {
  const raw = localStorage.getItem(LS_PREFIX + id)
  if (!raw) throw new Error('Proyecto no encontrado')
  return JSON.parse(raw)
}

function lsDelete(id) {
  localStorage.setItem(LS_INDEX, JSON.stringify(lsList().filter(p => p.id !== id)))
  localStorage.removeItem(LS_PREFIX + id)
}

// ── Auth ─────────────────────────────────────────────────────────────────────

export async function signInWithMagicLink(email) {
  if (!supabase) throw new Error('Supabase no configurado')
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.origin },
  })
  if (error) throw new Error(error.message)
}

export async function signOut() {
  if (!supabase) return
  await supabase.auth.signOut()
}

export async function getSession() {
  if (!supabase) return null
  const { data: { session } } = await supabase.auth.getSession()
  return session
}

export function onAuthStateChange(callback) {
  if (!supabase) return () => {}
  const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session)
  })
  return () => subscription.unsubscribe()
}

// ── API pública ───────────────────────────────────────────────────────────────

export async function listProjects(userEmail) {
  if (!supabase) return lsList()
  const { data, error } = await supabase
    .from('projects')
    .select('id, name, platform, format_key, thumbnail, created_at, updated_at')
    .eq('user_email', userEmail)
    .order('updated_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data
}

export async function saveProject({ id, userEmail, name, platform, formatKey, slides, thumbnail }) {
  if (!supabase) return lsSave({ id, userEmail, name, platform, formatKey, slides, thumbnail })
  const payload = {
    user_email: userEmail,
    name,
    platform,
    format_key: formatKey,
    data: { slides },
    thumbnail,
    updated_at: new Date().toISOString(),
  }
  if (id) {
    const { data, error } = await supabase.from('projects').update(payload).eq('id', id).select('id').single()
    if (error) throw new Error(error.message)
    return data.id
  } else {
    const { data, error } = await supabase.from('projects').insert(payload).select('id').single()
    if (error) throw new Error(error.message)
    return data.id
  }
}

export async function loadProject(id) {
  if (!supabase) return lsLoad(id)
  const { data, error } = await supabase.from('projects').select('*').eq('id', id).single()
  if (error) throw new Error(error.message)
  return data
}

export async function deleteProject(id) {
  if (!supabase) { lsDelete(id); return }
  const { error } = await supabase.from('projects').delete().eq('id', id)
  if (error) throw new Error(error.message)
}
