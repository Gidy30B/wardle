import { LOGICAL_HEIGHT, LOGICAL_WIDTH, MAX_RENDER_DPR } from './caseScene.constants'

export function getCaseSceneRenderResolution() {
  return typeof window === 'undefined' ? 1 : Math.max(1, Math.min(window.devicePixelRatio || 1, MAX_RENDER_DPR))
}

export function getCaseSceneTextResolution(scaleFactor = 1) {
  const renderResolution = getCaseSceneRenderResolution()
  const effectiveScale = Math.max(0.5, scaleFactor)

  return Math.max(1, Math.min(3, Math.ceil(renderResolution / effectiveScale)))
}

export function getCaseSceneCanvasSize() {
  return {
    width: LOGICAL_WIDTH,
    height: LOGICAL_HEIGHT,
  }
}
