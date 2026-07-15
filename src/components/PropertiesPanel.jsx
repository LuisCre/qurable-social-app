import { useState, useEffect, useRef } from 'react'
import { fetchIcon } from './IconPicker.jsx'

// ── Slider con local state (evita cortes en drag) ─────────────────────────────
function SliderField({ value, onChange, min, max, step = 1, C }) {
  const [local, setLocal] = useState(value ?? min)
  const dragging = useRef(false)
  useEffect(() => { if (!dragging.current) setLocal(value ?? min) }, [value])
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', minWidth: 0 }}>
      <input type="range" min={min} max={max} step={step} value={local}
        onPointerDown={() => { dragging.current = true }}
        onPointerUp={() => { dragging.current = false }}
        onChange={e => { setLocal(Number(e.target.value)); onChange(Number(e.target.value)) }}
        style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} />
      <input type="number" step={step}
        value={step < 1 ? Number(local ?? 0).toFixed(2) : Math.round(Number(local ?? 0))}
        onChange={e => { const v = Number(e.target.value); setLocal(v); onChange(v) }}
        style={{ width: 40, background: C?.input, border: `1px solid ${C?.inputBorder}`, borderRadius: 5, padding: '4px 5px', color: C?.text, fontSize: 10, textAlign: 'center' }} />
    </div>
  )
}

// ── Utilities ─────────────────────────────────────────────────────────────────
const fileToDataURL = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.readAsDataURL(file)
  reader.onload = () => resolve(reader.result)
  reader.onerror = reject
})

const hexToRgba = (hex, opacity) => {
  if (!hex || hex === 'transparent') return `rgba(0,0,0,0)`
  if (hex.startsWith('rgba') || hex.startsWith('rgb')) return hex
  const h = hex.replace('#', '').padEnd(6, '0')
  const r = parseInt(h.substring(0, 2), 16) || 0
  const g = parseInt(h.substring(2, 4), 16) || 0
  const b = parseInt(h.substring(4, 6), 16) || 0
  return `rgba(${r},${g},${b},${opacity ?? 1})`
}

// Parsea cualquier color CSS → { hex, opacity }
const parseColor = (str) => {
  if (!str) return { hex: '#000000', opacity: 1 }
  if (str === 'transparent') return { hex: '#000000', opacity: 0 }
  const t = str.trim()
  if (t.startsWith('#')) return { hex: t.slice(0, 7), opacity: 1 }
  const m = t.match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s]+([\d.]+))?\s*\)/)
  if (m) {
    const r = parseInt(m[1]).toString(16).padStart(2, '0')
    const g = parseInt(m[2]).toString(16).padStart(2, '0')
    const b = parseInt(m[3]).toString(16).padStart(2, '0')
    return { hex: `#${r}${g}${b}`, opacity: m[4] !== undefined ? parseFloat(m[4]) : 1 }
  }
  return { hex: '#6430F7', opacity: 1 }
}

// Parsea linear-gradient CSS → { angle, stops: [{hex, opacity}] }
// Robusto: maneja rgba() con comas internas correctamente
const parseGradient = (css) => {
  const dflt = { angle: 135, stops: [{ hex: '#6430F7', opacity: 1 }, { hex: '#4318CC', opacity: 1 }] }
  if (!css?.includes('gradient')) return dflt
  const angleM = css.match(/linear-gradient\(\s*(\d+)deg,/)
  if (!angleM) return dflt
  const angle = parseInt(angleM[1])
  const rest = css.slice(css.indexOf(angleM[0]) + angleM[0].length)
  const rParen = rest.lastIndexOf(')')
  const inner = rest.slice(0, rParen)
  // Split by top-level comma (no dentro de paréntesis)
  const parts = []
  let depth = 0, start = 0
  for (let i = 0; i < inner.length; i++) {
    if (inner[i] === '(') depth++
    else if (inner[i] === ')') depth--
    else if (inner[i] === ',' && depth === 0) { parts.push(inner.slice(start, i).trim()); start = i + 1 }
  }
  parts.push(inner.slice(start).trim())
  if (parts.length < 2) return dflt
  // Cada parte puede tener un porcentaje al final (ej. "#6430F7 0%"), descartarlo
  const cleanPart = (p) => p.replace(/\s+\d+%$/, '').trim()
  return { angle, stops: [parseColor(cleanPart(parts[0])), parseColor(cleanPart(parts[1]))] }
}

// Construye CSS string desde el estado de gradiente { angle, stops }
const buildGradCSS = (g) =>
  `linear-gradient(${g.angle}deg, ${hexToRgba(g.stops[0].hex, g.stops[0].opacity)}, ${hexToRgba(g.stops[1].hex, g.stops[1].opacity)})`

// ── Presets de gradiente ──────────────────────────────────────────────────────
const GRAD_PRESETS = [
  { name: 'Violeta',   angle: 135, stops: [{ hex: '#6430F7', opacity: 1 }, { hex: '#4318CC', opacity: 1 }] },
  { name: 'Dark',      angle: 135, stops: [{ hex: '#0F172A', opacity: 1 }, { hex: '#1E293B', opacity: 1 }] },
  { name: 'Midnight',  angle: 145, stops: [{ hex: '#0A0A18', opacity: 1 }, { hex: '#6430F7', opacity: 1 }] },
  { name: 'Sky',       angle: 135, stops: [{ hex: '#0EA5E9', opacity: 1 }, { hex: '#6366F1', opacity: 1 }] },
  { name: 'Rosa',      angle: 135, stops: [{ hex: '#EC4899', opacity: 1 }, { hex: '#8B5CF6', opacity: 1 }] },
  { name: 'Sunset',    angle: 135, stops: [{ hex: '#F97316', opacity: 1 }, { hex: '#EC4899', opacity: 1 }] },
  { name: '↑ Negro',   angle: 0,   stops: [{ hex: '#000000', opacity: 1 }, { hex: '#000000', opacity: 0 }] },
  { name: '↑ Violeta', angle: 0,   stops: [{ hex: '#4318CC', opacity: 1 }, { hex: '#4318CC', opacity: 0 }] },
]

// ── GradientEditor ────────────────────────────────────────────────────────────
// Componente independiente para evitar problemas de closure.
// grad: { angle, stops: [{hex, opacity}] }  |  apply: (newGrad) => void
function GradientEditor({ grad, apply, C }) {
  const css = buildGradCSS(grad)
  const upStop = (i, patch) => {
    const stops = grad.stops.map((s, si) => si === i ? { ...s, ...patch } : s)
    apply({ ...grad, stops })
  }
  return (
    <div>
      {/* Barra de preview */}
      <div style={{ height: 24, borderRadius: 6, background: css, marginBottom: 10, border: `1px solid ${C.inputBorder}` }} />
      {/* Stops */}
      {grad.stops.map((stop, i) => (
        <div key={i} style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 8, color: C.textFaint, marginBottom: 3, fontWeight: '700', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Stop {i === 0 ? '0%' : '100%'}
          </div>
          <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
            <input type="color" value={stop.hex}
              onChange={e => upStop(i, { hex: e.target.value })}
              style={{ width: 28, height: 28, border: `1px solid ${C.inputBorder}`, borderRadius: 5, padding: 1, cursor: 'pointer', background: C.input, flexShrink: 0 }} />
            <input type="text" value={stop.hex}
              onChange={e => upStop(i, { hex: e.target.value })}
              style={{ flex: 1, background: C.input, border: `1px solid ${C.inputBorder}`, borderRadius: 5, padding: '4px 6px', color: C.text, fontSize: 10, fontFamily: 'monospace', minWidth: 0 }} />
            <input type="number" min={0} max={100}
              value={Math.round(stop.opacity * 100)}
              onChange={e => upStop(i, { opacity: Math.min(1, Math.max(0, Number(e.target.value) / 100)) })}
              style={{ width: 36, background: C.input, border: `1px solid ${C.inputBorder}`, borderRadius: 5, padding: '4px 4px', color: C.text, fontSize: 10, textAlign: 'center', flexShrink: 0 }} />
            <span style={{ fontSize: 9, color: C.textFaint, flexShrink: 0 }}>%</span>
          </div>
        </div>
      ))}
      {/* Ángulo */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
          <div style={{ fontSize: 9, color: C.textFaint }}>Ángulo</div>
          <div style={{ fontSize: 9, color: C.textMuted, fontWeight: '600' }}>{grad.angle}°</div>
        </div>
        <input type="range" min={0} max={360} value={grad.angle}
          onChange={e => apply({ ...grad, angle: Number(e.target.value) })}
          style={{ width: '100%', accentColor: C.text }} />
      </div>
      {/* Presets */}
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {GRAD_PRESETS.map((p) => {
          const previewCss = buildGradCSS(p)
          return (
            <button key={p.name} onClick={() => apply(p)}
              style={{ padding: '3px 8px', fontSize: 9, borderRadius: 5, border: `1px solid ${C.inputBorder}`, background: previewCss, color: '#fff', cursor: 'pointer', fontWeight: '600', textShadow: '0 1px 2px rgba(0,0,0,0.7)' }}>
              {p.name}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── PropertiesPanel ───────────────────────────────────────────────────────────
export default function PropertiesPanel({ el, fmt, onUpdate, onDelete, onDuplicate, onAlign, onFitToCanvas, onMoveUp, onMoveDown, C }) {
  const [gradEdit, setGradEdit] = useState(() => parseGradient(el?.color))
  const [showGradEditor, setShowGradEditor] = useState(() => !!el?.color?.includes('gradient'))
  const [btnGradEdit, setBtnGradEdit] = useState(() => parseGradient(el?.btnBg || 'linear-gradient(135deg,#6430F7,#4318CC)'))
  const [showBtnGradEditor, setShowBtnGradEditor] = useState(() => !!el?.btnBg?.includes('gradient'))
  const [collapsed, setCollapsed] = useState({})

  useEffect(() => {
    if (el) {
      setGradEdit(parseGradient(el.color))
      setShowGradEditor(!!el.color?.includes('gradient'))
      setBtnGradEdit(parseGradient(el.btnBg || 'linear-gradient(135deg,#6430F7,#4318CC)'))
      setShowBtnGradEditor(!!el.btnBg?.includes('gradient'))
    }
  }, [el?.id])

  if (!el) return (
    <div style={{ padding: '40px 14px', textAlign: 'center' }}>
      <div style={{ fontSize: 32, opacity: 0.08, marginBottom: 8 }}>↖</div>
      <div style={{ fontSize: 11, color: C.textFaint }}>Seleccioná un elemento</div>
    </div>
  )

  // ── UI primitivos ──────────────────────────────────────────────────────────

  // Encabezado de sección — divider + label uppercase + collapsible
  const SH = (title, key) => {
    const isCollapsed = !!collapsed[key]
    return (
      <div
        onClick={() => key && setCollapsed(p => ({ ...p, [key]: !p[key] }))}
        style={{
          borderTop: `1px solid ${C.inputBorder}`,
          paddingTop: 10, paddingBottom: 6, marginTop: 6,
          marginBottom: isCollapsed ? 0 : 8,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          cursor: key ? 'pointer' : 'default',
          userSelect: 'none',
        }}>
        <span style={{ fontSize: 9, fontWeight: '700', letterSpacing: '0.1em', textTransform: 'uppercase', color: C.text }}>{title}</span>
        {key && <span style={{ fontSize: 9, color: C.textFaint, lineHeight: 1 }}>{isCollapsed ? '▸' : '▾'}</span>}
      </div>
    )
  }

  const label = (t) => (
    <div style={{ fontSize: 9, fontWeight: '700', letterSpacing: '0.08em', color: C.textFaint, textTransform: 'uppercase', marginBottom: 4 }}>{t}</div>
  )

  const row = (lbl, ch) => <div style={{ marginBottom: 10 }}>{label(lbl)}{ch}</div>

  const numIn = (val, fn, { min, max } = {}) => (
    <input type="number" value={Math.round(Number(val) || 0)} min={min} max={max}
      onChange={e => fn(Number(e.target.value))}
      style={{ width: '100%', background: C.input, border: `1px solid ${C.inputBorder}`, borderRadius: 5, padding: '5px 7px', color: C.text, fontSize: 11,
        MozAppearance: 'textfield', WebkitAppearance: 'none' }} />
  )

  const strIn = (val, fn) => (
    <input type="text" value={val || ''} onChange={e => fn(e.target.value)}
      style={{ width: '100%', background: C.input, border: `1px solid ${C.inputBorder}`, borderRadius: 5, padding: '5px 7px', color: C.text, fontSize: 11, fontFamily: 'monospace' }} />
  )

  const slide = (val, fn, min, max, step = 1) => (
    <SliderField value={val} onChange={fn} min={min} max={max} step={step} C={C} />
  )

  const colorRow = (val, fn) => (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      <input type="color"
        value={(!val || val.startsWith('rgba') || val.includes('gradient')) ? '#6430F7' : val}
        onChange={e => fn(e.target.value)}
        style={{ width: 28, height: 28, border: `1px solid ${C.inputBorder}`, borderRadius: 5, padding: 1, cursor: 'pointer', background: C.input, flexShrink: 0 }} />
      <input type="text" value={val || ''} onChange={e => fn(e.target.value)}
        style={{ flex: 1, background: C.input, border: `1px solid ${C.inputBorder}`, borderRadius: 5, padding: '5px 6px', color: C.text, fontSize: 10, fontFamily: 'monospace' }} />
    </div>
  )

  // Color swatch + hex sin '#' + opacity%
  const colorOpacityRow = (hex, opacity, onHex, onOpacity) => (
    <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
      <input type="color" value={hex || '#000000'} onChange={e => onHex(e.target.value)}
        style={{ width: 28, height: 28, border: `1px solid ${C.inputBorder}`, borderRadius: 5, padding: 1, cursor: 'pointer', background: C.input, flexShrink: 0 }} />
      <input type="text" value={(hex || '#000000').replace('#', '')} onChange={e => onHex('#' + e.target.value.replace('#', ''))}
        style={{ flex: 1, background: C.input, border: `1px solid ${C.inputBorder}`, borderRadius: 5, padding: '5px 6px', color: C.text, fontSize: 10, fontFamily: 'monospace', minWidth: 0 }} />
      <input type="number" min={0} max={100} value={Math.round((opacity ?? 1) * 100)}
        onChange={e => onOpacity(Math.min(1, Math.max(0, Number(e.target.value) / 100)))}
        style={{ width: 36, background: C.input, border: `1px solid ${C.inputBorder}`, borderRadius: 5, padding: '5px 4px', color: C.text, fontSize: 10, textAlign: 'center', flexShrink: 0 }} />
      <span style={{ fontSize: 9, color: C.textFaint, flexShrink: 0 }}>%</span>
    </div>
  )

  const toggleChip = (active, onClick, labels) => (
    <button onClick={onClick}
      style={{ fontSize: 9, padding: '3px 9px', borderRadius: 5, border: '1px solid', fontWeight: '600', cursor: 'pointer',
        borderColor: active ? C.selectedText : C.inputBorder,
        background: active ? C.selected : C.input,
        color: active ? C.selectedText : C.textMuted }}>
      {active ? labels[1] : labels[0]}
    </button>
  )

  const iconBtn = (title, onClick, active, content) => (
    <button title={title} onClick={onClick}
      style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 5, border: '1px solid', cursor: 'pointer', flexShrink: 0, fontSize: 14,
        borderColor: active ? C.selectedText : C.inputBorder,
        background: active ? C.selected : C.input,
        color: active ? C.selectedText : C.textMuted }}>
      {content}
    </button>
  )

  const alignBtn = (icon, type, tip) => (
    <button title={tip} onClick={() => onAlign(type)}
      style={{ flex: 1, height: 28, background: C.input, border: `1px solid ${C.inputBorder}`, borderRadius: 5, color: C.textMuted, cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {icon}
    </button>
  )

  const typeToggle = (values, current, onChange) => (
    <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
      {values.map(([lbl, val]) => (
        <button key={val} onClick={() => onChange(val)}
          style={{ flex: 1, padding: '5px 0', borderRadius: 5, border: '1px solid', cursor: 'pointer', fontSize: 10, fontWeight: '600',
            borderColor: current === val ? C.selectedText : C.inputBorder,
            background: current === val ? C.selected : C.input,
            color: current === val ? C.selectedText : C.textMuted }}>
          {lbl}
        </button>
      ))}
    </div>
  )

  // ── Color + Gradiente toggle ───────────────────────────────────────────────
  const colorGradSection = (solidDefault = '#FFFFFF') => {
    const isGrad = el.color?.includes('gradient')
    return (
      <div style={{ marginBottom: 10 }}>
        {label('Color')}
        {typeToggle(
          [['Sólido', 'solid'], ['Gradiente', 'grad']],
          showGradEditor ? 'grad' : 'solid',
          (v) => {
            const toGrad = v === 'grad'
            setShowGradEditor(toGrad)
            if (toGrad && !isGrad) onUpdate({ color: buildGradCSS(gradEdit) })
            if (!toGrad && isGrad) onUpdate({ color: solidDefault })
          }
        )}
        {showGradEditor
          ? <GradientEditor grad={gradEdit} apply={(g) => { setGradEdit(g); onUpdate({ color: buildGradCSS(g) }) }} C={C} />
          : colorRow(isGrad ? solidDefault : (el.color || solidDefault), v => onUpdate({ color: v }))}
      </div>
    )
  }

  // ── Fondo del botón ───────────────────────────────────────────────────────
  const btnBgSection = () => {
    const isBgGrad = el.btnBg?.includes('gradient')
    return (
      <div style={{ marginBottom: 10 }}>
        {label('Fondo')}
        {typeToggle(
          [['Sólido', 'solid'], ['Gradiente', 'grad']],
          showBtnGradEditor ? 'grad' : 'solid',
          (v) => {
            const toGrad = v === 'grad'
            setShowBtnGradEditor(toGrad)
            if (toGrad && !isBgGrad) onUpdate({ btnBg: buildGradCSS(btnGradEdit) })
            if (!toGrad && isBgGrad) onUpdate({ btnBg: '#6430F7' })
          }
        )}
        {showBtnGradEditor
          ? <GradientEditor grad={btnGradEdit} apply={(g) => { setBtnGradEdit(g); onUpdate({ btnBg: buildGradCSS(g) }) }} C={C} />
          : colorRow(isBgGrad ? '#6430F7' : (el.btnBg || '#6430F7'), v => onUpdate({ btnBg: v }))}
      </div>
    )
  }

  // ── Trazo ─────────────────────────────────────────────────────────────────
  const strokeSection = () => {
    const str = el.stroke
    const hasStroke = (str?.width ?? 0) > 0
    return (
      <>
        {SH('Trazo', 'stroke')}
        {!collapsed['stroke'] && (<>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: hasStroke ? 10 : 0 }}>
            <div style={{ fontSize: 10, color: C.textMuted }}>{hasStroke ? `${str.width}px` : '—'}</div>
            {toggleChip(hasStroke, () => onUpdate({ stroke: hasStroke ? { width: 0, color: str?.color || '#FFFFFF' } : { width: 2, color: '#FFFFFF' } }), ['+ Agregar', 'Activo'])}
          </div>
          {hasStroke && <>
            {row('Grosor', slide(str.width, v => onUpdate({ stroke: { ...str, width: v } }), 1, 40))}
            {row('Color', colorRow(str.color || '#FFFFFF', v => onUpdate({ stroke: { ...str, color: v } })))}
          </>}
        </>)}
      </>
    )
  }

  // ── Sombra ────────────────────────────────────────────────────────────────
  const shadowSection = () => {
    const ds = el.shadow
    const hasShadow = !!ds
    return (
      <>
        {SH('Sombra', 'shadow')}
        {!collapsed['shadow'] && (<>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: hasShadow ? 10 : 0 }}>
            {hasShadow ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
                <div style={{ width: 14, height: 14, borderRadius: 3, background: ds.color || '#000', opacity: ds.opacity ?? 0.5, border: `1px solid ${C.inputBorder}`, flexShrink: 0 }} />
                <div style={{ fontSize: 10, color: C.textMuted }}>{ds.x || 0} {ds.y || 0} {ds.blur || 0}px</div>
              </div>
            ) : <div style={{ flex: 1 }} />}
            {toggleChip(hasShadow, () => onUpdate({ shadow: hasShadow ? null : { x: 4, y: 8, blur: 16, spread: 0, color: '#000000', opacity: 0.5 } }), ['+ Agregar', 'Activo'])}
          </div>
          {hasShadow && <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 10 }}>
              <div><div style={{ fontSize: 9, color: C.textFaint, marginBottom: 3 }}>X</div>{numIn(ds.x ?? 4, v => onUpdate({ shadow: { ...ds, x: v } }), { min: -100, max: 100 })}</div>
              <div><div style={{ fontSize: 9, color: C.textFaint, marginBottom: 3 }}>Y</div>{numIn(ds.y ?? 8, v => onUpdate({ shadow: { ...ds, y: v } }), { min: -100, max: 100 })}</div>
            </div>
            {row('Blur', slide(ds.blur ?? 16, v => onUpdate({ shadow: { ...ds, blur: v } }), 0, 80))}
            {(el.type === 'shape' || el.type === 'button') && el.shape !== 'triangle' &&
              row('Spread', slide(ds.spread ?? 0, v => onUpdate({ shadow: { ...ds, spread: v } }), -20, 40))}
            {row('Color + opacidad',
              colorOpacityRow(
                ds.color || '#000000', ds.opacity ?? 0.5,
                v => onUpdate({ shadow: { ...ds, color: v } }),
                v => onUpdate({ shadow: { ...ds, opacity: v } })
              )
            )}
          </>}
        </>)}
      </>
    )
  }

  const isText   = el.type === 'text'
  const isImage  = el.type === 'image'
  const isShape  = el.type === 'shape' && el.shape !== 'gradient-overlay'
  const isIcon   = el.type === 'icon'
  const isButton = el.type === 'button'

  const typeLabel = isText ? 'T Texto' : isImage ? '▣ Imagen' : isIcon ? '◈ Icono' : isButton ? '⊡ Botón' : '◼ Forma'

  return (
    <div style={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div style={{ padding: '9px 14px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 9, fontWeight: '700', color: C.textMuted, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{typeLabel}</span>
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={onDuplicate} title="Duplicar (⌘D)"
            style={{ padding: '3px 8px', background: C.input, border: `1px solid ${C.inputBorder}`, borderRadius: 5, color: C.textMuted, cursor: 'pointer', fontSize: 10 }}>⊕</button>
          <button onClick={onDelete}
            style={{ padding: '3px 8px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: 5, color: '#F87171', cursor: 'pointer', fontSize: 10 }}>×</button>
        </div>
      </div>

      <div style={{ padding: '0 14px 20px' }}>

        {/* ── POSICIÓN ──────────────────────────────────────────────────────── */}
        {SH('Posición', 'pos')}

        {!collapsed['pos'] && (<>
          {/* X / Y */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 9, color: C.textFaint, marginBottom: 3 }}>X</div>
              {numIn(el.x, v => onUpdate({ x: v }))}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 9, color: C.textFaint, marginBottom: 3 }}>Y</div>
              {numIn(el.y, v => onUpdate({ y: v }))}
            </div>
          </div>

          {/* Rotación + Flip */}
          <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', marginBottom: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 9, color: C.textFaint, marginBottom: 3 }}>Rotación</div>
              <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                <input type="number" min={-360} max={360} value={Math.round(el.rotation || 0)}
                  onChange={e => onUpdate({ rotation: Number(e.target.value) })}
                  style={{ flex: 1, background: C.input, border: `1px solid ${C.inputBorder}`, borderRadius: 5, padding: '5px 7px', color: C.text, fontSize: 11 }} />
                <span style={{ fontSize: 9, color: C.textFaint }}>°</span>
              </div>
            </div>
            <div>
              <div style={{ fontSize: 9, color: C.textFaint, marginBottom: 3 }}>Flip</div>
              <div style={{ display: 'flex', gap: 4 }}>
                {iconBtn('Reflejar horizontal (↔)', () => onUpdate({ flipH: !el.flipH }), !!el.flipH, '↔')}
                {iconBtn('Reflejar vertical (↕)', () => onUpdate({ flipV: !el.flipV }), !!el.flipV, '↕')}
              </div>
            </div>
          </div>

          {/* Alineación */}
          <div style={{ marginBottom: 8 }}>
            {label('Alinear al canvas')}
            <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
              {alignBtn('⟵', 'left', 'Izquierda')}
              {alignBtn('⊥', 'centerH', 'Centro horizontal')}
              {alignBtn('⟶', 'right', 'Derecha')}
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              {alignBtn('↑', 'top', 'Arriba')}
              {alignBtn('↔', 'centerV', 'Centro vertical')}
              {alignBtn('↓', 'bottom', 'Abajo')}
            </div>
          </div>
        </>)}

        {/* ── TEXTO ─────────────────────────────────────────────────────────── */}
        {isText && (<>
          {SH('Texto', 'content')}
          {!collapsed['content'] && (<>
            {row('Contenido', (
              <textarea value={el.content} onChange={e => onUpdate({ content: e.target.value })}
                style={{ width: '100%', background: C.input, border: `1px solid ${C.inputBorder}`, borderRadius: 5, padding: '7px 8px', color: C.text, fontSize: 12, minHeight: 56, lineHeight: 1.5, resize: 'none', fontFamily: 'inherit' }} />
            ))}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, marginBottom: 10 }}>
              <div style={{ minWidth: 0 }}>
                {label('Tamaño')}
                {slide(el.fontSize || 48, v => onUpdate({ fontSize: v }), 8, 300)}
              </div>
              <div>
                {label('Peso')}
                <div style={{ display: 'flex', gap: 3 }}>
                  {[['R', '400'], ['M', '500'], ['B', '700']].map(([l, v]) => (
                    <button key={v} onClick={() => onUpdate({ fontWeight: v })}
                      style={{ width: 26, height: 26, borderRadius: 5, border: '1px solid', cursor: 'pointer', fontSize: 10, fontWeight: v,
                        borderColor: el.fontWeight === v ? C.selectedText : C.inputBorder,
                        background: el.fontWeight === v ? C.selected : C.input,
                        color: el.fontWeight === v ? C.selectedText : C.textMuted }}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            {colorGradSection('#FFFFFF')}
            <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
              {[
                ['left', <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="2" width="1.5" height="10" rx="0.75" fill="currentColor"/><rect x="3.5" y="3.5" width="9" height="1.5" rx="0.75" fill="currentColor"/><rect x="3.5" y="6.25" width="6" height="1.5" rx="0.75" fill="currentColor"/><rect x="3.5" y="9" width="7.5" height="1.5" rx="0.75" fill="currentColor"/></svg>],
                ['center', <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="6.25" y="2" width="1.5" height="10" rx="0.75" fill="currentColor"/><rect x="1.5" y="3.5" width="11" height="1.5" rx="0.75" fill="currentColor"/><rect x="3.5" y="6.25" width="7" height="1.5" rx="0.75" fill="currentColor"/><rect x="2.5" y="9" width="9" height="1.5" rx="0.75" fill="currentColor"/></svg>],
                ['right', <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="11.5" y="2" width="1.5" height="10" rx="0.75" fill="currentColor"/><rect x="1.5" y="3.5" width="9" height="1.5" rx="0.75" fill="currentColor"/><rect x="4.5" y="6.25" width="6" height="1.5" rx="0.75" fill="currentColor"/><rect x="3" y="9" width="7.5" height="1.5" rx="0.75" fill="currentColor"/></svg>],
              ].map(([val, icon]) => (
                <button key={val} onClick={() => onUpdate({ textAlign: val })}
                  style={{ flex: 1, padding: '5px 0', borderRadius: 5, border: '1px solid', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    borderColor: (el.textAlign || 'left') === val ? C.selectedText : C.inputBorder,
                    background: (el.textAlign || 'left') === val ? C.selected : C.input,
                    color: (el.textAlign || 'left') === val ? C.selectedText : C.textMuted }}>
                  {icon}
                </button>
              ))}
            </div>
            {row('Espaciado letras', slide(parseFloat(el.letterSpacing) || 0, v => onUpdate({ letterSpacing: `${v}em` }), -0.05, 0.5, 0.005))}
            {row('Interlineado', slide(el.lineHeight || 1.2, v => onUpdate({ lineHeight: v }), 0.7, 2.5, 0.05))}
            {row('Ancho máx', slide(el.maxWidth || fmt.width, v => onUpdate({ maxWidth: v }), 100, fmt.width, 10))}
            {row('Border radius', slide(el.borderRadius || 0, v => onUpdate({ borderRadius: v }), 0, 60))}
            {strokeSection()}
            {shadowSection()}
          </>)}
        </>)}

        {/* ── IMAGEN ────────────────────────────────────────────────────────── */}
        {isImage && (<>
          {SH('Imagen', 'content')}
          {!collapsed['content'] && (<>
            {row('Opacidad', slide(el.opacity ?? 1, v => onUpdate({ opacity: v }), 0, 1, 0.01))}

            {/* W + H inputs */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
              <div style={{ minWidth: 0 }}>
                {label('W')}
                <input type="number" min={1}
                  value={el.width === 'auto' ? (el.naturalW || 200) : Math.round(Number(el.width) || 200)}
                  onChange={e => {
                    const w = Math.max(1, Number(e.target.value))
                    if (el.lockAspect !== false && el.naturalW && el.naturalH) {
                      const h = Math.round(w * el.naturalH / el.naturalW)
                      onUpdate({ width: w, height: h })
                    } else {
                      onUpdate({ width: w })
                    }
                  }}
                  style={{ width: '100%', background: C.input, border: `1px solid ${C.inputBorder}`, borderRadius: 5, padding: '5px 7px', color: C.text, fontSize: 11, MozAppearance: 'textfield' }} />
              </div>
              <div style={{ minWidth: 0 }}>
                {label('H')}
                <input type="number" min={1}
                  value={el.height === 'auto' ? (el.naturalH || 200) : Math.round(Number(el.height) || 200)}
                  onChange={e => {
                    const h = Math.max(1, Number(e.target.value))
                    if (el.lockAspect !== false && el.naturalW && el.naturalH) {
                      const w = Math.round(h * el.naturalW / el.naturalH)
                      onUpdate({ height: h, width: w })
                    } else {
                      onUpdate({ height: h })
                    }
                  }}
                  style={{ width: '100%', background: C.input, border: `1px solid ${C.inputBorder}`, borderRadius: 5, padding: '5px 7px', color: C.text, fontSize: 11, MozAppearance: 'textfield' }} />
              </div>
            </div>

            {/* Mantener proporción toggle */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <div onClick={() => onUpdate({ lockAspect: el.lockAspect === false ? true : false })}
                style={{ width: 32, height: 18, borderRadius: 9, background: el.lockAspect !== false ? C.text : C.inputBorder, cursor: 'pointer', position: 'relative', transition: 'background 150ms', flexShrink: 0 }}>
                <div style={{ position: 'absolute', top: 2, left: el.lockAspect !== false ? 16 : 2, width: 14, height: 14, borderRadius: '50%', background: el.lockAspect !== false ? C.panel : '#fff', transition: 'left 150ms' }} />
              </div>
              <span style={{ fontSize: 10, color: C.textMuted, cursor: 'pointer' }} onClick={() => onUpdate({ lockAspect: el.lockAspect === false ? true : false })}>
                Mantener proporción
              </span>
            </div>
            {row('Border radius', slide(el.borderRadius || 0, v => onUpdate({ borderRadius: v }), 0, 500))}
            <div style={{ marginBottom: 10 }}>
              <button onClick={onFitToCanvas}
                style={{ width: '100%', padding: '7px', background: C.input, border: `1px solid ${C.inputBorder}`, borderRadius: 5, color: C.textMuted, cursor: 'pointer', fontSize: 10, fontWeight: '600' }}>
                ⬛ Ajustar al ancho
              </button>
            </div>
            {row('Reemplazar', (
              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, height: 32, background: C.input, border: `1px dashed ${C.inputBorder}`, borderRadius: 5, cursor: 'pointer', color: C.textMuted, fontSize: 10 }}>
                <input type="file" accept="image/*" style={{ display: 'none' }}
                  onChange={async e => { const f = e.target.files?.[0]; if (f) onUpdate({ src: await fileToDataURL(f) }) }} />
                ↑ Subir imagen
              </label>
            ))}
            {row('URL', strIn(el.src, v => onUpdate({ src: v })))}
          </>)}
        </>)}

        {/* ── FORMA ─────────────────────────────────────────────────────────── */}
        {isShape && (<>
          {SH('Forma', 'content')}
          {!collapsed['content'] && (<>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 4, marginBottom: 10 }}>
              {[
                { v: 'rect', icon: '▬', lbl: 'Rect' },
                { v: 'circle', icon: '●', lbl: 'Círc' },
                { v: 'triangle', icon: '▲', lbl: 'Tri' },
                { v: 'line', icon: '—', lbl: 'Línea' },
              ].map(({ v, icon, lbl }) => (
                <button key={v} onClick={() => onUpdate({ shape: v })}
                  style={{ padding: '6px 2px', borderRadius: 5, border: '1px solid', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, fontSize: 13,
                    borderColor: el.shape === v ? C.selectedText : C.inputBorder,
                    background: el.shape === v ? C.selected : C.input,
                    color: el.shape === v ? C.selectedText : C.textMuted }}>
                  {icon}
                  <span style={{ fontSize: 7 }}>{lbl}</span>
                </button>
              ))}
            </div>
            {colorGradSection('#6430F7')}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
              <div style={{ minWidth: 0 }}>
                {label('W')}
                <input type="number" min={1}
                  value={Math.round(Number(el.width) || 100)}
                  onChange={e => {
                    const w = Math.max(1, Number(e.target.value))
                    if (el.lockAspect !== false && el.aspectRatio) {
                      onUpdate({ width: w, height: Math.round(w / el.aspectRatio) })
                    } else {
                      onUpdate({ width: w })
                    }
                  }}
                  style={{ width: '100%', background: C.input, border: `1px solid ${C.inputBorder}`, borderRadius: 5, padding: '5px 7px', color: C.text, fontSize: 11, MozAppearance: 'textfield' }} />
              </div>
              <div style={{ minWidth: 0 }}>
                {label('H')}
                <input type="number" min={1}
                  value={Math.round(Number(el.height) || 100)}
                  onChange={e => {
                    const h = Math.max(1, Number(e.target.value))
                    if (el.lockAspect !== false && el.aspectRatio) {
                      onUpdate({ height: h, width: Math.round(h * el.aspectRatio) })
                    } else {
                      onUpdate({ height: h })
                    }
                  }}
                  style={{ width: '100%', background: C.input, border: `1px solid ${C.inputBorder}`, borderRadius: 5, padding: '5px 7px', color: C.text, fontSize: 11, MozAppearance: 'textfield' }} />
              </div>
            </div>
            {/* Mantener proporción toggle */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <div onClick={() => {
                if (el.lockAspect === false) {
                  // Re-enabling: restore correct proportions using stored aspectRatio
                  const ar = el.aspectRatio || 1
                  const newH = Math.round((el.width || 100) / ar)
                  onUpdate({ lockAspect: true, height: newH })
                } else {
                  // Disabling: store current ratio before unlocking
                  const aspectRatio = (el.width || 100) / Math.max(1, el.height || 100)
                  onUpdate({ lockAspect: false, aspectRatio })
                }
              }}
                style={{ width: 32, height: 18, borderRadius: 9, background: el.lockAspect !== false ? C.text : C.inputBorder, cursor: 'pointer', position: 'relative', transition: 'background 150ms', flexShrink: 0 }}>
                <div style={{ position: 'absolute', top: 2, left: el.lockAspect !== false ? 16 : 2, width: 14, height: 14, borderRadius: '50%', background: el.lockAspect !== false ? C.panel : '#fff', transition: 'left 150ms' }} />
              </div>
              <span style={{ fontSize: 10, color: C.textMuted, cursor: 'pointer' }}
                onClick={() => {
                  if (el.lockAspect === false) {
                    const ar = el.aspectRatio || 1
                    const newH = Math.round((el.width || 100) / ar)
                    onUpdate({ lockAspect: true, height: newH })
                  } else {
                    const aspectRatio = (el.width || 100) / Math.max(1, el.height || 100)
                    onUpdate({ lockAspect: false, aspectRatio })
                  }
                }}>
                Mantener proporción
              </span>
            </div>
            {el.shape !== 'circle' && el.shape !== 'triangle' &&
              row('Border radius', slide(el.borderRadius ?? 0, v => onUpdate({ borderRadius: v }), 0, 500))}
            {row('Opacidad', slide(el.opacity ?? 1, v => onUpdate({ opacity: v }), 0, 1, 0.01))}
            {strokeSection()}
            {shadowSection()}
          </>)}
        </>)}

        {/* ── ICONO ─────────────────────────────────────────────────────────── */}
        {isIcon && (<>
          {SH('Icono', 'content')}
          {!collapsed['content'] && (<>
            {row('Color', colorRow(el.color || '#FFFFFF', v => onUpdate({ color: v })))}
            {row('Tamaño', slide(el.size || 64, v => onUpdate({ size: v }), 16, 400))}
            <div style={{ display: 'flex', gap: 3, marginBottom: 10 }}>
              {['regular', 'bold', 'fill', 'light'].map(v => (
                <button key={v} onClick={async () => {
                  try { const svg = await fetchIcon(el.name, v); onUpdate({ variant: v, svgContent: svg }) } catch {}
                }}
                  style={{ flex: 1, padding: '5px 0', borderRadius: 5, border: '1px solid', cursor: 'pointer', fontSize: 8, fontWeight: '600',
                    borderColor: el.variant === v ? C.selectedText : C.inputBorder,
                    background: el.variant === v ? C.selected : C.input,
                    color: el.variant === v ? C.selectedText : C.textMuted }}>
                  {v}
                </button>
              ))}
            </div>
            {row('Nombre (Phosphor)', strIn(el.name, async v => {
              try { const svg = await fetchIcon(v, el.variant || 'regular'); onUpdate({ name: v, svgContent: svg }) } catch {}
            }))}
          </>)}
        </>)}

        {/* ── BOTÓN ─────────────────────────────────────────────────────────── */}
        {isButton && (<>
          {SH('Texto del botón', 'content')}
          {!collapsed['content'] && (<>
          {row('Contenido', (
            <input type="text" value={el.content || ''} onChange={e => onUpdate({ content: e.target.value })}
              style={{ width: '100%', background: C.input, border: `1px solid ${C.inputBorder}`, borderRadius: 5, padding: '5px 7px', color: C.text, fontSize: 12 }} />
          ))}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, marginBottom: 10 }}>
            <div style={{ minWidth: 0 }}>
              {label('Tamaño')}
              {slide(el.fontSize || 22, v => onUpdate({ fontSize: v }), 8, 120)}
            </div>
            <div>
              {label('Peso')}
              <div style={{ display: 'flex', gap: 3 }}>
                {[['R', '400'], ['M', '500'], ['B', '700']].map(([l, v]) => (
                  <button key={v} onClick={() => onUpdate({ fontWeight: v })}
                    style={{ width: 26, height: 26, borderRadius: 5, border: '1px solid', cursor: 'pointer', fontSize: 10, fontWeight: v,
                      borderColor: el.fontWeight === v ? C.selectedText : C.inputBorder,
                      background: el.fontWeight === v ? C.selected : C.input,
                      color: el.fontWeight === v ? C.selectedText : C.textMuted }}>
                    {l}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {row('Color texto', colorRow(el.color || '#FFFFFF', v => onUpdate({ color: v })))}

          {SH('Relleno')}
          {btnBgSection()}

          {SH('Borde')}
          <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
            {[['Sin borde', 'none'], ['Sólido', 'solid'], ['Punteado', 'dashed']].map(([lbl, val]) => (
              <button key={val} onClick={() => onUpdate({ borderStyle: val })}
                style={{ flex: 1, padding: '5px 0', borderRadius: 5, border: '1px solid', cursor: 'pointer', fontSize: 9, fontWeight: '600',
                  borderColor: (el.borderStyle || 'none') === val ? C.selectedText : C.inputBorder,
                  background: (el.borderStyle || 'none') === val ? C.selected : C.input,
                  color: (el.borderStyle || 'none') === val ? C.selectedText : C.textMuted }}>
                {lbl}
              </button>
            ))}
          </div>
          {el.borderStyle && el.borderStyle !== 'none' && <>
            {row('Grosor', slide(el.borderWidth || 2, v => onUpdate({ borderWidth: v }), 1, 20))}
            {row('Color borde', colorRow(el.borderColor || '#FFFFFF', v => onUpdate({ borderColor: v })))}
          </>}

          {SH('Forma & Espaciado')}
          {row('Border radius', slide(el.borderRadius ?? 14, v => onUpdate({ borderRadius: v }), 0, 999))}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
            <div style={{ minWidth: 0 }}>{label('Padding X')}{slide(el.paddingX || 44, v => onUpdate({ paddingX: v }), 0, 200)}</div>
            <div style={{ minWidth: 0 }}>{label('Padding Y')}{slide(el.paddingY || 20, v => onUpdate({ paddingY: v }), 0, 100)}</div>
          </div>
          {row('Opacidad', slide(el.opacity ?? 1, v => onUpdate({ opacity: v }), 0, 1, 0.01))}

          {SH('Ícono en botón')}
          {(() => {
            const hasIcon = !!el.iconSvg
            return (
              <div style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: hasIcon ? 10 : 0 }}>
                  <div style={{ fontSize: 10, color: C.textMuted }}>{hasIcon ? (el.iconName || 'Ícono activo') : 'Sin ícono'}</div>
                  {toggleChip(hasIcon, () => onUpdate({ iconSvg: hasIcon ? null : '', iconName: hasIcon ? '' : (el.iconName || ''), iconSize: el.iconSize || 20, iconPosition: el.iconPosition || 'left' }), ['+ Agregar', 'Quitar'])}
                </div>
                {hasIcon && <>
                  {row('Nombre (Phosphor)', (
                    <input type="text" value={el.iconName || ''} onChange={async e => {
                      const name = e.target.value; onUpdate({ iconName: name })
                      try { const svg = await fetchIcon(name, el.iconVariant || 'regular'); onUpdate({ iconName: name, iconSvg: svg }) } catch {}
                    }}
                      placeholder="ej: arrow-right"
                      style={{ width: '100%', background: C.input, border: `1px solid ${C.inputBorder}`, borderRadius: 5, padding: '5px 7px', color: C.text, fontSize: 11 }} />
                  ))}
                  <div style={{ display: 'flex', gap: 3, marginBottom: 10 }}>
                    {['regular', 'bold', 'fill', 'light'].map(v => (
                      <button key={v} onClick={async () => {
                        try { const svg = await fetchIcon(el.iconName, v); onUpdate({ iconVariant: v, iconSvg: svg }) } catch {}
                      }}
                        style={{ flex: 1, padding: '4px 0', borderRadius: 5, border: '1px solid', cursor: 'pointer', fontSize: 8, fontWeight: '600',
                          borderColor: (el.iconVariant || 'regular') === v ? C.selectedText : C.inputBorder,
                          background: (el.iconVariant || 'regular') === v ? C.selected : C.input,
                          color: (el.iconVariant || 'regular') === v ? C.selectedText : C.textMuted }}>
                        {v}
                      </button>
                    ))}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, marginBottom: 10 }}>
                    <div>{label('Tamaño')}{slide(el.iconSize || 20, v => onUpdate({ iconSize: v }), 12, 60)}</div>
                    <div>
                      {label('Posición')}
                      <div style={{ display: 'flex', gap: 4 }}>
                        {[['←', 'left'], ['→', 'right']].map(([icon, val]) => (
                          <button key={val} onClick={() => onUpdate({ iconPosition: val })}
                            style={{ width: 28, height: 26, borderRadius: 5, border: '1px solid', cursor: 'pointer', fontSize: 11,
                              borderColor: (el.iconPosition || 'left') === val ? C.selectedText : C.inputBorder,
                              background: (el.iconPosition || 'left') === val ? C.selected : C.input,
                              color: (el.iconPosition || 'left') === val ? C.selectedText : C.textMuted }}>
                            {icon}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </>}
              </div>
            )
          })()}
          {shadowSection()}
          </>)}
        </>)}

        {/* ── ORDEN ─────────────────────────────────────────────────────────── */}
        {SH('Orden', 'order')}
        {!collapsed['order'] && (
          <div style={{ display: 'flex', gap: 4 }}>
            {[
              ['↑ Frente', onMoveUp, null],
              ['↓ Fondo', onMoveDown, null],
              ['⊕ Dup', onDuplicate, null],
              ['× Elim', onDelete, '239,68,68'],
            ].map(([lbl, fn, col]) => (
              <button key={lbl} onClick={fn}
                style={{ flex: 1, padding: '6px 2px', borderRadius: 5, border: '1px solid', cursor: 'pointer', fontSize: 9, fontWeight: '600', textAlign: 'center',
                  borderColor: col ? `rgba(${col},0.2)` : C.inputBorder,
                  background: col ? `rgba(${col},0.08)` : C.input,
                  color: col ? `rgb(${col})` : C.textMuted }}>
                {lbl}
              </button>
            ))}
          </div>
        )}

      </div>
    </div>
  )
}
