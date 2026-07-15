/* ────────────────────────────────────────────
   BOLD DARK — Navy profundo, tipografía hero
   ──────────────────────────────────────────── */
export default function BoldDark({ data, fmt }) {
  const { headline = 'Tu titular\nva aquí', subtitle = '', cta = '', label = '', bgImage, logoVariant = 'white' } = data
  const isStory = fmt.height > fmt.width

  const basePx = fmt.width / 1080
  const px = n => `${n * basePx}px`

  return (
    <div style={{
      width: fmt.width, height: fmt.height,
      background: bgImage
        ? 'transparent'
        : 'linear-gradient(150deg, #111827 0%, #0A0A1A 60%, #120B2E 100%)',
      position: 'relative', overflow: 'hidden',
      fontFamily: '"PP Neue Montreal", sans-serif',
    }}>
      {/* Background image with overlay */}
      {bgImage && (
        <>
          <img src={bgImage} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', filter: 'brightness(0.3) saturate(0.6)' }} />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(160deg, rgba(10,10,26,0.9) 0%, rgba(18,11,46,0.85) 100%)' }} />
        </>
      )}

      {/* Decorative Q watermark */}
      <div style={{
        position: 'absolute', right: px(-40), top: px(-60),
        fontSize: px(520), fontWeight: 700, color: 'rgba(100,48,247,0.06)',
        lineHeight: 1, userSelect: 'none', fontFamily: '"PP Neue Montreal", sans-serif',
      }}>Q</div>

      {/* Purple glow blob */}
      <div style={{
        position: 'absolute', top: px(-100), right: px(-100),
        width: px(500), height: px(500),
        background: 'radial-gradient(circle, rgba(100,48,247,0.15) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      {/* Top bar — Logo + label */}
      <div style={{
        position: 'absolute', top: px(isStory ? 80 : 60), left: px(64), right: px(64),
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <img src={`/logos/logo-${logoVariant}.svg`} style={{ height: px(28) }} />
        {label && (
          <span style={{
            fontSize: px(11), fontWeight: 700, letterSpacing: '0.15em',
            textTransform: 'uppercase', color: '#6430F7',
            border: '1px solid rgba(100,48,247,0.4)',
            padding: `${px(6)} ${px(14)}`, borderRadius: px(100),
          }}>{label}</span>
        )}
      </div>

      {/* Main content */}
      <div style={{
        position: 'absolute',
        left: px(64), right: px(64),
        top: '50%', transform: 'translateY(-55%)',
      }}>
        {/* Accent bar */}
        <div style={{ width: px(48), height: px(4), background: '#6430F7', borderRadius: px(2), marginBottom: px(32) }} />

        {/* Headline */}
        <h1 style={{
          margin: 0,
          fontSize: px(isStory ? 88 : 72),
          fontWeight: 700,
          lineHeight: 1.02,
          letterSpacing: '-0.03em',
          color: '#FFFFFF',
          whiteSpace: 'pre-line',
        }}>{headline}</h1>

        {/* Subtitle */}
        {subtitle && (
          <p style={{
            margin: `${px(28)} 0 0`,
            fontSize: px(20),
            fontWeight: 400,
            lineHeight: 1.5,
            color: 'rgba(255,255,255,0.55)',
            maxWidth: px(680),
          }}>{subtitle}</p>
        )}
      </div>

      {/* Bottom — CTA */}
      <div style={{
        position: 'absolute', bottom: px(isStory ? 80 : 64), left: px(64), right: px(64),
        display: 'flex', alignItems: 'center', gap: px(20),
      }}>
        {cta && (
          <div style={{
            background: '#6430F7', color: '#fff',
            fontSize: px(14), fontWeight: 700,
            letterSpacing: '0.04em',
            padding: `${px(14)} ${px(28)}`,
            borderRadius: px(100),
            display: 'inline-block',
          }}>{cta}</div>
        )}
        <div style={{ flex: 1, height: px(1), background: 'rgba(255,255,255,0.1)' }} />
      </div>
    </div>
  )
}
