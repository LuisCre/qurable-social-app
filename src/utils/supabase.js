import { createClient } from '@supabase/supabase-js'

const URL = import.meta.env.VITE_SUPABASE_URL
const KEY = import.meta.env.VITE_SUPABASE_KEY

// Solo inicializa si las env vars están presentes — evita crash en entornos sin Supabase
export const supabase = (URL && KEY) ? createClient(URL, KEY) : null

// ── Proyectos ─────────────────────────────────────────────────────────────────

const NO_SUPABASE = 'Guardado en la nube no disponible (Supabase no configurado).'

export async function listProjects(userEmail) {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('projects')
    .select('id, name, platform, format_key, thumbnail, created_at, updated_at')
    .eq('user_email', userEmail)
    .order('updated_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data
}

export async function saveProject({ id, userEmail, name, platform, formatKey, slides, thumbnail }) {
  if (!supabase) throw new Error(NO_SUPABASE)
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
    const { data, error } = await supabase
      .from('projects')
      .update(payload)
      .eq('id', id)
      .select('id')
      .single()
    if (error) throw new Error(error.message)
    return data.id
  } else {
    const { data, error } = await supabase
      .from('projects')
      .insert(payload)
      .select('id')
      .single()
    if (error) throw new Error(error.message)
    return data.id
  }
}

export async function loadProject(id) {
  if (!supabase) throw new Error(NO_SUPABASE)
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', id)
    .single()
  if (error) throw new Error(error.message)
  return data
}

export async function deleteProject(id) {
  if (!supabase) throw new Error(NO_SUPABASE)
  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', id)
  if (error) throw new Error(error.message)
}
