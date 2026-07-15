/* ────────────────────────────────────────────
   GRADIENT DARK — Navy to Purple, premium aspiracional
   ──────────────────────────────────────────── */
export default function GradientDark({ data, fmt }) {
  const { headline = 'El futuro\ndel pago digital', subtitle = '', cta = '', label = '', bgImage, logoVariant = 'white' } = data
  const isStory = fmt.height > fmt.width
  const basePx = fmt.width / 1080
  const px = n => `${n * basePx}px`

  return (
    <div style={{
      width: fmt.width, height: fmt.height,
      background: 'linear-gradient(145deg, #0F172A 0%, #1E1040 35%, #3B1090 65%, #6430F7 100%)',
      position: 'relative', overflow: 'hidden',
      fontFamily: '"PP Neue Montreal", sans-serif',
    }}>
      {/* Background image with blend */}
      {bgImage && (
        <img src={bgImage} style={{
          position: 'absolute', inset: 0, width: '100%', height: '100%',
          objectFit: 'cover', opacity: 0.12, mixBlendMode: 'luminosity',
        }} />
      )}

      {/* Radial purple bloom — top right */}
      <div style={{
        position: 'absolute', top: px(-200), right: px(-100),
        width: px(700), height: px(700),
        background: 'radial-gradient(circle, rgba(139,92,246,0.35) 0%, transparent 65%)',
      }} />

      {/* Radial blue bloom — bottom left */}
      <div style={{
        position: 'absolute', bottom: px(-150), left: px(-150),
        width: px(600), height: px(600),
        background: 'radial-gradient(circle, rgba(59,16,144,0.5) 0%, transparent 65%)',
      }} />

      {/* Grain */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.05'/%3E%3C/svg%3E")`,
      }} />

      {/* Diagonal line elements */}
      <div style={{
        position: 'absolute', top: 0, left: '60%', right: 0, bottom: 0,
        background: 'linear-gradient(to right, transparent, rgba(255,255,255,0.02))',
        transform: 'skewX(-15deg)', transformOrigin: 'top right',
      }} />

      {/* Top — Logo + tag */}
      <div style={{
        position: 'absolute', top: px(isStory ? 80 : 60), left: px(64), right: px(64),
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <img src="/logos/logo-white.svg" style={{ height: px(28) }} />
        {label && (
          <span style={{
            fontSize: px(11), fontWeight: 700, letterSpacing: '0.15em',
            textTransform: 'uppercase', color: 'rgba(255,255,255,0.7)',
            border: '1px solid rgba(255,255,255,0.2)',
            padding: `${px(6)} ${px(14)}`, borderRadius: px(100),
            backdropFilter: 'blur(10px)',
          }}>{label}</span>
        )}
      </div>

      {/* Center content */}
      <div style={{
        position: 'absolute',
        left: px(64), right: px(64),
        top: '50%', transform: 'translateY(-52%)',
      }}>
        {/* Small accent dots */}
        <div style={{ display: 'flex', gap: px(6), marginBottom: px(28) }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{
              width: px(6), height: px(6), borderRadius: '50%',
              background: i === 1 ? '#6430F7' : i === 2 ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.15)',
            }} />
          ))}
        </div>

        {/* Headline */}
        <h1 style={{
          margin: `0 0 ${px(24)} 0`,
          fontSize: px(isStory ? 92 : 74),
          fontWeight: 700,
          lineHeight: 1.02,
          letterSpacing: '-0.03em',
          color: '#FFFFFF',
          whiteSpace: 'pre-line',
        }}>{headline}</h1>

        {/* Divider */}
        <div style={{
          width: px(56), height: px(3),
          background: 'linear-gradient(to right, #6430F7, rgba(100,48,247,0))',
          marginBottom: px(24),
          borderRadius: px(2),
        }} />

        {/* Subtitle */}
        {subtitle && (
          <p style={{
            margin: 0, fontSize: px(20), fontWeight: 400,
            lineHeight: 1.55, color: 'rgba(255,255,255,0.55)',
            maxWidth: px(640),
          }}>{subtitle}</p>
        )}
      </div>

      {/* Bottom */}
      <div style={{
        position: 'absolute', bottom: px(isStory ? 80 : 64),
        left: px(64), right: px(64),
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        {cta && (
          <div style={{
            background: 'rgba(255,255,255,0.1)',
            border: '1px solid rgba(255,255,255,0.2)',
            backdropFilter: 'blur(12px)',
            color: '#fff', fontSize: px(14), fontWeight: 700,
            letterSpacing: '0.04em',
            padding: `${px(14)} ${px(28)}`, borderRadius: px(100),
          }}>{cta}</div>
        )}
        <div style={{ flex: 1, height: px(1), background: 'linear-gradient(to right, transparent, rgba(255,255,255,0.12), transparent)', margin: `0 ${px(20)}` }} />
        <span style={{ fontSize: px(13), color: 'rgba(255,255,255,0.3)', fontWeight: 500 }}>qurable.com</span>
      </div>
    </div>
  )
}
