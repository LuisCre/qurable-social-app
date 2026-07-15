/**
 * AI layer — Qurable Social Generator
 * Llama a OpenAI para generar copy, recomendar estilo e imagen
 */

const BRAND_SYSTEM_PROMPT = `Sos el sistema de inteligencia creativa de Qurable, fintech latinoamericana de pagos y beneficios digitales.

## Tu rol
Analizás un brief y devolvés los campos necesarios para armar una pieza de redes sociales: copy, estilo visual, y SOLO si es explícitamente necesario, una imagen de fondo.

## REGLA CRÍTICA — Textos proporcionados por el usuario
Si el brief contiene textos marcados explícitamente (con "TEXTOS:", comillas, viñetas, o etiquetas como "Headline:", "Eyebrow:", "Línea principal:", etc.):
- COPIÁ esos textos EXACTAMENTE, sin cambiar ni una palabra
- NO los "mejores", NO los acortes, NO los reescribas
- Tu única tarea en ese caso es elegir el estilo visual adecuado
- El headline puede ser largo si el usuario lo proporcionó así — respetalo

Si el brief es solo un concepto o idea (sin textos específicos), entonces sí generás copy creativo siguiendo el tono de Qurable.

## REGLA CRÍTICA — Imagen de fondo (needsImage)
needsImage debe ser TRUE únicamente si:
- El brief menciona explícitamente "foto", "imagen de fondo", "background fotográfico", "photo"
- O el estilo elegido es "photo-hero" Y el brief no tiene textos preexistentes

En TODOS los demás casos: needsImage: false
Cuando hay dudas: needsImage: false
El usuario puede agregar imagen manualmente si quiere. No la generes por defecto.

## Brand Qurable

### Tono de voz (para copy generado, no para textos provistos)
- Directo, claro, sin jerga corporativa
- Verbos de acción: transformar, conectar, escalar, habilitar
- Español latinoamericano (voseo)
- NUNCA frases motivacionales genéricas

## Templates disponibles
- bold-dark: Navy profundo, tipografía de impacto. Anuncios, lanzamientos.
- purple-brand: Violeta puro. Celebraciones, hitos de marca.
- photo-hero: Foto full bleed con overlay. Solo si el brief pide imagen.
- clean-white: Blanco editorial. LinkedIn, contenido educativo, insights.
- gradient-dark: Dark to purple. Partnerships, producto premium.

## Selección de estilo
- Announcement/launch → bold-dark
- Partnership/alianza → gradient-dark (sin imagen a menos que se pida)
- Energía de marca → purple-brand
- Persona o foto real → photo-hero (solo si hay foto)
- Insight/educativo → clean-white`

/**
 * Genera copy completo y recomienda estilo a partir de un brief
 */
export async function generateFromBrief({ brief, platform, format, apiKey }) {
  if (!apiKey) throw new Error('API key requerida. Configurala en ⚙ Ajustes.')

  const userPrompt = `Brief: "${brief}"
Plataforma: ${platform.toUpperCase()} | Formato: ${format}

INSTRUCCIONES:
1. Si el brief contiene textos explícitos (marcados con "TEXTOS:", viñetas, comillas, "Línea principal:", "Eyebrow:", etc.) → copialos EXACTAMENTE en los campos correspondientes. NO los modifiques.
2. Si es solo un concepto/idea → generá copy creativo en tono Qurable.
3. needsImage: false por defecto. Solo true si el brief pide explícitamente una foto o imagen de fondo.

Mapeo de textos del brief a campos JSON:
- Titular / Headline / Línea principal → "headline"
- Eyebrow / Tag / Label pequeño → "label"
- Bajada / Subtítulo → "subtitle"
- CTA → "cta"

Respondé SOLO con JSON válido:
{
  "headline": "texto exacto o generado (puede tener \\n para saltos de línea)",
  "subtitle": "texto exacto o generado",
  "cta": "texto exacto o generado (si no hay CTA en el brief: 'Conocé más')",
  "label": "texto exacto o generado",
  "style": "bold-dark | purple-brand | photo-hero | clean-white | gradient-dark",
  "needsImage": false,
  "imagePrompt": "",
  "reasoning": "una línea sobre el estilo elegido"
}`

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: BRAND_SYSTEM_PROMPT },
        { role: 'user',   content: userPrompt },
      ],
      temperature: 0.35,
      max_tokens: 700,
      response_format: { type: 'json_object' },
    }),
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(err?.error?.message || `OpenAI error ${response.status}`)
  }

  const json = await response.json()
  const content = json.choices?.[0]?.message?.content
  return JSON.parse(content)
}

/**
 * Genera una imagen con DALL-E 3
 */
export async function generateImage({ prompt, format, apiKey }) {
  if (!apiKey) throw new Error('API key requerida.')

  // gpt-image-1 sizes: 1024x1024 · 1536x1024 · 1024x1536 · auto
  const sizeMap = {
    '1:1':  '1024x1024',
    '4:5':  '1024x1536',
    '9:16': '1024x1536',
    '16:9': '1536x1024',
  }
  const size = sizeMap[format] || '1024x1024'

  const brandPrompt = `${prompt}. Photorealistic or high-quality digital art. Muted cool color palette — blues, indigo, dark purples. Professional, modern, no text, no watermarks, no logos. Premium quality.`

  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-image-1',
      prompt: brandPrompt,
      n: 1,
      size,
      quality: 'high',
    }),
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(err?.error?.message || `OpenAI image error ${response.status}`)
  }

  const json = await response.json()
  // gpt-image-1 devuelve base64, no URL
  const b64 = json.data?.[0]?.b64_json
  if (!b64) throw new Error('No se recibió imagen de la API')
  return `data:image/png;base64,${b64}`
}

/**
 * Itera sobre una pieza existente con una instrucción
 */
export async function iteratePiece({ currentData, instruction, platform, format, apiKey }) {
  if (!apiKey) throw new Error('API key requerida.')

  const userPrompt = `Pieza actual:
- Titular: "${currentData.headline}"
- Bajada: "${currentData.subtitle}"
- CTA: "${currentData.cta}"
- Label: "${currentData.label}"
- Estilo: ${currentData.style || 'bold-dark'}

Instrucción de cambio: "${instruction}"
Plataforma: ${platform.toUpperCase()} | Formato: ${format}

REGLAS:
- Modificá SOLO lo que la instrucción pide cambiar. El resto queda idéntico.
- Si la instrucción no menciona imágenes: needsImage: false
- Si la instrucción pide cambiar un texto específico, usá exactamente ese texto

Respondé SOLO con JSON:
{
  "headline": "...",
  "subtitle": "...",
  "cta": "...",
  "label": "...",
  "style": "bold-dark | purple-brand | photo-hero | clean-white | gradient-dark",
  "needsImage": false,
  "imagePrompt": ""
}`

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: BRAND_SYSTEM_PROMPT },
        { role: 'user',   content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 600,
      response_format: { type: 'json_object' },
    }),
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(err?.error?.message || `OpenAI error ${response.status}`)
  }

  const json = await response.json()
  return JSON.parse(json.choices?.[0]?.message?.content)
}
