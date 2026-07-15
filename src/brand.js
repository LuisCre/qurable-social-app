export const BRAND = {
  colors: {
    primary:       '#6430F7',
    primaryLight:  '#8B5CF6',
    primaryDark:   '#4318CC',
    navy:          '#1E293B',
    dark:          '#0F172A',
    white:         '#FFFFFF',
    offWhite:      '#FAFAFA',
    gray50:        '#FAFAFA',
    gray100:       '#F0F0F0',
    gray200:       '#D7D6DB',
    gray300:       '#BFBDC5',
    gray500:       '#64748B',
    gray900:       '#1E293B',
  },
  gradients: {
    purpleDark:  'linear-gradient(135deg, #1E293B 0%, #0F172A 100%)',
    purpleBrand: 'linear-gradient(135deg, #7C3AED 0%, #4318CC 100%)',
    purpleVibe:  'linear-gradient(135deg, #6430F7 0%, #3B0FCC 100%)',
    darkGlow:    'linear-gradient(135deg, #1E293B 0%, #2D1B69 100%)',
    midnight:    'linear-gradient(135deg, #0F172A 0%, #1E1040 100%)',
  },
  fonts: {
    primary: '"PP Neue Montreal", sans-serif',
    secondary: '"TWK Lausanne", sans-serif',
  },
}

export const FORMATS = {
  '1:1':  { width: 1080, height: 1080, label: '1:1 — Post cuadrado' },
  '4:5':  { width: 1080, height: 1350, label: '4:5 — Post vertical' },
  '9:16': { width: 1080, height: 1920, label: '9:16 — Story / Reel' },
  '16:9': { width: 1920, height: 1080, label: '16:9 — Cover / Banner' },
}

export const PLATFORMS = {
  ig: { label: 'Instagram', formats: ['4:5', '9:16'], types: ['Post', 'Story', 'Carrusel', 'Reel'] },
  ln: { label: 'LinkedIn',  formats: ['1:1', '4:5', '16:9'], types: ['Post', 'Carrusel', 'Banner'] },
  fb: { label: 'Facebook',  formats: ['16:9', '1:1', '4:5'], types: ['Post', 'Story', 'Banner'] },
}

export const STYLES = [
  {
    id: 'bold-dark',
    label: 'Bold Dark',
    desc: 'Editorial de impacto, headline enorme sobre fondo oscuro',
    mood: 'Editorial',
    preview: 'linear-gradient(160deg, #08080F 0%, #0D0D20 60%, #111127 100%)',
    accentColor: '#6430F7',
    textColor: '#FFFFFF',
    platforms: ['IG', 'LN'],
  },
  {
    id: 'purple-brand',
    label: 'Purple Brand',
    desc: 'Identidad de marca, energía y CTA fuerte al centro',
    mood: 'Brand',
    preview: 'linear-gradient(155deg, #5823E8 0%, #4318CC 50%, #310FA8 100%)',
    accentColor: '#FFFFFF',
    textColor: '#FFFFFF',
    platforms: ['IG', 'FB'],
  },
  {
    id: 'photo-hero',
    label: 'Photo Hero',
    desc: 'Foto full bleed con overlay y texto sobre imagen',
    mood: 'Visual',
    preview: 'linear-gradient(to top, #0A0F1E 0%, #334155 60%, #64748B 100%)',
    accentColor: '#6430F7',
    textColor: '#FFFFFF',
    platforms: ['IG', 'FB'],
  },
  {
    id: 'clean-white',
    label: 'Clean White',
    desc: 'Minimalismo tipográfico, ideal para LinkedIn y corporate',
    mood: 'Minimal',
    preview: '#FFFFFF',
    accentColor: '#6430F7',
    textColor: '#0A0A14',
    platforms: ['LN', 'FB'],
  },
  {
    id: 'gradient-dark',
    label: 'Gradient Dark',
    desc: 'Gradiente profundo, premium y aspiracional — estilo Stripe',
    mood: 'Premium',
    preview: 'linear-gradient(145deg, #0A0A18 0%, #160B3C 30%, #2B0F74 60%, #5020CC 85%, #6430F7 100%)',
    accentColor: '#FFFFFF',
    textColor: '#FFFFFF',
    platforms: ['IG', 'LN', 'FB'],
  },
]
