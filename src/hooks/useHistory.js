/**
 * useHistory — undo/redo stack para el canvas editor
 * Usa refs para evitar re-renders en cada push
 */
export function useHistory() {
  const stack = { current: [] }
  const idx = { current: -1 }

  // No usamos useState para el stack — solo para forzar re-render en undo/redo
  return {
    _stack: stack,
    _idx: idx,
  }
}

// Standalone helpers que reciben los refs directamente
export function historyPush(stack, idx, state) {
  const clone = JSON.parse(JSON.stringify(state))
  stack.current = stack.current.slice(0, idx.current + 1)
  stack.current.push(clone)
  if (stack.current.length > 60) stack.current.shift()
  idx.current = stack.current.length - 1
}

export function historyUndo(stack, idx) {
  if (idx.current <= 0) return null
  idx.current--
  return JSON.parse(JSON.stringify(stack.current[idx.current]))
}

export function historyRedo(stack, idx) {
  if (idx.current >= stack.current.length - 1) return null
  idx.current++
  return JSON.parse(JSON.stringify(stack.current[idx.current]))
}

export function canUndo(idx) { return idx.current > 0 }
export function canRedo(stack, idx) { return idx.current < stack.current.length - 1 }
