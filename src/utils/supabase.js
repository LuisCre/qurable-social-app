import { createClient } from '@supabase/supabase-js'

const URL = import.meta.env.VITE_SUPABASE_URL
const KEY = import.meta.env.VITE_SUPABASE_KEY

export const supabase = createClient(URL, KEY)

// ── Proyectos ─────────────────────────────────────────────────────────────────

export async function listProjects(userEmail) {
  const { data, error } = await supabase
    .from('projects')
    .select('id, name, platform, format_key, thumbnail, created_at, updated_at')
    .eq('user_email', userEmail)
    .order('updated_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data
}

export async function saveProject({ id, userEmail, name, platform, formatKey, slides, thumbnail }) {
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
    // Actualizar existente
    const { data, error } = await supabase
      .from('projects')
      .update(payload)
      .eq('id', id)
      .select('id')
      .single()
    if (error) throw new Error(error.message)
    return data.id
  } else {
    // Crear nuevo
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
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', id)
    .single()
  if (error) throw new Error(error.message)
  return data
}

export async function deleteProject(id) {
  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', id)
  if (error) throw new Error(error.message)
}
