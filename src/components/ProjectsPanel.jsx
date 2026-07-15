import { useState, useEffect, useRef } from 'react'
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

// Card individual de proyecto
function ProjectCard({ p, onLoad, onDeleted, C }) {
  const [menuOpen, setMenuOpen]       = useState(false)
  const [confirming, setConfirming]   = useState(false)
  const [deleting, setDeleting]       = useState(false)
  const menuRef = useRef(null)

  // Cerrar menú si click fuera
  useEffect(() => {
    if (!menuOpen) return
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menuOpen])

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await deleteProject(p.id)
      onDeleted(p.id)
    } catch (e) { alert(e.message); setDeleting(false); setConfirming(false) }
  }

  // Estado: confirmando eliminación
  if (confirming) {
    return (
      <div style={{ borderRadius: 10, border: `1px solid rgba(239,68,68,0.4)`, background: 'rgba(239,68,68,0.06)', overflow: 'hidden', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '18px 12px', minHeight: 148, textAlign: 'center' }}>
        <div style={{ fontSize: 11, fontWeight: '700', color: '#F87171', marginBottom: 6 }}>¿Eliminar?</div>
        <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 14, lineHeight: 1.4, padding: '0 4px' }}>
          "{p.name}"<br/>Esta acción no se puede deshacer.
        </div>
        <div style={{ display: 'flex', gap: 6, width: '100%' }}>
          <button
            onClick={() => setConfirming(false)}
            style={{ flex: 1, padding: '7px 0', borderRadius: 6, border: `1px solid ${C.inputBorder}`, background: C.input, color: C.textMuted, cursor: 'pointer', fontSize: 11 }}>
            Cancelar
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            style={{ flex: 1, padding: '7px 0', borderRadius: 6, border: 'none', background: '#EF4444', color: '#fff', cursor: deleting ? 'default' : 'pointer', fontSize: 11, fontWeight: '700' }}>
            {deleting ? '···' : 'Eliminar'}
          </button>
        </div>
      </div>
    )
  }

  // Estado normal
  return (
    <div
      style={{ borderRadius: 10, border: `1px solid ${C.inputBorder}`, overflow: 'visible', cursor: 'pointer', transition: 'all 150ms', position: 'relative', background: C.sidebar }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.transform = 'translateY(-2px)' }}
      onMouseLeave={e => { if (!menuOpen) { e.currentTarget.style.borderColor = C.inputBorder; e.currentTarget.style.transform = 'translateY(0)' } }}>

      {/* Thumbnail */}
      <div
        onClick={() => onLoad(p.id)}
        style={{ height: 100, background: p.thumbnail ? 'transparent' : C.input, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '9px 9px 0 0' }}>
        {p.thumbnail
          ? <img src={p.thumbnail} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <span style={{ fontSize: 24, opacity: 0.15 }}>🎨</span>
        }
      </div>

      {/* Info */}
      <div onClick={() => onLoad(p.id)} style={{ padding: '8px 10px 8px', background: C.sidebar, borderRadius: '0 0 9px 9px' }}>
        <div style={{ fontSize: 11, fontWeight: '700', color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 16 }}>{p.name}</div>
        <div style={{ fontSize: 9, color: C.textMuted, marginTop: 2 }}>
          {p.platform?.toUpperCase()} · {p.format_key} · {timeAgo(p.updated_at)}
        </div>
      </div>

      {/* ··· menu button */}
      <div ref={menuRef} style={{ position: 'absolute', top: 6, right: 6 }}>
        <button
          onClick={e => { e.stopPropagation(); setMenuOpen(o => !o) }}
          style={{ width: 24, height: 24, borderRadius: 6, background: menuOpen ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0.45)', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', letterSpacing: '0.05em', backdropFilter: 'blur(4px)' }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.75)'}
          onMouseLeave={e => { if (!menuOpen) e.currentTarget.style.background = 'rgba(0,0,0,0.45)' }}>
          ···
        </button>

        {menuOpen && (
          <div style={{ position: 'absolute', top: 28, right: 0, zIndex: 10, background: C.sidebar, border: `1px solid ${C.inputBorder}`, borderRadius: 8, padding: '4px', boxShadow: '0 8px 24px rgba(0,0,0,0.4)', minWidth: 130 }}>
            <button
              onClick={e => { e.stopPropagation(); setMenuOpen(false); onLoad(p.id) }}
              style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '7px 10px', background: 'transparent', border: 'none', color: C.text, cursor: 'pointer', fontSize: 12, borderRadius: 5, textAlign: 'left' }}
              onMouseEnter={e => e.currentTarget.style.background = C.input}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <span style={{ fontSize: 11, opacity: 0.6 }}>↗</span> Abrir
            </button>
            <div style={{ height: 1, background: C.inputBorder, margin: '3px 4px' }} />
            <button
              onClick={e => { e.stopPropagation(); setMenuOpen(false); setConfirming(true) }}
              style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '7px 10px', background: 'transparent', border: 'none', color: '#F87171', cursor: 'pointer', fontSize: 12, borderRadius: 5, textAlign: 'left' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.1)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <span style={{ fontSize: 11 }}>×</span> Eliminar
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function ProjectsPanel({ userEmail, onLoad, onClose, C }) {
  const [projects, setProjects] = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true); setError(null)
    try {
      const data = await listProjects(userEmail)
      setProjects(data)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: C.sidebar, border: `1px solid ${C.sidebarBorder}`, borderRadius: 16, width: 600, maxHeight: '82vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 24px 60px rgba(0,0,0,0.5)' }}>

        {/* Header */}
        <div style={{ padding: '18px 20px', borderBottom: `1px solid ${C.sidebarBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: '700', color: C.text }}>Mis proyectos</div>
            <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>{userEmail}</div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: C.textMuted, cursor: 'pointer', fontSize: 20, lineHeight: 1 }}>×</button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
          {loading && (
            <div style={{ textAlign: 'center', padding: '40px 0', color: C.textMuted, fontSize: 13 }}>Cargando proyectos…</div>
          )}
          {error && (
            <div style={{ padding: '12px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: 8, color: '#F87171', fontSize: 12 }}>⚠ {error}</div>
          )}
          {!loading && !error && projects.length === 0 && (
            <div style={{ textAlign: 'center', padding: '50px 0' }}>
              <div style={{ fontSize: 36, opacity: 0.1, marginBottom: 10 }}>📁</div>
              <div style={{ fontSize: 13, color: C.textMuted }}>No tenés proyectos guardados todavía</div>
              <div style={{ fontSize: 11, color: C.textFaint, marginTop: 6 }}>Usá "Guardar" para guardar tu trabajo</div>
            </div>
          )}
          {!loading && projects.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              {projects.map(p => (
                <ProjectCard
                  key={p.id}
                  p={p}
                  onLoad={(id) => { onLoad(id); onClose() }}
                  onDeleted={(id) => setProjects(prev => prev.filter(x => x.id !== id))}
                  C={C}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
