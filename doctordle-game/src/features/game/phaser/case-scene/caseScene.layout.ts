import Phaser from 'phaser'
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from './caseScene.constants'

export type LayoutRect = {
  x: number
  y: number
  width: number
  height: number
}

export type LayoutMetrics = {
  board: LayoutRect
  insets: {
    top: number
    right: number
    bottom: number
    left: number
  }
  header: LayoutRect
  clues: LayoutRect & {
    captionX: number
    captionY: number
    cardInset: number
    maskInset: number
    stackBottomInset: number
    minTopInset: number
    ageShiftX: number
    stepMin: number
    stepMax: number
  }
  feedback: {
    x: number
    y: number
    width: number
    height: number
    baselineOffset: number
  }
  guessBar: LayoutRect & {
    haloInset: number
    labelY: number
    valueY: number
    helperBottomInset: number
    textInset: number
  }
  actions: LayoutRect & {
    gap: number
    clearWidth: number
    submitWidth: number
    backspaceWidth: number
  }
  keyboard: LayoutRect & {
    rowTop: number
    rowGap: number
    keyGap: number
    sideInset: number
    keyHeight: number
    spaceWidth: number
    spaceTopGap: number
  }
  overlay: LayoutRect & {
    padding: number
    accentHeight: number
    buttonWidth: number
    buttonHeight: number
    buttonBottomInset: number
    entryOffset: number
    shadowOffset: number
  }
  statePanel: LayoutRect & {
    padding: number
    bodyY: number
    actionWidth: number
    actionHeight: number
    actionBottomInset: number
  }
  typography: {
    headerProgress: number
    headerStatus: number
    clueCaption: number
    clueEmpty: number
    clueType: number
    clueValue: number
    guessLabel: number
    guessValue: number
    guessHelper: number
    keyLabel: number
    actionLabel: number
    feedback: number
    overlayEyebrow: number
    overlayTitle: number
    overlayDiagnosis: number
    overlayHelper: number
    stateEyebrow: number
    stateTitle: number
    stateBody: number
  }
}

export type LabVisualBudget = {
  ambientMotes: number
  feedbackBursts: number
  overlayDna: number
}

export function getLayoutMetrics(width: number, height: number): LayoutMetrics {
  const toPx = (value: number) => Math.max(1, Math.round(value))
  const canvasWidth = Math.max(1, width)
  const canvasHeight = Math.max(1, height)
  const fit = Math.min(canvasWidth / LOGICAL_WIDTH, canvasHeight / LOGICAL_HEIGHT)
  const boardWidth = toPx(LOGICAL_WIDTH * fit)
  const boardHeight = toPx(LOGICAL_HEIGHT * fit)
  const boardX = Math.round((canvasWidth - boardWidth) / 2)
  const boardY = Math.round((canvasHeight - boardHeight) / 2)
  const scaleX = boardWidth / LOGICAL_WIDTH
  const scaleY = boardHeight / LOGICAL_HEIGHT
  const textScale = Phaser.Math.Clamp(fit, 0.84, 1.24)
  const horizontalGutter = toPx(Phaser.Math.Clamp(boardWidth * 0.022, 8, 10))
  const topInset = toPx(Phaser.Math.Clamp(boardHeight * 0.016, 10, 14))
  const bottomInset = toPx(Phaser.Math.Clamp(boardHeight * 0.016, 10, 14))
  const headerHeight = Phaser.Math.Clamp(Math.round(boardHeight * 0.084), 52, 68)
  const headerGap = toPx(Phaser.Math.Clamp(boardHeight * 0.012, 8, 9))
  const sectionGap = toPx(Phaser.Math.Clamp(boardHeight * 0.009, 6, 7))
  const boardInnerWidth = Math.max(1, boardWidth - horizontalGutter * 2)
  const keyboardHeight = toPx(Phaser.Math.Clamp(boardHeight * 0.336, 232, 254))
  const guessHeight = Phaser.Math.Clamp(Math.round(boardHeight * 0.08), 56, 72)
  const keyboardY = boardY + boardHeight - bottomInset - keyboardHeight
  const guessY = keyboardY - sectionGap - guessHeight
  const headerY = boardY + topInset
  const cluesY = headerY + headerHeight + headerGap
  const cluesHeight = Math.max(toPx(boardHeight * 0.3), guessY - sectionGap - cluesY)
  const keyboardSideInset = toPx(Phaser.Math.Clamp(boardWidth * 0.012, 4, 5))
  const keyGap = toPx(Phaser.Math.Clamp(boardWidth * 0.007, 2, 2))
  const keyHeight = toPx(Phaser.Math.Clamp(boardHeight * 0.057, 39, 43))
  const actionGap = toPx(Phaser.Math.Clamp(boardWidth * 0.016, 5, 7))
  const actionHeight = toPx(Phaser.Math.Clamp(boardHeight * 0.055, 39, 43))
  const actionTopInset = toPx(Phaser.Math.Clamp(boardHeight * 0.0035, 2, 3))
  const actionKeyboardGap = toPx(Phaser.Math.Clamp(boardHeight * 0.009, 6, 8))
  const actionWidth = Math.max(1, boardInnerWidth - keyboardSideInset * 2)
  const clearWidth = toPx(actionWidth * (88 / 334))
  const submitWidth = toPx(actionWidth * (150 / 334))
  const backspaceWidth = Math.max(toPx(46 * scaleX), actionWidth - clearWidth - submitWidth - actionGap * 2)
  const rowTop = actionTopInset + actionHeight + actionKeyboardGap
  const rowGap = toPx(Phaser.Math.Clamp(boardHeight * 0.003, 2, 2))
  const spaceTopGap = toPx(Phaser.Math.Clamp(boardHeight * 0.004, 2, 3))
  const spaceWidth = toPx(
    Math.min(
      boardInnerWidth - keyboardSideInset * 2,
      Phaser.Math.Clamp(boardWidth * 0.59, 210, 232),
    ),
  )
  const overlayWidth = boardInnerWidth
  const overlayHeight = toPx(Phaser.Math.Clamp(boardHeight * 0.268, 196, 212))
  const overlayPadding = toPx(Phaser.Math.Clamp(boardWidth * 0.041, 14, 16))
  const overlayButtonGap = toPx(Phaser.Math.Clamp(boardWidth * 0.021, 8, 10))
  const overlayButtonWidth = Math.max(92, Math.floor((overlayWidth - overlayPadding * 2 - overlayButtonGap) / 2))
  const statePanelWidth = Math.max(1, boardInnerWidth - toPx(Phaser.Math.Clamp(boardWidth * 0.02, 6, 8)))
  const statePanelHeight = toPx(Phaser.Math.Clamp(boardHeight * 0.31, 220, 238))
  const statePanelY = boardY + Math.round((boardHeight - statePanelHeight) / 2) - toPx(Phaser.Math.Clamp(boardHeight * 0.02, 8, 14))

  const header = {
    x: boardX + horizontalGutter,
    y: headerY,
    width: boardInnerWidth,
    height: headerHeight,
  }

  const clues = {
    x: boardX + horizontalGutter,
    y: cluesY,
    width: boardInnerWidth,
    height: cluesHeight,
  }

  const guessBar = {
    x: boardX + horizontalGutter,
    y: guessY,
    width: boardInnerWidth,
    height: guessHeight,
  }

  const keyboard = {
    x: boardX + horizontalGutter,
    y: keyboardY,
    width: boardInnerWidth,
    height: keyboardHeight,
  }

  return {
    board: {
      x: boardX,
      y: boardY,
      width: boardWidth,
      height: boardHeight,
    },
    insets: {
      top: topInset,
      right: horizontalGutter,
      bottom: bottomInset,
      left: horizontalGutter,
    },
    header,
    clues: {
      ...clues,
      captionX: toPx(Phaser.Math.Clamp(boardWidth * 0.024, 8, 10)),
      captionY: toPx(Phaser.Math.Clamp(boardHeight * 0.011, 7, 9)),
      cardInset: toPx(Phaser.Math.Clamp(boardWidth * 0.02, 7, 9)),
      maskInset: toPx(Phaser.Math.Clamp(boardWidth * 0.008, 2, 3)),
      stackBottomInset: toPx(Phaser.Math.Clamp(boardHeight * 0.018, 12, 14)),
      minTopInset: toPx(Phaser.Math.Clamp(boardHeight * 0.032, 22, 24)),
      ageShiftX: toPx(Phaser.Math.Clamp(boardWidth * 0.017, 6, 7)),
      stepMin: toPx(Phaser.Math.Clamp(boardHeight * 0.021, 14, 16)),
      stepMax: toPx(Phaser.Math.Clamp(boardHeight * 0.034, 22, 26)),
    },
    feedback: {
      x: boardX + Math.round(boardWidth / 2),
      y: guessY - toPx(Phaser.Math.Clamp(boardHeight * 0.014, 8, 10)),
      width: toPx(Phaser.Math.Clamp(boardWidth * 0.31, 112, 122)),
      height: toPx(Phaser.Math.Clamp(boardHeight * 0.038, 26, 30)),
      baselineOffset: toPx(Phaser.Math.Clamp(boardHeight * 0.008, 5, 6)),
    },
    guessBar: {
      ...guessBar,
      haloInset: toPx(Phaser.Math.Clamp(Math.min(scaleX, scaleY) * 4, 3, 4)),
      labelY: toPx(Phaser.Math.Clamp(boardHeight * 0.012, 7, 9)),
      valueY: toPx(Phaser.Math.Clamp(boardHeight * 0.028, 18, 22)),
      helperBottomInset: toPx(Phaser.Math.Clamp(boardHeight * 0.007, 4, 5)),
      textInset: toPx(Phaser.Math.Clamp(boardWidth * 0.043, 15, 17)),
    },
    actions: {
      x: keyboard.x + keyboardSideInset,
      y: keyboard.y + actionTopInset,
      width: actionWidth,
      height: actionHeight,
      gap: actionGap,
      clearWidth,
      submitWidth,
      backspaceWidth,
    },
    keyboard: {
      ...keyboard,
      rowTop,
      rowGap,
      keyGap,
      sideInset: keyboardSideInset,
      keyHeight,
      spaceWidth,
      spaceTopGap,
    },
    overlay: {
      x: boardX + horizontalGutter,
      y: boardY + boardHeight - bottomInset - overlayHeight - toPx(Phaser.Math.Clamp(boardHeight * 0.072, 24, 32)),
      width: overlayWidth,
      height: overlayHeight,
      padding: overlayPadding,
      accentHeight: toPx(Phaser.Math.Clamp(boardHeight * 0.0055, 3, 4)),
      buttonWidth: overlayButtonWidth,
      buttonHeight: toPx(Phaser.Math.Clamp(boardHeight * 0.047, 34, 36)),
      buttonBottomInset: toPx(Phaser.Math.Clamp(boardHeight * 0.021, 14, 16)),
      entryOffset: toPx(Phaser.Math.Clamp(boardHeight * 0.034, 22, 28)),
      shadowOffset: toPx(Phaser.Math.Clamp(boardHeight * 0.013, 8, 10)),
    },
    statePanel: {
      x: boardX + Math.round((boardWidth - statePanelWidth) / 2),
      y: statePanelY,
      width: statePanelWidth,
      height: statePanelHeight,
      padding: toPx(Phaser.Math.Clamp(boardWidth * 0.046, 16, 18)),
      bodyY: toPx(Phaser.Math.Clamp(statePanelHeight * 0.52, 114, 124)),
      actionWidth: toPx(Phaser.Math.Clamp(statePanelWidth * 0.45, 150, 160)),
      actionHeight: toPx(Phaser.Math.Clamp(boardHeight * 0.055, 40, 42)),
      actionBottomInset: toPx(Phaser.Math.Clamp(boardHeight * 0.023, 16, 18)),
    },
    typography: {
      headerProgress: toPx(Phaser.Math.Clamp(headerHeight * 0.34, 14, 20)),
      headerStatus: toPx(Phaser.Math.Clamp(headerHeight * 0.25, 10, 14)),
      clueCaption: toPx(10 * textScale),
      clueEmpty: toPx(16 * textScale),
      clueType: toPx(10 * textScale),
      clueValue: toPx(15 * textScale),
      guessLabel: toPx(Phaser.Math.Clamp(guessHeight * 0.13, 8, 11)),
      guessValue: toPx(Phaser.Math.Clamp(guessHeight * 0.36, 20, 28)),
      guessHelper: toPx(Phaser.Math.Clamp(guessHeight * 0.115, 8, 11)),
      keyLabel: toPx(Phaser.Math.Clamp(keyHeight * 0.34, 12, 15)),
      actionLabel: toPx(Phaser.Math.Clamp(actionHeight * 0.34, 12, 15)),
      feedback: toPx(13 * textScale),
      overlayEyebrow: toPx(11 * textScale),
      overlayTitle: toPx(22 * textScale),
      overlayDiagnosis: toPx(18 * textScale),
      overlayHelper: toPx(12 * textScale),
      stateEyebrow: toPx(12 * textScale),
      stateTitle: toPx(28 * textScale),
      stateBody: toPx(17 * textScale),
    },
  }
}

export function getLabVisualBudget(board: LayoutRect): LabVisualBudget {
  if (board.width <= 300) {
    return { ambientMotes: 3, feedbackBursts: 8, overlayDna: 4 }
  }

  if (board.width <= 360) {
    return { ambientMotes: 4, feedbackBursts: 10, overlayDna: 5 }
  }

  return { ambientMotes: 5, feedbackBursts: 12, overlayDna: 6 }
}
