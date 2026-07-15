import { useState } from 'react'
import { signInWithMagicLink } from '../utils/supabase.js'

export default function AuthScreen() {
  const [email, setEmail]   = useState('')
  const [status, setStatus] = useState('idle') // idle | loading | sent | error
  const [error, setError]   = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email.trim()) return
    setStatus('loading'); setError('')
    try {
      await signInWithMagicLink(email.trim().toLowerCase())
      setStatus('sent')
    } catch (err) {
      setError(err.message || 'Error al enviar el link')
      setStatus('error')
    }
  }

  const C = {
    bg:          '#0A0A14',
    card:        '#111118',
    border:      '#1E1E2E',
    input:       '#16161F',
    inputBorder: '#252535',
    text:        '#FFFFFF',
    textMuted:   '#6B6B8A',
    accent:      '#6430F7',
    accentHover: '#7A42FF',
  }

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: C.bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'PP Neue Montreal', 'Inter', system-ui, sans-serif",
    }}>
      {/* Glow sutil */}
      <div style={{
        position: 'absolute', top: '20%', left: '50%', transform: 'translateX(-50%)',
        width: 600, height: 600, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(100,48,247,0.08) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div style={{
        position: 'relative', width: '100%', maxWidth: 380,
        background: C.card, border: `1px solid ${C.border}`,
        borderRadius: 16, padding: '40px 36px',
        boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
      }}>

        {/* Logo + título */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <img src="/logos/logo-white.svg" alt="Qurable" style={{ height: 28, marginBottom: 16, opacity: 0.92 }} />
          <div style={{ fontSize: 18, fontWeight: '700', color: C.text, letterSpacing: '-0.03em', lineHeight: 1.2 }}>
            Qurable Studio
          </div>
          <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: '600' }}>
            Social Generator
          </div>
        </div>

        <div style={{ height: 1, background: C.border, marginBottom: 28 }} />

        {status === 'sent' ? (
          /* ── Estado: link enviado ── */
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: 48, height: 48, borderRadius: '50%',
              background: 'rgba(100,48,247,0.15)', border: `1px solid rgba(100,48,247,0.3)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 16px', fontSize: 22,
            }}>✓</div>
            <div style={{ fontSize: 15, fontWeight: '700', color: C.text, marginBottom: 8 }}>
              Revisá tu email
            </div>
            <div style={{ fontSize: 13, color: C.textMuted, lineHeight: 1.55, marginBottom: 4 }}>
              Te enviamos un link de acceso a
            </div>
            <div style={{ fontSize: 13, fontWeight: '600', color: C.text, marginBottom: 16 }}>
              {email}
            </div>
            <div style={{ fontSize: 11, color: C.textMuted }}>El link expira en 1 hora.</div>
            <button
              onClick={() => { setStatus('idle'); setError('') }}
              style={{ marginTop: 20, background: 'none', border: 'none', color: C.accent, fontSize: 12, cursor: 'pointer', textDecoration: 'underline' }}>
              Usar otro email
            </button>
          </div>
        ) : (
          /* ── Formulario ── */
          <form onSubmit={handleSubmit}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: '600', color: C.textMuted, marginBottom: 8, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="tu@qurable.co"
              autoFocus
              required
              style={{
                width: '100%', boxSizing: 'border-box',
                padding: '10px 13px', fontSize: 14,
                background: C.input, border: `1px solid ${C.inputBorder}`,
                borderRadius: 8, color: C.text,
                outline: 'none', marginBottom: 12,
                fontFamily: 'inherit',
              }}
              onFocus={e => { e.target.style.borderColor = C.accent }}
              onBlur={e =>  { e.target.style.borderColor = C.inputBorder }}
            />

            {(status === 'error') && (
              <div style={{ fontSize: 12, color: '#F87171', marginBottom: 10 }}>{error}</div>
            )}

            <button
              type="submit"
              disabled={status === 'loading' || !email.trim()}
              style={{
                width: '100%', padding: '11px', fontSize: 13, fontWeight: '700',
                background: status === 'loading' ? 'rgba(100,48,247,0.5)' : C.accent,
                color: '#FFFFFF', border: 'none', borderRadius: 8,
                cursor: status === 'loading' ? 'default' : 'pointer',
                letterSpacing: '-0.01em', transition: 'background 0.15s',
              }}
              onMouseEnter={e => { if (status !== 'loading') e.currentTarget.style.background = C.accentHover }}
              onMouseLeave={e => { if (status !== 'loading') e.currentTarget.style.background = C.accent }}>
              {status === 'loading' ? 'Enviando…' : 'Enviar link de acceso'}
            </button>

            <div style={{ marginTop: 20, fontSize: 11, color: C.textMuted, textAlign: 'center', lineHeight: 1.6 }}>
              Recibirás un link en tu email.<br />No se requiere contraseña.
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
