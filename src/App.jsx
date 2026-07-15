import { useState, useRef, useEffect, useCallback } from 'react'
import { toPng, toJpeg } from 'html-to-image'
import JSZip from 'jszip'
import { FORMATS, PLATFORMS, STYLES } from './brand.js'
import { createCanvas, GRADIENT_PRESETS } from './utils/presets.js'
import { generateFromBrief, generateImage, iteratePiece } from './utils/ai.js'
import { historyPush, historyUndo, historyRedo, canUndo, canRedo } from './hooks/useHistory.js'
import { saveProject, loadProject, listProjects, getSession, onAuthStateChange, signOut } from './utils/supabase.js'
import PropertiesPanel from './components/PropertiesPanel.jsx'
import IconPicker from './components/IconPicker.jsx'
import ProjectsPanel from './components/ProjectsPanel.jsx'
import AuthScreen from './components/AuthScreen.jsx'

const API_KEY = import.meta.env.VITE_OPENAI_KEY || ''

// Convierte un File a data URL base64 (persiste entre sesiones, a diferencia de blob:)
const fileToDataURL = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.readAsDataURL(file)
  reader.onload = () => resolve(reader.result)
  reader.onerror = reject
})

// Convierte hex + opacidad a rgba (para overlays con control de opacidad por stop)
const hexToRgba = (hex, opacity) => {
  if (!hex || hex === 'transparent') return `rgba(0,0,0,0)`
  if (hex.startsWith('rgba') || hex.startsWith('rgb')) return hex
  const h = hex.replace('#', '').padEnd(6, '0')
  const r = parseInt(h.substring(0, 2), 16) || 0
  const g = parseInt(h.substring(2, 4), 16) || 0
  const b = parseInt(h.substring(4, 6), 16) || 0
  return `rgba(${r},${g},${b},${opacity ?? 1})`
}

// Comprime una data URL de imagen a JPEG (reduce tamaño para Supabase)
const compressDataURL = (dataURL, maxDim = 1200, quality = 0.75) => new Promise((resolve) => {
  if (!dataURL || !dataURL.startsWith('data:image')) return resolve(dataURL)
  const img = new Image()
  img.onload = () => {
    const scale = Math.min(maxDim / img.naturalWidth, maxDim / img.naturalHeight, 1)
    const w = Math.max(1, Math.round(img.naturalWidth * scale))
    const h = Math.max(1, Math.round(img.naturalHeight * scale))
    const c = document.createElement('canvas')
    c.width = w; c.height = h
    c.getContext('2d').drawImage(img, 0, 0, w, h)
    resolve(c.toDataURL('image/jpeg', quality))
  }
  img.onerror = () => resolve(dataURL)
  img.src = dataURL
})

// Comprime todas las imágenes dentro de los slides antes de guardar en Supabase
const compressSlidesForStorage = async (slides) =>
  Promise.all(slides.map(async (slide) => {
    const newBg = { ...slide.bg }
    if (newBg.type === 'image' && newBg.value?.startsWith('data:')) {
      newBg.value = await compressDataURL(newBg.value)
    }
    const newElements = await Promise.all((slide.elements || []).map(async (el) => {
      if (el.type === 'image' && el.src?.startsWith('data:')) {
        return { ...el, src: await compressDataURL(el.src) }
      }
      return el
    }))
    return { ...slide, bg: newBg, elements: newElements }
  }))
let _uid = 1
const uid = () => `el_${_uid++}`

const DEFAULT_BG = { type: 'gradient', value: 'linear-gradient(150deg, #111827 0%, #0A0A1A 100%)' }
const INIT_SLIDE = () => ({ id: uid(), elements: [], bg: { ...DEFAULT_BG } })

// ── Theme colors ──────────────────────────────────────────────────────────────
// Paleta de sistema: grises neutros (sin tinte azul/violeta en el chrome).
// Violeta #6430F7 solo para: active/selected, primary CTA, AI highlight.
const THEMES = {
  dark: {
    bg: '#111111',         sidebar: '#1A1A1A',  sidebarBorder: '#2A2A2A',
    panel: '#1A1A1A',      panelBorder: '#2A2A2A',
    input: '#252525',      inputBorder: '#353535',
    canvasBg: '#2E2E2E',  carouselBg: '#222222',
    text: '#FFFFFF',       textMuted: '#8A8A8A',  textFaint: '#4A4A4A',
    accent: '#6430F7',     accentLight: '#A78BFA',
    btnHover: '#2E2E2E',
    selected: '#303030',   selectedText: '#FFFFFF',
  },
  light: {
    bg: '#EBEBEB',         sidebar: '#F5F5F5',   sidebarBorder: '#E0E0E0',
    panel: '#F5F5F5',      panelBorder: '#E0E0E0',
    input: '#EBEBEB',      inputBorder: '#D5D5D5',
    canvasBg: '#D6D6D6',  carouselBg: '#C8C8C8',
    text: '#111111',       textMuted: '#6B6B6B',  textFaint: '#A0A0A0',
    accent: '#6430F7',     accentLight: '#7C3AED',
    btnHover: '#E0E0E0',
    selected: '#E2E2E2',   selectedText: '#111111',
  },
}

// ── Element Renderer ──────────────────────────────────────────────────────────
function ElementRenderer({ el, selected, editing, onMouseDown, onDoubleClick, scale, canvasWidth = 1080 }) {
  const sel = {}
  const elTransformParts = [
    el.rotation ? `rotate(${el.rotation}deg)` : '',
    el.flipH ? 'scaleX(-1)' : '',
    el.flipV ? 'scaleY(-1)' : '',
  ].filter(Boolean)
  const elTransformStyle = elTransformParts.length
    ? { transform: elTransformParts.join(' '), transformOrigin: 'center center' }
    : {}
  const base = { position: 'absolute', left: el.x, top: el.y, cursor: 'move', userSelect: 'none', zIndex: el.zIndex || 2, ...elTransformStyle, ...sel }

  if (el.type === 'text') {
    const hasPad = el.hasBg || el.hasBorder
    const isCentered = el.textAlign === 'center' || el.textAlign === 'right'
    const textStyle = isCentered
      ? { width: el.maxWidth || canvasWidth, textAlign: el.textAlign }
      : { textAlign: el.textAlign || 'left' }
    const isGradColor = typeof el.color === 'string' && el.color.includes('gradient')
    // text-shadow
    const ts = el.shadow
    const textShadow = ts ? `${ts.x || 0}px ${ts.y || 0}px ${ts.blur || 0}px ${hexToRgba(ts.color || '#000', ts.opacity ?? 0.5)}` : undefined
    // text-stroke
    const str = el.stroke
    const textStroke = str?.width > 0 ? `${str.width}px ${str.color || '#fff'}` : undefined

    // ── Gradient text strategy ──
    // - Simple case (no hasBg): apply gradient directly to the outer div.
    //   Using `backgroundImage` (not the `background` shorthand) prevents the shorthand
    //   from resetting background-clip, which is the root cause of the "gradient rectangle"
    //   bug during rapid re-renders while editing the gradient.
    // - Complex case (gradient + hasBg): outer div keeps hasBg background;
    //   inner span carries the gradient clip. Same fix applied to backgroundImage.
    const needsGradSpan = isGradColor && !!el.hasBg
    const gradDivStyle = isGradColor && !needsGradSpan ? {
      backgroundImage: el.color,
      WebkitBackgroundClip: 'text',
      backgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      color: 'transparent',
    } : (!isGradColor ? { color: el.color || '#fff' } : {})
    const gradSpan = needsGradSpan ? (
      <span style={{
        backgroundImage: el.color,
        WebkitBackgroundClip: 'text',
        backgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        color: 'transparent',
        display: 'block',
        whiteSpace: 'pre-line',
      }}>{el.content}</span>
    ) : null

    // ── Pill / badge case: centered text WITH background or border ──
    // Problem: the centering wrapper needs canvas-full width, but hasBg must wrap
    // only the text content (pill shape). Solution: flex wrapper + inner pill div.
    if (isCentered && hasPad) {
      const innerStyle = {
        display: 'inline-block',
        fontSize: el.fontSize, fontWeight: el.fontWeight || '400',
        letterSpacing: el.letterSpacing, lineHeight: el.lineHeight,
        textTransform: el.textTransform,
        fontFamily: "'PP Neue Montreal', sans-serif",
        whiteSpace: 'pre-line', textAlign: 'center',
        borderRadius: el.borderRadius,
        ...gradDivStyle,
        ...(el.hasBg ? { background: el.bgColor } : {}),
        ...(el.hasBorder ? { border: `1px solid ${el.borderColor}` } : {}),
        padding: `${el.paddingY || 0}px ${el.paddingX || 0}px`,
        ...(textShadow ? { textShadow } : {}),
        ...(textStroke ? { WebkitTextStroke: textStroke } : {}),
      }
      return (
        <div
          data-el-id={el.id}
          onMouseDown={e => onMouseDown(e, el.id)}
          onDoubleClick={e => { e.stopPropagation(); onDoubleClick(el.id) }}
          style={{
            position: 'absolute', left: el.x || 0, top: el.y,
            width: el.maxWidth || canvasWidth,
            display: 'flex',
            justifyContent: el.textAlign === 'right' ? 'flex-end' : 'center',
            cursor: 'move', userSelect: 'none', zIndex: el.zIndex || 2,
            ...elTransformStyle,
            ...sel,
          }}
        >
          <div style={innerStyle}>{editing ? null : (gradSpan || el.content)}</div>
        </div>
      )
    }

    return (
      <div
        data-el-id={el.id}
        onMouseDown={e => onMouseDown(e, el.id)}
        onDoubleClick={e => { e.stopPropagation(); onDoubleClick(el.id) }}
        style={{
          ...base,
          ...textStyle,
          fontSize: el.fontSize, fontWeight: el.fontWeight || '400',
          letterSpacing: el.letterSpacing,
          lineHeight: el.lineHeight, textTransform: el.textTransform,
          fontFamily: "'PP Neue Montreal', sans-serif",
          whiteSpace: 'pre-line', maxWidth: el.maxWidth,
          borderRadius: el.borderRadius,
          ...gradDivStyle,
          ...(el.hasBg ? { background: el.bgColor } : {}),
          ...(el.hasBorder ? { border: `1px solid ${el.borderColor}` } : {}),
          ...(hasPad ? { padding: `${el.paddingY || 0}px ${el.paddingX || 0}px` } : {}),
          ...(hasPad || isCentered ? { display: 'block' } : {}),
          ...(textShadow ? { textShadow } : {}),
          ...(textStroke ? { WebkitTextStroke: textStroke } : {}),
        }}
      >{editing ? null : (gradSpan || el.content)}</div>
    )
  }

  if (el.type === 'image') {
    const imgStyle = { height: el.height || 'auto', width: el.width === 'auto' ? 'auto' : el.width, opacity: el.opacity ?? 1, display: 'block', maxWidth: el.maxWidth, borderRadius: el.borderRadius }
    // textAlign: 'center' | 'right' → wrap in a positioned flex container (same technique as text)
    if (el.textAlign === 'center' || el.textAlign === 'right') {
      return (
        <div
          data-el-id={el.id}
          onMouseDown={e => onMouseDown(e, el.id)}
          onDoubleClick={e => e.stopPropagation()}
          style={{
            position: 'absolute', left: 0, top: el.y,
            width: el.maxWidth || canvasWidth,
            display: 'flex',
            justifyContent: el.textAlign === 'center' ? 'center' : 'flex-end',
            cursor: 'move', userSelect: 'none', zIndex: el.zIndex || 2,
            ...elTransformStyle,
            ...sel,
          }}>
          <img src={el.src} draggable={false} alt="" style={imgStyle} />
        </div>
      )
    }
    return (
      <img src={el.src} draggable={false} alt=""
        data-el-id={el.id}
        onMouseDown={e => onMouseDown(e, el.id)}
        onDoubleClick={e => e.stopPropagation()}
        style={{ ...base, ...imgStyle }} />
    )
  }

  if (el.type === 'shape') {
    if (el.shape === 'gradient-overlay') return (
      <div style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', background: el.color, pointerEvents: 'none', zIndex: el.zIndex || 1 }} />
    )
    const isTriangle = el.shape === 'triangle'
    const ds = el.shadow
    const str = el.stroke
    // Box-shadow: drop shadow + inset stroke (triangles no soportan inset)
    const bsParts = []
    if (ds) bsParts.push(`${ds.x || 0}px ${ds.y || 0}px ${ds.blur || 0}px ${ds.spread || 0}px ${hexToRgba(ds.color || '#000', ds.opacity ?? 0.5)}`)
    if (str?.width > 0 && !isTriangle) bsParts.push(`0 0 0 ${str.width}px ${str.color || '#fff'} inset`)
    const boxShadow = bsParts.length ? bsParts.join(', ') : undefined
    // Filter drop-shadow para triángulo (clip-path corta box-shadow)
    const filterShadow = isTriangle && ds
      ? `drop-shadow(${ds.x || 0}px ${ds.y || 0}px ${ds.blur || 0}px ${hexToRgba(ds.color || '#000', ds.opacity ?? 0.5)})`
      : undefined
    // Shape-specific style
    let shapeStyle = {}
    if (el.shape === 'circle') shapeStyle = { borderRadius: '50%' }
    else if (el.shape === 'triangle') shapeStyle = { clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)', borderRadius: 0 }
    else shapeStyle = { borderRadius: el.borderRadius ?? 0 }
    return (
      <div data-el-id={el.id} onMouseDown={e => onMouseDown(e, el.id)}
        style={{ ...base, width: el.width, height: el.height, background: el.color, ...shapeStyle, opacity: el.opacity ?? 1, ...(boxShadow ? { boxShadow } : {}), ...(filterShadow ? { filter: filterShadow } : {}) }} />
    )
  }

  if (el.type === 'icon') {
    return (
      <div
        data-el-id={el.id}
        onMouseDown={e => onMouseDown(e, el.id)}
        onDoubleClick={e => e.stopPropagation()}
        style={{ ...base, width: el.size || 64, height: el.size || 64, color: el.color || '#fff', flexShrink: 0 }}
        dangerouslySetInnerHTML={{ __html: el.svgContent || '' }}
      />
    )
  }

  if (el.type === 'button') {
    const hasBtnBorder = el.borderStyle && el.borderStyle !== 'none' && (el.borderWidth || 0) > 0
    const ds = el.shadow
    const bsParts = []
    if (ds) bsParts.push(`${ds.x || 0}px ${ds.y || 0}px ${ds.blur || 0}px ${ds.spread || 0}px ${hexToRgba(ds.color || '#000', ds.opacity ?? 0.5)}`)
    const boxShadow = bsParts.length ? bsParts.join(', ') : undefined
    return (
      <div
        data-el-id={el.id}
        onMouseDown={e => onMouseDown(e, el.id)}
        onDoubleClick={e => e.stopPropagation()}
        style={{
          ...base,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: el.iconSvg ? (el.iconGap || 8) : 0,
          flexDirection: el.iconPosition === 'right' ? 'row-reverse' : 'row',
          background: el.btnBg || 'linear-gradient(135deg, #6430F7, #4318CC)',
          borderRadius: el.borderRadius ?? 14,
          border: hasBtnBorder ? `${el.borderWidth || 2}px ${el.borderStyle} ${el.borderColor || 'rgba(255,255,255,0.3)'}` : 'none',
          padding: `${el.paddingY || 20}px ${el.paddingX || 44}px`,
          opacity: el.opacity ?? 1,
          whiteSpace: 'nowrap',
          ...(boxShadow ? { boxShadow } : {}),
        }}
      >
        {el.iconSvg && (
          <div style={{ width: el.iconSize || 20, height: el.iconSize || 20, color: el.color || '#FFFFFF', flexShrink: 0 }}
            dangerouslySetInnerHTML={{ __html: el.iconSvg }} />
        )}
        <span style={{
          fontSize: el.fontSize || 22,
          fontWeight: el.fontWeight || '600',
          color: el.color || '#FFFFFF',
          letterSpacing: el.letterSpacing || '-0.01em',
          lineHeight: 1,
          fontFamily: "'PP Neue Montreal', sans-serif",
        }}>{el.content || 'Botón'}</span>
      </div>
    )
  }

  return null
}

// ── Inline text editor ────────────────────────────────────────────────────────
function InlineEditor({ el, onDone }) {
  const [val, setVal] = useState(el.content)
  const ref = useRef(null)
  useEffect(() => { ref.current?.select() }, [])
  return (
    <textarea ref={ref} value={val}
      onChange={e => setVal(e.target.value)}
      onBlur={() => onDone(val)}
      onKeyDown={e => { if (e.key === 'Escape') onDone(val) }}
      style={{
        position: 'absolute', left: el.x, top: el.y,
        width: el.maxWidth || 800, minHeight: el.fontSize * 1.2 + 16,
        fontSize: el.fontSize, fontWeight: el.fontWeight || '400',
        color: el.color || '#fff', letterSpacing: el.letterSpacing,
        lineHeight: el.lineHeight,
        fontFamily: "'PP Neue Montreal', sans-serif",
        background: 'rgba(100,48,247,0.12)',
        border: '2px solid rgba(100,48,247,0.7)',
        borderRadius: 4, outline: 'none',
        padding: 0, margin: 0, resize: 'none', overflow: 'hidden',
        zIndex: 100,
      }}
    />
  )
}

// ── Mockup Frame ──────────────────────────────────────────────────────────────
function MockupFrame({ platform, formatKey, scale }) {
  const { width: fw, height: fh } = FORMATS[formatKey]
  const w = fw * scale, h = fh * scale
  const isStory = formatKey === '9:16'
  const grad = 'linear-gradient(45deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)'

  const avatar = (sz) => (
    <div style={{ width: sz, height: sz, borderRadius: '50%', background: grad, padding: sz * 0.06, flexShrink: 0 }}>
      <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: '#1e1e2e' }} />
    </div>
  )

  if (platform === 'ig') {
    if (isStory) return (
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', top: 10 * scale, left: 8 * scale, right: 8 * scale, display: 'flex', gap: 3 * scale }}>
          {[0,1,2].map(i => <div key={i} style={{ flex: 1, height: 2 * scale, background: i === 0 ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.3)', borderRadius: 1 }} />)}
        </div>
        <div style={{ position: 'absolute', top: 20 * scale, left: 10 * scale, display: 'flex', alignItems: 'center', gap: 8 * scale }}>
          {avatar(28 * scale)}
          <span style={{ color: '#fff', fontWeight: '600', fontSize: 11 * scale, fontFamily: 'sans-serif', textShadow: '0 1px 3px rgba(0,0,0,0.5)' }}>qurable.co</span>
          <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 10 * scale, fontFamily: 'sans-serif' }}>· 2h</span>
        </div>
      </div>
    )
    const barH = 44 * scale, btmH = 62 * scale
    return (
      <div style={{ position: 'absolute', pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', top: -barH, left: 0, width: w, height: barH, background: '#fff', borderRadius: `${8*scale}px ${8*scale}px 0 0`, display: 'flex', alignItems: 'center', padding: `0 ${10*scale}px`, gap: 8*scale }}>
          {avatar(28*scale)}
          <span style={{ fontWeight: '600', fontSize: 11*scale, color: '#000', fontFamily: 'sans-serif', flex: 1 }}>qurable.co</span>
          <span style={{ fontSize: 16*scale }}>···</span>
        </div>
        <div style={{ position: 'absolute', top: h, left: 0, width: w, height: btmH, background: '#fff', borderRadius: `0 0 ${8*scale}px ${8*scale}px`, padding: `${8*scale}px ${10*scale}px` }}>
          <div style={{ display: 'flex', gap: 12*scale, marginBottom: 5*scale }}>
            {['♡','💬','✈'].map(i => <span key={i} style={{ fontSize: 20*scale }}>{i}</span>)}
            <div style={{ flex:1 }} />
            <span style={{ fontSize: 20*scale }}>🔖</span>
          </div>
          <div style={{ fontSize: 10*scale, color: '#000', fontFamily: 'sans-serif', fontWeight:'600' }}>324 Me gusta</div>
        </div>
      </div>
    )
  }

  if (platform === 'ln') {
    const barH = 52*scale, btmH = 42*scale
    return (
      <div style={{ position: 'absolute', pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', top: -barH, left: 0, width: w, height: barH, background: '#fff', borderRadius: `${8*scale}px ${8*scale}px 0 0`, display: 'flex', alignItems: 'center', padding: `0 ${10*scale}px`, gap: 8*scale }}>
          <div style={{ width: 34*scale, height: 34*scale, borderRadius: 6*scale, background: 'linear-gradient(135deg,#6430F7,#1E293B)', flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: '600', fontSize: 12*scale, color: '#000', fontFamily: 'sans-serif' }}>Qurable</div>
            <div style={{ fontSize: 10*scale, color: '#666', fontFamily: 'sans-serif' }}>Empresa · Fintech LatAm</div>
          </div>
          <span style={{ color: '#0077B5', fontSize: 12*scale, fontWeight: '600', fontFamily: 'sans-serif' }}>+ Seguir</span>
        </div>
        <div style={{ position: 'absolute', top: h, left: 0, width: w, height: btmH, background: '#fff', borderRadius: `0 0 ${8*scale}px ${8*scale}px`, display: 'flex', alignItems: 'center', padding: `0 ${10*scale}px`, gap: 16*scale }}>
          {['👍 Me gusta','💬 Comentar','↗ Compartir','✉ Enviar'].map(t => (
            <span key={t} style={{ fontSize: 10*scale, color: '#555', fontFamily: 'sans-serif', whiteSpace: 'nowrap' }}>{t}</span>
          ))}
        </div>
      </div>
    )
  }
  return null
}

// ── App ────────────────────────────────────────────────────────────────────────
export default function App() {
  // ── Auth ──
  const [session, setSession] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)

  useEffect(() => {
    getSession().then(s => { setSession(s); setAuthLoading(false) })
    return onAuthStateChange(s => { setSession(s); setAuthLoading(false) })
  }, [])

  // ── Theme ──
  const [themeName, setThemeName] = useState('dark')
  const C = THEMES[themeName]

  // ── Slides (carousel) ──
  const [slides, setSlides] = useState([INIT_SLIDE()])
  const [slideIdx, setSlideIdx] = useState(0)
  const currentSlide = slides[slideIdx] || slides[0]
  const elements = currentSlide.elements
  const bg = currentSlide.bg

  const setElements = useCallback((fn) => {
    setSlides(prev => {
      const curr = prev[slideIdx]
      const newEls = typeof fn === 'function' ? fn(curr.elements) : fn
      const updated = [...prev]
      updated[slideIdx] = { ...curr, elements: newEls }
      return updated
    })
  }, [slideIdx])

  const setBg = useCallback((newBg) => {
    setSlides(prev => {
      const updated = [...prev]
      updated[slideIdx] = { ...prev[slideIdx], bg: newBg }
      return updated
    })
  }, [slideIdx])

  // ── History (undo/redo) ──
  const histStack = useRef([])
  const histIdx = useRef(-1)
  const [histTick, setHistTick] = useState(0) // force re-render for canUndo/canRedo

  const pushHistory = useCallback((newSlides) => {
    historyPush(histStack, histIdx, newSlides)
    setHistTick(t => t + 1)
  }, [])

  const undo = () => {
    const snap = historyUndo(histStack, histIdx)
    if (snap) { setSlides(snap); setHistTick(t => t + 1) }
  }

  const redo = () => {
    const snap = historyRedo(histStack, histIdx)
    if (snap) { setSlides(snap); setHistTick(t => t + 1) }
  }

  // ── Canvas selection & drag ──
  const [selectedId, setSelectedId] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [layerDragId, setLayerDragId] = useState(null)
  const [layerOverId, setLayerOverId] = useState(null)
  const [dragging, setDragging] = useState(null)
  const resizingRef = useRef(null)
  const [scale, setScale] = useState(0.5)
  const autoScaleRef = useRef(0.5)
  const [zoomFactor, setZoomFactor] = useState(1.0)
  const zoomFactorRef = useRef(1.0)
  const [snapGuides, setSnapGuides] = useState([])

  const selectedEl = elements.find(e => e.id === selectedId)
  const editingEl = elements.find(e => e.id === editingId)

  // ── UI state ──
  const [platform, setPlatform] = useState('ig')
  const [formatKey, setFormatKey] = useState('4:5')
  const [brief, setBrief] = useState('')
  const [iterateText, setIterateText] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState(null)
  const [aiReason, setAiReason] = useState(null)
  const [hasGenerated, setHasGenerated] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exportModal, setExportModal] = useState(null) // null | 'png' | 'jpeg'
  const [composing, setComposing] = useState(false)
  const [showMockup, setShowMockup] = useState(false)
  const [bgTab, setBgTab] = useState('presets')
  const [customGrad, setCustomGrad] = useState({ c1: '#6430F7', c2: '#0F172A', angle: 135 })
  const [bgPrompt, setBgPrompt] = useState('')
  const [showIconPicker, setShowIconPicker] = useState(false)
  const [showNewModal, setShowNewModal] = useState(false)
  const [showImageAI, setShowImageAI] = useState(false)
  const [imageAIPrompt, setImageAIPrompt] = useState('')
  const [imageAILoading, setImageAILoading] = useState(false)
  const [imageAIError, setImageAIError] = useState(null)
  // ── Cloud projects ──
  const [recentProjects, setRecentProjects] = useState([])
  const [showRecentsMenu, setShowRecentsMenu] = useState(false)
  const [showProjects, setShowProjects] = useState(false)
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [saveMode, setSaveMode] = useState('save')           // 'save' | 'saveAs'
  const [projectName, setProjectName] = useState('')
  const [currentProjectId, setCurrentProjectId] = useState(null)
  const [cloudSaving, setCloudSaving] = useState(false)
  const [cloudError, setCloudError] = useState(null)
  const [lastSaved, setLastSaved] = useState(null)
  const [saveProjectList, setSaveProjectList] = useState([])
  const [saveOverwriteTarget, setSaveOverwriteTarget] = useState(null) // proyecto seleccionado para sobreescribir
  const [showFileMenu, setShowFileMenu] = useState(false)
  const [leftCollapsed, setLeftCollapsed] = useState({})
  const fileMenuRef = useRef(null)

  const canvasRef = useRef(null)
  const canvasAreaRef = useRef(null)
  const fmt = FORMATS[formatKey]

  // ── Scale ──
  useEffect(() => {
    const calc = () => {
      if (!canvasAreaRef.current) return
      const { width: pw, height: ph } = canvasAreaRef.current.getBoundingClientRect()
      const auto = Math.min((pw - 48) / fmt.width, (ph - 100) / fmt.height, 1)
      autoScaleRef.current = auto
      setScale(auto * zoomFactorRef.current)
    }
    // Reset zoom when format changes
    zoomFactorRef.current = 1.0
    setZoomFactor(1.0)
    calc()
    const ro = new ResizeObserver(calc)
    if (canvasAreaRef.current) ro.observe(canvasAreaRef.current)
    return () => ro.disconnect()
  }, [fmt])

  // ── Keyboard shortcuts ──
  useEffect(() => {
    const onKey = (e) => {
      const isInput = ['INPUT','TEXTAREA'].includes(e.target.tagName)
      const meta = e.metaKey || e.ctrlKey

      if (meta && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); return }
      if (meta && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); redo(); return }
      if (meta && e.key === 's' && e.shiftKey) { e.preventDefault(); setSaveMode('saveAs'); setShowSaveModal(true); setSaveOverwriteTarget(null); return }
      if (meta && e.key === 's') { e.preventDefault(); if (currentProjectId) { handleSave() } else { setSaveMode('save'); setShowSaveModal(true) } return }
      if (meta && (e.key === '=' || e.key === '+')) { e.preventDefault(); zoomIn(); return }
      if (meta && e.key === '-') { e.preventDefault(); zoomOut(); return }
      if (meta && e.key === '0') { e.preventDefault(); zoomFit(); return }

      if (isInput) return

      if (meta && e.key === 'd' && selectedId) {
        e.preventDefault()
        duplicateEl(selectedId)
        return
      }

      if (e.key === 'Escape') { setSelectedId(null); setEditingId(null); return }

      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId && !editingId) {
        e.preventDefault()
        deleteEl(selectedId)
        return
      }

      if (selectedId && !editingId) {
        const step = e.shiftKey ? 10 : 1
        let dx = 0, dy = 0
        if (e.key === 'ArrowLeft') dx = -step
        if (e.key === 'ArrowRight') dx = step
        if (e.key === 'ArrowUp') dy = -step
        if (e.key === 'ArrowDown') dy = step
        if (dx || dy) {
          e.preventDefault()
          setElements(prev => prev.map(el => el.id === selectedId ? { ...el, x: el.x + dx, y: el.y + dy } : el))
        }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [selectedId, editingId, slides, slideIdx])

  // ── Drag ──
  useEffect(() => {
    if (!dragging) return
    const onMove = (e) => {
      const rawX = Math.round(dragging.ox + (e.clientX - dragging.sx) / scale)
      const rawY = Math.round(dragging.oy + (e.clientY - dragging.sy) / scale)

      const domEl = canvasRef.current?.querySelector(`[data-el-id="${dragging.id}"]`)
      const elW = domEl?.offsetWidth || 0
      const elH = domEl?.offsetHeight || 0

      const THRESH = Math.round(8 / scale)
      let snapX = rawX, snapY = rawY
      const guides = []

      const cX = fmt.width / 2
      const cY = fmt.height / 2

      if (Math.abs((rawX + elW / 2) - cX) < THRESH) {
        snapX = Math.round(cX - elW / 2)
        guides.push({ type: 'v', pos: cX })
      }
      if (Math.abs((rawY + elH / 2) - cY) < THRESH) {
        snapY = Math.round(cY - elH / 2)
        guides.push({ type: 'h', pos: cY })
      }

      elements.filter(el => el.id !== dragging.id).forEach(other => {
        const otherDom = canvasRef.current?.querySelector(`[data-el-id="${other.id}"]`)
        if (!otherDom) return
        const oW = otherDom.offsetWidth, oH = otherDom.offsetHeight
        const ox2 = other.x, oy2 = other.y

        const checks = [
          [rawX, ox2], [rawX + elW, ox2 + oW], [rawX + elW / 2, ox2 + oW / 2]
        ]
        for (const [a, b] of checks) {
          if (Math.abs(a - b) < THRESH) {
            snapX = Math.round(rawX + (b - a))
            guides.push({ type: 'v', pos: b })
            break
          }
        }

        const checksY = [
          [rawY, oy2], [rawY + elH, oy2 + oH], [rawY + elH / 2, oy2 + oH / 2]
        ]
        for (const [a, b] of checksY) {
          if (Math.abs(a - b) < THRESH) {
            snapY = Math.round(rawY + (b - a))
            guides.push({ type: 'h', pos: b })
            break
          }
        }
      })

      setSnapGuides(guides)
      setElements(prev => prev.map(el =>
        el.id === dragging.id ? { ...el, x: snapX, y: snapY } : el
      ))
    }
    const onUp = () => {
      setDragging(null)
      setSnapGuides([])
      setSlides(curr => { pushHistory(curr); return curr })
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    return () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp) }
  }, [dragging, scale])


  const handleMouseDown = (e, id) => {
    if (editingId) return
    e.stopPropagation(); e.preventDefault()
    setSelectedId(id)
    const el = elements.find(el => el.id === id)
    if (el) setDragging({ id, sx: e.clientX, sy: e.clientY, ox: el.x, oy: el.y })
  }

  const handleDoubleClick = (id) => {
    const el = elements.find(e => e.id === id)
    if (el?.type === 'text') setEditingId(id)
  }

  // ── CRUD ──
  const updateEl = useCallback((id, patch) => {
    setElements(prev => prev.map(el => el.id === id ? { ...el, ...patch } : el))
    setSlides(curr => { pushHistory(curr); return curr })
  }, [setElements, pushHistory])

  const deleteEl = (id) => {
    pushHistory(slides)
    setElements(prev => prev.filter(el => el.id !== id))
    setSelectedId(null)
  }

  const duplicateEl = (id) => {
    const el = elements.find(e => e.id === id)
    if (!el) return
    pushHistory(slides)
    const clone = { ...el, id: uid(), x: el.x + 20, y: el.y + 20 }
    setElements(prev => [...prev, clone])
    setSelectedId(clone.id)
  }

  const moveEl = (id, dir) => setElements(prev => {
    const i = prev.findIndex(el => el.id === id), j = i + dir
    if (j < 0 || j >= prev.length) return prev
    const arr = [...prev]; [arr[i], arr[j]] = [arr[j], arr[i]]; return arr
  })

  const alignEl = (type) => {
    if (!selectedId || !canvasRef.current) return
    const domEl = canvasRef.current.querySelector(`[data-el-id="${selectedId}"]`)
    const elW = domEl?.offsetWidth || 200
    const elH = domEl?.offsetHeight || 60
    const updates = {}
    if (type === 'left') updates.x = 0
    if (type === 'right') updates.x = fmt.width - elW
    if (type === 'centerH') updates.x = Math.round((fmt.width - elW) / 2)
    if (type === 'top') updates.y = 0
    if (type === 'bottom') updates.y = fmt.height - elH
    if (type === 'centerV') updates.y = Math.round((fmt.height - elH) / 2)
    updateEl(selectedId, updates)
  }

  const fitImageToCanvas = () => {
    if (selectedEl?.type === 'image') {
      updateEl(selectedId, { x: 0, y: 0, width: fmt.width, height: 'auto', maxWidth: fmt.width })
    }
  }

  const addText = () => {
    pushHistory(slides)
    const el = { id: uid(), type: 'text', content: 'Nuevo texto', x: 80, y: Math.round(fmt.height / 2), fontSize: 64, fontWeight: '700', color: '#FFFFFF', letterSpacing: '-0.02em', lineHeight: 1.1, maxWidth: fmt.width - 160 }
    setElements(prev => [...prev, el]); setSelectedId(el.id)
  }

  const addShape = (shapeType = 'rect') => {
    pushHistory(slides)
    const cx = Math.round(fmt.width / 2), cy = Math.round(fmt.height / 2)
    const defaults = {
      rect:     { width: 200, height: 80, borderRadius: 8, color: '#6430F7' },
      circle:   { width: 120, height: 120, borderRadius: 0, color: '#6430F7', lockAspect: true, aspectRatio: 1 },
      triangle: { width: 120, height: 120, borderRadius: 0, color: '#6430F7', lockAspect: true, aspectRatio: 1 },
      line:     { width: Math.round(fmt.width * 0.6), height: 3, borderRadius: 2, color: '#FFFFFF' },
    }
    const d = defaults[shapeType] || defaults.rect
    const el = { id: uid(), type: 'shape', shape: shapeType, x: cx - Math.round(d.width / 2), y: cy - Math.round(d.height / 2), ...d, opacity: 1 }
    setElements(prev => [...prev, el]); setSelectedId(el.id)
  }

  const addImageEl = (src) => {
    pushHistory(slides)
    const newId = uid()
    const el = { id: newId, type: 'image', src, x: 0, y: 0, width: 'auto', height: 'auto', opacity: 1, lockAspect: true }
    setElements(prev => [...prev, el])
    setSelectedId(newId)
    const img = new Image()
    img.onload = () => setElements(prev => prev.map(e => e.id === newId ? { ...e, naturalW: img.naturalWidth, naturalH: img.naturalHeight } : e))
    img.src = src
  }

  const startHandleDrag = (e, el, handle) => {
    e.stopPropagation()
    e.preventDefault()
    if (!canvasRef.current) return
    const rect = canvasRef.current.getBoundingClientRect()
    const mx = (e.clientX - rect.left) / scale
    const my = (e.clientY - rect.top) / scale
    resizingRef.current = { handle, startEl: { ...el }, startMouse: { x: mx, y: my } }

    const onMove = (ev) => {
      const r = resizingRef.current
      if (!r || !canvasRef.current) return
      const cr = canvasRef.current.getBoundingClientRect()
      const cmx = (ev.clientX - cr.left) / scale
      const cmy = (ev.clientY - cr.top) / scale
      const { handle: h, startEl: se, startMouse: sm } = r
      const dx = cmx - sm.x
      const dy = cmy - sm.y

      if (h === 'rot') {
        const elSW = se.type === 'text' ? (se.maxWidth || 300) : se.type === 'icon' ? (se.size || 64) : (Number(se.width) || 100)
        const elSH = se.type === 'icon' ? (se.size || 64) : (Number(se.height) || 100)
        const cx = (se.x || 0) + elSW / 2
        const cy = (se.y || 0) + elSH / 2
        const angle = Math.atan2(cmy - cy, cmx - cx) * (180 / Math.PI) + 90
        const snap = ev.shiftKey ? Math.round(angle / 45) * 45 : Math.round(angle)
        updateEl(se.id, { rotation: snap })
        return
      }

      let nx = se.x || 0
      let ny = se.y || 0
      const origW = se.type === 'text' ? (se.maxWidth || 300) : se.type === 'icon' ? (se.size || 64) : (Number(se.width) || 100)
      const origH = se.type === 'icon' ? (se.size || 64) : (Number(se.height) || 100)
      let nw = origW
      let nh = origH

      switch (h) {
        case 'TL': nx += dx; ny += dy; nw = origW - dx; nh = origH - dy; break
        case 'TR': ny += dy; nw = origW + dx; nh = origH - dy; break
        case 'BL': nx += dx; nw = origW - dx; nh = origH + dy; break
        case 'BR': nw = origW + dx; nh = origH + dy; break
        case 'TC': ny += dy; nh = origH - dy; break
        case 'BC': nh = origH + dy; break
        case 'ML': nx += dx; nw = origW - dx; break
        case 'MR': nw = origW + dx; break
      }
      nw = Math.max(10, Math.round(nw))
      nh = Math.max(10, Math.round(nh))

      // Aspect ratio for corners (Shift or lockAspect)
      if ((ev.shiftKey || se.lockAspect) && ['TL','TR','BL','BR'].includes(h)) {
        const aspect = origW / Math.max(1, origH)
        nh = Math.round(nw / aspect)
        if (['TL','TR'].includes(h)) ny = (se.y || 0) + origH - nh
        nw = Math.max(10, nw); nh = Math.max(10, nh)
      }

      if (se.type === 'text') {
        // Corner handles: also scale fontSize proportionally
        const isCorn = ['TL','TR','BL','BR'].includes(h)
        const patch = { maxWidth: nw, x: Math.round(nx), y: Math.round(ny) }
        if (isCorn && se.fontSize) {
          patch.fontSize = Math.max(6, Math.round(se.fontSize * nw / Math.max(1, origW)))
        }
        updateEl(se.id, patch)
      } else if (se.type === 'icon') {
        updateEl(se.id, { size: nw, x: Math.round(nx), y: Math.round(ny) })
      } else {
        updateEl(se.id, { width: nw, height: nh, x: Math.round(nx), y: Math.round(ny) })
      }
    }

    const onUp = () => {
      resizingRef.current = null
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  const generateAIImageEl = async () => {
    if (!imageAIPrompt.trim()) return
    setImageAILoading(true); setImageAIError(null)
    try {
      const url = await generateImage({ prompt: imageAIPrompt, format: formatKey, apiKey: API_KEY })
      if (url) {
        pushHistory(slides)
        const el = { id: uid(), type: 'image', src: url, x: 0, y: 0, width: fmt.width, height: 'auto', opacity: 1 }
        setElements(prev => [...prev, el]); setSelectedId(el.id)
        setShowImageAI(false); setImageAIPrompt('')
      }
    } catch (err) { setImageAIError(err.message) }
    finally { setImageAILoading(false) }
  }

  const addIconEl = (iconData) => {
    pushHistory(slides)
    const el = { id: uid(), type: 'icon', ...iconData, x: Math.round(fmt.width / 2 - 32), y: Math.round(fmt.height / 2 - 32) }
    setElements(prev => [...prev, el]); setSelectedId(el.id)
  }

  const addButton = () => {
    pushHistory(slides)
    const el = {
      id: uid(), type: 'button',
      content: 'Empezá hoy',
      x: Math.round(fmt.width / 2 - 160), y: Math.round(fmt.height * 0.72),
      fontSize: 22, fontWeight: '600', color: '#FFFFFF',
      letterSpacing: '-0.01em',
      btnBg: 'linear-gradient(135deg, #6430F7, #4318CC)',
      borderRadius: 14,
      borderStyle: 'none', borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)',
      paddingX: 44, paddingY: 20,
      opacity: 1,
    }
    setElements(prev => [...prev, el]); setSelectedId(el.id)
  }

  const loadPreset = (styleId) => {
    pushHistory(slides)
    const canvas = createCanvas(styleId, fmt)
    setElements(canvas.elements); setBg(canvas.bg); setSelectedId(null); setHasGenerated(false); setAiReason(null)
  }

  // ── Slides management ──
  const addSlide = () => {
    pushHistory(slides)
    const newSlide = INIT_SLIDE()
    setSlides(prev => [...prev, newSlide])
    setSlideIdx(slides.length)
    setSelectedId(null)
  }

  const deleteSlide = (idx) => {
    if (slides.length <= 1) return
    pushHistory(slides)
    setSlides(prev => prev.filter((_, i) => i !== idx))
    setSlideIdx(Math.max(0, Math.min(slideIdx, slides.length - 2)))
    setSelectedId(null)
  }

  const switchSlide = (idx) => {
    setSlideIdx(idx)
    setSelectedId(null)
    setEditingId(null)
  }

  const duplicateSlide = (idx) => {
    pushHistory(slides)
    const clone = { ...slides[idx], id: uid(), elements: JSON.parse(JSON.stringify(slides[idx].elements)), bg: { ...slides[idx].bg } }
    setSlides(prev => { const arr = [...prev]; arr.splice(idx + 1, 0, clone); return arr })
    setSlideIdx(idx + 1)
  }

  // Carga la lista de proyectos al abrir el modal de guardado
  useEffect(() => {
    if (showSaveModal) {
      listProjects(USER_EMAIL).then(data => setSaveProjectList(data)).catch(() => {})
    }
  }, [showSaveModal])

  // Cierra el menú Archivo al hacer clic afuera; carga recientes al abrir
  useEffect(() => {
    if (!showFileMenu) { setShowRecentsMenu(false); return }
    const onOut = (e) => { if (!fileMenuRef.current?.contains(e.target)) setShowFileMenu(false) }
    document.addEventListener('mousedown', onOut)
    // Cargar proyectos recientes
    listProjects(USER_EMAIL).then(data => setRecentProjects(data.slice(0, 7))).catch(() => {})
    return () => document.removeEventListener('mousedown', onOut)
  }, [showFileMenu])

  // ── Cloud save/load ──
  const handleSave = async (nameOverride, idOverride) => {
    const name = nameOverride || projectName || 'Sin nombre'
    // idOverride=null fuerza crear nuevo; undefined usa currentProjectId
    setCloudSaving(true); setCloudError(null)
    try {
      // Generar miniatura comprimida del canvas actual
      let thumbnail = null
      if (canvasRef.current) {
        try { thumbnail = await toJpeg(canvasRef.current, { pixelRatio: 0.12, quality: 0.5 }) } catch {}
      }
      // Comprimir imágenes antes de guardar para evitar timeout de Supabase
      const slidesToSave = await compressSlidesForStorage(slides)
      const id = await saveProject({
        id: idOverride !== undefined ? idOverride : currentProjectId,
        userEmail: USER_EMAIL,
        name,
        platform,
        formatKey,
        slides: slidesToSave,
        thumbnail,
      })
      setCurrentProjectId(id)
      setLastSaved(new Date())
      setShowSaveModal(false)
    } catch (e) { setCloudError(e.message) }
    finally { setCloudSaving(false) }
  }

  // Guardar como un proyecto NUEVO (ignora el currentProjectId aunque exista)
  const handleSaveAsNew = () => handleSave(undefined, null)

  const handleLoadProject = async (id) => {
    try {
      const proj = await loadProject(id)
      if (!proj?.data?.slides) return
      pushHistory(slides)
      setSlides(proj.data.slides)
      setSlideIdx(0)
      setPlatform(proj.platform || 'ig')
      setFormatKey(proj.format_key || '4:5')
      setCurrentProjectId(proj.id)
      setProjectName(proj.name)
      setSelectedId(null); setEditingId(null)
      setShowProjects(false)
      setLastSaved(new Date(proj.updated_at))
    } catch (e) { alert('Error al cargar el proyecto: ' + e.message) }
  }

  // ── New project ──
  const handleNew = () => {
    if (elements.length > 0) { setShowNewModal(true); return }
    resetProject()
  }

  const resetProject = () => {
    setSlides([INIT_SLIDE()])
    setSlideIdx(0)
    setSelectedId(null); setEditingId(null)
    setHasGenerated(false); setAiReason(null); setAiError(null)
    setBrief(''); setShowNewModal(false)
    // Limpiar ID y nombre del proyecto anterior → próximo guardado crea uno nuevo
    setCurrentProjectId(null)
    setProjectName('')
    setLastSaved(null)
    histStack.current = []; histIdx.current = -1
    setHistTick(t => t + 1)
  }

  // ── AI ──
  const handleGenerate = async () => {
    if (!brief.trim()) return
    setAiLoading(true); setAiError(null)
    try {
      const result = await generateFromBrief({ brief, platform, format: formatKey, apiKey: API_KEY })
      pushHistory(slides)
      const canvas = createCanvas(result.style || 'bold-dark', fmt)
      const W = fmt.width, H = fmt.height

      // 1. Merge AI text + adaptive fontSize (prevent single-word overflow for long texts)
      let merged = canvas.elements.map(el => {
        let updated = { ...el }
        if (el.id === 'headline' && result.headline)                 updated.content = result.headline
        else if (el.id === 'subtitle' && result.subtitle)            updated.content = result.subtitle
        else if (el.id === 'cta' && result.cta)                      updated.content = result.cta
        else if ((el.id === 'tag' || el.id === 'eyebrow') && result.label) updated.content = result.label

        // Adaptive font size — only for text elements that got AI content applied
        if (updated.type === 'text' && updated.fontSize && updated.content &&
            (el.id === 'headline' || el.id === 'subtitle' || el.id === 'body')) {
          const text = updated.content.replace(/\n/g, ' ')
          const words = text.split(/\s+/).filter(Boolean)
          const longestWordLen = Math.max(...words.map(w => w.length), 0)
          // Use 86% of canvas width as effective safe zone (accounts for centered text margins)
          const effectiveW = Math.floor(W * 0.86)
          // PP Neue Montreal Bold: ~0.65 width-to-height ratio per char
          const maxFsByWord = longestWordLen > 0
            ? Math.floor(effectiveW / (longestWordLen * 0.65))
            : updated.fontSize
          // Total char count scaling (long texts need smaller font regardless of longest word)
          const totalChars = text.length
          const lenScale = totalChars > 55 ? 0.54
            : totalChars > 40 ? 0.68
            : totalChars > 28 ? 0.83
            : 1.0
          const maxFsByLen = Math.round(updated.fontSize * lenScale)
          const adapted = Math.min(updated.fontSize, maxFsByWord, maxFsByLen)
          updated.fontSize = Math.max(adapted, el.id === 'headline' ? 24 : 16)
        }
        return updated
      })

      // 2. Inject eyebrow if label exists but template has no eyebrow/tag slot
      const hasLabelSlot = merged.some(el => el.id === 'tag' || el.id === 'eyebrow')
      if (result.label && !hasLabelSlot) {
        const headlineEl = merged.find(el => el.id === 'headline')
        const isCentered = headlineEl?.textAlign === 'center'
        const eyeFs = Math.max(Math.round(H * 0.011), 12)
        const eyeY = headlineEl
          ? Math.max(headlineEl.y - Math.round(eyeFs * 4.5), 80)
          : Math.round(H * 0.15)
        merged = [
          ...merged,
          {
            id: 'eyebrow_injected',
            type: 'text',
            content: result.label,
            x: isCentered ? 0 : (headlineEl?.x ?? 72),
            y: eyeY,
            maxWidth: headlineEl?.maxWidth || W,
            fontSize: eyeFs,
            fontWeight: '700',
            color: 'rgba(255,255,255,0.50)',
            letterSpacing: '0.20em',
            textTransform: 'uppercase',
            textAlign: isCentered ? 'center' : 'left',
          }
        ]
      }

      setElements(merged); setBg(canvas.bg); setAiReason(result.reasoning); setHasGenerated(true)
      if (result.needsImage && result.imagePrompt && API_KEY) {
        const url = await generateImage({ prompt: result.imagePrompt, format: formatKey, apiKey: API_KEY })
        if (url) setBg({ type: 'image', value: url })
      }
    } catch (err) { setAiError(err.message) }
    finally { setAiLoading(false) }
  }

  const handleIterate = async () => {
    if (!iterateText.trim()) return
    setAiLoading(true); setAiError(null)
    try {
      const curr = {
        headline: elements.find(e => e.id === 'headline')?.content || '',
        subtitle: elements.find(e => e.id === 'subtitle')?.content || '',
        cta: elements.find(e => e.id === 'cta')?.content || '',
        label: elements.find(e => e.id === 'tag')?.content || '',
      }
      const result = await iteratePiece({ currentData: curr, instruction: iterateText, platform, format: formatKey, apiKey: API_KEY })
      pushHistory(slides)
      setElements(prev => prev.map(el => ({
        ...el,
        ...(el.id === 'headline' && result.headline ? { content: result.headline } : {}),
        ...(el.id === 'subtitle' && result.subtitle ? { content: result.subtitle } : {}),
        ...(el.id === 'cta' && result.cta ? { content: result.cta } : {}),
        ...(el.id === 'tag' && result.label ? { content: result.label } : {}),
      })))
      setIterateText('')
    } catch (err) { setAiError(err.message) }
    finally { setAiLoading(false) }
  }

  // ── Zoom ──
  const zoomIn = useCallback(() => {
    const nz = Math.min(+(zoomFactorRef.current + 0.15).toFixed(2), 3.0)
    zoomFactorRef.current = nz
    setZoomFactor(nz)
    setScale(autoScaleRef.current * nz)
  }, [])
  const zoomOut = useCallback(() => {
    const nz = Math.max(+(zoomFactorRef.current - 0.15).toFixed(2), 0.2)
    zoomFactorRef.current = nz
    setZoomFactor(nz)
    setScale(autoScaleRef.current * nz)
  }, [])
  const zoomFit = useCallback(() => {
    zoomFactorRef.current = 1.0
    setZoomFactor(1.0)
    setScale(autoScaleRef.current)
  }, [])

  // ── Export ──
  // canvasRef apunta al div interno sin transform → html-to-image captura a dimensiones nativas (fmt.width × fmt.height)
  // pixelRatio:2 dobla la resolución → salida 2× (ej: 2160×2700 para 4:5)
  const handleExport = async (type = 'png') => {
    if (!canvasRef.current) return
    setExporting(true)
    const prevSel = selectedId; setSelectedId(null); setEditingId(null)
    await new Promise(r => setTimeout(r, 80))
    try {
      const opts = { pixelRatio: 2 }
      const url = type === 'png'
        ? await toPng(canvasRef.current, opts)
        : await toJpeg(canvasRef.current, { ...opts, quality: 0.95 })
      const a = document.createElement('a'); a.href = url
      a.download = `qurable-${platform}-s${slideIdx + 1}-${formatKey.replace(':', 'x')}.${type}`; a.click()
    } catch (err) { console.error(err) }
    finally { setExporting(false); setSelectedId(prevSel) }
  }

  // ── Export All (ZIP con todos los slides) ──
  const handleExportAll = async (type = 'png') => {
    setExportModal(null)
    if (slides.length <= 1) { handleExport(type); return }
    setExporting(true)
    const prevSel = selectedId; setSelectedId(null); setEditingId(null)
    const origIdx = slideIdx
    try {
      const zip = new JSZip()
      const ext = type === 'png' ? 'png' : 'jpg'
      const baseName = `qurable-${platform}-${formatKey.replace(':', 'x')}`
      for (let i = 0; i < slides.length; i++) {
        setSlideIdx(i)
        await new Promise(r => setTimeout(r, 200))
        if (!canvasRef.current) continue
        const opts = { pixelRatio: 2 }
        const dataUrl = type === 'png'
          ? await toPng(canvasRef.current, opts)
          : await toJpeg(canvasRef.current, { ...opts, quality: 0.95 })
        // dataUrl → base64 → zip
        const base64 = dataUrl.split(',')[1]
        zip.file(`${baseName}-s${i + 1}.${ext}`, base64, { base64: true })
      }
      const blob = await zip.generateAsync({ type: 'blob' })
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
      a.download = `${baseName}-x${slides.length}.zip`; a.click()
      URL.revokeObjectURL(a.href)
    } catch (err) { console.error(err) }
    finally {
      setExporting(false)
      setSlideIdx(origIdx)
      setSelectedId(prevSel)
    }
  }

  const handleCompose = async () => {
    if (elements.length === 0) return
    const apiKey = API_KEY
    if (!apiKey) { alert('Configurá tu API key de OpenAI primero.'); return }
    setComposing(true)
    try {
      const W = fmt.width, H = fmt.height
      // Proportional safe margin
      const margin = Math.round(Math.min(W, H) * 0.065)

      // 1. DOM-measured bounds → canvas-space px (accurate for text wrapping, auto-sized images, etc.)
      const domMeasures = {}
      if (canvasRef.current) {
        const canvasRect = canvasRef.current.getBoundingClientRect()
        elements.forEach(el => {
          const domEl = canvasRef.current.querySelector(`[data-el-id="${el.id}"]`)
          if (domEl) {
            const r = domEl.getBoundingClientRect()
            domMeasures[el.id] = {
              x: Math.round((r.left - canvasRect.left) / scale),
              y: Math.round((r.top - canvasRect.top) / scale),
              w: Math.round(r.width / scale),
              h: Math.round(r.height / scale),
            }
          }
        })
      }

      // 2. Build rich element summary with actual position + size
      const summary = elements.map(el => {
        const dom = domMeasures[el.id]
        const w = dom?.w ?? (el.width === 'auto' ? (el.naturalW || 400) : Math.round(Number(el.width) || 200))
        const h = dom?.h ?? (el.height === 'auto' ? (el.naturalH || 300) : Math.round(Number(el.height) || 200))
        const x = dom?.x ?? Math.round(el.x || 0)
        const y = dom?.y ?? Math.round(el.y || 0)
        const fs = Math.round(el.fontSize || 0)
        const isBgImage = el.type === 'image' && w >= W * 0.7
        const role = el.type === 'text' && fs >= 56 ? 'headline'
          : el.type === 'text' && fs >= 28 ? 'subtitle'
          : el.type === 'text' ? 'body_text'
          : el.type === 'button' ? 'cta_button'
          : isBgImage ? 'bg_image'
          : el.type === 'image' ? 'image'
          : el.type === 'shape' ? 'shape'
          : el.type === 'icon' ? 'icon'
          : el.type
        return {
          id: el.id,
          role,
          content: (el.type === 'text' || el.type === 'button') ? (el.content || '').slice(0, 80) : undefined,
          currentX: x,
          currentY: y,
          currentW: w,
          currentH: h,
          ...(fs ? { currentFontSize: fs } : {}),
          ...(el.type === 'text' ? { textAlign: el.textAlign || 'left', textColumnWidth: el.maxWidth || w } : {}),
        }
      })

      // 3. Describe font size hierarchy so AI respects existing proportions
      const textEls = summary
        .filter(e => e.currentFontSize)
        .sort((a, b) => b.currentFontSize - a.currentFontSize)
      const fontNote = textEls.length > 0
        ? `\nJerarquía tipográfica actual: ${textEls.map(e => `${e.role}=${e.currentFontSize}px`).join(' > ')} — respetá estas proporciones.`
        : ''

      const isVert = H > W

      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            {
              role: 'system',
              content: `Sos un senior UI/UX designer especializado en piezas para redes sociales. Proponés layouts limpios, con jerarquía clara, generoso espaciado y composición equilibrada. Nunca ponés elementos en posiciones aleatorias. Siempre respondés SOLO con JSON válido.`
            },
            {
              role: 'user',
              content: `Canvas: ${W}×${H}px | ${platform} ${formatKey} | ${isVert ? 'Vertical' : H === W ? 'Cuadrado' : 'Horizontal'}
Margen de seguridad: ${margin}px desde cada borde${fontNote}

ELEMENTOS (${elements.length}):
${JSON.stringify(summary, null, 2)}

TAREA: Redistribuí los elementos para lograr una composición profesional y equilibrada.

REGLAS DE TAMAÑOS:
• bg_image → siempre x:0, y:0, width:${W}, height:${H}
• headline → ajustá fontSize SOLO si el actual está fuera del rango ${Math.round(H*0.055)}–${Math.round(H*0.095)}px
• subtitle → ajustá fontSize SOLO si el actual está fuera del rango ${Math.round(H*0.022)}–${Math.round(H*0.04)}px
• body_text → ajustá fontSize SOLO si está fuera de ${Math.round(H*0.018)}–${Math.round(H*0.028)}px
• cta_button → width:200–420, height:52–76
• image/shape/icon → tamaño coherente con su posición en el canvas

REGLAS DE POSICIÓN:
• Margen lateral mínimo ${margin}px: x ≥ ${margin}, x+textColumnWidth ≤ ${W-margin}
• Espacio mínimo 24px entre cualquier par de elementos
• Distribuí verticalmente para ocupar el canvas completo de forma equilibrada
• Textos del mismo nivel comparten el mismo x (alineados)
• headline+subtitle: bloque con 16–32px de gap entre ellos
• NO apilés todo arriba ni todo abajo
• Si un elemento ya está bien posicionado, podés mantener sus x/y actuales

RESPONDÉ ÚNICAMENTE CON JSON:
{"elements":[{"id":"...","x":N,"y":N,"width":N,"height":N}]}

CRÍTICO:
- headline/subtitle/body_text: incluí "fontSize", NO incluyas width ni height
- cta_button/image/shape/icon: incluí width y height, NO fontSize
- bg_image: x:0, y:0, width:${W}, height:${H}
- Incluí los ${elements.length} elementos; todos los valores son enteros`
            }
          ],
          temperature: 0.25,
          max_tokens: 1500,
          response_format: { type: 'json_object' },
        })
      })

      if (!res.ok) throw new Error(`AI error ${res.status}`)
      const data = await res.json()
      const parsed = JSON.parse(data.choices?.[0]?.message?.content || '{}')
      const patches = parsed.elements || []
      if (patches.length > 0) {
        pushHistory(slides)
        patches.forEach(({ id, x, y, width, height, fontSize }) => {
          const el = elements.find(e => e.id === id)
          if (!el) return
          const patch = {}
          if (x !== undefined) patch.x = Math.round(x)
          if (y !== undefined) patch.y = Math.round(y)
          if (el.type === 'text' && fontSize) patch.fontSize = Math.round(fontSize)
          if (el.type !== 'text' && width) patch.width = Math.round(width)
          if (el.type !== 'text' && el.type !== 'icon' && height) patch.height = Math.round(height)
          if (Object.keys(patch).length > 0) updateEl(id, patch)
        })
      }
    } catch (err) {
      console.error('Compose error:', err)
    } finally {
      setComposing(false)
    }
  }

  const exportAll = async (type = 'png') => {
    for (let i = 0; i < slides.length; i++) {
      setSlideIdx(i)
      await new Promise(r => setTimeout(r, 120))
      await handleExport(type)
    }
  }

  // ── Background helpers ──
  const applyCustomGrad = (v) => {
    setCustomGrad(v)
    setBg({ type: 'gradient', value: `linear-gradient(${v.angle}deg, ${v.c1}, ${v.c2})` })
  }

  // ── Derived ──
  const canvasBgStyle = bg.type === 'image'
    ? {
        backgroundImage: `url(${bg.value})`,
        backgroundSize: bg.fit === 'contain' ? 'contain' : bg.fit === 'cover' ? 'cover' : (bg.zoom ? `${bg.zoom}%` : 'cover'),
        backgroundPosition: `${bg.posX ?? 50}% ${bg.posY ?? 50}%`,
        backgroundRepeat: 'no-repeat',
      }
    : { background: bg.value }

  // ── Reusable style helpers ──
  const btn = (active) => ({
    padding: '6px 11px', borderRadius: 7, border: '1px solid', cursor: 'pointer', fontSize: 11, fontWeight: '500',
    borderColor: active ? C.selectedText : C.inputBorder,
    background: active ? C.selected : C.input,
    color: active ? C.selectedText : C.textMuted,
  })
  const SL = { fontSize: 9, fontWeight: '700', letterSpacing: '0.1em', color: C.textFaint, textTransform: 'uppercase', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }
  const HR = { height: 1, background: C.sidebarBorder, margin: '12px 0' }

  const SHL = (title, key) => {
    const isC = !!leftCollapsed[key]
    return (
      <div onClick={() => setLeftCollapsed(p => ({...p, [key]: !p[key]}))}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          paddingBottom: 8, paddingTop: 4, marginBottom: isC ? 0 : 2, cursor: 'pointer', userSelect: 'none' }}>
        <span style={{ fontSize: 9, fontWeight: '700', letterSpacing: '0.1em', color: C.textMuted, textTransform: 'uppercase' }}>{title}</span>
        <span style={{ fontSize: 9, color: C.textFaint }}>{isC ? '▸' : '▾'}</span>
      </div>
    )
  }

  const _canUndo = canUndo(histIdx)
  const _canRedo = canRedo(histStack, histIdx)

  // Auth gates
  if (authLoading) return (
    <div style={{ height: '100vh', background: '#0A0A14', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 28, height: 28, borderRadius: '50%', border: '2px solid rgba(100,48,247,0.3)', borderTopColor: '#6430F7', animation: 'spin 0.7s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
  if (!session) return <AuthScreen />

  const USER_EMAIL = session.user.email

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: C.bg, overflow: 'hidden', fontFamily: "'PP Neue Montreal', sans-serif", color: C.text }}>
      <style>{`
        @keyframes qSpinDots {
          0%  { opacity: 1 }
          33% { opacity: 0.3 }
          66% { opacity: 0.6 }
          100%{ opacity: 1 }
        }
        @keyframes qPulseGlow {
          0%,100% { box-shadow: 0 0 0 0 rgba(100,48,247,0.35); }
          50%      { box-shadow: 0 0 0 6px rgba(100,48,247,0); }
        }
        .q-generating { animation: qPulseGlow 1.4s ease-in-out infinite; }
        .q-dot1 { animation: qSpinDots 1.2s 0.0s infinite; }
        .q-dot2 { animation: qSpinDots 1.2s 0.2s infinite; }
        .q-dot3 { animation: qSpinDots 1.2s 0.4s infinite; }
        .q-drag-handle { opacity: 0.25; transition: opacity 120ms; }
        .q-layer-row:hover .q-drag-handle { opacity: 0.7; }
        .q-layer-row:hover { background: rgba(255,255,255,0.04) !important; }
        .q-layer-row:active .q-drag-handle { opacity: 1; }
        * { box-sizing: border-box; }
        .q-sl::after { content: ''; display: inline-block; flex: 1; height: 1px; background: currentColor; opacity: 0.2; margin-left: 2px; vertical-align: middle; }
        input[type=number]::-webkit-inner-spin-button,
        input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
        input[type=number] { -moz-appearance: textfield; }
        input[type=range] { -webkit-appearance: none; appearance: none; background: transparent; cursor: pointer; }
        input[type=range]::-webkit-slider-runnable-track { height: 2px; background: #555555; border-radius: 1px; }
        input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; width: 11px; height: 11px; border-radius: 50%; background: #8A8A8A; margin-top: -4.5px; }
        input[type=range]::-moz-range-track { height: 2px; background: #555555; border-radius: 1px; border: none; }
        input[type=range]::-moz-range-thumb { width: 11px; height: 11px; border-radius: 50%; background: #8A8A8A; border: none; }
      `}</style>

      {/* ─── GLOBAL TOP BAR ─── */}
      <div style={{ height: 44, flexShrink: 0, display: 'flex', alignItems: 'center', padding: '0 14px', background: C.sidebar, borderBottom: `1px solid ${C.sidebarBorder}`, gap: 8, zIndex: 10 }}>
        <img src="/logos/logo-iso.svg" style={{ width: 20, height: 20, opacity: 0.88, flexShrink: 0 }} alt="" />
        <div style={{ width: 1, height: 18, background: C.sidebarBorder, margin: '0 2px', flexShrink: 0 }} />
        <span style={{ fontSize: 13, fontWeight: '700', color: C.text, letterSpacing: '-0.02em' }}>Qurable Studio</span>
        <span style={{ fontSize: 9, fontWeight: '600', color: C.textFaint, letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: 1 }}>Social Generator</span>
        <div style={{ width: 1, height: 18, background: C.sidebarBorder, margin: '0 2px', flexShrink: 0 }} />
        {/* Archivo */}
        <div ref={fileMenuRef} style={{ position: 'relative' }}>
          <button onClick={() => setShowFileMenu(f => !f)}
            style={{ ...btn(showFileMenu), padding: '5px 10px', fontSize: 11, fontWeight: '600', display: 'flex', alignItems: 'center', gap: 4 }}>
            Archivo <span style={{ fontSize: 8, opacity: 0.7 }}>▾</span>
          </button>
          {showFileMenu && (
            <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 300, background: C.sidebar, border: `1px solid ${C.inputBorder}`, borderRadius: 8, padding: '4px', boxShadow: '0 8px 28px rgba(0,0,0,0.35)', minWidth: 192 }}>

              {/* Abrir */}
              <button onClick={() => { setShowProjects(true); setShowFileMenu(false) }}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', textAlign: 'left', padding: '7px 10px', background: 'transparent', border: 'none', color: C.text, cursor: 'pointer', fontSize: 11, borderRadius: 5, gap: 16 }}
                onMouseEnter={e => { e.currentTarget.style.background = C.input; setShowRecentsMenu(false) }}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                Abrir
              </button>

              {/* Abrir recientes — con submenu */}
              <div style={{ position: 'relative' }}
                onMouseEnter={() => setShowRecentsMenu(true)}
                onMouseLeave={() => setShowRecentsMenu(false)}>
                <button
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', textAlign: 'left', padding: '7px 10px', background: showRecentsMenu ? C.input : 'transparent', border: 'none', color: recentProjects.length === 0 ? C.textFaint : C.text, cursor: recentProjects.length === 0 ? 'default' : 'pointer', fontSize: 11, borderRadius: 5, gap: 16 }}>
                  <span>Abrir recientes</span>
                  <span style={{ fontSize: 9, color: C.textFaint }}>›</span>
                </button>
                {showRecentsMenu && recentProjects.length > 0 && (
                  <div style={{ position: 'absolute', top: 0, left: '100%', marginLeft: 4, zIndex: 301, background: C.sidebar, border: `1px solid ${C.inputBorder}`, borderRadius: 8, padding: '4px', boxShadow: '0 8px 28px rgba(0,0,0,0.4)', minWidth: 220, maxHeight: 320, overflowY: 'auto' }}>
                    {recentProjects.map(p => (
                      <button key={p.id}
                        onClick={() => { handleLoadProject(p.id); setShowFileMenu(false) }}
                        style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', padding: '7px 10px', background: 'transparent', border: 'none', color: C.text, cursor: 'pointer', fontSize: 11, borderRadius: 5 }}
                        onMouseEnter={e => e.currentTarget.style.background = C.input}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        {/* Mini thumbnail */}
                        <div style={{ width: 32, height: 32, borderRadius: 4, flexShrink: 0, overflow: 'hidden', background: C.input, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {p.thumbnail
                            ? <img src={p.thumbnail} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            : <span style={{ fontSize: 14, opacity: 0.2 }}>🎨</span>
                          }
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 11, fontWeight: '600', color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                          <div style={{ fontSize: 9, color: C.textMuted, marginTop: 1 }}>
                            {p.platform?.toUpperCase()} · {p.format_key} · {(() => {
                              const diff = Date.now() - new Date(p.updated_at).getTime()
                              const m = Math.floor(diff / 60000)
                              if (m < 1) return 'ahora'
                              if (m < 60) return `hace ${m}m`
                              const h = Math.floor(m / 60)
                              if (h < 24) return `hace ${h}h`
                              return `hace ${Math.floor(h / 24)}d`
                            })()}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ height: 1, background: C.inputBorder, margin: '3px 4px' }} />

              {/* Nuevo */}
              <button onClick={() => { handleNew(); setShowFileMenu(false) }}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', textAlign: 'left', padding: '7px 10px', background: 'transparent', border: 'none', color: C.text, cursor: 'pointer', fontSize: 11, borderRadius: 5, gap: 16 }}
                onMouseEnter={e => { e.currentTarget.style.background = C.input; setShowRecentsMenu(false) }}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <span>Nuevo</span>
                <span style={{ fontSize: 9, color: C.textFaint }}>⌘N</span>
              </button>

              {/* Guardar */}
              <button
                onClick={() => { setShowFileMenu(false); if (currentProjectId) { handleSave() } else { setSaveMode('save'); setSaveOverwriteTarget(null); setShowSaveModal(true) } }}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', textAlign: 'left', padding: '7px 10px', background: 'transparent', border: 'none', color: C.text, cursor: 'pointer', fontSize: 11, borderRadius: 5, gap: 16 }}
                onMouseEnter={e => { e.currentTarget.style.background = C.input; setShowRecentsMenu(false) }}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <span>Guardar</span>
                <span style={{ fontSize: 9, color: C.textFaint }}>⌘S</span>
              </button>

              {/* Guardar como */}
              <button
                onClick={() => { setShowFileMenu(false); setSaveMode('saveAs'); setSaveOverwriteTarget(null); setShowSaveModal(true) }}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', textAlign: 'left', padding: '7px 10px', background: 'transparent', border: 'none', color: C.text, cursor: 'pointer', fontSize: 11, borderRadius: 5, gap: 16 }}
                onMouseEnter={e => { e.currentTarget.style.background = C.input; setShowRecentsMenu(false) }}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <span>Guardar como…</span>
                <span style={{ fontSize: 9, color: C.textFaint }}>⌘⇧S</span>
              </button>

              <div style={{ height: 1, background: C.inputBorder, margin: '3px 4px' }} />

              {/* Cerrar sesión */}
              <button onClick={() => { setShowFileMenu(false); signOut() }}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', textAlign: 'left', padding: '7px 10px', background: 'transparent', border: 'none', color: C.text, cursor: 'pointer', fontSize: 11, borderRadius: 5, gap: 16 }}
                onMouseEnter={e => { e.currentTarget.style.background = C.input; setShowRecentsMenu(false) }}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <span>Cerrar sesión</span>
                <span style={{ fontSize: 9, color: C.textFaint }}>{USER_EMAIL.split('@')[0]}</span>
              </button>

            </div>
          )}
        </div>
        {/* Undo/Redo */}
        <button onClick={undo} disabled={!_canUndo} title="Deshacer (⌘Z)"
          style={{ ...btn(false), opacity: _canUndo ? 1 : 0.3, padding: '5px 9px', fontSize: 14 }}>↩</button>
        <button onClick={redo} disabled={!_canRedo} title="Rehacer (⌘⇧Z)"
          style={{ ...btn(false), opacity: _canRedo ? 1 : 0.3, padding: '5px 9px', fontSize: 14 }}>↪</button>
        <div style={{ width: 1, height: 18, background: C.sidebarBorder, margin: '0 2px', flexShrink: 0 }} />
        {/* Mockup + dimensions */}
        <button onClick={() => setShowMockup(!showMockup)} style={{ ...btn(showMockup), padding: '5px 11px' }}>
          ⬜ Mockup
        </button>
        <span style={{ fontSize: 10, color: C.textFaint }}>{fmt.width}×{fmt.height}</span>
        <button onClick={handleCompose} disabled={composing || elements.length === 0}
          title="Proponer un layout con IA para los elementos del canvas"
          onMouseEnter={e => { if (!composing) e.currentTarget.style.background = C.input }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
          style={{ padding: '5px 11px', borderRadius: 7, border: `1px solid ${C.inputBorder}`, background: 'transparent', color: composing ? C.textFaint : C.textMuted, cursor: composing || elements.length === 0 ? 'default' : 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', gap: 5, opacity: elements.length === 0 ? 0.4 : 1, flexShrink: 0 }}>
          <span style={{ fontSize: 10 }}>{composing ? '◌' : '✦'}</span>
          {composing ? 'Componiendo…' : 'Componer'}
        </button>
        <div style={{ flex: 1 }} />
        {lastSaved && (
          <div style={{ fontSize: 9, color: C.textFaint }}>
            Guardado · {lastSaved.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
            {projectName && ` · ${projectName}`}
          </div>
        )}
        <div style={{ width: 1, height: 18, background: C.sidebarBorder, margin: '0 2px', flexShrink: 0 }} />
        <span style={{ fontSize: 9, color: C.textFaint, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Exportar</span>
        <button
          onClick={() => { slides.length > 1 ? setExportModal('png') : handleExport('png') }}
          disabled={exporting}
          onMouseEnter={e => { if (!exporting) e.currentTarget.style.background = C.input }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
          style={{ padding: '5px 10px', borderRadius: 7, border: `1px solid ${C.inputBorder}`, background: 'transparent', color: C.textMuted, cursor: exporting ? 'default' : 'pointer', fontSize: 11 }}>
          {exporting ? '···' : '↓ PNG'}
        </button>
        <button
          onClick={() => { slides.length > 1 ? setExportModal('jpeg') : handleExport('jpeg') }}
          disabled={exporting}
          onMouseEnter={e => { if (!exporting) e.currentTarget.style.background = C.input }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
          style={{ padding: '5px 10px', borderRadius: 7, border: `1px solid ${C.inputBorder}`, background: 'transparent', color: C.textMuted, cursor: exporting ? 'default' : 'pointer', fontSize: 11 }}>
          ↓ JPG
        </button>
        <div style={{ width: 1, height: 18, background: C.sidebarBorder, margin: '0 2px', flexShrink: 0 }} />
        <button onClick={() => setThemeName(t => t === 'dark' ? 'light' : 'dark')} title="Cambiar tema"
          style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 7, border: `1px solid ${C.inputBorder}`, background: C.input, color: C.textMuted, cursor: 'pointer', fontSize: 14 }}>
          {themeName === 'dark' ? '☀' : '◑'}
        </button>
      </div>

      {/* ─── THREE-COLUMN LAYOUT ─── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

      {/* ─── LEFT SIDEBAR ─── */}
      <div style={{ width: 288, flexShrink: 0, borderRight: `1px solid ${C.sidebarBorder}`, display: 'flex', flexDirection: 'column', background: C.sidebar, overflowY: 'auto' }}>

        <div style={{ padding: '12px 14px', flex: 1 }}>
          {SHL('Plataforma & Formato', 'pf')}
          {!leftCollapsed['pf'] && (<>
            {/* Platform */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', gap: 5 }}>
                {Object.entries(PLATFORMS).map(([k, v]) => {
                  const isActive = platform === k
                  return (
                    <button key={k} onClick={() => { setPlatform(k); setFormatKey(v.formats[0]) }}
                      style={{ ...btn(isActive), flex: 1, transition: 'all 120ms' }}
                      onMouseEnter={e => { if (!isActive) { e.currentTarget.style.background = C.btnHover; e.currentTarget.style.color = C.text } }}
                      onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = C.input; e.currentTarget.style.color = C.textMuted } }}>
                      {v.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Format */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                {PLATFORMS[platform].formats.map(f => {
                  const isActive = formatKey === f
                  return (
                    <button key={f} onClick={() => setFormatKey(f)}
                      style={{ ...btn(isActive), transition: 'all 120ms' }}
                      onMouseEnter={e => { if (!isActive) { e.currentTarget.style.background = C.btnHover; e.currentTarget.style.color = C.text } }}
                      onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = C.input; e.currentTarget.style.color = C.textMuted } }}>
                      {f}
                    </button>
                  )
                })}
              </div>
            </div>

            <div style={HR} />
          </>)}

          {SHL('Generador IA', 'ai')}
          {!leftCollapsed['ai'] && (
          <div style={{ background: 'linear-gradient(135deg, rgba(100,48,247,0.1) 0%, rgba(67,26,214,0.04) 100%)', border: '1px solid rgba(100,48,247,0.16)', borderRadius: 12, padding: 12, marginBottom: 12 }}>
            <textarea value={brief} onChange={e => setBrief(e.target.value)}
              placeholder="Describí la pieza — lanzamiento, campaña, insight..."
              onKeyDown={e => { if (e.key === 'Enter' && e.metaKey) handleGenerate() }}
              style={{ width: '100%', background: C.input, border: `1px solid ${C.inputBorder}`, borderRadius: 8, padding: '8px 10px', color: C.text, fontSize: 12, minHeight: 72, lineHeight: 1.5, resize: 'none', outline: 'none' }} />
            <button onClick={handleGenerate} disabled={aiLoading || !brief.trim()}
              className={aiLoading ? 'q-generating' : ''}
              style={{ width: '100%', marginTop: 7, padding: '9px', background: aiLoading ? 'rgba(100,48,247,0.55)' : 'linear-gradient(135deg,#6430F7,#4318CC)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: '600', cursor: aiLoading ? 'default' : 'pointer', opacity: !brief.trim() && !aiLoading ? 0.5 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              {aiLoading ? (
                <>
                  <span style={{ opacity: 0.85 }}>✦ Generando</span>
                  <span style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
                    <span className="q-dot1" style={{ width: 4, height: 4, borderRadius: '50%', background: '#fff', display: 'inline-block' }} />
                    <span className="q-dot2" style={{ width: 4, height: 4, borderRadius: '50%', background: '#fff', display: 'inline-block' }} />
                    <span className="q-dot3" style={{ width: 4, height: 4, borderRadius: '50%', background: '#fff', display: 'inline-block' }} />
                  </span>
                </>
              ) : '✦ Generar pieza'}
            </button>
            {aiReason && <div style={{ marginTop: 7, fontSize: 11, color: '#7C3AED', lineHeight: 1.4 }}>💡 {aiReason}</div>}
            {hasGenerated && (
              <div style={{ marginTop: 10, borderTop: '1px solid rgba(100,48,247,0.12)', paddingTop: 9 }}>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input value={iterateText} onChange={e => setIterateText(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleIterate() }}
                    placeholder="Iterar: más corto, urgente..."
                    style={{ flex: 1, background: C.input, border: `1px solid ${C.inputBorder}`, borderRadius: 6, padding: '8px 10px', color: C.text, fontSize: 11, outline: 'none' }} />
                  <button onClick={handleIterate} disabled={aiLoading}
                    style={{ padding: '7px 12px', background: C.selected, border: `1px solid ${C.inputBorder}`, borderRadius: 6, color: C.text, cursor: 'pointer', fontSize: 14 }}>→</button>
                </div>
              </div>
            )}
            {aiError && <div style={{ marginTop: 7, fontSize: 11, color: '#F87171', lineHeight: 1.4 }}>⚠ {aiError}</div>}
          </div>
          )}

          {/* Presets */}
          <div style={{ marginBottom: 12 }}>
            <span className="q-sl" style={SL}>Presets de diseño</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {STYLES.map(s => (
                <button key={s.id} onClick={() => loadPreset(s.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0', background: 'transparent', border: `1px solid ${C.inputBorder}`, borderRadius: 9, cursor: 'pointer', textAlign: 'left', overflow: 'hidden', transition: 'border-color 150ms, box-shadow 150ms' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = C.text; e.currentTarget.style.boxShadow = 'none' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = C.inputBorder; e.currentTarget.style.boxShadow = 'none' }}>
                  {/* Preview swatch */}
                  <div style={{ width: 60, height: 56, flexShrink: 0, background: s.preview, position: 'relative', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: '7px 7px 6px' }}>
                    {/* Headline bar — grande, negro */}
                    <div style={{ height: 3, width: '80%', background: s.textColor, opacity: 1, borderRadius: 1.5, marginBottom: 2.5 }} />
                    <div style={{ height: 3, width: '65%', background: s.textColor, opacity: 1, borderRadius: 1.5, marginBottom: 2.5 }} />
                    <div style={{ height: 3, width: '50%', background: s.textColor, opacity: 1, borderRadius: 1.5, marginBottom: 5 }} />
                    {/* Accent line */}
                    <div style={{ height: 2, width: 16, background: s.accentColor, opacity: 0.9, borderRadius: 1 }} />
                  </div>
                  {/* Info */}
                  <div style={{ flex: 1, padding: '8px 10px 8px 0', minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 }}>
                      <span style={{ fontSize: 11, fontWeight: '700', color: C.text, whiteSpace: 'nowrap' }}>{s.label}</span>
                      <span style={{ fontSize: 8, fontWeight: '600', color: C.textMuted, background: C.input, border: `1px solid ${C.inputBorder}`, borderRadius: 4, padding: '1px 5px', letterSpacing: '0.04em', flexShrink: 0 }}>{s.mood.toUpperCase()}</span>
                    </div>
                    <div style={{ fontSize: 10, color: C.textMuted, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.desc}</div>
                    <div style={{ display: 'flex', gap: 3, marginTop: 4 }}>
                      {s.platforms.map(p => (
                        <span key={p} style={{ fontSize: 8, fontWeight: '500', color: C.textFaint, background: C.input, borderRadius: 3, padding: '1px 5px' }}>{p}</span>
                      ))}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div style={HR} />

          {SHL('Fondo', 'bg')}
          {!leftCollapsed['bg'] && (<>
          {/* Background */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', gap: 5, marginBottom: 9 }}>
              {[['presets','Presets'],['custom','Custom'],['ia','IA']].map(([t,l]) => (
                <button key={t} onClick={() => setBgTab(t)} style={{ ...btn(bgTab === t), flex: 1, padding: '4px', fontSize: 10 }}>{l}</button>
              ))}
            </div>

            {bgTab === 'presets' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}>
                {GRADIENT_PRESETS.map((p, i) => (
                  <button key={i} onClick={() => setBg({ type: p.isColor ? 'color' : 'gradient', value: p.value })}
                    style={{ height: 34, borderRadius: 7, border: `2px solid ${bg.value === p.value ? C.accent : 'transparent'}`, cursor: 'pointer', background: p.value, position: 'relative', overflow: 'hidden' }}>
                  </button>
                ))}
                <label style={{ height: 34, borderRadius: 7, border: `1px dashed ${C.inputBorder}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gridColumn: '1/-1' }}>
                  <input type="file" accept="image/*" style={{ display: 'none' }}
                    onChange={async e => { const f = e.target.files?.[0]; if (f) setBg({ type: 'image', value: await fileToDataURL(f), posX: 50, posY: 50, zoom: 100 }) }} />
                  <span style={{ fontSize: 10, color: C.textMuted }}>+ Subir imagen de fondo</span>
                </label>
              </div>
            )}

            {/* Controles de imagen de fondo — aparecen solo cuando hay imagen */}
            {bg.type === 'image' && (() => {
              const sl = (label, key, min, max, dflt) => (
                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 9, color: C.textMuted, marginBottom: 3 }}>{label}: {Math.round(bg[key] ?? dflt)}{key === 'zoom' ? '%' : '%'}</div>
                  <input type="range" min={min} max={max} value={bg[key] ?? dflt}
                    onChange={e => setBg({ ...bg, [key]: Number(e.target.value), ...(key === 'zoom' ? { fit: undefined } : {}) })}
                    style={{ width: '100%' }} />
                </div>
              )
              const hasOverlay = !!bg.overlay
              return (
                <div style={{ marginTop: 10, padding: '10px', background: C.input, borderRadius: 8, border: `1px solid ${C.inputBorder}` }}>
                  <div style={{ fontSize: 9, fontWeight: '700', color: C.textFaint, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>Ajustar imagen</div>
                  {/* Fit buttons */}
                  <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
                    {[['Cubrir', 'cover'], ['Ajustar', 'contain']].map(([lbl, fit]) => {
                      const active = (bg.fit === fit) || (fit === 'cover' && !bg.fit && !bg.zoom)
                      return (
                        <button key={fit} onClick={() => setBg({ ...bg, fit, zoom: undefined })}
                          style={{ flex: 1, padding: '5px 0', fontSize: 10, fontWeight: '600', borderRadius: 5, border: '1px solid', cursor: 'pointer',
                            borderColor: active ? C.selectedText : C.inputBorder,
                            background: active ? C.selected : C.panel,
                            color: active ? C.selectedText : C.textMuted }}>
                          {lbl}
                        </button>
                      )
                    })}
                  </div>
                  {sl('Posición X', 'posX', 0, 100, 50)}
                  {sl('Posición Y', 'posY', 0, 100, 50)}
                  {sl('Zoom', 'zoom', 50, 300, 100)}
                  <div style={{ borderTop: `1px solid ${C.inputBorder}`, marginTop: 8, paddingTop: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: hasOverlay ? 8 : 0 }}>
                      <div style={{ fontSize: 9, fontWeight: '700', color: C.textFaint, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Overlay</div>
                      <button onClick={() => setBg({ ...bg, overlay: hasOverlay ? null : { type: 'solid', color: '#000000', opacity: 0.4 } })}
                        style={{ fontSize: 9, padding: '3px 8px', borderRadius: 5, border: `1px solid ${C.inputBorder}`, background: hasOverlay ? C.selected : C.input, color: hasOverlay ? C.selectedText : C.textMuted, cursor: 'pointer', fontWeight: '600' }}>
                        {hasOverlay ? 'Activo' : '+ Agregar'}
                      </button>
                    </div>
                    {hasOverlay && (() => {
                      const ov = bg.overlay
                      const ovType = ov.type || 'solid'
                      const setOv = (patch) => setBg({ ...bg, overlay: { ...ov, ...patch } })
                      const ovBtn = (t) => ({
                        fontSize: 9, padding: '4px 0', borderRadius: 5, border: '1px solid', cursor: 'pointer', fontWeight: '600', flex: 1,
                        borderColor: ovType === t ? C.selectedText : C.inputBorder,
                        background: ovType === t ? C.selected : C.input,
                        color: ovType === t ? C.selectedText : C.textMuted,
                      })
                      return (
                        <div>
                          {/* Tipo: sólido o gradiente */}
                          <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
                            <button style={ovBtn('solid')} onClick={() => setOv({ type: 'solid' })}>Sólido</button>
                            <button style={ovBtn('gradient')} onClick={() => setOv({ type: 'gradient', color1: ov.color1 || '#000000', opacity1: ov.opacity1 ?? 0.85, color2: ov.color2 || '#000000', opacity2: ov.opacity2 ?? 0, direction: ov.direction || 'to top', coverage: ov.coverage ?? 60 })}>Gradiente</button>
                          </div>

                          {ovType === 'gradient' ? (
                            <>
                              {/* Dirección */}
                              <div style={{ marginBottom: 7 }}>
                                <div style={{ fontSize: 9, color: C.textMuted, marginBottom: 3 }}>Dirección</div>
                                <div style={{ display: 'flex', gap: 4 }}>
                                  {[['↑','to top'],['↓','to bottom'],['←','to left'],['→','to right']].map(([icon, dir]) => (
                                    <button key={dir} onClick={() => setOv({ direction: dir })}
                                      style={{ flex: 1, padding: '5px 0', borderRadius: 5, border: '1px solid', cursor: 'pointer', fontSize: 13,
                                        borderColor: (ov.direction || 'to top') === dir ? C.selectedText : C.inputBorder,
                                        background: (ov.direction || 'to top') === dir ? C.selected : C.input,
                                        color: (ov.direction || 'to top') === dir ? C.selectedText : C.textMuted,
                                      }}>{icon}</button>
                                  ))}
                                </div>
                              </div>
                              {/* Color denso */}
                              <div style={{ marginBottom: 6 }}>
                                <div style={{ fontSize: 9, color: C.textMuted, marginBottom: 3 }}>Color denso · {Math.round((ov.opacity1 ?? 0.85) * 100)}%</div>
                                <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                                  <input type="color" value={ov.color1 || '#000000'} onChange={e => setOv({ color1: e.target.value })}
                                    style={{ width: 28, height: 28, border: `1px solid ${C.inputBorder}`, borderRadius: 5, padding: 1, cursor: 'pointer', background: C.input, flexShrink: 0 }} />
                                  <input type="range" min={0} max={100} value={Math.round((ov.opacity1 ?? 0.85) * 100)} onChange={e => setOv({ opacity1: Number(e.target.value) / 100 })}
                                    style={{ flex: 1, accentColor: C.text }} />
                                </div>
                              </div>
                              {/* Color fade */}
                              <div style={{ marginBottom: 6 }}>
                                <div style={{ fontSize: 9, color: C.textMuted, marginBottom: 3 }}>Color fade · {Math.round((ov.opacity2 ?? 0) * 100)}%</div>
                                <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                                  <input type="color" value={ov.color2 || '#000000'} onChange={e => setOv({ color2: e.target.value })}
                                    style={{ width: 28, height: 28, border: `1px solid ${C.inputBorder}`, borderRadius: 5, padding: 1, cursor: 'pointer', background: C.input, flexShrink: 0 }} />
                                  <input type="range" min={0} max={100} value={Math.round((ov.opacity2 ?? 0) * 100)} onChange={e => setOv({ opacity2: Number(e.target.value) / 100 })}
                                    style={{ flex: 1, accentColor: C.text }} />
                                </div>
                              </div>
                              {/* Cobertura */}
                              <div style={{ marginBottom: 7 }}>
                                <div style={{ fontSize: 9, color: C.textMuted, marginBottom: 3 }}>Cobertura: {Math.round(ov.coverage ?? 60)}%</div>
                                <input type="range" min={10} max={100} value={ov.coverage ?? 60} onChange={e => setOv({ coverage: Number(e.target.value) })}
                                  style={{ width: '100%', accentColor: C.text }} />
                              </div>
                              {/* Presets de gradiente */}
                              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                {[
                                  ['↑ Negro', { color1:'#000000', opacity1:0.9, color2:'#000000', opacity2:0, direction:'to top', coverage:60 }],
                                  ['↑ Violeta', { color1:'#4318CC', opacity1:0.9, color2:'#4318CC', opacity2:0, direction:'to top', coverage:60 }],
                                  ['↓ Oscuro', { color1:'#000000', opacity1:0.85, color2:'#000000', opacity2:0, direction:'to bottom', coverage:50 }],
                                  ['Full Velo', { color1:'#000000', opacity1:0.55, color2:'#000000', opacity2:0.05, direction:'to top', coverage:100 }],
                                ].map(([label, preset]) => (
                                  <button key={label} onClick={() => setOv(preset)}
                                    style={{ padding: '3px 7px', fontSize: 9, borderRadius: 5, border: `1px solid ${C.inputBorder}`, background: C.input, color: C.textMuted, cursor: 'pointer' }}>
                                    {label}
                                  </button>
                                ))}
                              </div>
                            </>
                          ) : (
                            <>
                              {/* Color sólido */}
                              <div style={{ marginBottom: 6 }}>
                                <div style={{ fontSize: 9, color: C.textMuted, marginBottom: 3 }}>Color</div>
                                <div style={{ display: 'flex', gap: 5 }}>
                                  <input type="color" value={ov.color?.startsWith('#') ? ov.color : '#000000'} onChange={e => setOv({ color: e.target.value })}
                                    style={{ width: 28, height: 28, border: `1px solid ${C.inputBorder}`, borderRadius: 5, padding: 1, cursor: 'pointer', background: C.input, flexShrink: 0 }} />
                                  <input type="text" value={ov.color || '#000000'} onChange={e => setOv({ color: e.target.value })}
                                    style={{ flex: 1, background: C.input, border: `1px solid ${C.inputBorder}`, borderRadius: 6, padding: '5px 7px', color: C.text, fontSize: 10, fontFamily: 'monospace' }} />
                                </div>
                              </div>
                              {/* Opacidad */}
                              <div style={{ marginBottom: 7 }}>
                                <div style={{ fontSize: 9, color: C.textMuted, marginBottom: 3 }}>Opacidad: {Math.round((ov.opacity ?? 0.4) * 100)}%</div>
                                <input type="range" min={0} max={100} value={Math.round((ov.opacity ?? 0.4) * 100)} onChange={e => setOv({ opacity: Number(e.target.value) / 100 })}
                                  style={{ width: '100%', accentColor: C.text }} />
                              </div>
                              {/* Presets de color */}
                              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                {[['Negro','#000000'],['Navy','#0F172A'],['Violeta','#4318CC'],['Blanco','#FFFFFF']].map(([label, val]) => (
                                  <button key={label} onClick={() => setOv({ color: val })}
                                    style={{ padding: '3px 7px', fontSize: 9, borderRadius: 5, border: `1px solid ${C.inputBorder}`, background: val, color: val === '#FFFFFF' ? '#333' : '#fff', cursor: 'pointer', fontWeight: '600', textShadow: val === '#FFFFFF' ? 'none' : '0 1px 2px rgba(0,0,0,0.5)' }}>
                                    {label}
                                  </button>
                                ))}
                              </div>
                            </>
                          )}
                        </div>
                      )
                    })()}
                  </div>
                </div>
              )
            })()}

            {bgTab === 'custom' && (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 9 }}>
                  {[['c1','Color 1'],['c2','Color 2']].map(([k,l]) => (
                    <div key={k}>
                      <div style={{ fontSize: 9, color: C.textMuted, marginBottom: 3 }}>{l}</div>
                      <input type="color" value={customGrad[k]}
                        onChange={e => applyCustomGrad({ ...customGrad, [k]: e.target.value })}
                        style={{ width: '100%', height: 32, border: `1px solid ${C.inputBorder}`, borderRadius: 6, padding: 2, cursor: 'pointer', background: C.input }} />
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: 9, color: C.textMuted, marginBottom: 3 }}>Ángulo: {customGrad.angle}°</div>
                <input type="range" min={0} max={360} value={customGrad.angle}
                  onChange={e => applyCustomGrad({ ...customGrad, angle: Number(e.target.value) })}
                  style={{ width: '100%', accentColor: C.text, marginBottom: 7 }} />
                <div style={{ height: 26, borderRadius: 6, background: `linear-gradient(${customGrad.angle}deg, ${customGrad.c1}, ${customGrad.c2})` }} />
              </div>
            )}

            {bgTab === 'ia' && (
              <div>
                <textarea value={bgPrompt} onChange={e => setBgPrompt(e.target.value)}
                  placeholder="Describí el fondo: ciudad de noche, patrón abstracto..."
                  style={{ width: '100%', background: C.input, border: `1px solid ${C.inputBorder}`, borderRadius: 8, padding: '8px', color: C.text, fontSize: 12, minHeight: 56 }} />
                <button disabled={aiLoading || !bgPrompt.trim()}
                  onClick={async () => {
                    setAiLoading(true)
                    try { const url = await generateImage({ prompt: bgPrompt, format: formatKey, apiKey: API_KEY }); if (url) setBg({ type: 'image', value: url }) }
                    catch (err) { setAiError(err.message) }
                    finally { setAiLoading(false) }
                  }}
                  style={{ width: '100%', marginTop: 7, padding: '8px', background: C.input, border: `1px solid ${C.inputBorder}`, borderRadius: 8, color: C.textMuted, fontSize: 12, cursor: 'pointer', opacity: !bgPrompt.trim() ? 0.4 : 1 }}>
                  {aiLoading ? 'Generando...' : '✦ Generar fondo IA'}
                </button>
              </div>
            )}
          </div>

          <div style={HR} />
          </>)}

          {SHL('Imágenes', 'img')}
          {!leftCollapsed['img'] && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5, marginBottom: 8 }}>
              <label style={{ padding: '10px 8px', background: C.input, border: `1px solid ${C.inputBorder}`, borderRadius: 8, color: C.text, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, transition: 'all 120ms' }}
                onMouseEnter={e => { e.currentTarget.style.background = C.btnHover; e.currentTarget.style.borderColor = C.accent }}
                onMouseLeave={e => { e.currentTarget.style.background = C.input; e.currentTarget.style.borderColor = C.inputBorder }}>
                <input type="file" accept="image/*" style={{ display: 'none' }}
                  onChange={async e => { const f = e.target.files?.[0]; if (f) addImageEl(await fileToDataURL(f)) }} />
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.textMuted} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>
                <span style={{ fontSize: 10, color: C.textMuted, fontWeight: '500' }}>Imagen</span>
              </label>
              <button onClick={() => { setShowImageAI(true); setImageAIError(null) }}
                style={{ padding: '10px 8px', background: C.input, border: `1px solid ${C.inputBorder}`, borderRadius: 8, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, transition: 'all 120ms' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = C.textMuted; e.currentTarget.style.background = C.btnHover }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = C.inputBorder; e.currentTarget.style.background = C.input }}>
                <span style={{ fontSize: 16, lineHeight: 1, color: C.accent }}>✦</span>
                <span style={{ fontSize: 10, color: C.textMuted, fontWeight: '600' }}>Imagen IA</span>
              </button>
            </div>
          )}

          {SHL('Elementos', 'el')}
          {!leftCollapsed['el'] && (<>
            {/* Primarios: Texto + Icono */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5, marginBottom: 5 }}>
              <button onClick={addText}
                style={{ padding: '10px 8px', background: C.input, border: `1px solid ${C.inputBorder}`, borderRadius: 8, color: C.text, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, transition: 'all 120ms' }}
                onMouseEnter={e => { e.currentTarget.style.background = C.btnHover; e.currentTarget.style.borderColor = C.accent }}
                onMouseLeave={e => { e.currentTarget.style.background = C.input; e.currentTarget.style.borderColor = C.inputBorder }}>
                <span style={{ fontSize: 20, lineHeight: 1, fontWeight: '700', color: C.accent, fontFamily: 'Georgia, serif', letterSpacing: '-0.02em' }}>T</span>
                <span style={{ fontSize: 10, color: C.textMuted, fontWeight: '500' }}>Texto</span>
              </button>
              <button onClick={() => setShowIconPicker(true)}
                style={{ padding: '10px 8px', background: C.input, border: `1px solid ${C.inputBorder}`, borderRadius: 8, color: C.text, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, transition: 'all 120ms' }}
                onMouseEnter={e => { e.currentTarget.style.background = C.btnHover; e.currentTarget.style.borderColor = C.accent }}
                onMouseLeave={e => { e.currentTarget.style.background = C.input; e.currentTarget.style.borderColor = C.inputBorder }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.textMuted} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M2 12h3M19 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12"/></svg>
                <span style={{ fontSize: 10, color: C.textMuted, fontWeight: '500' }}>Icono</span>
              </button>
            </div>
            {/* Formas */}
            <div>
              <span className="q-sl" style={{ ...SL, marginBottom: 5, marginTop: 4 }}>Formas</span>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 4, marginBottom: 5 }}>
                {[
                  { type: 'rect',     svg: <rect x="3" y="5" width="18" height="14" rx="1.5" fill={C.textMuted}/>, label: 'Rect' },
                  { type: 'circle',   svg: <circle cx="12" cy="12" r="9" fill={C.textMuted}/>, label: 'Círculo' },
                  { type: 'triangle', svg: <polygon points="12,3 22,21 2,21" fill={C.textMuted}/>, label: 'Triáng' },
                  { type: 'line',     svg: <line x1="3" y1="12" x2="21" y2="12" stroke={C.textMuted} strokeWidth="2.5" strokeLinecap="round"/>, label: 'Línea' },
                ].map(({ type, svg, label }) => (
                  <button key={type} onClick={() => addShape(type)} title={label}
                    style={{ padding: '9px 4px', background: C.input, border: `1px solid ${C.inputBorder}`, borderRadius: 7, color: C.textMuted, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, transition: 'all 120ms' }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = C.accent}
                    onMouseLeave={e => e.currentTarget.style.borderColor = C.inputBorder}>
                    <svg width="16" height="16" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">{svg}</svg>
                    <span style={{ fontSize: 8, letterSpacing: '0.01em' }}>{label.slice(0,5)}</span>
                  </button>
                ))}
              </div>
              {/* Botón */}
              <button onClick={addButton}
                style={{ width: '100%', padding: '9px 10px', background: C.input, border: `1px solid ${C.inputBorder}`, borderRadius: 7, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 9, transition: 'all 120ms' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.background = C.btnHover }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = C.inputBorder; e.currentTarget.style.background = C.input }}>
                <div style={{ width: 34, height: 16, borderRadius: 5, background: 'linear-gradient(135deg, #6430F7, #4318CC)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ fontSize: 7, color: '#fff', fontWeight: '700', letterSpacing: '0.05em' }}>BTN</span>
                </div>
                <span style={{ fontSize: 10, color: C.textMuted, fontWeight: '500' }}>Botón</span>
              </button>
            </div>
          </>)}
        </div>
      </div>

      {/* ─── CENTER ─── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.canvasBg, minWidth: 0 }}>

        {/* Canvas area wrapper: position:relative so floating controls stay fixed */}
        <div ref={canvasAreaRef} style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>

          {/* Scroll container — permite pan cuando el canvas supera el área */}
          <div
            onWheel={e => { if (e.ctrlKey || e.metaKey) { e.preventDefault(); e.deltaY < 0 ? zoomIn() : zoomOut() } }}
            style={{ position: 'absolute', inset: 0, overflow: 'auto' }}>
            {/* Inner centering wrapper — crece cuando el canvas es más grande */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: `max(100%, ${fmt.width * scale + 40}px)`,
              height: `max(100%, ${fmt.height * scale + 40}px)`,
              padding: '20px', boxSizing: 'border-box',
            }}>

          {/* Outer shell: ocupa el espacio visual escalado */}
          <div style={{ position: 'relative', width: fmt.width * scale, height: fmt.height * scale, flexShrink: 0, boxShadow: '0 4px 32px rgba(0,0,0,0.32), 0 0 0 1px rgba(0,0,0,0.14)', transition: 'width 0.18s ease, height 0.18s ease' }}>
            {/* Scale wrapper: aplica el zoom visual. canvasRef NO tiene transform → export limpio */}
            <div style={{ position: 'absolute', top: 0, left: 0, width: fmt.width, height: fmt.height, transformOrigin: 'top left', transform: `scale(${scale})`, transition: 'transform 0.18s ease' }}>
              <div
                ref={canvasRef}
                onClick={e => { if (e.target === e.currentTarget) { setSelectedId(null); setEditingId(null) } }}
                style={{ position: 'relative', width: fmt.width, height: fmt.height, cursor: 'default', overflow: 'hidden', ...canvasBgStyle }}
              >
                {/* Overlay sobre imagen de fondo */}
                {bg.type === 'image' && bg.overlay && (() => {
                  const ov = bg.overlay
                  const ovType = ov.type || 'solid'
                  if (ovType === 'gradient') {
                    const c1 = hexToRgba(ov.color1 || '#000000', ov.opacity1 ?? 0.85)
                    const c2 = hexToRgba(ov.color2 || '#000000', ov.opacity2 ?? 0)
                    const grad = `linear-gradient(${ov.direction || 'to top'}, ${c1}, ${c2})`
                    const cov = `${ov.coverage ?? 60}%`
                    const dir = ov.direction || 'to top'
                    let s = { position: 'absolute', background: grad, pointerEvents: 'none', zIndex: 0 }
                    if (dir === 'to top') s = { ...s, bottom: 0, left: 0, right: 0, height: cov }
                    else if (dir === 'to bottom') s = { ...s, top: 0, left: 0, right: 0, height: cov }
                    else if (dir === 'to left') s = { ...s, top: 0, bottom: 0, right: 0, width: cov }
                    else if (dir === 'to right') s = { ...s, top: 0, bottom: 0, left: 0, width: cov }
                    else s = { ...s, inset: 0 }
                    return <div style={s} />
                  } else {
                    const color = hexToRgba(ov.color || '#000000', ov.opacity ?? 0.4)
                    return <div style={{ position: 'absolute', inset: 0, background: color, pointerEvents: 'none', zIndex: 0 }} />
                  }
                })()}
                {elements.map(el => (
                  <ElementRenderer key={el.id} el={el}
                    selected={el.id === selectedId}
                    editing={el.id === editingId}
                    onMouseDown={handleMouseDown}
                    onDoubleClick={handleDoubleClick}
                    scale={scale}
                    canvasWidth={fmt.width} />
                ))}
                {snapGuides.map((g, i) => (
                  g.type === 'v'
                    ? <div key={i} style={{ position: 'absolute', top: 0, left: g.pos, width: 1, height: fmt.height, background: '#00C8FF', opacity: 0.75, pointerEvents: 'none', zIndex: 50 }} />
                    : <div key={i} style={{ position: 'absolute', top: g.pos, left: 0, height: 1, width: fmt.width, background: '#00C8FF', opacity: 0.75, pointerEvents: 'none', zIndex: 50 }} />
                ))}
                {editingEl && (
                  <InlineEditor el={editingEl}
                    onDone={(val) => { updateEl(editingId, { content: val }); setEditingId(null) }} />
                )}
                {elements.length === 0 && (
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', gap: 12 }}>
                    <div style={{ fontSize: 40, opacity: 0.08 }}>✦</div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.12)', fontWeight: '600', marginBottom: 4 }}>Canvas vacío</div>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.07)' }}>Elegí un preset o generá con IA</div>
                    </div>
                  </div>
                )}
              </div>
            {/* ─── Selection Handles ─── sibling of canvasRef, outside overflow:hidden */}
            {selectedEl && !editingId && (() => {
              const el = selectedEl
              let elX = el.x || 0, elY = el.y || 0, elW, elH
              const domEl = canvasRef.current?.querySelector(`[data-el-id="${el.id}"]`)
              if (domEl && canvasRef.current) {
                const canvasRect = canvasRef.current.getBoundingClientRect()
                const elRect = domEl.getBoundingClientRect()
                elX = (elRect.left - canvasRect.left) / scale
                elY = (elRect.top - canvasRect.top) / scale
                elW = elRect.width / scale
                elH = elRect.height / scale
              } else {
                elW = el.type === 'text' ? (el.maxWidth || 300) : el.type === 'icon' ? (el.size || 64) : (Number(el.width) || 100)
                elH = el.type === 'icon' ? (el.size || 64) : (Number(el.height) || 100)
              }
              const hs = Math.max(6, 8 / scale)
              const rs = Math.max(5, 6 / scale)
              const bw = Math.max(0.5, 1 / scale)
              // Lock aspect: only show corner handles to prevent deformation
              const lockSides = el.lockAspect !== false && el.type === 'shape'
              const allHandles = [
                { id: 'TL', cx: elX,         cy: elY,         cursor: 'nw-resize' },
                { id: 'TC', cx: elX + elW/2, cy: elY,         cursor: 'n-resize'  },
                { id: 'TR', cx: elX + elW,   cy: elY,         cursor: 'ne-resize' },
                { id: 'ML', cx: elX,         cy: elY + elH/2, cursor: 'w-resize'  },
                { id: 'MR', cx: elX + elW,   cy: elY + elH/2, cursor: 'e-resize'  },
                { id: 'BL', cx: elX,         cy: elY + elH,   cursor: 'sw-resize' },
                { id: 'BC', cx: elX + elW/2, cy: elY + elH,   cursor: 's-resize'  },
                { id: 'BR', cx: elX + elW,   cy: elY + elH,   cursor: 'se-resize' },
              ]
              const handles = lockSides ? allHandles.filter(h => ['TL','TR','BL','BR'].includes(h.id)) : allHandles
              return (
                <>
                  <div style={{ position: 'absolute', left: elX, top: elY, width: elW, height: elH,
                    border: `${bw}px solid rgba(255,255,255,0.8)`, pointerEvents: 'none', zIndex: 200, boxSizing: 'border-box' }} />
                  <div style={{ position: 'absolute', left: elX + elW/2 - bw/2, top: elY - 20/scale,
                    width: bw, height: 20/scale, background: 'rgba(255,255,255,0.6)', pointerEvents: 'none', zIndex: 200 }} />
                  <div onMouseDown={e => startHandleDrag(e, el, 'rot')}
                    style={{ position: 'absolute', left: elX + elW/2 - rs, top: elY - 20/scale - rs*2,
                      width: rs*2, height: rs*2, borderRadius: '50%',
                      background: '#FFFFFF', border: `${bw}px solid rgba(0,0,0,0.35)`,
                      cursor: 'crosshair', zIndex: 201, boxSizing: 'border-box' }} />
                  {handles.map(h => (
                    <div key={h.id} onMouseDown={e => startHandleDrag(e, el, h.id)}
                      style={{ position: 'absolute', left: h.cx - hs/2, top: h.cy - hs/2,
                        width: hs, height: hs, background: '#FFFFFF',
                        border: `${bw}px solid rgba(0,0,0,0.35)`,
                        cursor: h.cursor, zIndex: 201, boxSizing: 'border-box' }} />
                  ))}
                </>
              )
            })()}
            </div>
            {showMockup && (
              <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'visible', zIndex: 10 }}>
                <MockupFrame platform={platform} formatKey={formatKey} scale={scale} />
              </div>
            )}
          </div>

            </div> {/* /inner centering wrapper */}
          </div> {/* /scroll container */}

          {/* ─── Floating zoom controls ─── */}
          <div style={{
            position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)',
            zIndex: 50, display: 'flex', alignItems: 'center', gap: 1,
            background: 'rgba(14,14,18,0.88)', backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 10, padding: '4px 6px',
            boxShadow: '0 2px 20px rgba(0,0,0,0.5)',
            pointerEvents: 'auto',
          }}>
            <button onClick={zoomOut} title="Zoom out (⌘−)"
              style={{ width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontSize: 16, borderRadius: 6, lineHeight: 1 }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>−</button>
            <span
              onClick={zoomFit}
              title="Ajustar al área (⌘0)"
              style={{ fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.75)', cursor: 'pointer', minWidth: 44, textAlign: 'center', userSelect: 'none', letterSpacing: '-0.01em' }}>
              {Math.round(zoomFactor * 100)}%
            </span>
            <button onClick={zoomIn} title="Zoom in (⌘+)"
              style={{ width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontSize: 16, borderRadius: 6, lineHeight: 1 }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>+</button>
          </div>

        </div> {/* /canvas area wrapper */}

        {/* Carousel strip */}
        {(() => {
          const thumbH = 60
          const thumbW = Math.round(thumbH * fmt.width / fmt.height)
          return (
            <div style={{ height: 88, flexShrink: 0, borderTop: `1px solid ${C.sidebarBorder}`, background: C.carouselBg, display: 'flex', alignItems: 'center', gap: 10, padding: '0 16px', overflowX: 'auto' }}>
              {slides.map((slide, i) => {
                const slideBgStyle = slide.bg.type === 'image'
                  ? { backgroundImage: `url(${slide.bg.value})`, backgroundSize: 'cover', backgroundPosition: 'center' }
                  : { background: slide.bg.value }
                const isActive = i === slideIdx
                return (
                  <div key={slide.id} style={{ position: 'relative', flexShrink: 0 }}>
                    <div onClick={() => switchSlide(i)}
                      style={{ width: thumbW, height: thumbH, borderRadius: 6, cursor: 'pointer', ...slideBgStyle,
                        border: `2px solid ${isActive ? C.text : 'transparent'}`,
                        boxShadow: isActive ? `0 0 0 1px ${C.text}, 0 2px 8px rgba(0,0,0,0.3)` : `0 0 0 1px ${C.inputBorder}`,
                        opacity: isActive ? 1 : 0.65, transition: 'all 150ms',
                        display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end',
                        overflow: 'hidden',
                      }}>
                      <span style={{ fontSize: 8, background: isActive ? C.accent : 'rgba(0,0,0,0.55)', color: '#fff', padding: '2px 5px', borderRadius: '4px 0 0 0', fontWeight: '700', letterSpacing: '0.02em' }}>{i + 1}</span>
                    </div>
                    {/* Duplicate button */}
                    <button onClick={e => { e.stopPropagation(); duplicateSlide(i) }} title="Duplicar slide"
                      style={{ position: 'absolute', top: -7, left: -7, width: 18, height: 18, borderRadius: '50%', background: C.accent, border: `2px solid ${C.carouselBg}`, color: '#fff', cursor: 'pointer', fontSize: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1, padding: 0 }}>
                      ⧉
                    </button>
                    {slides.length > 1 && (
                      <button onClick={() => deleteSlide(i)}
                        style={{ position: 'absolute', top: -7, right: -7, width: 16, height: 16, borderRadius: '50%', background: '#EF4444', border: `2px solid ${C.carouselBg}`, color: '#fff', cursor: 'pointer', fontSize: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1, padding: 0 }}>
                        ×
                      </button>
                    )}
                  </div>
                )
              })}
              {/* Add slide */}
              <button onClick={addSlide}
                style={{ width: thumbW, height: thumbH, borderRadius: 6, border: `2px dashed ${C.inputBorder}`, background: 'transparent', color: C.textMuted, cursor: 'pointer', fontSize: 22, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'border-color 150ms' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = C.inputBorder; e.currentTarget.style.color = C.textMuted }}>
                +
              </button>
            </div>
          )
        })()}
      </div>

      {/* ─── RIGHT SIDEBAR: Properties ─── */}
      <div style={{ width: 288, flexShrink: 0, borderLeft: `1px solid ${C.panelBorder}`, display: 'flex', flexDirection: 'column', background: C.panel }}>
        <div style={{ padding: '11px 14px 9px', borderBottom: `1px solid ${C.panelBorder}`, flexShrink: 0 }}>
          <span style={{ fontSize: 9, fontWeight: '700', letterSpacing: '0.1em', color: C.textMuted, textTransform: 'uppercase' }}>Propiedades</span>
        </div>
        <PropertiesPanel
          el={selectedEl} fmt={fmt} C={C}
          onUpdate={patch => selectedId && updateEl(selectedId, patch)}
          onDelete={() => selectedId && deleteEl(selectedId)}
          onDuplicate={() => selectedId && duplicateEl(selectedId)}
          onAlign={alignEl}
          onFitToCanvas={fitImageToCanvas}
          onMoveUp={() => selectedId && moveEl(selectedId, 1)}
          onMoveDown={() => selectedId && moveEl(selectedId, -1)}
        />
        {/* Layer list */}
        {elements.length > 0 && (
          <div style={{ borderTop: `1px solid ${C.panelBorder}`, padding: '8px 10px 10px', overflowY: 'auto', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <span className="q-sl" style={SL}>Capas</span>
              <span style={{ fontSize: 9, color: C.textFaint }}>{elements.length}</span>
            </div>
            {[...elements].reverse().map(el => {
              const isDragging = layerDragId === el.id
              const isOver = layerOverId === el.id && layerDragId !== el.id
              const isSelected = el.id === selectedId
              // Type icon
              const typeIcon = el.type === 'text' ? 'T' : el.type === 'image' ? '▣' : el.type === 'icon' ? '◈' : el.type === 'button' ? '⊡' : el.shape === 'circle' ? '●' : el.shape === 'triangle' ? '▲' : el.shape === 'line' ? '─' : '▬'
              const typeColor = isSelected ? C.text : C.textFaint
              // Label
              const label = el.type === 'text'
                ? (el.content?.split('\n')[0]?.slice(0, 18) || 'Texto')
                : el.type === 'image' ? 'Imagen'
                : el.type === 'icon' ? (el.name || 'Icono')
                : el.type === 'button' ? (el.content?.slice(0, 18) || 'Botón')
                : el.shape === 'gradient-overlay' ? 'Overlay'
                : el.shape ? el.shape.charAt(0).toUpperCase() + el.shape.slice(1)
                : 'Elemento'
              return (
                <div key={el.id}
                  draggable
                  className="q-layer-row"
                  onClick={() => setSelectedId(el.id)}
                  onDragStart={() => { setLayerDragId(el.id); setLayerOverId(null) }}
                  onDragEnd={() => { setLayerDragId(null); setLayerOverId(null) }}
                  onDragOver={e => { e.preventDefault(); setLayerOverId(el.id) }}
                  onDrop={e => {
                    e.preventDefault()
                    if (!layerDragId || layerDragId === el.id) return
                    setElements(prev => {
                      const arr = [...prev]
                      const fromIdx = arr.findIndex(x => x.id === layerDragId)
                      const toIdx = arr.findIndex(x => x.id === el.id)
                      if (fromIdx < 0 || toIdx < 0) return prev
                      const [item] = arr.splice(fromIdx, 1)
                      arr.splice(toIdx, 0, item)
                      return arr
                    })
                    setLayerDragId(null); setLayerOverId(null)
                  }}
                  style={{ padding: '5px 6px', borderRadius: 6, marginBottom: 1, cursor: 'grab', display: 'flex', alignItems: 'center', gap: 6,
                    background: isOver ? C.selected : isSelected ? C.selected : 'transparent',
                    border: `1px solid ${isOver ? C.selectedText : isSelected ? C.inputBorder : 'transparent'}`,
                    opacity: isDragging ? 0.35 : 1,
                    transition: 'opacity 100ms, background 100ms, border-color 100ms',
                  }}>
                  {/* Drag handle */}
                  <svg className="q-drag-handle" width="8" height="12" viewBox="0 0 8 12" fill={C.textFaint} style={{ flexShrink: 0, cursor: 'grab' }}>
                    <circle cx="2" cy="2" r="1.2"/><circle cx="6" cy="2" r="1.2"/>
                    <circle cx="2" cy="6" r="1.2"/><circle cx="6" cy="6" r="1.2"/>
                    <circle cx="2" cy="10" r="1.2"/><circle cx="6" cy="10" r="1.2"/>
                  </svg>
                  {/* Type indicator */}
                  <span style={{ fontSize: el.type === 'text' ? 11 : 10, fontWeight: el.type === 'text' ? '700' : '400', color: typeColor, flexShrink: 0, width: 12, textAlign: 'center', lineHeight: 1 }}>{typeIcon}</span>
                  {/* Label */}
                  <span style={{ fontSize: 11, color: isSelected ? C.text : C.textMuted, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: isSelected ? '500' : '400' }}>
                    {label}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      </div> {/* ─── end THREE-COLUMN LAYOUT ─── */}

      {/* ─── Modals ─── */}
      {showIconPicker && <IconPicker onSelect={addIconEl} onClose={() => setShowIconPicker(false)} C={C} />}

      {showProjects && (
        <ProjectsPanel
          userEmail={USER_EMAIL}
          onLoad={handleLoadProject}
          onClose={() => setShowProjects(false)}
          C={C}
        />
      )}

      {showSaveModal && (() => {
        const isSaveAs = saveMode === 'saveAs'
        // Collision: otro proyecto con mismo nombre, que no sea el actual ni el seleccionado para overwrite
        const nameCollision = !saveOverwriteTarget && projectName.trim() && saveProjectList.find(p =>
          p.name.trim().toLowerCase() === projectName.trim().toLowerCase() &&
          p.id !== currentProjectId
        )
        const canSubmit = projectName.trim() && !cloudSaving && !nameCollision
        const doSave = async () => {
          if (!canSubmit) return
          if (saveOverwriteTarget) {
            await handleSave(projectName, saveOverwriteTarget.id)
          } else if (isSaveAs) {
            await handleSave(projectName, null)
          } else {
            await handleSave(projectName)
          }
          setSaveOverwriteTarget(null)
        }
        const selectOverwrite = (p) => {
          setProjectName(p.name)
          setSaveOverwriteTarget(p)
        }
        const saveLabel = saveOverwriteTarget
          ? `Reemplazar "${saveOverwriteTarget.name.slice(0, 20)}${saveOverwriteTarget.name.length > 20 ? '…' : ''}"`
          : isSaveAs ? '↑ Guardar como nuevo' : '↑ Guardar'
        return (
          <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onClick={e => { if (e.target === e.currentTarget) { setShowSaveModal(false); setSaveOverwriteTarget(null) } }}>
            <div style={{ background: C.sidebar, border: `1px solid ${C.sidebarBorder}`, borderRadius: 16, width: 520, maxHeight: '82vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 60px rgba(0,0,0,0.5)', overflow: 'hidden' }}>

              {/* Header */}
              <div style={{ padding: '18px 20px 14px', borderBottom: `1px solid ${C.sidebarBorder}`, flexShrink: 0 }}>
                <div style={{ fontSize: 15, fontWeight: '700', color: C.text }}>
                  {isSaveAs ? 'Guardar como…' : 'Guardar proyecto'}
                </div>
                <div style={{ fontSize: 11, color: C.textMuted, marginTop: 3 }}>
                  {isSaveAs ? 'Elegí un nombre nuevo o seleccioná uno existente para reemplazarlo.' : 'Nombrá tu proyecto o seleccioná uno existente para reemplazarlo.'}
                </div>
              </div>

              {/* Project list */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '14px 20px', minHeight: 0 }}>
                {saveProjectList.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '24px 0', color: C.textFaint, fontSize: 12 }}>
                    Todavía no tenés proyectos guardados.
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                    {saveProjectList.map(p => {
                      const isSelected = saveOverwriteTarget?.id === p.id
                      return (
                        <div key={p.id} onClick={() => selectOverwrite(p)}
                          style={{ borderRadius: 9, border: `2px solid ${isSelected ? '#EF4444' : C.inputBorder}`, overflow: 'hidden', cursor: 'pointer', transition: 'all 140ms', background: isSelected ? 'rgba(239,68,68,0.06)' : 'transparent' }}
                          onMouseEnter={e => { if (!isSelected) e.currentTarget.style.borderColor = C.accent }}
                          onMouseLeave={e => { if (!isSelected) e.currentTarget.style.borderColor = C.inputBorder }}>
                          <div style={{ height: 80, background: C.input, overflow: 'hidden' }}>
                            {p.thumbnail
                              ? <img src={p.thumbnail} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: 22, opacity: 0.1 }}>🎨</div>
                            }
                          </div>
                          <div style={{ padding: '6px 8px', background: C.sidebar }}>
                            <div style={{ fontSize: 10, fontWeight: '700', color: isSelected ? '#F87171' : C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                            <div style={{ fontSize: 8, color: C.textFaint, marginTop: 1 }}>{p.platform?.toUpperCase()} · {p.format_key}</div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Footer: name input + actions */}
              <div style={{ padding: '14px 20px', borderTop: `1px solid ${C.sidebarBorder}`, flexShrink: 0 }}>
                {/* Overwrite warning */}
                {saveOverwriteTarget && (
                  <div style={{ padding: '8px 12px', background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 7, color: '#F87171', fontSize: 11, marginBottom: 10, lineHeight: 1.5 }}>
                    ⚠ Vas a sobreescribir <strong>"{saveOverwriteTarget.name}"</strong>. Esta acción no se puede deshacer.
                  </div>
                )}
                {/* Name collision warning */}
                {nameCollision && !saveOverwriteTarget && (
                  <div style={{ padding: '8px 12px', background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 7, color: '#F87171', fontSize: 11, marginBottom: 10, lineHeight: 1.5 }}>
                    Ya existe un proyecto con ese nombre. Elegí uno diferente o seleccioná el proyecto de la lista para reemplazarlo.
                  </div>
                )}

                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    value={projectName}
                    onChange={e => { setProjectName(e.target.value); setSaveOverwriteTarget(null) }}
                    onKeyDown={e => { if (e.key === 'Enter' && canSubmit) doSave() }}
                    placeholder="Nombre del proyecto…"
                    autoFocus
                    style={{ flex: 1, background: C.input, border: `1px solid ${nameCollision ? 'rgba(239,68,68,0.4)' : saveOverwriteTarget ? 'rgba(239,68,68,0.4)' : C.inputBorder}`, borderRadius: 8, padding: '9px 12px', color: C.text, fontSize: 12 }}
                  />
                  <button onClick={() => { setShowSaveModal(false); setSaveOverwriteTarget(null) }}
                    style={{ padding: '9px 14px', border: `1px solid ${C.inputBorder}`, borderRadius: 8, background: C.input, color: C.textMuted, cursor: 'pointer', fontSize: 11, flexShrink: 0 }}>
                    Cancelar
                  </button>
                  <button onClick={doSave} disabled={!canSubmit}
                    style={{ padding: '9px 16px', border: 'none', borderRadius: 8, background: !canSubmit ? C.input : (saveOverwriteTarget ? 'linear-gradient(135deg,#EF4444,#B91C1C)' : 'linear-gradient(135deg,#6430F7,#4318CC)'), color: !canSubmit ? C.textFaint : '#fff', cursor: !canSubmit ? 'default' : 'pointer', fontSize: 11, fontWeight: '700', flexShrink: 0 }}>
                    {cloudSaving ? 'Guardando…' : saveLabel}
                  </button>
                </div>

                {cloudError && (
                  <div style={{ marginTop: 8, padding: '7px 10px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 7, fontSize: 11, color: '#F87171' }}>⚠ {cloudError}</div>
                )}
              </div>
            </div>
          </div>
        )
      })()}

      {showImageAI && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={e => { if (e.target === e.currentTarget) setShowImageAI(false) }}>
          <div style={{ background: C.sidebar, border: `1px solid ${C.sidebarBorder}`, borderRadius: 16, padding: 28, width: 420, boxShadow: '0 24px 60px rgba(0,0,0,0.5)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: '700', color: C.text }}>✦ Generar imagen con IA</div>
                <div style={{ fontSize: 11, color: C.textMuted, marginTop: 3 }}>Se agrega como elemento al canvas — movible, redimensionable</div>
              </div>
              <button onClick={() => setShowImageAI(false)} style={{ background: 'transparent', border: 'none', color: C.textMuted, cursor: 'pointer', fontSize: 20, padding: 4 }}>×</button>
            </div>
            <textarea
              value={imageAIPrompt}
              onChange={e => setImageAIPrompt(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && e.metaKey) generateAIImageEl() }}
              placeholder={`Describí la imagen — producto fintech, persona usando app, gráfico abstracto, ciudad LatAm de noche, patrón geométrico púrpura...`}
              autoFocus
              style={{ width: '100%', background: C.input, border: `1px solid ${C.inputBorder}`, borderRadius: 10, padding: '12px', color: C.text, fontSize: 13, minHeight: 90, lineHeight: 1.55, resize: 'vertical' }}
            />
            <div style={{ fontSize: 10, color: C.textFaint, marginTop: 6, marginBottom: 14 }}>
              Tip: sé específico con el estilo visual — "fotografía editorial", "ilustración flat", "render 3D", "minimalista"
            </div>
            {imageAIError && (
              <div style={{ marginBottom: 12, padding: '8px 12px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: 8, fontSize: 11, color: '#F87171' }}>
                ⚠ {imageAIError}
              </div>
            )}
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowImageAI(false)}
                style={{ flex: 1, padding: '10px', border: `1px solid ${C.inputBorder}`, borderRadius: 8, background: C.input, color: C.textMuted, cursor: 'pointer', fontSize: 13 }}>
                Cancelar
              </button>
              <button onClick={generateAIImageEl} disabled={imageAILoading || !imageAIPrompt.trim()}
                style={{ flex: 2, padding: '10px', border: 'none', borderRadius: 8, background: imageAILoading ? C.input : 'linear-gradient(135deg,#6430F7,#4318CC)', color: imageAILoading ? C.textMuted : '#fff', cursor: imageAILoading ? 'default' : 'pointer', fontSize: 13, fontWeight: '600', opacity: !imageAIPrompt.trim() ? 0.5 : 1 }}>
                {imageAILoading ? '✦ Generando imagen...' : '✦ Generar y agregar al canvas'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Export Modal ─── */}
      {exportModal && (
        <div onClick={() => setExportModal(null)} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: C.sidebar, border: `1px solid ${C.sidebarBorder}`, borderRadius: 14, padding: '28px 28px 24px', width: 320, boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }}>
            <div style={{ fontSize: 14, fontWeight: '700', color: C.text, marginBottom: 6 }}>
              Exportar como {exportModal.toUpperCase()}
            </div>
            <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 22, lineHeight: 1.5 }}>
              Tenés {slides.length} slides. ¿Qué querés exportar?
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button
                onClick={() => { setExportModal(null); handleExport(exportModal) }}
                style={{ padding: '11px 14px', borderRadius: 8, border: `1px solid ${C.inputBorder}`, background: C.input, color: C.text, cursor: 'pointer', fontSize: 13, textAlign: 'left', fontWeight: '500' }}
                onMouseEnter={e => e.currentTarget.style.borderColor = C.accent}
                onMouseLeave={e => e.currentTarget.style.borderColor = C.inputBorder}>
                ↓ Este slide — slide {slideIdx + 1}
              </button>
              <button
                onClick={() => handleExportAll(exportModal)}
                style={{ padding: '11px 14px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg,#6430F7,#4318CC)', color: '#fff', cursor: 'pointer', fontSize: 13, textAlign: 'left', fontWeight: '600' }}
                onMouseEnter={e => e.currentTarget.style.opacity = '0.9'}
                onMouseLeave={e => e.currentTarget.style.opacity = '1'}>
                ↓ Todos los slides ({slides.length}) — ZIP
              </button>
            </div>
            <button onClick={() => setExportModal(null)}
              style={{ marginTop: 16, width: '100%', padding: '8px', borderRadius: 7, border: `1px solid ${C.inputBorder}`, background: 'transparent', color: C.textFaint, cursor: 'pointer', fontSize: 11 }}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {showNewModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: C.sidebar, border: `1px solid ${C.sidebarBorder}`, borderRadius: 14, padding: 28, width: 340, textAlign: 'center', boxShadow: '0 20px 50px rgba(0,0,0,0.4)' }}>
            <div style={{ fontSize: 28, marginBottom: 10 }}>⚠</div>
            <div style={{ fontSize: 15, fontWeight: '700', color: C.text, marginBottom: 8 }}>¿Empezar un nuevo proyecto?</div>
            <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 24, lineHeight: 1.5 }}>
              Vas a perder el trabajo actual si no lo exportaste. Esta acción no se puede deshacer.
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowNewModal(false)}
                style={{ flex: 1, padding: '10px', border: `1px solid ${C.inputBorder}`, borderRadius: 8, background: C.input, color: C.textMuted, cursor: 'pointer', fontSize: 13 }}>
                Cancelar
              </button>
              <button onClick={resetProject}
                style={{ flex: 1, padding: '10px', border: 'none', borderRadius: 8, background: 'linear-gradient(135deg,#6430F7,#4318CC)', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: '600' }}>
                Nuevo proyecto
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
