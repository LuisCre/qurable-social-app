/* ────────────────────────────────────────────
   PURPLE BRAND — Violeta puro, energía de marca
   ──────────────────────────────────────────── */
export default function PurpleBrand({ data, fmt }) {
  const { headline = 'Algo grande\nestá llegando', subtitle = '', cta = '', label = '', logoVariant = 'white' } = data
  const isStory = fmt.height > fmt.width
  const basePx = fmt.width / 1080
  const px = n => `${n * basePx}px`

  return (
    <div style={{
      width: fmt.width, height: fmt.height,
      background: 'linear-gradient(150deg, #6430F7 0%, #4C1AD6 40%, #350DAA 100%)',
      position: 'relative', overflow: 'hidden',
      fontFamily: '"PP Neue Montreal", sans-serif',
    }}>
      {/* Noise texture overlay */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E")`,
        opacity: 0.5,
      }} />

      {/* Decorative circles */}
      <div style={{
        position: 'absolute', top: px(-200), right: px(-200),
        width: px(800), height: px(800),
        border: `${px(1)} solid rgba(255,255,255,0.1)`,
        borderRadius: '50%',
      }} />
      <div style={{
        position: 'absolute', top: px(-100), right: px(-100),
        width: px(500), height: px(500),
        border: `${px(1)} solid rgba(255,255,255,0.07)`,
        borderRadius: '50%',
      }} />

      {/* Bottom light blob */}
      <div style={{
        position: 'absolute', bottom: px(-150), left: px(-100),
        width: px(600), height: px(400),
        background: 'radial-gradient(ellipse, rgba(255,255,255,0.08) 0%, transparent 70%)',
      }} />

      {/* Giant Q background */}
      <div style={{
        position: 'absolute', right: px(-80), bottom: px(-80),
        fontSize: px(600), fontWeight: 700,
        color: 'rgba(255,255,255,0.04)',
        lineHeight: 1, userSelect: 'none',
        fontFamily: '"PP Neue Montreal", sans-serif',
      }}>Q</div>

      {/* Logo top-left */}
      <div style={{
        position: 'absolute', top: px(isStory ? 80 : 60), left: px(64),
      }}>
        <img src="/logos/logo-white.svg" style={{ height: px(28) }} />
      </div>

      {/* Tag top-right */}
      {label && (
        <div style={{
          position: 'absolute', top: px(isStory ? 80 : 60), right: px(64),
          fontSize: px(11), fontWeight: 700, letterSpacing: '0.15em',
          textTransform: 'uppercase', color: 'rgba(255,255,255,0.9)',
          border: '1px solid rgba(255,255,255,0.3)',
          padding: `${px(6)} ${px(14)}`, borderRadius: px(100),
        }}>{label}</div>
      )}

      {/* Center content */}
      <div style={{
        position: 'absolute',
        left: px(64), right: px(64),
        top: '50%', transform: 'translateY(-55%)',
      }}>
        <h1 style={{
          margin: 0,
          fontSize: px(isStory ? 96 : 78),
          fontWeight: 700,
          lineHeight: 1.0,
          letterSpacing: '-0.03em',
          color: '#FFFFFF',
          whiteSpace: 'pre-line',
        }}>{headline}</h1>

        {subtitle && (
          <p style={{
            margin: `${px(32)} 0 0`,
            fontSize: px(20),
            fontWeight: 400,
            lineHeight: 1.5,
            color: 'rgba(255,255,255,0.65)',
            maxWidth: px(680),
          }}>{subtitle}</p>
        )}
      </div>

      {/* Bottom */}
      <div style={{
        position: 'absolute', bottom: px(isStory ? 80 : 64),
        left: px(64), right: px(64),
        display: 'flex', alignItems: 'center', gap: px(20),
      }}>
        {cta && (
          <div style={{
            background: 'rgba(255,255,255,0.15)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,255,255,0.25)',
            color: '#fff', fontSize: px(14), fontWeight: 700,
            letterSpacing: '0.04em',
            padding: `${px(14)} ${px(28)}`, borderRadius: px(100),
          }}>{cta}</div>
        )}
        <div style={{ flex: 1, height: px(1), background: 'rgba(255,255,255,0.15)' }} />
      </div>
    </div>
  )
}
