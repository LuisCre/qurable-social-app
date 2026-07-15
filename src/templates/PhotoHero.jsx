/* ────────────────────────────────────────────
   PHOTO HERO — Foto full bleed, texto cinematográfico
   ──────────────────────────────────────────── */
export default function PhotoHero({ data, fmt }) {
  const { headline = 'Tu historia,\nen una imagen', subtitle = '', cta = '', label = '', bgImage, logoVariant = 'white' } = data
  const isStory = fmt.height > fmt.width
  const basePx = fmt.width / 1080
  const px = n => `${n * basePx}px`

  const placeholder = !bgImage

  return (
    <div style={{
      width: fmt.width, height: fmt.height,
      background: placeholder ? '#1a1a2e' : 'transparent',
      position: 'relative', overflow: 'hidden',
      fontFamily: '"PP Neue Montreal", sans-serif',
    }}>
      {/* Background */}
      {bgImage ? (
        <img src={bgImage} style={{
          position: 'absolute', inset: 0,
          width: '100%', height: '100%', objectFit: 'cover',
        }} />
      ) : (
        /* Placeholder gradient */
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
        }} />
      )}

      {/* Cinematic gradient overlays */}
      {/* Top fade for logo legibility */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, transparent 35%)',
      }} />
      {/* Bottom fade for text */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.6) 35%, transparent 65%)',
      }} />

      {/* Purple tint at bottom */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(to top, rgba(100,48,247,0.25) 0%, transparent 40%)',
      }} />

      {/* Vignette edges */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.4) 100%)',
      }} />

      {/* Logo top */}
      <div style={{
        position: 'absolute', top: px(isStory ? 80 : 60), left: px(64),
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        right: px(64),
      }}>
        <img src="/logos/logo-white.svg" style={{ height: px(26) }} />
        {label && (
          <span style={{
            fontSize: px(11), fontWeight: 700, letterSpacing: '0.15em',
            textTransform: 'uppercase', color: 'rgba(255,255,255,0.85)',
            border: '1px solid rgba(255,255,255,0.3)',
            padding: `${px(6)} ${px(14)}`, borderRadius: px(100),
          }}>{label}</span>
        )}
      </div>

      {/* Content — anchored bottom */}
      <div style={{
        position: 'absolute',
        bottom: px(isStory ? 100 : 72), left: px(64), right: px(64),
      }}>
        {/* Category line */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: px(12), marginBottom: px(20),
        }}>
          <div style={{ width: px(32), height: px(3), background: '#6430F7', borderRadius: px(2) }} />
          {label && <span style={{ fontSize: px(12), fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#8B5CF6' }}>{label}</span>}
        </div>

        {/* Headline */}
        <h1 style={{
          margin: `0 0 ${px(20)} 0`,
          fontSize: px(isStory ? 80 : 62),
          fontWeight: 700,
          lineHeight: 1.05,
          letterSpacing: '-0.025em',
          color: '#FFFFFF',
          whiteSpace: 'pre-line',
        }}>{headline}</h1>

        {/* Subtitle + CTA */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: px(20) }}>
          {subtitle && (
            <p style={{
              margin: 0, fontSize: px(18), fontWeight: 400,
              lineHeight: 1.5, color: 'rgba(255,255,255,0.65)',
              maxWidth: px(560),
            }}>{subtitle}</p>
          )}
          {cta && (
            <div style={{
              flexShrink: 0,
              background: '#6430F7', color: '#fff',
              fontSize: px(13), fontWeight: 700, letterSpacing: '0.04em',
              padding: `${px(14)} ${px(26)}`, borderRadius: px(100),
              whiteSpace: 'nowrap',
            }}>{cta}</div>
          )}
        </div>
      </div>
    </div>
  )
}
