/* ────────────────────────────────────────────
   CLEAN WHITE — Editorial, ideal LinkedIn
   ──────────────────────────────────────────── */
export default function CleanWhite({ data, fmt }) {
  const { headline = 'Un pensamiento\nque vale la pena', subtitle = '', cta = '', label = '' } = data
  const isStory = fmt.height > fmt.width
  const basePx = fmt.width / 1080
  const px = n => `${n * basePx}px`

  return (
    <div style={{
      width: fmt.width, height: fmt.height,
      background: '#FAFAFA',
      position: 'relative', overflow: 'hidden',
      fontFamily: '"PP Neue Montreal", sans-serif',
    }}>
      {/* Left accent bar */}
      <div style={{
        position: 'absolute', left: 0, top: 0, bottom: 0,
        width: px(6), background: 'linear-gradient(to bottom, #6430F7, #4318CC)',
      }} />

      {/* Subtle grid pattern */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: `radial-gradient(circle, rgba(100,48,247,0.04) 1px, transparent 1px)`,
        backgroundSize: `${px(40)} ${px(40)}`,
      }} />

      {/* Purple glow top-right */}
      <div style={{
        position: 'absolute', top: px(-200), right: px(-200),
        width: px(500), height: px(500),
        background: 'radial-gradient(circle, rgba(100,48,247,0.06) 0%, transparent 70%)',
      }} />

      {/* Logo Q iso — top right, ghosted */}
      <div style={{
        position: 'absolute', top: px(isStory ? 70 : 52), right: px(64),
      }}>
        <img src="/logos/logo-black.svg" style={{ height: px(32), opacity: 0.8 }} />
      </div>

      {/* Main content */}
      <div style={{
        position: 'absolute',
        top: '50%', transform: 'translateY(-52%)',
        left: px(88), right: px(88),
      }}>
        {/* Category */}
        {label && (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: px(8),
            marginBottom: px(36),
          }}>
            <div style={{ width: px(24), height: px(2), background: '#6430F7' }} />
            <span style={{
              fontSize: px(12), fontWeight: 700,
              letterSpacing: '0.14em', textTransform: 'uppercase',
              color: '#6430F7',
            }}>{label}</span>
          </div>
        )}

        {/* Headline */}
        <h1 style={{
          margin: `0 0 ${px(32)} 0`,
          fontSize: px(isStory ? 80 : 64),
          fontWeight: 700,
          lineHeight: 1.05,
          letterSpacing: '-0.03em',
          color: '#1E293B',
          whiteSpace: 'pre-line',
        }}>{headline}</h1>

        {/* Divider */}
        <div style={{ width: px(64), height: px(2), background: '#6430F7', marginBottom: px(28) }} />

        {/* Subtitle */}
        {subtitle && (
          <p style={{
            margin: 0,
            fontSize: px(20),
            fontWeight: 400,
            lineHeight: 1.6,
            color: '#475569',
            maxWidth: px(700),
          }}>{subtitle}</p>
        )}
      </div>

      {/* Bottom — CTA + brand */}
      <div style={{
        position: 'absolute', bottom: px(isStory ? 80 : 60),
        left: px(88), right: px(88),
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        {cta ? (
          <div style={{
            fontSize: px(14), fontWeight: 700, letterSpacing: '0.04em',
            color: '#6430F7', display: 'flex', alignItems: 'center', gap: px(8),
          }}>
            <span>{cta}</span>
            <span style={{ fontSize: px(16) }}>→</span>
          </div>
        ) : <div />}

        <span style={{
          fontSize: px(13), fontWeight: 500, color: '#94A3B8',
          letterSpacing: '0.02em',
        }}>qurable.com</span>
      </div>
    </div>
  )
}
