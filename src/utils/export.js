import { toPng, toJpeg } from 'html-to-image'
import { FORMATS } from '../brand.js'

/**
 * Exporta el nodo DOM como imagen a resolución nativa.
 * El template siempre vive en un div a tamaño real pero escalado con CSS;
 * aquí lo capturamos al natural.
 */
export async function exportPiece(nodeRef, formatKey, type = 'png', filename = 'qurable-pieza') {
  const fmt = FORMATS[formatKey]
  if (!nodeRef || !fmt) return

  const options = {
    width:       fmt.width,
    height:      fmt.height,
    pixelRatio:  2,          // 2x = alta densidad (2160px final)
    quality:     0.97,
    skipFonts:   false,
    cacheBust:   true,
    style: {
      transform:       'none',
      transformOrigin: 'top left',
    },
  }

  try {
    let dataUrl
    if (type === 'jpg') {
      dataUrl = await toJpeg(nodeRef, { ...options, quality: 0.95, backgroundColor: '#0F172A' })
    } else {
      dataUrl = await toPng(nodeRef, options)
    }

    const link = document.createElement('a')
    link.download = `${filename}.${type === 'jpg' ? 'jpg' : 'png'}`
    link.href = dataUrl
    link.click()
  } catch (err) {
    console.error('Export error:', err)
    throw err
  }
}
