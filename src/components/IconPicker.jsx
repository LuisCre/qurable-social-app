import { useState, useEffect, useRef } from 'react'

// Phosphor v2 icon names organizados por categoría
export const ICON_CATEGORIES = {
  'Flechas': ['arrow-right','arrow-left','arrow-up','arrow-down','arrow-circle-right','arrow-circle-up-right','caret-right','caret-down','caret-up','caret-left','arrows-out','arrows-in'],
  'UI': ['x','check','plus','minus','dots-three','dots-six','funnel','magnifying-glass','gear','sliders','bell','lock','lock-open','eye','eye-slash','list','grid-four'],
  'Personas': ['user','users','user-circle','user-plus','user-check','identification-badge','address-book'],
  'Fintech': ['currency-dollar','credit-card','bank','wallet','receipt','hand-coins','coins','trend-up','trend-down','money','percent','chart-line-up'],
  'Gráficos': ['chart-bar','chart-line','chart-pie','chart-scatter','presentation-chart'],
  'Comunicación': ['chat','chat-dots','envelope','phone','megaphone','paper-plane','broadcast','at'],
  'Archivos': ['file','file-text','note','link','download','upload','share-network','copy','export','bookmark'],
  'Tecnología': ['code','terminal','database','cloud','device-mobile','device-desktop','cpu','lightning','shield-check','wifi','qr-code','robot'],
  'Redes': ['instagram-logo','linkedin-logo','twitter-logo','facebook-logo','whatsapp-logo','youtube-logo'],
  'Especiales': ['rocket','target','trophy','star','heart','crown','diamond','fire','flag','globe','handshake','certificate','medal','leaf','confetti'],
}

const BASE_URL = 'https://raw.githubusercontent.com/phosphor-icons/core/main/assets'

// Phosphor v2: archivos non-regular incluyen sufijo de variante en el nombre.
// Ej: regular → "arrow-right.svg", bold → "arrow-right-bold.svg"
export async function fetchIcon(name, variant = 'regular') {
  const fileName = variant === 'regular' ? `${name}.svg` : `${name}-${variant}.svg`
  const url = `${BASE_URL}/${variant}/${fileName}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Icon not found: ${name} (${variant})`)
  let svg = await res.text()
  svg = svg
    .replace(/fill="(?!none)[^"]*"/g, 'fill="currentColor"')
    .replace(/stroke="(?!none)[^"]*"/g, 'stroke="currentColor"')
    .replace(/width="[^"]*"/, 'width="100%"')
    .replace(/height="[^"]*"/, 'height="100%"')
  return svg
}

function IconThumb({ name, variant, color, onClick }) {
  const [svg, setSvg] = useState(null)
  useEffect(() => {
    let cancelled = false
    fetchIcon(name, variant).then(s => { if (!cancelled) setSvg(s) }).catch(() => {})
    return () => { cancelled = true }
  }, [name, variant])

  return (
    <button
      title={name}
      onClick={() => onClick(name, svg)}
      style={{
        width: 48, height: 48,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'transparent',
        border: '1px solid #161628',
        borderRadius: 8,
        cursor: 'pointer',
        color: color || '#CBD5E1',
        padding: 10,
        transition: 'all 120ms',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(100,48,247,0.15)'; e.currentTarget.style.borderColor = '#6430F7' }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = '#161628' }}
    >
      {svg
        ? <div style={{ width: '100%', height: '100%' }} dangerouslySetInnerHTML={{ __html: svg }} />
        : <div style={{ width: 20, height: 20, background: '#1E293B', borderRadius: 3 }} />
      }
    </button>
  )
}

export default function IconPicker({ onSelect, onClose, C }) {
  const [search, setSearch] = useState('')
  const [variant, setVariant] = useState('regular')
  const [iconColor, setIconColor] = useState('#FFFFFF')
  const [activeCategory, setActiveCategory] = useState('Especiales')
  const inputRef = useRef(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  const allIcons = Object.entries(ICON_CATEGORIES).flatMap(([, icons]) => icons)
  const searchResults = search.trim()
    ? allIcons.filter(n => n.includes(search.toLowerCase()))
    : null

  const displayIcons = searchResults
    || ICON_CATEGORIES[activeCategory]
    || []

  const handleSelect = async (name, cachedSvg) => {
    let svgContent = cachedSvg
    if (!svgContent) {
      try { svgContent = await fetchIcon(name, variant) }
      catch { return }
    }
    onSelect({ name, variant, svgContent, size: 64, color: iconColor })
    onClose()
  }

  const bg = C.sidebar
  const border = C.sidebarBorder

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: bg, border: `1px solid ${border}`, borderRadius: 16, width: 560, maxHeight: '80vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 24px 60px rgba(0,0,0,0.5)' }}>
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${border}`, display: 'flex', alignItems: 'center', gap: 12 }}>
          <input ref={inputRef} value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar icono (ej: arrow, chart, star...)"
            style={{ flex: 1, background: C.input, border: `1px solid ${border}`, borderRadius: 8, padding: '8px 12px', color: C.text, fontSize: 13 }} />
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: C.textMuted, cursor: 'pointer', fontSize: 20, padding: 4 }}>×</button>
        </div>

        {/* Controls */}
        <div style={{ padding: '10px 20px', borderBottom: `1px solid ${border}`, display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{ fontSize: 11, color: C.textMuted }}>Variante:</div>
          {['regular','bold','fill','light'].map(v => (
            <button key={v} onClick={() => setVariant(v)}
              style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid', cursor: 'pointer', fontSize: 11,
                borderColor: variant === v ? '#6430F7' : border,
                background: variant === v ? 'rgba(100,48,247,0.15)' : 'transparent',
                color: variant === v ? '#A78BFA' : C.textMuted,
              }}>{v}</button>
          ))}
          <div style={{ flex: 1 }} />
          <div style={{ fontSize: 11, color: C.textMuted }}>Color:</div>
          <input type="color" value={iconColor} onChange={e => setIconColor(e.target.value)}
            style={{ width: 28, height: 28, border: `1px solid ${border}`, borderRadius: 5, padding: 1, cursor: 'pointer', background: C.input }} />
          <input type="text" value={iconColor} onChange={e => setIconColor(e.target.value)}
            style={{ width: 80, background: C.input, border: `1px solid ${border}`, borderRadius: 6, padding: '4px 7px', color: C.text, fontSize: 11, fontFamily: 'monospace' }} />
        </div>

        {/* Category tabs (hidden when searching) */}
        {!search.trim() && (
          <div style={{ padding: '8px 20px', borderBottom: `1px solid ${border}`, display: 'flex', gap: 6, overflowX: 'auto', flexShrink: 0 }}>
            {Object.keys(ICON_CATEGORIES).map(cat => (
              <button key={cat} onClick={() => setActiveCategory(cat)}
                style={{ padding: '4px 10px', borderRadius: 20, border: '1px solid', cursor: 'pointer', fontSize: 10, whiteSpace: 'nowrap', fontWeight: '600',
                  borderColor: activeCategory === cat ? '#6430F7' : border,
                  background: activeCategory === cat ? 'rgba(100,48,247,0.15)' : 'transparent',
                  color: activeCategory === cat ? '#A78BFA' : C.textMuted,
                }}>{cat}</button>
            ))}
          </div>
        )}

        {/* Grid */}
        <div style={{ padding: 20, overflowY: 'auto', flex: 1 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, 48px)', gap: 8 }}>
            {displayIcons.map(name => (
              <IconThumb key={`${name}-${variant}`} name={name} variant={variant} color={iconColor} onClick={handleSelect} />
            ))}
          </div>
          {displayIcons.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 0', color: C.textMuted, fontSize: 13 }}>
              No se encontraron iconos para "{search}"
            </div>
          )}
        </div>

        <div style={{ padding: '10px 20px', borderTop: `1px solid ${border}`, fontSize: 10, color: C.textFaint }}>
          Phosphor Icons · {allIcons.length} iconos disponibles · phosphoricons.com
        </div>
      </div>
    </div>
  )
}

