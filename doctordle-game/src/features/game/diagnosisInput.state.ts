import type { DiagnosisSelection } from './game.types'
import { isDiagnosisSelectionCurrent } from './diagnosisRegistry.search'

export const GAMEPLAY_DIAGNOSIS_SELECTION_POLICY =
  'selection-required' as const

export type DiagnosisSelectionPolicy = typeof GAMEPLAY_DIAGNOSIS_SELECTION_POLICY

export type DiagnosisDictionaryAvailability = 'loading' | 'ready' | 'unavailable'

export type DiagnosisInputState =
  | {
      mode: 'empty'
      text: ''
      selectedDiagnosis: null
      lastSelectedDiagnosis: null
    }
  | {
      mode: 'typing'
      text: string
      selectedDiagnosis: null
      lastSelectedDiagnosis: null
    }
  | {
      mode: 'selected'
      text: string
      selectedDiagnosis: DiagnosisSelection
      lastSelectedDiagnosis: DiagnosisSelection
    }
  | {
      mode: 'stale-selection'
      text: string
      selectedDiagnosis: null
      lastSelectedDiagnosis: DiagnosisSelection
    }

export type DiagnosisSubmitMode = 'selected-id' | 'blocked'

export type DiagnosisSelectionState = {
  selectedDiagnosis: DiagnosisSelection | null
  staleSelection: DiagnosisSelection | null
}

export function reconcileDiagnosisSelectionAfterTextChange(input: {
  nextText: string
  selectedDiagnosis: DiagnosisSelection | null
  staleSelection: DiagnosisSelection | null
}): DiagnosisSelectionState {
  const trimmed = input.nextText.trim()

  if (!trimmed) {
    return {
      selectedDiagnosis: null,
      staleSelection: null,
    }
  }

  if (input.selectedDiagnosis) {
    if (isDiagnosisSelectionCurrent(input.selectedDiagnosis.displayLabel, input.nextText)) {
      return {
        selectedDiagnosis: input.selectedDiagnosis,
        staleSelection: null,
      }
    }

    return {
      selectedDiagnosis: null,
      staleSelection: input.selectedDiagnosis,
    }
  }

  return {
    selectedDiagnosis: null,
    staleSelection: input.staleSelection,
  }
}

export function deriveDiagnosisInputState(input: {
  text: string
  selectedDiagnosis: DiagnosisSelection | null
  staleSelection: DiagnosisSelection | null
}): DiagnosisInputState {
  if (input.selectedDiagnosis) {
    return {
      mode: 'selected',
      text: input.text,
      selectedDiagnosis: input.selectedDiagnosis,
      lastSelectedDiagnosis: input.selectedDiagnosis,
    }
  }

  if (input.text.length === 0) {
    return {
      mode: 'empty',
      text: '',
      selectedDiagnosis: null,
      lastSelectedDiagnosis: null,
    }
  }

  if (input.staleSelection) {
    return {
      mode: 'stale-selection',
      text: input.text,
      selectedDiagnosis: null,
      lastSelectedDiagnosis: input.staleSelection,
    }
  }

  return {
    mode: 'typing',
    text: input.text,
    selectedDiagnosis: null,
    lastSelectedDiagnosis: null,
  }
}

export function deriveDiagnosisSubmitMode(input: {
  diagnosisInputState: DiagnosisInputState
  dictionaryAvailability: DiagnosisDictionaryAvailability
}): DiagnosisSubmitMode {
  if (
    input.diagnosisInputState.mode === 'selected' &&
    input.dictionaryAvailability === 'ready'
  ) {
    return 'selected-id'
  }

  return 'blocked'
}
