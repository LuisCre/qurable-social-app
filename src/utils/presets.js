/**
 * Canvas presets v4 — Qurable Social Generator
 *
 * BUGS CORREGIDOS vs v3:
 * - Bold Dark: headline + 16 causaba wrap inesperado → colisión con subtitle
 * - Clean White: headline + 20 (168px) hacía wrap en 4-5 líneas → body dentro del headline
 * - Photo Hero: y fijo = h-316 con 148px/3 líneas = 430px de alto → salía 114px del canvas
 * - Purple Brand + Gradient Dark: CTA buttons en imagen estática (no tienen función)
 *
 * PRINCIPIOS DE POSICIONAMIENTO:
 * - Usar eH() para calcular altura real de cada elemento antes de posicionar el siguiente
 * - Fuentes left-aligned (hlL) calibradas para que ninguna línea explícita haga wrap
 * - Fuentes centered (hlC) pueden ser más grandes porque el wrap es grácil
 * - Photo Hero: headline se ancla desde abajo (h - PAD - altura), no desde arriba
 * - SIN CTAs en ningún preset: las imágenes estáticas no tienen interacción
 */

const T   = 'text'
const IMG = 'image'
const SH  = 'shape'

export function createCanvas(styleId, fmt) {
  const w = fmt.width   // ej. 1080
  const h = fmt.height  // ej. 1350 para 4:5
  const ratio = h / w   // ej. 1.25

  // ── Escala tipográfica PROPORCIONAL ────────────────────────────────────
  //
  // hlL (left-aligned): calibrada para que ninguna línea explícita supere maxWidth.
  // hlC (centered): puede ser más grande; el wrap en centrado es grácil.
  //
  const hlL = ratio > 1.5 ? 120 : ratio > 1.1 ? 100 : ratio < 0.7 ? 64 : 82
  const hlC = ratio > 1.5 ? 156 : ratio > 1.1 ? 140 : ratio < 0.7 ? 88 : 112

  // Bajadas y logo PROPORCIONALES al headline y al canvas.
  // Regla editorial: bajada ≈ 28-32% del headline · logo ≈ 4% del ancho del canvas.
  // Así se mantiene la jerarquía visual independientemente del formato.
  const subL  = Math.round(hlL * 0.30)  // bajada para presets left-aligned  (4:5 → 30px)
  const subC  = Math.round(hlC * 0.22)  // bajada para presets centered       (4:5 → 31px)
  const logoH = Math.round(w * 0.040)   // logo proporcional al ancho canvas  (1080 → 43px)

  // ── Grilla de composición ───────────────────────────────────────────────
  const PAD = 72        // padding lateral
  const LX  = 96        // x para elementos con barra lateral (Clean White)
  const T3  = h / 3    // tercio de altura (regla de tercios)
  const BR  = h - PAD  // borde inferior respirable

  // eH: estima la altura en px de un bloque de texto (lines × fontSize × lineHeight)
  const eH = (lines, size, lh = 0.95) => Math.ceil(lines * size * lh)

  const presets = {

    /* ─── BOLD DARK ─────────────────────────────────────────────────────────
       Mood: Editorial de autoridad. WIRED cover, Apple Keynote, NYT homepage.
       Composición: regla de tercios — línea de acento en T3-1, headline desde T3.
       Subtitle posicionado dinámicamente DEBAJO del headline (no en T3*2 fijo).
       SIN CTA — el editorial posiciona la marca, no convierte directamente.      */
    'bold-dark': {
      bg: { type: 'gradient', value: 'linear-gradient(160deg, #07070E 0%, #0C0C1E 60%, #0E0E1C 100%)' },
      elements: (() => {
        const hlY = Math.round(T3)
        const hlH = eH(3, hlL, 0.95)
        const subY = hlY + hlH + 60
        return [
          { id: 'logo',
            type: IMG, src: '/logos/logo-white.svg',
            x: PAD, y: 60, width: 'auto', height: logoH, opacity: 0.88 },

          { id: 'line',
            type: SH, shape: 'rect',
            x: PAD, y: hlY - 36, width: 48, height: 5,
            color: '#6430F7', borderRadius: 2 },

          { id: 'headline',
            type: T,
            content: 'La oportunidad\nmás grande\ndel año.',
            x: PAD, y: hlY,
            maxWidth: w - PAD * 2,
            fontSize: hlL, fontWeight: '700', color: '#FFFFFF',
            letterSpacing: '-0.038em', lineHeight: 0.95, textAlign: 'left' },

          { id: 'subtitle',
            type: T,
            content: 'Tecnología financiera para marcas\nque quieren escalar.',
            x: PAD, y: subY,
            maxWidth: w - PAD * 2,
            fontSize: subL, fontWeight: '400',
            color: 'rgba(255,255,255,0.55)',
            lineHeight: 1.55, textAlign: 'left' },
        ]
      })(),
    },

    /* ─── PURPLE BRAND ───────────────────────────────────────────────────────
       Mood: Campaña de marca energética. Stripe launch, Linear announcement.
       Composición: centrada total — logo arriba, eyebrow + headline en zona media.
       SIN CTA — la pieza es awareness, no conversión directa en imagen estática.  */
    'purple-brand': {
      bg: { type: 'gradient', value: 'linear-gradient(155deg, #5520E8 0%, #3F14CC 45%, #2C0DA0 100%)' },
      elements: (() => {
        const eyeY = Math.round(T3 * 0.68)
        const hlY  = Math.round(T3 * 0.78)
        return [
          { id: 'glow',
            type: SH, shape: 'rect',
            x: Math.round(w * 0.2), y: Math.round(-h * 0.05),
            width: Math.round(w * 0.6), height: Math.round(w * 0.6),
            color: 'rgba(255,255,255,0.07)', borderRadius: 999 },

          { id: 'logo',
            type: IMG, src: '/logos/logo-white.svg',
            x: 0, y: 64, width: 'auto', height: logoH, opacity: 0.92,
            maxWidth: w, textAlign: 'center' },

          { id: 'eyebrow',
            type: T,
            content: 'NUEVA FUNCIONALIDAD',
            x: 0, y: eyeY,
            maxWidth: w, fontSize: Math.round(logoH * 0.28), fontWeight: '700',
            color: 'rgba(255,255,255,0.45)',
            letterSpacing: '0.20em', textTransform: 'uppercase', textAlign: 'center' },

          { id: 'headline',
            type: T,
            content: 'Construimos\nel futuro\nde los pagos.',
            x: 0, y: hlY,
            maxWidth: w,
            fontSize: hlC, fontWeight: '700', color: '#FFFFFF',
            letterSpacing: '-0.04em', lineHeight: 0.96, textAlign: 'center' },

          { id: 'domain',
            type: T,
            content: 'qurable.co',
            x: 0, y: BR,
            maxWidth: w, fontSize: Math.round(subC * 0.55), fontWeight: '500',
            color: 'rgba(255,255,255,0.22)', textAlign: 'center' },
        ]
      })(),
    },

    /* ─── PHOTO HERO ─────────────────────────────────────────────────────────
       Mood: Visual storytelling. Vogue editorial, NYT Instagram.
       Composición: el headline se ANCLA DESDE ABAJO (h - PAD - altura real).
       Esto garantiza que el texto nunca salga del canvas, independientemente
       del formato (9:16, 4:5, 1:1). El usuario agrega su foto al fondo.
       SIN CTA — la fotografía hace todo el trabajo narrativo.                    */
    'photo-hero': {
      bg: { type: 'color', value: '#0A0A14' },
      elements: (() => {
        // ⚠ Posicionamiento desde el fondo hacia arriba:
        const hlH  = eH(3, hlL, 0.97)
        const hlY  = h - PAD - hlH
        const eyeY = hlY - Math.round(subL * 1.8)  // proporcional a subL
        return [
          { id: 'overlay',
            type: SH, shape: 'gradient-overlay',
            x: 0, y: 0, width: w, height: h,
            color: 'linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.60) 30%, rgba(0,0,0,0.15) 55%, transparent 75%)',
            zIndex: 1 },

          { id: 'logo',
            type: IMG, src: '/logos/logo-white.svg',
            x: PAD, y: 60, width: 'auto', height: Math.round(logoH * 0.72), opacity: 0.52, zIndex: 2 },

          { id: 'eyebrow',
            type: T,
            content: 'HISTORIA',
            x: PAD, y: eyeY,
            fontSize: Math.round(subL * 0.45), fontWeight: '700',
            color: '#6430F7', letterSpacing: '0.22em',
            textTransform: 'uppercase', zIndex: 2 },

          { id: 'headline',
            type: T,
            content: 'Detrás de\ncada pago,\nhay una historia.',
            x: PAD, y: hlY,
            maxWidth: w - PAD * 1.8,
            fontSize: hlL, fontWeight: '700', color: '#FFFFFF',
            letterSpacing: '-0.03em', lineHeight: 0.97, zIndex: 2 },
        ]
      })(),
    },

    /* ─── CLEAN WHITE ────────────────────────────────────────────────────────
       Mood: Pensamiento editorial. Notion post, LinkedIn de autoridad.
       Composición: headline monumental con barra lateral violeta. La tipografía
       ES el diseño. Elementos calculados dinámicamente para evitar colisión.
       SIN CTA — editorial construye autoridad, no convierte en imagen estática.   */
    'clean-white': {
      bg: { type: 'color', value: '#FFFFFF' },
      elements: (() => {
        const hlY  = Math.round(h * 0.28)
        const hlH  = eH(3, hlL, 0.95)
        const divY = hlY + hlH + 48
        const bdY  = divY + Math.round(subL * 0.7)
        const tagFs = Math.round(subL * 0.38)
        return [
          { id: 'bar',
            type: SH, shape: 'rect',
            x: 0, y: 0, width: 6, height: h, color: '#6430F7', borderRadius: 0 },

          { id: 'tag',
            type: T,
            content: 'PERSPECTIVA',
            x: LX, y: Math.round(PAD * 0.82),
            fontSize: tagFs, fontWeight: '700', color: '#6430F7',
            letterSpacing: '0.20em', textTransform: 'uppercase',
            hasBorder: true, borderColor: 'rgba(100,48,247,0.25)',
            borderRadius: 100, paddingX: 14, paddingY: 6 },

          { id: 'logo',
            type: IMG, src: '/logos/logo-black.svg',
            x: 0, y: Math.round(PAD * 0.75),
            width: 'auto', height: Math.round(logoH * 0.82), opacity: 0.38,
            textAlign: 'right', maxWidth: w - PAD },

          { id: 'headline',
            type: T,
            content: 'El insight que\ncambia cómo\noperás.',
            x: LX, y: hlY,
            maxWidth: w - LX - PAD,
            fontSize: hlL, fontWeight: '700', color: '#0A0A14',
            letterSpacing: '-0.04em', lineHeight: 0.95, textAlign: 'left' },

          { id: 'divider',
            type: SH, shape: 'rect',
            x: LX, y: divY, width: 40, height: 4, color: '#6430F7', borderRadius: 2 },

          { id: 'body',
            type: T,
            content: 'Una idea concreta que amplía el pensamiento\ny genera acción.',
            x: LX, y: bdY,
            maxWidth: w - LX - PAD, fontSize: subL, fontWeight: '400',
            color: '#555555', lineHeight: 1.60, textAlign: 'left' },

          { id: 'source',
            type: T,
            content: 'qurable.co',
            x: LX, y: BR,
            fontSize: Math.round(subL * 0.42), fontWeight: '500', color: '#C0C0C0' },
        ]
      })(),
    },

    /* ─── GRADIENT DARK ──────────────────────────────────────────────────────
       Mood: Premium aspiracional. Vercel, Stripe homepage, Linear.
       Composición: todo centrado, el degradado profundo hace el trabajo decorativo.
       Subtitle posicionado dinámicamente debajo del headline real.
       SIN CTA — premium awareness, no conversión directa en imagen estática.      */
    'gradient-dark': {
      bg: { type: 'gradient', value: 'linear-gradient(145deg, #08081A 0%, #120936 25%, #220C68 55%, #4418B8 80%, #6430F7 100%)' },
      elements: (() => {
        const hlY  = Math.round(T3 * 0.88)
        const hlH  = eH(3, hlC, 0.96)
        const subY = hlY + hlH + 56
        return [
          { id: 'halo',
            type: SH, shape: 'rect',
            x: Math.round(w * 0.15), y: Math.round(h * 0.1),
            width: Math.round(w * 0.7), height: Math.round(h * 0.45),
            color: 'rgba(100,48,247,0.10)', borderRadius: 999 },

          { id: 'logo',
            type: IMG, src: '/logos/logo-white.svg',
            x: 0, y: 64, width: 'auto', height: logoH, opacity: 0.82,
            maxWidth: w, textAlign: 'center' },

          { id: 'headline',
            type: T,
            content: 'Infraestructura\npara el nuevo\ncomercio.',
            x: 0, y: hlY,
            maxWidth: w,
            fontSize: hlC, fontWeight: '700', color: '#FFFFFF',
            letterSpacing: '-0.04em', lineHeight: 0.96, textAlign: 'center' },

          { id: 'subtitle',
            type: T,
            content: 'Pagos, beneficios y experiencias digitales\npara marcas que quieren escalar.',
            x: 0, y: subY,
            maxWidth: w, fontSize: subC, fontWeight: '400',
            color: 'rgba(255,255,255,0.50)',
            lineHeight: 1.60, textAlign: 'center' },

          { id: 'domain',
            type: T,
            content: 'qurable.co',
            x: 0, y: BR,
            maxWidth: w, fontSize: Math.round(subC * 0.52), fontWeight: '500',
            color: 'rgba(255,255,255,0.20)', textAlign: 'center' },
        ]
      })(),
    },
  }

  const preset = presets[styleId] || presets['bold-dark']
  return {
    bg: { ...preset.bg },
    elements: preset.elements.map(el => ({ ...el })),
  }
}

export const GRADIENT_PRESETS = [
  { label: 'Night',     value: 'linear-gradient(160deg, #07070E 0%, #0C0C1E 55%, #10101E 100%)' },
  { label: 'Purple',    value: 'linear-gradient(155deg, #5520E8 0%, #3F14CC 50%, #2C0DA0 100%)' },
  { label: 'Midnight',  value: 'linear-gradient(145deg, #08081A 0%, #120936 25%, #220C68 55%, #6430F7 100%)' },
  { label: 'Navy',      value: 'linear-gradient(135deg, #1E293B 0%, #2D1B69 100%)' },
  { label: 'Indigo',    value: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)' },
  { label: 'Sky',       value: 'linear-gradient(160deg, #0EA5E9 0%, #6366F1 100%)' },
  { label: 'Forest',    value: 'linear-gradient(160deg, #064E3B 0%, #065F46 100%)' },
  { label: 'Blanco',    value: '#FFFFFF', isColor: true },
  { label: 'Negro',     value: '#0A0A14', isColor: true },
]
