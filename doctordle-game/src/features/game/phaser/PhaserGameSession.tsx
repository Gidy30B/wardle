import { useEffect, useMemo, useRef } from 'react'
import Phaser from 'phaser'
import { DEBUG_RENDER_AUDIT, createCaseScene, getCaseSceneCanvasSize, getCaseSceneRenderResolution, type CaseScene } from './CaseScene'
import type { PhaserGameSessionIntents, PhaserGameSessionSnapshot } from './gameSessionBridge'

type PhaserGameSessionProps = {
  snapshot: PhaserGameSessionSnapshot
  intents: PhaserGameSessionIntents
  className?: string
}

export default function PhaserGameSession({ snapshot, intents, className }: PhaserGameSessionProps) {
  const parentRef = useRef<HTMLDivElement | null>(null)
  const gameRef = useRef<Phaser.Game | null>(null)
  const sceneRef = useRef<CaseScene | null>(null)
  const snapshotRef = useRef(snapshot)
  const intentsRef = useRef(intents)

  snapshotRef.current = snapshot
  intentsRef.current = intents

  const stableIntents = useMemo(() => intents, [intents])

  useEffect(() => {
    if (!parentRef.current || gameRef.current) {
      return
    }

    const parent = parentRef.current
    let resizeFrame = 0
    let booted = false
    const logRenderAudit = (
      phase: string,
      game: Phaser.Game,
      intended?: { cssWidth: number; cssHeight: number; renderWidth: number; renderHeight: number },
    ) => {
      if (!DEBUG_RENDER_AUDIT) {
        return
      }

      const bounds = parent.getBoundingClientRect()
      const computed = window.getComputedStyle(game.canvas)
      const payload = {
        phase,
        dpr: window.devicePixelRatio,
        parentRect: {
          width: bounds.width,
          height: bounds.height,
        },
        intended,
        scaleParentSize: {
          width: game.scale.parentSize.width,
          height: game.scale.parentSize.height,
        },
        scaleGameSize: {
          width: game.scale.gameSize.width,
          height: game.scale.gameSize.height,
        },
        canvas: {
          width: game.canvas.width,
          height: game.canvas.height,
          clientWidth: game.canvas.clientWidth,
          clientHeight: game.canvas.clientHeight,
          styleWidth: game.canvas.style.width,
          styleHeight: game.canvas.style.height,
          computedWidth: computed.width,
          computedHeight: computed.height,
        },
      }

      console.groupCollapsed(`[PhaserGameSession render audit] ${phase}`)
      console.log(payload)
      console.groupEnd()

      ;(window as typeof window & { __DXLAB_PHASER_RENDER_AUDIT__?: unknown }).__DXLAB_PHASER_RENDER_AUDIT__ = payload
    }

    const applyRenderSize = (game: Phaser.Game) => {
      const bounds = parent.getBoundingClientRect()
      const cssWidth = Math.max(1, Math.round(bounds.width))
      const cssHeight = Math.max(1, Math.round(bounds.height))
      const renderResolution = getCaseSceneRenderResolution()
      const renderWidth = Math.max(1, Math.round(cssWidth * renderResolution))
      const renderHeight = Math.max(1, Math.round(cssHeight * renderResolution))
      const intended = { cssWidth, cssHeight, renderWidth, renderHeight }

      logRenderAudit('before-resize', game, intended)

      // Let RESIZE mode own the responsive CSS/world size, then override the backing store for DPR.
      game.scale.resize(cssWidth, cssHeight)
      game.canvas.width = renderWidth
      game.canvas.height = renderHeight
      if ('resize' in game.renderer && typeof game.renderer.resize === 'function') {
        game.renderer.resize(renderWidth, renderHeight)
      }
      game.canvas.style.width = `${cssWidth}px`
      game.canvas.style.height = `${cssHeight}px`
      game.scale.updateBounds()
      game.scale.displayScale.set(renderWidth / cssWidth, renderHeight / cssHeight)
      logRenderAudit('after-resize', game, intended)
    }

    const bootGame = () => {
      if (booted || !parent.isConnected) {
        return
      }

      const rect = parent.getBoundingClientRect()
      if (rect.width < 2 || rect.height < 2) {
        return
      }

      const scene = createCaseScene(() => snapshotRef.current, () => intentsRef.current)
      sceneRef.current = scene
      const canvasSize = getCaseSceneCanvasSize()

      // Layout contract:
      // - React owns the size of parentRef via flexbox and surrounding shell padding.
      // - Phaser owns the canvas display size inside that box via the Scale Manager.
      // - The canvas backing store is resized to device density, while CSS width / height stay parent-sized.
      // - The scene recomputes layout metrics from the CSS-sized parent box on every resize.
      // - Text objects opt into DPR-backed rasterization inside the scene.
      const game = new Phaser.Game({
        type: Phaser.AUTO,
        width: canvasSize.width,
        height: canvasSize.height,
        parent,
        backgroundColor: '#04070d',
        antialias: true,
        roundPixels: true,
        transparent: false,
        scene: [scene],
        scale: {
          mode: Phaser.Scale.RESIZE,
          autoRound: true,
          expandParent: false,
          width: canvasSize.width,
          height: canvasSize.height,
        },
      })

      game.canvas.style.display = 'block'
      game.canvas.style.margin = '0'
      game.canvas.style.touchAction = 'none'
      game.canvas.style.imageRendering = 'auto'

      applyRenderSize(game)
      if (DEBUG_RENDER_AUDIT) {
        game.scale.on('resize', () => {
          logRenderAudit('scale-event', game)
          sceneRef.current?.runRenderAudit('scale-event')
        })
      }

      gameRef.current = game
      booted = true
    }

    const resizeObserver = new ResizeObserver(() => {
      if (resizeFrame !== 0) {
        window.cancelAnimationFrame(resizeFrame)
      }

      resizeFrame = window.requestAnimationFrame(() => {
        resizeFrame = 0
        if (!booted) {
          bootGame()
          return
        }

        if (!gameRef.current) {
          return
        }

        applyRenderSize(gameRef.current)
        sceneRef.current?.syncRenderSurface('react-resize-observer')
      })
    })

    resizeObserver.observe(parent)
    bootGame()

    return () => {
      if (resizeFrame !== 0) {
        window.cancelAnimationFrame(resizeFrame)
      }
      resizeObserver.disconnect()
      sceneRef.current = null
      gameRef.current?.destroy(true)
      gameRef.current = null
    }
  }, [])

  useEffect(() => {
    intentsRef.current = stableIntents
    sceneRef.current?.applyBridge()
  }, [stableIntents])

  useEffect(() => {
    sceneRef.current?.applyBridge()
  }, [snapshot])

  return (
    <div
      className={className}
      style={{ minHeight: 0, minWidth: 0, touchAction: 'manipulation' }}
    >
      {/* The direct Phaser parent is a plain sizing box. Decorative styles live in React wrappers above it. */}
      <div ref={parentRef} className="h-full w-full" style={{ minHeight: 0, minWidth: 0 }} />
    </div>
  )
}
