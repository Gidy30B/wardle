import Phaser from 'phaser'
import { resolveResponsiveGameLayout, type GameLayoutMode } from '../../gameLayout'
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from './caseScene.constants'

export type LayoutRect = {
  x: number
  y: number
  width: number
  height: number
}

export type LayoutMetrics = {
  profile: GameLayoutProfile
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

export type GameLayoutProfile = {
  mode: GameLayoutMode
  isDesktop: boolean
  isTablet: boolean
  isMobile: boolean
  width: number
  height: number
  safePadding: number
  boardWidth: number
  boardHeight: number
  contentGap: number
  columnGap: number
  leftPane: LayoutRect | null
  rightPane: LayoutRect | null
}

export const CASE_SCENE_DESKTOP_SPLIT_LAYOUT_ENABLED = false

export function getLayoutMetrics(width: number, height: number): LayoutMetrics {
  const toPx = (value: number) => Math.max(1, Math.round(value))
  const canvasWidth = Math.max(1, width)
  const canvasHeight = Math.max(1, height)
  const responsiveLayout = resolveResponsiveGameLayout(canvasWidth, canvasHeight)
  const isDesktopSplit =
    responsiveLayout.isDesktop && CASE_SCENE_DESKTOP_SPLIT_LAYOUT_ENABLED
  // The scene only sees the already-capped Phaser host, not the full viewport width.
  // Use a reachable stage-size threshold so desktop adaptive metrics can activate
  // without re-enabling the old split layout.
  const isDesktopAdaptive = !isDesktopSplit && canvasWidth >= 560 && canvasHeight >= 680
  const usesDesktopMetrics = isDesktopSplit || isDesktopAdaptive
  const fit = Math.min(canvasWidth / LOGICAL_WIDTH, canvasHeight / LOGICAL_HEIGHT)
  const boardWidth = isDesktopSplit
    ? toPx(Math.min(canvasWidth - Phaser.Math.Clamp(canvasWidth * 0.04, 28, 56), 1360))
    : isDesktopAdaptive
      ? toPx(
          Math.min(
            canvasWidth - Phaser.Math.Clamp(canvasWidth * 0.08, 36, 72),
            canvasHeight >= 900 ? 760 : canvasHeight >= 760 ? 680 : 580,
          ),
        )
    : toPx(LOGICAL_WIDTH * fit)
  const boardHeight = isDesktopSplit
    ? toPx(Math.min(canvasHeight - Phaser.Math.Clamp(canvasHeight * 0.05, 28, 48), 860))
    : isDesktopAdaptive
      ? toPx(Math.min(canvasHeight - Phaser.Math.Clamp(canvasHeight * 0.05, 24, 40), 900))
    : toPx(LOGICAL_HEIGHT * fit)
  const boardX = Math.round((canvasWidth - boardWidth) / 2)
  const boardY = Math.round((canvasHeight - boardHeight) / 2)
  const scaleX = boardWidth / LOGICAL_WIDTH
  const scaleY = boardHeight / LOGICAL_HEIGHT
  const boardFit = Math.min(boardWidth / LOGICAL_WIDTH, boardHeight / LOGICAL_HEIGHT)
  const textScale = Phaser.Math.Clamp(boardFit, 0.84, usesDesktopMetrics ? 1.34 : 1.24)
  const horizontalGutter = usesDesktopMetrics
    ? toPx(Phaser.Math.Clamp(boardWidth * 0.024, 16, 26))
    : toPx(Phaser.Math.Clamp(boardWidth * 0.022, 8, 10))
  const topInset = usesDesktopMetrics
    ? toPx(Phaser.Math.Clamp(boardHeight * 0.024, 18, 22))
    : toPx(Phaser.Math.Clamp(boardHeight * 0.016, 10, 14))
  const bottomInset = usesDesktopMetrics
    ? toPx(Phaser.Math.Clamp(boardHeight * 0.024, 18, 22))
    : toPx(Phaser.Math.Clamp(boardHeight * 0.016, 10, 14))
  const headerHeight = usesDesktopMetrics
    ? Phaser.Math.Clamp(Math.round(boardHeight * 0.145), 98, 124)
    : Phaser.Math.Clamp(Math.round(boardHeight * 0.136), 86, 104)
  const headerGap = usesDesktopMetrics
    ? toPx(Phaser.Math.Clamp(boardHeight * 0.012, 8, 12))
    : toPx(Phaser.Math.Clamp(boardHeight * 0.01, 6, 8))
  const sectionGap = usesDesktopMetrics
    ? toPx(Phaser.Math.Clamp(boardHeight * 0.016, 12, 16))
    : toPx(Phaser.Math.Clamp(boardHeight * 0.009, 6, 7))
  const boardInnerWidth = Math.max(1, boardWidth - horizontalGutter * 2)
  const contentBottom = boardY + boardHeight - bottomInset
  const headerY = boardY + topInset
  const cluesY = headerY + headerHeight + headerGap
  const columnGap = isDesktopSplit
    ? toPx(Phaser.Math.Clamp(boardWidth * 0.024, 18, 28))
    : 0
  const leftPaneWidth = isDesktopSplit
    ? toPx(Phaser.Math.Clamp((boardInnerWidth - columnGap) * 0.56, 420, 760))
    : boardInnerWidth
  const rightPaneWidth = isDesktopSplit
    ? Math.max(1, boardInnerWidth - leftPaneWidth - columnGap)
    : boardInnerWidth
  const leftPaneX = boardX + horizontalGutter
  const rightPaneX = isDesktopSplit ? leftPaneX + leftPaneWidth + columnGap : leftPaneX
  const keyboardHeight = isDesktopSplit
    ? toPx(Phaser.Math.Clamp(boardHeight * 0.42, 300, 352))
    : isDesktopAdaptive
      ? toPx(Phaser.Math.Clamp(boardHeight * 0.305, 214, 240))
    : toPx(Phaser.Math.Clamp(boardHeight * 0.336, 232, 254))
  const guessHeight = isDesktopSplit
    ? Phaser.Math.Clamp(Math.round(boardHeight * 0.092), 70, 86)
    : isDesktopAdaptive
      ? Phaser.Math.Clamp(Math.round(boardHeight * 0.086), 62, 76)
    : Phaser.Math.Clamp(Math.round(boardHeight * 0.08), 56, 72)
  const keyboardY = boardY + boardHeight - bottomInset - keyboardHeight
  const guessY = keyboardY - sectionGap - guessHeight
  const cluesHeight = isDesktopSplit
    ? Math.max(toPx(boardHeight * 0.38), contentBottom - cluesY)
    : Math.max(toPx(boardHeight * 0.3), guessY - sectionGap - cluesY)
  const keyboardSideInset = isDesktopSplit
    ? toPx(Phaser.Math.Clamp(rightPaneWidth * 0.03, 10, 14))
    : isDesktopAdaptive
      ? toPx(Phaser.Math.Clamp(boardWidth * 0.02, 8, 12))
    : toPx(Phaser.Math.Clamp(boardWidth * 0.012, 4, 5))
  const keyGap = isDesktopSplit
    ? toPx(Phaser.Math.Clamp(rightPaneWidth * 0.012, 6, 8))
    : isDesktopAdaptive
      ? toPx(Phaser.Math.Clamp(boardWidth * 0.009, 4, 6))
    : toPx(Phaser.Math.Clamp(boardWidth * 0.007, 2, 2))
  const keyHeight = isDesktopSplit
    ? toPx(Phaser.Math.Clamp(boardHeight * 0.067, 46, 54))
    : isDesktopAdaptive
      ? toPx(Phaser.Math.Clamp(boardHeight * 0.055, 40, 46))
    : toPx(Phaser.Math.Clamp(boardHeight * 0.057, 39, 43))
  const actionGap = isDesktopSplit
    ? toPx(Phaser.Math.Clamp(rightPaneWidth * 0.02, 8, 12))
    : isDesktopAdaptive
      ? toPx(Phaser.Math.Clamp(boardWidth * 0.014, 6, 8))
    : toPx(Phaser.Math.Clamp(boardWidth * 0.016, 5, 7))
  const actionHeight = isDesktopSplit
    ? toPx(Phaser.Math.Clamp(boardHeight * 0.064, 44, 50))
    : isDesktopAdaptive
      ? toPx(Phaser.Math.Clamp(boardHeight * 0.052, 38, 44))
    : toPx(Phaser.Math.Clamp(boardHeight * 0.055, 39, 43))
  const actionTopInset = isDesktopSplit
    ? toPx(Phaser.Math.Clamp(boardHeight * 0.012, 6, 8))
    : isDesktopAdaptive
      ? toPx(Phaser.Math.Clamp(boardHeight * 0.006, 4, 6))
    : toPx(Phaser.Math.Clamp(boardHeight * 0.0035, 2, 3))
  const actionKeyboardGap = isDesktopSplit
    ? toPx(Phaser.Math.Clamp(boardHeight * 0.016, 10, 14))
    : isDesktopAdaptive
      ? toPx(Phaser.Math.Clamp(boardHeight * 0.012, 8, 10))
    : toPx(Phaser.Math.Clamp(boardHeight * 0.009, 6, 8))
  const actionWidth = Math.max(
    1,
    (isDesktopSplit ? rightPaneWidth : boardInnerWidth) - keyboardSideInset * 2,
  )
  const clearWidth = isDesktopSplit
    ? toPx(actionWidth * 0.26)
    : isDesktopAdaptive
      ? toPx(actionWidth * 0.25)
    : toPx(actionWidth * (88 / 334))
  const submitWidth = isDesktopSplit
    ? toPx(actionWidth * 0.5)
    : isDesktopAdaptive
      ? toPx(actionWidth * 0.52)
    : toPx(actionWidth * (150 / 334))
  const backspaceWidth = Math.max(
    toPx(((isDesktopSplit || isDesktopAdaptive) ? 58 : 46) * scaleX),
    actionWidth - clearWidth - submitWidth - actionGap * 2,
  )
  const rowTop = actionTopInset + actionHeight + actionKeyboardGap
  const rowGap = isDesktopSplit
    ? toPx(Phaser.Math.Clamp(boardHeight * 0.008, 5, 7))
    : isDesktopAdaptive
      ? toPx(Phaser.Math.Clamp(boardHeight * 0.004, 3, 4))
    : toPx(Phaser.Math.Clamp(boardHeight * 0.003, 2, 2))
  const spaceTopGap = isDesktopSplit
    ? toPx(Phaser.Math.Clamp(boardHeight * 0.01, 6, 8))
    : isDesktopAdaptive
      ? toPx(Phaser.Math.Clamp(boardHeight * 0.006, 4, 6))
    : toPx(Phaser.Math.Clamp(boardHeight * 0.004, 2, 3))
  const spaceWidth = toPx(
    Math.min(
      (isDesktopSplit ? rightPaneWidth : boardInnerWidth) - keyboardSideInset * 2,
      isDesktopSplit
        ? Phaser.Math.Clamp(rightPaneWidth * 0.62, 260, 340)
        : isDesktopAdaptive
          ? Phaser.Math.Clamp(boardWidth * 0.58, 260, 360)
        : Phaser.Math.Clamp(boardWidth * 0.59, 210, 232),
    ),
  )
  const overlayWidth = isDesktopSplit
    ? toPx(Phaser.Math.Clamp(boardWidth * 0.62, 620, 760))
    : isDesktopAdaptive
      ? toPx(Phaser.Math.Clamp(boardWidth * 0.72, 440, 620))
    : boardInnerWidth
  const overlayHeight = isDesktopSplit
    ? toPx(Phaser.Math.Clamp(boardHeight * 0.42, 300, 340))
    : isDesktopAdaptive
      ? toPx(Phaser.Math.Clamp(boardHeight * 0.48, 332, 430))
    : toPx(Phaser.Math.Clamp(boardHeight * 0.5, 334, 404))
  const overlayPadding = isDesktopSplit
    ? toPx(Phaser.Math.Clamp(overlayWidth * 0.055, 20, 24))
    : isDesktopAdaptive
      ? toPx(Phaser.Math.Clamp(overlayWidth * 0.045, 16, 20))
    : toPx(Phaser.Math.Clamp(boardWidth * 0.041, 14, 16))
  const overlayButtonGap = isDesktopSplit
    ? toPx(Phaser.Math.Clamp(overlayWidth * 0.024, 10, 14))
    : isDesktopAdaptive
      ? toPx(Phaser.Math.Clamp(overlayWidth * 0.02, 8, 12))
    : toPx(Phaser.Math.Clamp(boardWidth * 0.021, 8, 10))
  const overlayButtonWidth = Math.max(92, Math.floor((overlayWidth - overlayPadding * 2 - overlayButtonGap) / 2))
  const statePanelWidth = isDesktopSplit
    ? toPx(Phaser.Math.Clamp(boardWidth * 0.58, 560, 760))
    : isDesktopAdaptive
      ? toPx(Phaser.Math.Clamp(boardWidth * 0.8, 440, 620))
    : Math.max(1, boardInnerWidth - toPx(Phaser.Math.Clamp(boardWidth * 0.02, 6, 8)))
  const statePanelHeight = isDesktopSplit
    ? toPx(Phaser.Math.Clamp(boardHeight * 0.34, 250, 290))
    : isDesktopAdaptive
      ? toPx(Phaser.Math.Clamp(boardHeight * 0.28, 220, 270))
    : toPx(Phaser.Math.Clamp(boardHeight * 0.31, 220, 238))
  const statePanelY = boardY + Math.round((boardHeight - statePanelHeight) / 2) - toPx(Phaser.Math.Clamp(boardHeight * 0.02, 8, 14))

  const header = {
    x: boardX + horizontalGutter,
    y: headerY,
    width: boardInnerWidth,
    height: headerHeight,
  }

  const clues = {
    x: leftPaneX,
    y: cluesY,
    width: leftPaneWidth,
    height: cluesHeight,
  }

  const guessBar = {
    x: rightPaneX,
    y: guessY,
    width: rightPaneWidth,
    height: guessHeight,
  }

  const keyboard = {
    x: rightPaneX,
    y: keyboardY,
    width: rightPaneWidth,
    height: keyboardHeight,
  }

  const profile: GameLayoutProfile = {
    mode: usesDesktopMetrics ? 'desktop' : responsiveLayout.mode,
    isDesktop: usesDesktopMetrics,
    isTablet: !usesDesktopMetrics && responsiveLayout.isTablet,
    isMobile: !usesDesktopMetrics && responsiveLayout.isMobile,
    width: canvasWidth,
    height: canvasHeight,
    safePadding: usesDesktopMetrics
      ? toPx(Phaser.Math.Clamp(canvasWidth * 0.02, 14, 24))
      : toPx(Phaser.Math.Clamp(canvasWidth * 0.012, 6, 12)),
    boardWidth,
    boardHeight,
    contentGap: sectionGap,
    columnGap,
    leftPane: {
      x: leftPaneX,
      y: cluesY,
      width: leftPaneWidth,
      height: contentBottom - cluesY,
    },
    rightPane: isDesktopSplit
      ? {
          x: rightPaneX,
          y: cluesY,
          width: rightPaneWidth,
          height: contentBottom - cluesY,
        }
      : null,
  }

  return {
    profile,
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
      x: isDesktopSplit
        ? rightPaneX + Math.round(rightPaneWidth / 2)
        : boardX + Math.round(boardWidth / 2),
      y: guessY - toPx(Phaser.Math.Clamp(boardHeight * (usesDesktopMetrics ? 0.02 : 0.014), usesDesktopMetrics ? 12 : 8, usesDesktopMetrics ? 16 : 10)),
      width: isDesktopSplit
        ? toPx(Phaser.Math.Clamp(rightPaneWidth * 0.54, 180, 250))
        : isDesktopAdaptive
          ? toPx(Phaser.Math.Clamp(boardWidth * 0.44, 180, 260))
        : toPx(Phaser.Math.Clamp(boardWidth * 0.31, 112, 122)),
      height: usesDesktopMetrics
        ? toPx(Phaser.Math.Clamp(boardHeight * 0.046, 32, 38))
        : toPx(Phaser.Math.Clamp(boardHeight * 0.038, 26, 30)),
      baselineOffset: usesDesktopMetrics
        ? toPx(Phaser.Math.Clamp(boardHeight * 0.01, 6, 8))
        : toPx(Phaser.Math.Clamp(boardHeight * 0.008, 5, 6)),
    },
    guessBar: {
      ...guessBar,
      haloInset: toPx(Phaser.Math.Clamp(Math.min(scaleX, scaleY) * (usesDesktopMetrics ? 5 : 4), 3, usesDesktopMetrics ? 6 : 4)),
      labelY: usesDesktopMetrics
        ? toPx(Phaser.Math.Clamp(guessHeight * 0.12, 8, 10))
        : toPx(Phaser.Math.Clamp(boardHeight * 0.012, 7, 9)),
      valueY: usesDesktopMetrics
        ? toPx(Phaser.Math.Clamp(guessHeight * 0.31, 22, 28))
        : toPx(Phaser.Math.Clamp(boardHeight * 0.028, 18, 22)),
      helperBottomInset: usesDesktopMetrics
        ? toPx(Phaser.Math.Clamp(guessHeight * 0.09, 6, 8))
        : toPx(Phaser.Math.Clamp(boardHeight * 0.007, 4, 5)),
      textInset: usesDesktopMetrics
        ? toPx(Phaser.Math.Clamp(guessBar.width * 0.05, 18, 22))
        : toPx(Phaser.Math.Clamp(boardWidth * 0.043, 15, 17)),
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
      x: boardX + Math.round((boardWidth - overlayWidth) / 2),
      y: boardY + Math.round((boardHeight - overlayHeight) / 2),
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
      padding: usesDesktopMetrics
        ? toPx(Phaser.Math.Clamp(statePanelWidth * 0.055, 22, 28))
        : toPx(Phaser.Math.Clamp(boardWidth * 0.046, 16, 18)),
      bodyY: usesDesktopMetrics
        ? toPx(Phaser.Math.Clamp(statePanelHeight * 0.48, 122, 138))
        : toPx(Phaser.Math.Clamp(statePanelHeight * 0.52, 114, 124)),
      actionWidth: usesDesktopMetrics
        ? toPx(Phaser.Math.Clamp(statePanelWidth * 0.36, 180, 220))
        : toPx(Phaser.Math.Clamp(statePanelWidth * 0.45, 150, 160)),
      actionHeight: usesDesktopMetrics
        ? toPx(Phaser.Math.Clamp(boardHeight * 0.06, 44, 48))
        : toPx(Phaser.Math.Clamp(boardHeight * 0.055, 40, 42)),
      actionBottomInset: usesDesktopMetrics
        ? toPx(Phaser.Math.Clamp(boardHeight * 0.03, 20, 24))
        : toPx(Phaser.Math.Clamp(boardHeight * 0.023, 16, 18)),
    },
    typography: {
      headerProgress: toPx(Phaser.Math.Clamp(headerHeight * (usesDesktopMetrics ? 0.38 : 0.34), 14, usesDesktopMetrics ? 26 : 20)),
      headerStatus: toPx(Phaser.Math.Clamp(headerHeight * (usesDesktopMetrics ? 0.27 : 0.25), 10, usesDesktopMetrics ? 16 : 14)),
      clueCaption: toPx((usesDesktopMetrics ? 11 : 10) * textScale),
      clueEmpty: toPx((usesDesktopMetrics ? 18 : 16) * textScale),
      clueType: toPx((usesDesktopMetrics ? 11 : 10) * textScale),
      clueValue: toPx((usesDesktopMetrics ? 17 : 15) * textScale),
      guessLabel: toPx(Phaser.Math.Clamp(guessHeight * (usesDesktopMetrics ? 0.14 : 0.13), 8, usesDesktopMetrics ? 12 : 11)),
      guessValue: toPx(Phaser.Math.Clamp(guessHeight * (usesDesktopMetrics ? 0.35 : 0.36), 20, usesDesktopMetrics ? 32 : 28)),
      guessHelper: toPx(Phaser.Math.Clamp(guessHeight * (usesDesktopMetrics ? 0.14 : 0.115), 8, usesDesktopMetrics ? 13 : 11)),
      keyLabel: toPx(Phaser.Math.Clamp(keyHeight * 0.34, 12, usesDesktopMetrics ? 18 : 15)),
      actionLabel: toPx(Phaser.Math.Clamp(actionHeight * 0.34, 12, usesDesktopMetrics ? 17 : 15)),
      feedback: toPx((usesDesktopMetrics ? 15 : 13) * textScale),
      overlayEyebrow: toPx((usesDesktopMetrics ? 12 : 11) * textScale),
      overlayTitle: toPx((usesDesktopMetrics ? 24 : 22) * textScale),
      overlayDiagnosis: toPx((usesDesktopMetrics ? 20 : 18) * textScale),
      overlayHelper: toPx((usesDesktopMetrics ? 13 : 12) * textScale),
      stateEyebrow: toPx((usesDesktopMetrics ? 13 : 12) * textScale),
      stateTitle: toPx((usesDesktopMetrics ? 30 : 28) * textScale),
      stateBody: toPx((usesDesktopMetrics ? 18 : 17) * textScale),
    },
  }
}

export function getLabVisualBudget(board: LayoutRect): LabVisualBudget {
  if (board.width >= 900) {
    return { ambientMotes: 7, feedbackBursts: 14, overlayDna: 8 }
  }

  if (board.width <= 300) {
    return { ambientMotes: 3, feedbackBursts: 8, overlayDna: 4 }
  }

  if (board.width <= 360) {
    return { ambientMotes: 4, feedbackBursts: 10, overlayDna: 5 }
  }

  return { ambientMotes: 5, feedbackBursts: 12, overlayDna: 6 }
}
