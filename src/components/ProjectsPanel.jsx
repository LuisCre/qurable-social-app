import { useState, useEffect } from 'react'
import { listProjects, deleteProject } from '../utils/supabase.js'

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'ahora'
  if (m < 60) return `hace ${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `hace ${h}h`
  return `hace ${Math.floor(h / 24)}d`
}

export default function ProjectsPanel({ userEmail, onLoad, onClose, C }) {
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [deleting, setDeleting] = useState(null)

  useEffect(() => {
    load()
  }, [])

  const load = async () => {
    setLoading(true); setError(null)
    try {
      const data = await listProjects(userEmail)
      setProjects(data)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  const handleDelete = async (id, e) => {
    e.stopPropagation()
    if (!confirm('¿Eliminar este proyecto?')) return
    setDeleting(id)
    try {
      await deleteProject(id)
      setProjects(prev => prev.filter(p => p.id !== id))
    } catch (e) { alert(e.message) }
    finally { setDeleting(null) }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: C.sidebar, border: `1px solid ${C.sidebarBorder}`, borderRadius: 16, width: 580, maxHeight: '80vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 24px 60px rgba(0,0,0,0.5)' }}>

        {/* Header */}
        <div style={{ padding: '18px 20px', borderBottom: `1px solid ${C.sidebarBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: '700', color: C.text }}>Mis proyectos</div>
            <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>{userEmail}</div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: C.textMuted, cursor: 'pointer', fontSize: 20 }}>×</button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
          {loading && (
            <div style={{ textAlign: 'center', padding: '40px 0', color: C.textMuted, fontSize: 13 }}>Cargando proyectos...</div>
          )}
          {error && (
            <div style={{ padding: '12px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: 8, color: '#F87171', fontSize: 12 }}>⚠ {error}</div>
          )}
          {!loading && !error && projects.length === 0 && (
            <div style={{ textAlign: 'center', padding: '50px 0' }}>
              <div style={{ fontSize: 36, opacity: 0.1, marginBottom: 10 }}>📁</div>
              <div style={{ fontSize: 13, color: C.textMuted }}>No tenés proyectos guardados todavía</div>
              <div style={{ fontSize: 11, color: C.textFaint, marginTop: 6 }}>Usá "Guardar proyecto" para guardar tu trabajo</div>
            </div>
          )}
          {!loading && projects.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              {projects.map(p => (
                <div key={p.id}
                  onClick={() => onLoad(p.id)}
                  style={{ borderRadius: 10, border: `1px solid ${C.inputBorder}`, overflow: 'hidden', cursor: 'pointer', transition: 'all 150ms', position: 'relative' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.transform = 'translateY(-2px)' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = C.inputBorder; e.currentTarget.style.transform = 'translateY(0)' }}>

                  {/* Thumbnail */}
                  <div style={{ height: 100, background: p.thumbnail ? 'transparent' : C.input, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {p.thumbnail
                      ? <img src={p.thumbnail} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <span style={{ fontSize: 24, opacity: 0.15 }}>🎨</span>
                    }
                  </div>

                  {/* Info */}
                  <div style={{ padding: '8px 10px', background: C.sidebar }}>
                    <div style={{ fontSize: 11, fontWeight: '700', color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                    <div style={{ fontSize: 9, color: C.textMuted, marginTop: 2 }}>
                      {p.platform?.toUpperCase()} · {p.format_key} · {timeAgo(p.updated_at)}
                    </div>
                  </div>

                  {/* Delete button */}
                  <button
                    onClick={e => handleDelete(p.id, e)}
                    disabled={deleting === p.id}
                    style={{ position: 'absolute', top: 6, right: 6, width: 22, height: 22, borderRadius: '50%', background: 'rgba(0,0,0,0.5)', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0, transition: 'opacity 150ms' }}
                    onMouseEnter={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.background = '#EF4444' }}
                    onMouseLeave={e => { e.currentTarget.style.opacity = '0'; e.currentTarget.style.background = 'rgba(0,0,0,0.5)' }}>
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
