import { FORMATS } from '../brand.js'

/** Calcula el scale para mostrar el template en el área de preview */
export function calcScale(formatKey, previewWidth, previewHeight) {
  const fmt = FORMATS[formatKey]
  if (!fmt) return 1
  const scaleW = previewWidth / fmt.width
  const scaleH = previewHeight / fmt.height
  return Math.min(scaleW, scaleH, 1)
}

/** Dimensiones del contenedor visual en el preview */
export function previewDimensions(formatKey, scale) {
  const fmt = FORMATS[formatKey]
  return {
    width:  fmt.width  * scale,
    height: fmt.height * scale,
  }
}
