import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import PhaserGameSession from './phaser/PhaserGameSession'
import type { PhaserGameSessionIntents, PhaserGameSessionSnapshot } from './phaser/gameSessionBridge'
import { resolveGameStageFrame, resolveResponsiveGameLayout } from './gameLayout'
import ReactGamePlaySurface from './react/ReactGamePlaySurface'
import type { RoundViewModel } from './round.types'
import type { AppIconSet } from '../../theme/icons'

type GamePlaySectionProps = {
  iconSet: AppIconSet
  roundViewModel: RoundViewModel
  currentStreak: number | null
  organizationName: string | null
  onInputCharacter: (value: string) => void
  onChangeGuess: (value: string) => void
  onClearGuess: () => void
  onClearSelectedSuggestion: () => boolean
  onBackspace: () => void
  onMoveSuggestionHighlight: (direction: -1 | 1) => void
  onSelectSuggestion: (index: number) => void
  onSelectHighlightedSuggestion: () => boolean
  onSubmit: () => void
  onContinue?: () => void
  onReload?: () => void
  onOpenMenu: () => void
  onOpenExplanation: () => void
}

const GAMEPLAY_RENDERER =
  import.meta.env.VITE_GAMEPLAY_RENDERER === 'phaser' ? 'phaser' : 'react'

export default function GamePlaySection({
  iconSet,
  roundViewModel,
  currentStreak,
  organizationName,
  onInputCharacter,
  onChangeGuess,
  onClearGuess,
  onClearSelectedSuggestion,
  onBackspace,
  onMoveSuggestionHighlight,
  onSelectSuggestion,
  onSelectHighlightedSuggestion,
  onSubmit,
  onContinue,
  onReload,
  onOpenMenu,
  onOpenExplanation,
}: GamePlaySectionProps) {
  // React is the active gameplay renderer. Phaser is deprecated and remains
  // available only as an explicit legacy fallback via VITE_GAMEPLAY_RENDERER=phaser.
  const gameplayRenderer = GAMEPLAY_RENDERER
  const shellRef = useRef<HTMLElement | null>(null)
  const [shellSize, setShellSize] = useState({ width: 0, height: 0 })

  const snapshot = useMemo<PhaserGameSessionSnapshot>(
    () => roundViewModel,
    [roundViewModel],
  )
  const responsiveLayout = useMemo(
    () => resolveResponsiveGameLayout(shellSize.width, shellSize.height),
    [shellSize.height, shellSize.width],
  )
  const stageFrame = useMemo(
    () => resolveGameStageFrame(shellSize.width, shellSize.height),
    [shellSize.height, shellSize.width],
  )
  const stageViewportStyle = useMemo<CSSProperties | undefined>(() => {
    if (responsiveLayout.isMobile) {
      return undefined
    }

    if (gameplayRenderer === 'react') {
      return {
        maxWidth: `${Math.max(720, Math.min(shellSize.width - 24, 920))}px`,
      }
    }

    return stageFrame.width > 0
      ? {
          maxWidth: `${stageFrame.width}px`,
        }
      : undefined
  }, [gameplayRenderer, responsiveLayout.isMobile, shellSize.width, stageFrame.width])

  const intents = useMemo<PhaserGameSessionIntents>(
    () => ({
      onInputCharacter: (value: string) => {
        if (!roundViewModel.canEditGuess) {
          return
        }

        onInputCharacter(value)
      },
      onMoveSuggestionHighlight,
      onSelectSuggestion,
      onSelectHighlightedSuggestion,
      onSubmit,
      onContinue: onContinue ?? (() => undefined),
      onOpenExplanation: onOpenExplanation,
      onOpenMenu,
      onClearGuess,
      onClearSelectedSuggestion,
      onBackspace,
      onReload: onReload ?? (() => undefined),
    }),
    [
      onBackspace,
      onClearGuess,
      onClearSelectedSuggestion,
      onContinue,
      onInputCharacter,
      onMoveSuggestionHighlight,
      onOpenExplanation,
      onOpenMenu,
      onReload,
      onSelectHighlightedSuggestion,
      onSelectSuggestion,
      onSubmit,
      roundViewModel.canEditGuess,
    ],
  )

  useEffect(() => {
    if (!shellRef.current) {
      return
    }

    const element = shellRef.current
    const updateSize = () => {
      const nextWidth = Math.round(element.clientWidth)
      const nextHeight = Math.round(element.clientHeight)
      setShellSize((current) =>
        current.width === nextWidth && current.height === nextHeight
          ? current
          : { width: nextWidth, height: nextHeight },
      )
    }

    updateSize()

    const observer = new ResizeObserver(() => {
      updateSize()
    })

    observer.observe(element)

    return () => {
      observer.disconnect()
    }
  }, [])

  return (
    <section
      ref={shellRef}
      className="mx-auto flex h-full min-h-0 w-full flex-1 items-stretch justify-center"
    >
      <div
        className={`flex h-full min-h-0 w-full flex-1 border-white/10 backdrop-blur sm:rounded-[30px] sm:border sm:shadow-[0_30px_120px_rgba(0,0,0,0.45)] ${
          gameplayRenderer === 'react'
            ? 'bg-[var(--wardle-color-charcoal)] sm:bg-[linear-gradient(180deg,rgba(30,30,44,0.98),rgba(21,24,34,0.98))] sm:p-2'
            : 'bg-black/45 sm:bg-[linear-gradient(180deg,rgba(8,14,24,0.96),rgba(5,8,15,0.98))] sm:p-3 sm:ring-1 sm:ring-cyan-200/6 lg:p-4'
        }`}
        style={stageViewportStyle}
      >
        <div
          className={`h-full min-h-0 w-full overflow-hidden border-white/6 sm:rounded-[24px] sm:border ${
            gameplayRenderer === 'react' ? 'bg-[var(--wardle-color-charcoal)]' : 'bg-black/45'
          }`}
        >
          {gameplayRenderer === 'react' ? (
            <ReactGamePlaySurface
              iconSet={iconSet}
              roundViewModel={roundViewModel}
              currentStreak={currentStreak}
              organizationName={organizationName}
              onChangeGuess={onChangeGuess}
              onSelectSuggestion={onSelectSuggestion}
              onMoveSuggestionHighlight={onMoveSuggestionHighlight}
              onSelectHighlightedSuggestion={onSelectHighlightedSuggestion}
              onSubmit={onSubmit}
              onReload={onReload}
            />
          ) : (
            <PhaserGameSession
              snapshot={snapshot}
              intents={intents}
              className="h-full w-full"
            />
          )}
        </div>
      </div>
    </section>
  )
}
