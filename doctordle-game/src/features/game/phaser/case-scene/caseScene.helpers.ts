import { COLORS } from './caseScene.constants'
import type { CluePalette, FeedbackLabel, GuessBarState } from './caseScene.types'
import type { PhaserGameSessionSnapshot, PhaserVisibleClue } from '../gameSessionBridge'

export function cloneSnapshot(snapshot: PhaserGameSessionSnapshot): PhaserGameSessionSnapshot {
  return {
    ...snapshot,
    visibleClues: snapshot.visibleClues.map((clue) => ({ ...clue })),
    selectedSuggestion: snapshot.selectedSuggestion ? { ...snapshot.selectedSuggestion } : null,
    suggestions: snapshot.suggestions.map((suggestion) => ({ ...suggestion })),
    latestAttempt: snapshot.latestAttempt ? { ...snapshot.latestAttempt } : null,
    reward: snapshot.reward ? { ...snapshot.reward } : null,
  }
}

export function getAttemptKey(attempt: PhaserGameSessionSnapshot['latestAttempt']) {
  return attempt ? `${attempt.guess}::${attempt.label}` : null
}

export function getFeedbackText(label: FeedbackLabel) {
  switch (label) {
    case 'correct':
      return 'CORRECT'
    case 'close':
      return 'CLOSE'
    default:
      return 'WRONG'
  }
}

export function getClueTone(type: PhaserVisibleClue['type']): CluePalette {
  switch (type) {
    case 'history':
      return { fill: COLORS.skySoft, stroke: COLORS.sky, tag: '#7dd3fc' }
    case 'symptom':
      return { fill: COLORS.roseSoft, stroke: COLORS.rose, tag: '#fda4af' }
    case 'exam':
      return { fill: COLORS.amberSoft, stroke: COLORS.amber, tag: '#fcd34d' }
    case 'lab':
      return { fill: COLORS.cyanSoft, stroke: COLORS.cyan, tag: '#67e8f9' }
    case 'vital':
      return { fill: COLORS.orangeSoft, stroke: COLORS.orange, tag: '#fdba74' }
    case 'imaging':
      return { fill: COLORS.violetSoft, stroke: COLORS.violet, tag: '#c4b5fd' }
    default:
      return { fill: COLORS.panelSoft, stroke: 0x64748b, tag: COLORS.textMuted }
  }
}

export function getGuessBarBaseState(snapshot: PhaserGameSessionSnapshot): GuessBarState {
  if (snapshot.mode === 'SUBMITTING') {
    return 'submitting'
  }

  if (!snapshot.canEditGuess && snapshot.mode !== 'FINAL_FEEDBACK') {
    return 'disabled'
  }

  return snapshot.guess.trim().length > 0 ? 'typing' : 'empty'
}

export function isReadyToCommit(snapshot: PhaserGameSessionSnapshot | undefined) {
  return Boolean(
    snapshot?.canEditGuess &&
      snapshot.guess.trim().length > 0 &&
      !snapshot.submitDisabled &&
      snapshot.diagnosisSubmitMode === 'selected-id',
  )
}
