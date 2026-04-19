import Phaser from 'phaser'
import type { PhaserGameSessionIntents, PhaserGameSessionSnapshot, PhaserVisibleClue } from '../gameSessionBridge'
import {
  ActionRowLayer,
  CluePanelLayer,
  DiagnosisBarLayer,
  FeedbackLayerModule,
  HudLayer,
  KeyboardPanelLayer,
  OverlayLayer,
  RewardLayer,
  type RoundLayer,
  type RoundLayerHost,
} from '../roundLayers'
import { formatAuditNumber, isFractionalValue } from './caseScene.audit'
import {
  COLORS,
  DEBUG_RENDER_AUDIT,
  DEBUG_RENDER_OVERLAY,
  DEPTH,
  FRACTIONAL_EPSILON,
  HEADER_HEART_EMPTY,
  HEADER_HEART_FULL,
  KEYBOARD_ROWS,
  LAB_DNA_TEXTURE,
  LAB_MOTE_TEXTURE,
  LOGICAL_HEIGHT,
  LOGICAL_WIDTH,
  MAX_RENDER_DPR,
  ONBOARDING_DEMO_CLUE,
  ONBOARDING_FORCE_STORAGE_KEY,
  ONBOARDING_GHOST_GUESS,
  ONBOARDING_SEEN_STORAGE_KEY,
  SCENE_KEY,
} from './caseScene.constants'
import {
  cloneSnapshot,
  getAttemptKey,
  getClueTone,
  getFeedbackText,
  getGuessBarBaseState,
  isReadyToCommit,
} from './caseScene.helpers'
import { getLabVisualBudget, getLayoutMetrics, type LayoutMetrics, type LayoutRect } from './caseScene.layout'
import { getCaseSceneTextResolution } from './caseScene.render'
import type {
  ButtonPalette,
  ClueCardView,
  EndOverlayView,
  FeedbackLabel,
  FeedbackView,
  GeometryAuditEntry,
  GuessBarState,
  GuessBarView,
  HeaderTensionState,
  OnboardingState,
  PressableButtonView,
  RewardToastView,
  RoundVisualState,
  ScaleAuditEntry,
  StatePanelView,
} from './caseScene.types'

export class RoundScene extends Phaser.Scene implements RoundLayerHost {
  private readonly getSnapshot: () => PhaserGameSessionSnapshot
  private readonly getIntents: () => PhaserGameSessionIntents
  private layoutMetrics: LayoutMetrics = getLayoutMetrics(LOGICAL_WIDTH, LOGICAL_HEIGHT)

  private backdropLayer?: Phaser.GameObjects.Container
  private backdropBase?: Phaser.GameObjects.Rectangle
  private backdropFrame?: Phaser.GameObjects.Rectangle
  private backdropGrid?: Phaser.GameObjects.Graphics
  private backdropWell?: Phaser.GameObjects.Ellipse
  private backdropUpperGlow?: Phaser.GameObjects.Arc
  private backdropLowerGlow?: Phaser.GameObjects.Arc
  private backdropWash?: Phaser.GameObjects.Rectangle
  private outerFrameContainer?: Phaser.GameObjects.Container
  private outerFrameBezel?: Phaser.GameObjects.Graphics
  private outerFrameInnerGlow?: Phaser.GameObjects.Rectangle
  private outerFrameVignette?: Phaser.GameObjects.Rectangle
  private outerFrameCornerMotifs: Phaser.GameObjects.GameObject[] = []
  private outerFramePulseTween?: Phaser.Tweens.Tween
  private ambientMotes: Phaser.GameObjects.Image[] = []

  private gameplayLayer?: Phaser.GameObjects.Container
  private feedbackRoot?: Phaser.GameObjects.Container
  private overlayRoot?: Phaser.GameObjects.Container
  private stateLayer?: Phaser.GameObjects.Container

  private headerRegion?: Phaser.GameObjects.Container
  private headerMenuButton?: PressableButtonView
  private headerShadow?: Phaser.GameObjects.Rectangle
  private headerBackground?: Phaser.GameObjects.Rectangle
  private headerInnerPlate?: Phaser.GameObjects.Rectangle
  private headerTopAccent?: Phaser.GameObjects.Rectangle
  private headerDivider?: Phaser.GameObjects.Rectangle
  private headerTitleGlow?: Phaser.GameObjects.Text
  private headerTitleText?: Phaser.GameObjects.Text
  private headerTitleAccent?: Phaser.GameObjects.Rectangle
  private headerDnaIcon?: Phaser.GameObjects.Image
  private headerDnaRotationTween?: Phaser.Tweens.Tween
  private headerFlashSweep?: Phaser.GameObjects.Rectangle
  private headerStatsRegion?: Phaser.GameObjects.Container
  private headerLevelChip?: Phaser.GameObjects.Rectangle
  private headerLevelText?: Phaser.GameObjects.Text
  private headerXpChip?: Phaser.GameObjects.Rectangle
  private headerXpText?: Phaser.GameObjects.Text
  private headerHeartsContainer?: Phaser.GameObjects.Container
  private headerHeartIcons: Phaser.GameObjects.Text[] = []
  private headerHeartPulseTween?: Phaser.Tweens.Tween
  private headerHeartPulseState: HeaderTensionState | null = null
  private lastHeaderViabilityRemaining = -1
  private lastHeaderViabilityTotal = -1
  private lastXp?: number
  private lastLevel?: number
  private isInDangerState?: boolean
  private isFrameInDangerState?: boolean
  private keyboardRegion?: Phaser.GameObjects.Container
  private keyboardTray?: Phaser.GameObjects.Rectangle
  private actionRowRegion?: Phaser.GameObjects.Container

  private clueStackRegion?: Phaser.GameObjects.Container
  private clueStackShadow?: Phaser.GameObjects.Rectangle
  private clueStackTray?: Phaser.GameObjects.Rectangle
  private clueStackCaption?: Phaser.GameObjects.Text

  private clueCardLayer?: Phaser.GameObjects.Container
  private clueMaskGraphics?: Phaser.GameObjects.Graphics
  private clueEmptyText?: Phaser.GameObjects.Text
  private readonly clueCards = new Map<string, ClueCardView>()

  private guessBar?: GuessBarView
  private feedbackLayer?: FeedbackView
  private rewardToast?: RewardToastView
  private endOverlay?: EndOverlayView
  private statePanel?: StatePanelView

  private actionButtons?: {
    clear: PressableButtonView
    submit: PressableButtonView
    backspace: PressableButtonView
  }

  private keyboardButtons: Array<{ key: string; view: PressableButtonView }> = []
  private spaceButton?: PressableButtonView
  private guessBarState: GuessBarState = 'empty'
  private guessBarGlowTween?: Phaser.Tweens.Tween
  private guessBarScanTween?: Phaser.Tweens.Tween
  private guessCaretBlinkEvent?: Phaser.Time.TimerEvent
  private guessCaretVisible = true
  private guessBarResetEvent?: Phaser.Time.TimerEvent
  private feedbackHideEvent?: Phaser.Time.TimerEvent
  private overlayBeamTween?: Phaser.Tweens.Tween
  private overlayDnaLoopEvent?: Phaser.Time.TimerEvent
  private onboardingState: OnboardingState = 'inactive'
  private onboardingLayer?: Phaser.GameObjects.Container
  private onboardingClueFocus?: Phaser.GameObjects.Rectangle
  private onboardingSubmitFocus?: Phaser.GameObjects.Rectangle
  private onboardingDemoClueContainer?: Phaser.GameObjects.Container
  private onboardingDemoClueWash?: Phaser.GameObjects.Rectangle
  private onboardingDemoClueShadow?: Phaser.GameObjects.Rectangle
  private onboardingDemoClueBackground?: Phaser.GameObjects.Rectangle
  private onboardingDemoClueAccent?: Phaser.GameObjects.Rectangle
  private onboardingDemoClueFrame?: Phaser.GameObjects.Rectangle
  private onboardingDemoClueText?: Phaser.GameObjects.Text
  private onboardingDemoLabel?: Phaser.GameObjects.Text
  private onboardingGhostGuess?: Phaser.GameObjects.Text
  private onboardingHelperLabel?: Phaser.GameObjects.Text
  private onboardingBeginHint?: Phaser.GameObjects.Text
  private onboardingSkipHint?: Phaser.GameObjects.Text
  private onboardingEvents: Phaser.Time.TimerEvent[] = []
  private onboardingSkipCooldownUntil = 0
  private previousSnapshot?: PhaserGameSessionSnapshot
  private visualState: RoundVisualState = 'boot'
  private debugAuditText?: Phaser.GameObjects.Text
  private feedbackBurstPool: Phaser.GameObjects.Image[] = []
  private overlayDnaPool: Phaser.GameObjects.Image[] = []
  private readonly hudLayerModule: RoundLayer
  private readonly cluePanelLayerModule: RoundLayer
  private readonly diagnosisBarLayerModule: RoundLayer
  private readonly actionRowLayerModule: RoundLayer
  private readonly keyboardPanelLayerModule: RoundLayer
  private readonly feedbackLayerModule: RoundLayer
  private readonly rewardLayerModule: RoundLayer
  private readonly overlayLayerModule: RoundLayer

  constructor(
    getSnapshot: () => PhaserGameSessionSnapshot,
    getIntents: () => PhaserGameSessionIntents,
  ) {
    super({ key: SCENE_KEY })
    this.getSnapshot = getSnapshot
    this.getIntents = getIntents
    this.hudLayerModule = new HudLayer(this)
    this.cluePanelLayerModule = new CluePanelLayer(this)
    this.diagnosisBarLayerModule = new DiagnosisBarLayer(this)
    this.actionRowLayerModule = new ActionRowLayer(this)
    this.keyboardPanelLayerModule = new KeyboardPanelLayer(this)
    this.feedbackLayerModule = new FeedbackLayerModule(this)
    this.rewardLayerModule = new RewardLayer(this)
    this.overlayLayerModule = new OverlayLayer(this)
  }

  create() {
    this.cameras.main.setBackgroundColor(COLORS.bg)
    this.cameras.main.roundPixels = true
    this.configureViewport()
    this.layoutMetrics = this.getCurrentLayoutMetrics()
    this.ensureLabTextures()

    this.backdropLayer = this.add.container(0, 0).setDepth(DEPTH.BACKDROP)
    this.gameplayLayer = this.add.container(0, 0).setDepth(DEPTH.BOARD)
    this.feedbackRoot = this.add.container(0, 0).setDepth(DEPTH.FEEDBACK)
    this.overlayRoot = this.add.container(0, 0).setDepth(DEPTH.OVERLAY)
    this.stateLayer = this.add.container(0, 0).setDepth(DEPTH.STATE)

    this.createBackdrop()
    this.createArtisticFrame()

    this.hudLayerModule.create()
    this.cluePanelLayerModule.create()
    this.feedbackLayerModule.create()
    this.rewardLayerModule.create()
    this.diagnosisBarLayerModule.create()
    this.startGuessCaretBlink()
    this.keyboardPanelLayerModule.create()
    this.actionRowLayerModule.create()
    this.overlayLayerModule.create()
    this.createOnboardingArtifacts()
    this.registerHardwareKeyboard()
    this.input.on('pointerdown', this.handleScenePointerDown, this)
    this.applyLayoutMetrics()
    if (DEBUG_RENDER_AUDIT && DEBUG_RENDER_OVERLAY) {
      this.createDebugAuditOverlay()
    }

    this.scale.on('resize', this.handleResize, this)
    this.applySnapshot()
    if (DEBUG_RENDER_AUDIT) {
      this.runRenderAudit('create')
    }
  }

  shutdown() {
    this.scale.off('resize', this.handleResize, this)
    this.input.off('pointerdown', this.handleScenePointerDown, this)
    this.input.keyboard?.off('keydown', this.handleHardwareKeyDown, this)
    this.guessBarGlowTween?.stop()
    this.guessBarScanTween?.stop()
    this.guessCaretBlinkEvent?.remove(false)
    this.overlayBeamTween?.stop()
    this.guessBarResetEvent?.remove(false)
    this.feedbackHideEvent?.remove(false)
    this.overlayDnaLoopEvent?.remove(false)
    this.outerFramePulseTween?.stop()
    this.cleanupOnboardingDemoArtifacts()
    this.clueMaskGraphics?.destroy()
    this.ambientMotes.forEach((mote) => mote.destroy())
    this.feedbackBurstPool.forEach((particle) => particle.destroy())
    this.overlayDnaPool.forEach((particle) => particle.destroy())
    this.headerDnaRotationTween?.stop()
    this.headerDnaIcon?.destroy()
    this.headerFlashSweep?.destroy()
    this.ambientMotes = []
    this.feedbackBurstPool = []
    this.overlayDnaPool = []
    this.headerDnaIcon = undefined
    this.headerDnaRotationTween = undefined
    this.headerFlashSweep = undefined
    this.lastXp = undefined
    this.lastLevel = undefined
    this.isInDangerState = undefined
    this.isFrameInDangerState = undefined
    this.outerFrameContainer?.destroy(true)
    this.outerFrameContainer = undefined
    this.outerFrameBezel = undefined
    this.outerFrameInnerGlow = undefined
    this.outerFrameVignette = undefined
    this.outerFrameCornerMotifs = []
    this.outerFramePulseTween = undefined
  }

  applyBridge() {
    if (this.sys.isActive()) {
      this.applySnapshot()
    }
  }

  private handleResize = () => {
    this.syncRenderSurface('resize')
  }

  private getDisplayLayoutSize() {
    const parentWidth = Math.round(this.scale.parentSize.width || 0)
    const parentHeight = Math.round(this.scale.parentSize.height || 0)

    return {
      width: Math.max(1, parentWidth || Math.round(this.scale.gameSize.width || LOGICAL_WIDTH)),
      height: Math.max(1, parentHeight || Math.round(this.scale.gameSize.height || LOGICAL_HEIGHT)),
    }
  }

  private getRenderCanvasSize() {
    const canvas = this.sys.game.canvas

    return {
      width: Math.max(1, Math.round(canvas?.width || this.scale.gameSize.width || LOGICAL_WIDTH)),
      height: Math.max(1, Math.round(canvas?.height || this.scale.gameSize.height || LOGICAL_HEIGHT)),
    }
  }

  private getRenderResolutionFactor() {
    const renderWidth = this.getRenderCanvasSize().width
    const { width } = this.getDisplayLayoutSize()

    return Phaser.Math.Clamp(renderWidth / Math.max(1, width), 1, MAX_RENDER_DPR)
  }

  private getCurrentLayoutMetrics() {
    const { width, height } = this.getDisplayLayoutSize()

    return getLayoutMetrics(width, height)
  }

  private registerHardwareKeyboard() {
    this.input.keyboard?.on('keydown', this.handleHardwareKeyDown, this)
  }

  private handleHardwareKeyDown(event: KeyboardEvent) {
    const activeElement = document.activeElement
    const activeTag = activeElement instanceof HTMLElement ? activeElement.tagName : ''

    if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) {
      return
    }

    if (this.onboardingState === 'awaiting_tap') {
      event.preventDefault()
      return
    }

    if (this.isOnboardingBlockingInput()) {
      this.skipOnboardingDemo()
      event.preventDefault()
      return
    }

    if (
      activeTag === 'INPUT' ||
      activeTag === 'TEXTAREA' ||
      activeTag === 'BUTTON' ||
      activeTag === 'SELECT' ||
      activeTag === 'A' ||
      activeElement instanceof HTMLTextAreaElement
    ) {
      return
    }

    const key = event.key
    const upper = key.toUpperCase()

    if (/^[A-Z]$/.test(upper)) {
      if (!event.repeat) {
        this.handleKeyPressIntent(upper)
        event.preventDefault()
      }
      return
    }

    if (key === 'Backspace' || key === 'Delete') {
      this.handleBackspaceIntent()
      event.preventDefault()
      return
    }

    if (key === 'Enter' && !event.repeat) {
      this.handleSubmitIntent()
      event.preventDefault()
      return
    }

    if (key === 'Escape' && !event.repeat) {
      this.handleClearIntent()
      event.preventDefault()
    }
  }

  private configureViewport() {
    const { width: renderWidth, height: renderHeight } = this.getRenderCanvasSize()
    const { width, height } = this.getDisplayLayoutSize()
    const renderResolution = this.getRenderResolutionFactor()

    this.cameras.main.setViewport(0, 0, renderWidth, renderHeight)
    this.cameras.main.setSize(renderWidth, renderHeight)
    this.cameras.main.setScroll(0, 0)
    this.cameras.main.setZoom(renderResolution)
    this.cameras.main.setBounds(0, 0, width, height)
  }

  public syncRenderSurface(reason = 'render-surface') {
    this.configureViewport()
    this.layoutMetrics = this.getCurrentLayoutMetrics()
    this.applyLayoutMetrics()
    this.applySnapshot()
    if (DEBUG_RENDER_AUDIT) {
      this.runRenderAudit(reason)
    }
  }

  private applyLayoutMetrics() {
    this.layoutBackdrop()
    this.layoutArtisticFrame()
    this.hudLayerModule.relayout()
    this.cluePanelLayerModule.relayout()
    this.diagnosisBarLayerModule.relayout()
    this.keyboardPanelLayerModule.relayout()
    this.actionRowLayerModule.relayout()
    this.feedbackLayerModule.relayout()
    this.rewardLayerModule.relayout()
    this.overlayLayerModule.relayout()
    this.layoutOnboardingArtifacts()
  }

  private createOnboardingArtifacts() {
    if (!this.feedbackRoot) {
      return
    }

    const layer = this.add.container(0, 0)
    const clueFocus = this.add
      .rectangle(0, 0, 10, 10, COLORS.cyan, 0)
      .setOrigin(0)
      .setStrokeStyle(2, COLORS.cyan, 0.7)
    const submitFocus = this.add
      .rectangle(0, 0, 10, 10, COLORS.emeraldGlow, 0)
      .setOrigin(0)
      .setStrokeStyle(2, COLORS.emeraldGlow, 0.8)
    const ghostGuess = this.createText(0, 0, '', {
      fontFamily: 'Arial',
      fontSize: this.toFontPx(this.layoutMetrics.typography.guessValue),
      color: '#d8fff1',
      fontStyle: 'bold',
      align: 'center',
    })
    ghostGuess.setOrigin(0.5, 0)
    ghostGuess.setAlpha(0)
    const helperLabel = this.createText(0, 0, '', {
      fontFamily: 'Arial',
      fontSize: this.toFontPx(Math.max(11, this.layoutMetrics.typography.headerStatus)),
      color: '#d8fff1',
      fontStyle: '600',
      align: 'center',
    })
    helperLabel.setOrigin(0.5, 1)
    helperLabel.setAlpha(0)
    const beginHint = this.createText(0, 0, 'Tap to begin', {
      fontFamily: 'Arial',
      fontSize: this.toFontPx(Math.max(11, this.layoutMetrics.typography.headerStatus)),
      color: COLORS.textMuted,
      align: 'center',
    })
    beginHint.setOrigin(0.5, 1)
    beginHint.setAlpha(0)
    const skipHint = this.createText(0, 0, 'Tap to skip', {
      fontFamily: 'Arial',
      fontSize: this.toFontPx(Math.max(10, this.layoutMetrics.typography.headerStatus - 1)),
      color: COLORS.textMuted,
    })
    skipHint.setOrigin(1, 0)
    skipHint.setAlpha(0)

    layer.add([clueFocus, submitFocus, ghostGuess, helperLabel, beginHint, skipHint])
    layer.setVisible(false)
    this.feedbackRoot.add(layer)
    this.onboardingLayer = layer
    this.onboardingClueFocus = clueFocus
    this.onboardingSubmitFocus = submitFocus
    this.onboardingGhostGuess = ghostGuess
    this.onboardingHelperLabel = helperLabel
    this.onboardingBeginHint = beginHint
    this.onboardingSkipHint = skipHint
    this.layoutOnboardingArtifacts()
  }

  private layoutOnboardingArtifacts() {
    if (!this.onboardingLayer) {
      return
    }

    const { board, clues, guessBar } = this.layoutMetrics
    this.onboardingSkipHint?.setPosition(board.x + board.width - 10, board.y + 10)
    this.onboardingGhostGuess?.setPosition(
      guessBar.x + Math.round(guessBar.width / 2),
      guessBar.y + guessBar.valueY,
    )
    this.onboardingHelperLabel?.setPosition(
      guessBar.x + Math.round(guessBar.width / 2),
      guessBar.y - 8,
    )
    this.onboardingBeginHint?.setPosition(
      guessBar.x + Math.round(guessBar.width / 2),
      guessBar.y + guessBar.height + 22,
    )
    if (this.onboardingClueFocus) {
      this.onboardingClueFocus.setPosition(clues.x + 6, clues.y + 32)
      this.setRectangleDimensions(
        this.onboardingClueFocus,
        Math.max(40, clues.width - 12),
        Math.max(40, Math.min(84, clues.height - 44)),
      )
    }

    if (this.onboardingSubmitFocus && this.actionButtons?.submit && this.actionRowRegion && this.keyboardRegion) {
      const submitX =
        this.layoutMetrics.keyboard.x +
        this.actionRowRegion.x +
        this.actionButtons.submit.container.x
      const submitY =
        this.layoutMetrics.keyboard.y +
        this.actionRowRegion.y +
        this.actionButtons.submit.container.y
      this.onboardingSubmitFocus.setPosition(submitX - 4, submitY - 4)
      this.setRectangleDimensions(
        this.onboardingSubmitFocus,
        Math.round(this.actionButtons.submit.background.width) + 8,
        Math.round(this.actionButtons.submit.background.height) + 8,
      )
    }

    this.layoutOnboardingDemoClue()
  }

  public bootHudLayer() {
    this.createHeader()
  }

  public relayoutHudLayer() {
    this.layoutHeader()
  }

  public renderHudLayer(viewModel: PhaserGameSessionSnapshot) {
    this.syncHeader(viewModel)
  }

  public bootCluePanelLayer() {
    this.createClueStack()
  }

  public relayoutCluePanelLayer() {
    this.layoutClueStack()
  }

  public renderCluePanelLayer(viewModel: PhaserGameSessionSnapshot, previous?: PhaserGameSessionSnapshot) {
    this.syncClues(viewModel, previous)
  }

  public bootDiagnosisBarLayer() {
    this.createGuessBar()
  }

  public relayoutDiagnosisBarLayer() {
    this.layoutGuessBar()
  }

  public renderDiagnosisBarLayer(viewModel: PhaserGameSessionSnapshot) {
    this.syncGuessBar(viewModel)
  }

  public bootActionRowLayer() {
    this.createActionRow()
  }

  public relayoutActionRowLayer() {
    this.layoutActionRow()
  }

  public renderActionRowLayer(viewModel: PhaserGameSessionSnapshot) {
    this.syncActionRow(viewModel)
  }

  public bootKeyboardPanelLayer() {
    this.createKeyboard()
  }

  public relayoutKeyboardPanelLayer() {
    this.layoutKeyboard()
  }

  public renderKeyboardPanelLayer(viewModel: PhaserGameSessionSnapshot) {
    this.syncKeyboard(viewModel)
  }

  public bootFeedbackLayer() {
    this.createFeedbackLayer()
  }

  public relayoutFeedbackLayer() {
    this.layoutFeedbackLayer()
  }

  public renderFeedbackLayer(viewModel: PhaserGameSessionSnapshot, previous?: PhaserGameSessionSnapshot) {
    this.syncFeedback(viewModel, previous)
  }

  public bootRewardLayer() {
    this.createRewardToast()
  }

  public relayoutRewardLayer() {
    this.layoutRewardToast()
  }

  public renderRewardLayer(_viewModel: PhaserGameSessionSnapshot) {
    // Reward presentation is transition-driven off snapshot diffs in applySnapshot.
  }

  public bootOverlayLayer() {
    this.createEndOverlay()
    this.createStatePanel()
  }

  public relayoutOverlayLayer() {
    this.layoutEndOverlay()
    this.layoutStatePanel()
  }

  public renderOverlayLayer(viewModel: PhaserGameSessionSnapshot, previous?: PhaserGameSessionSnapshot) {
    this.syncEndOverlay(viewModel, previous)
  }

  private syncVisualState(
    snapshot: PhaserGameSessionSnapshot,
    previousSnapshot: PhaserGameSessionSnapshot | undefined,
  ) {
    if (snapshot.loopState === 'loading_case') {
      this.visualState = 'loading_case'
      return
    }

    if (snapshot.loopState === 'waiting_next_case') {
      this.visualState = 'waiting_next_case'
      return
    }

    if (snapshot.loopState === 'blocked') {
      this.visualState = 'blocked'
      return
    }

    if (snapshot.mode === 'SUBMITTING') {
      this.visualState = 'submitting'
      return
    }

    if (snapshot.mode === 'FINAL_FEEDBACK') {
      this.visualState = 'round_complete'
      return
    }

    const clueRevealAdvanced = snapshot.revealedClueCount > (previousSnapshot?.revealedClueCount ?? 0)
    if (clueRevealAdvanced) {
      this.visualState = 'reveal_next_clue'
      return
    }

    if (
      snapshot.latestAttempt &&
      snapshot.latestAttempt.label !== previousSnapshot?.latestAttempt?.label
    ) {
      this.visualState = 'guess_result'
      return
    }

    if (!previousSnapshot || previousSnapshot.loopState === 'loading_case') {
      this.visualState = 'round_intro'
      return
    }

    this.visualState = 'playing'
  }

  private shouldRunOnboardingDemo(snapshot: PhaserGameSessionSnapshot) {
    if (snapshot.mode !== 'PLAYING' || !snapshot.canEditGuess || this.onboardingState !== 'inactive') {
      return false
    }

    try {
      const force =
        import.meta.env.DEV &&
        window.localStorage.getItem(ONBOARDING_FORCE_STORAGE_KEY) === '1'
      if (force) {
        return true
      }

      return window.localStorage.getItem(ONBOARDING_SEEN_STORAGE_KEY) !== '1'
    } catch {
      return false
    }
  }

  private queueOnboardingStep(delay: number, callback: () => void) {
    const event = this.time.delayedCall(delay, callback)
    this.onboardingEvents.push(event)
  }

  private isOnboardingBlockingInput() {
    return this.onboardingState === 'pending' || this.onboardingState === 'playing' || this.onboardingState === 'awaiting_tap'
  }

  private isOnboardingSkipCooldownActive() {
    return this.time.now < this.onboardingSkipCooldownUntil
  }

  private maybeStartOnboardingDemo(snapshot: PhaserGameSessionSnapshot) {
    if (!this.shouldRunOnboardingDemo(snapshot)) {
      return
    }

    this.onboardingState = 'pending'
    this.queueOnboardingStep(180, () => {
      if (this.onboardingState === 'pending') {
        this.startOnboardingDemo()
      }
    })
  }

  private startOnboardingDemo() {
    if (!this.onboardingLayer || !this.guessBar || !this.actionButtons?.submit) {
      this.finishOnboardingDemo(false)
      return
    }

    this.ensureOnboardingDemoClue()

    this.onboardingState = 'playing'
    this.layoutOnboardingArtifacts()
    this.onboardingLayer.setVisible(true)
    this.setLiveClueStackOnboardingPresentation(true)
    this.onboardingGhostGuess?.setText('')
    this.onboardingGhostGuess?.setAlpha(0)
    this.onboardingHelperLabel?.setAlpha(0)
    this.onboardingHelperLabel?.setText('')
    this.onboardingBeginHint?.setAlpha(0)
    this.onboardingSkipHint?.setAlpha(0.6)
    this.onboardingClueFocus?.setAlpha(0)
    this.onboardingSubmitFocus?.setAlpha(0)
    this.onboardingDemoClueContainer?.setAlpha(0)
    this.onboardingDemoClueContainer?.setScale(0.992)
    this.onboardingDemoLabel?.setAlpha(0)

    const guessCenterX = this.layoutMetrics.guessBar.x + Math.round(this.layoutMetrics.guessBar.width / 2)
    const clueHelperY = this.layoutMetrics.clues.y + 26
    const guessHelperY = this.layoutMetrics.guessBar.y - 8
    const submitHelperX =
      this.onboardingSubmitFocus?.x !== undefined && this.onboardingSubmitFocus.width > 0
        ? this.onboardingSubmitFocus.x + Math.round(this.onboardingSubmitFocus.width / 2)
        : guessCenterX
    const submitHelperY =
      this.onboardingSubmitFocus?.y !== undefined
        ? this.onboardingSubmitFocus.y - 8
        : this.layoutMetrics.actions.y - 8

    this.showOnboardingHelper('Read the clues', guessCenterX, clueHelperY)
    if (this.onboardingDemoClueContainer) {
      this.tweens.add({
        targets: this.onboardingDemoClueContainer,
        alpha: 1,
        scaleX: 1,
        scaleY: 1,
        duration: 180,
        ease: 'Sine.Out',
      })
    }
    if (this.onboardingDemoLabel) {
      this.tweens.add({
        targets: this.onboardingDemoLabel,
        alpha: 0.74,
        duration: 150,
        ease: 'Sine.Out',
      })
    }
    this.pulseOnboardingFocus(this.onboardingClueFocus, 240)

    const clueIntroDuration = 300
    const clueHoldDuration = 1350
    const typingLeadDuration = 180
    const typingBaseInterval = 190
    const typingJitter = 28
    const typingHoldDuration = 700
    const submitFocusLeadDuration = 220
    const submitPressDuration = 180
    const submitHoldDuration = 700
    const handoffSettleDuration = 260
    const finishSettleDuration = 340

    const characters = Array.from(ONBOARDING_GHOST_GUESS)
    let typed = ''
    let timeline = 0
    const queueAfter = (delay: number, callback: () => void) => {
      timeline += delay
      this.queueOnboardingStep(timeline, callback)
    }

    queueAfter(clueIntroDuration + clueHoldDuration, () => {
      if (this.onboardingState !== 'playing') {
        return
      }

      this.showOnboardingHelper('Type a diagnosis', guessCenterX, guessHelperY)
      this.pulseHalo(COLORS.cyan, 0.12)
    })
    timeline += typingLeadDuration
    characters.forEach((character, index) => {
      if (index > 0) {
        timeline += typingBaseInterval + Phaser.Math.Between(-typingJitter, typingJitter)
      }

      this.queueOnboardingStep(timeline, () => {
        if (this.onboardingState !== 'playing') {
          return
        }

        typed += character
        if (this.onboardingGhostGuess) {
          this.onboardingGhostGuess.setText(`${typed}${index === characters.length - 1 ? '' : '|'}`)
          this.onboardingGhostGuess.setAlpha(1)
        }
      })
    })

    queueAfter(typingHoldDuration, () => {
      if (this.onboardingState !== 'playing') {
        return
      }

      this.onboardingGhostGuess?.setText(ONBOARDING_GHOST_GUESS)
      this.showOnboardingHelper('Submit your guess', submitHelperX, submitHelperY)
      this.pulseOnboardingFocus(this.onboardingSubmitFocus, 220)
    })

    queueAfter(submitFocusLeadDuration, () => {
      if (this.onboardingState !== 'playing' || !this.actionButtons?.submit) {
        return
      }

      this.setPressableVisualState(this.actionButtons.submit, 'pressed')
      this.tweens.add({
        targets: this.actionButtons.submit.glow,
        alpha: { from: this.actionButtons.submit.glow.alpha, to: 0.34 },
        duration: 90,
        yoyo: true,
        ease: 'Quad.Out',
      })
    })

    queueAfter(submitPressDuration, () => {
      if (this.actionButtons?.submit) {
        this.setPressableVisualState(this.actionButtons.submit, 'rest')
      }
      this.pulseHalo(COLORS.emeraldGlow, 0.16)
    })

    queueAfter(submitHoldDuration, () => {
      if (this.onboardingState !== 'playing') {
        return
      }

      this.setLiveClueStackOnboardingPresentation(false)
      this.hideOnboardingHelper(100)
      if (this.onboardingDemoClueContainer) {
        this.tweens.add({
          targets: this.onboardingDemoClueContainer,
          alpha: 0,
          duration: 180,
          ease: 'Sine.In',
        })
      }
      if (this.onboardingDemoLabel) {
        this.tweens.add({
          targets: this.onboardingDemoLabel,
          alpha: 0,
          duration: 120,
          ease: 'Sine.In',
        })
      }
    })

    queueAfter(handoffSettleDuration, () => {
      if (this.onboardingState !== 'playing') {
        return
      }

      this.onboardingGhostGuess?.setAlpha(0)
      this.pulseOnboardingInputCue()
    })

    queueAfter(finishSettleDuration, () => {
      this.beginOnboardingTapToBegin()
    })
  }

  private showOnboardingHelper(text: string, x: number, y: number) {
    if (!this.onboardingHelperLabel) {
      return
    }

    this.tweens.killTweensOf(this.onboardingHelperLabel)
    const applyLabel = () => {
      if (!this.onboardingHelperLabel) {
        return
      }

      this.onboardingHelperLabel
        .setText(text)
        .setPosition(Math.round(x), Math.round(y))
        .setAlpha(0)
        .setScale(0.99)
      this.tweens.add({
        targets: this.onboardingHelperLabel,
        alpha: 0.88,
        scaleX: 1,
        scaleY: 1,
        duration: 140,
        ease: 'Sine.Out',
      })
    }

    if (this.onboardingHelperLabel.alpha > 0.02) {
      this.tweens.add({
        targets: this.onboardingHelperLabel,
        alpha: 0,
        duration: 80,
        ease: 'Sine.In',
        onComplete: applyLabel,
      })
      return
    }

    applyLabel()
  }

  private hideOnboardingHelper(duration = 100) {
    if (!this.onboardingHelperLabel) {
      return
    }

    this.tweens.killTweensOf(this.onboardingHelperLabel)
    this.tweens.add({
      targets: this.onboardingHelperLabel,
      alpha: 0,
      duration,
      ease: 'Sine.In',
      onComplete: () => {
        this.onboardingHelperLabel?.setText('')
      },
    })
  }

  private showOnboardingBeginHint() {
    if (!this.onboardingBeginHint) {
      return
    }

    this.tweens.killTweensOf(this.onboardingBeginHint)
    this.onboardingBeginHint.setAlpha(0)
    this.tweens.add({
      targets: this.onboardingBeginHint,
      alpha: 0.72,
      duration: 140,
      ease: 'Sine.Out',
    })
  }

  private hideOnboardingBeginHint(duration = 100) {
    if (!this.onboardingBeginHint) {
      return
    }

    this.tweens.killTweensOf(this.onboardingBeginHint)
    if (duration <= 0) {
      this.onboardingBeginHint.setAlpha(0)
      return
    }

    this.tweens.add({
      targets: this.onboardingBeginHint,
      alpha: 0,
      duration,
      ease: 'Sine.In',
    })
  }

  private ensureOnboardingDemoClue() {
    if (!this.onboardingLayer || this.onboardingDemoClueContainer) {
      this.layoutOnboardingDemoClue()
      return
    }

    const container = this.add.container(0, 0)
    const wash = this.add.rectangle(0, 0, 10, 10, COLORS.bgAccentSoft, 0.34).setOrigin(0)
    const shadow = this.add.rectangle(0, 0, 10, 10, COLORS.shadow, 0.22).setOrigin(0)
    const background = this.add
      .rectangle(0, 0, 10, 10, COLORS.skySoft, 0.96)
      .setOrigin(0)
      .setStrokeStyle(1, COLORS.cyan, 0.82)
    const accent = this.add.rectangle(0, 0, 10, 10, COLORS.cyan, 0.88).setOrigin(0)
    const frame = this.add
      .rectangle(0, 0, 10, 10, 0xffffff, 0)
      .setOrigin(0)
      .setStrokeStyle(1, COLORS.cyan, 0.2)
    const text = this.createText(0, 0, ONBOARDING_DEMO_CLUE, {
      fontFamily: 'Arial',
      fontSize: this.toFontPx(this.layoutMetrics.typography.clueValue),
      color: COLORS.text,
      wordWrap: { width: 10, useAdvancedWrap: true },
      lineSpacing: Math.max(2, Math.round(this.layoutMetrics.typography.clueValue * 0.22)),
    })
    const label = this.createText(0, 0, 'EXAMPLE', {
      fontFamily: 'Arial',
      fontSize: this.toFontPx(Math.max(10, this.layoutMetrics.typography.clueCaption - 1)),
      color: '#a5f3fc',
      fontStyle: 'bold',
    })

    container.add([wash, shadow, background, accent, frame, text])
    this.onboardingLayer.add([container, label])

    this.onboardingDemoClueContainer = container
    this.onboardingDemoClueWash = wash
    this.onboardingDemoClueShadow = shadow
    this.onboardingDemoClueBackground = background
    this.onboardingDemoClueAccent = accent
    this.onboardingDemoClueFrame = frame
    this.onboardingDemoClueText = text
    this.onboardingDemoLabel = label
    this.layoutOnboardingDemoClue()
  }

  private layoutOnboardingDemoClue() {
    if (
      !this.onboardingDemoClueContainer ||
      !this.onboardingDemoClueWash ||
      !this.onboardingDemoClueShadow ||
      !this.onboardingDemoClueBackground ||
      !this.onboardingDemoClueAccent ||
      !this.onboardingDemoClueFrame ||
      !this.onboardingDemoClueText ||
      !this.onboardingDemoLabel
    ) {
      return
    }

    const { clues, typography } = this.layoutMetrics
    const width = Math.max(120, clues.width - clues.cardInset * 2)
    const textInsetX = Math.max(12, Math.round(width * 0.045))
    const textTop = Math.max(18, Math.round(clues.height * (32 / 340)))
    const minHeight = Math.max(72, Math.round(clues.height * (96 / 340)))
    const shadowOffset = Math.max(4, Math.round(clues.height * (8 / 340)))
    const accentWidth = Math.max(4, Math.round(width * 0.017))
    const cardX = Math.round(clues.cardInset)
    const cardY = Math.round(clues.minTopInset)

    this.onboardingDemoClueContainer.setPosition(clues.x, clues.y)
    this.setRectangleDimensions(this.onboardingDemoClueWash, clues.width, clues.height)
    this.onboardingDemoClueWash.setPosition(0, 0)

    this.onboardingDemoClueText.setFontSize(this.toFontPx(typography.clueValue))
    this.onboardingDemoClueText.setLineSpacing(Math.max(2, Math.round(typography.clueValue * 0.22)))
    this.onboardingDemoClueText.setWordWrapWidth(width - textInsetX * 2)
    this.onboardingDemoClueText.setPosition(cardX + textInsetX, cardY + textTop)

    const cardHeight = Math.max(
      minHeight,
      Math.round(textTop + this.onboardingDemoClueText.height + Math.max(18, clues.height * (22 / 340))),
    )

    this.onboardingDemoClueShadow.setPosition(cardX, cardY + shadowOffset)
    this.setRectangleDimensions(this.onboardingDemoClueShadow, width, cardHeight)
    this.onboardingDemoClueBackground.setPosition(cardX, cardY)
    this.setRectangleDimensions(this.onboardingDemoClueBackground, width, cardHeight)
    this.onboardingDemoClueAccent.setPosition(cardX, cardY)
    this.setRectangleDimensions(this.onboardingDemoClueAccent, accentWidth, cardHeight)
    this.onboardingDemoClueFrame.setPosition(cardX + 3, cardY + 3)
    this.setRectangleDimensions(this.onboardingDemoClueFrame, Math.max(1, width - 6), Math.max(1, cardHeight - 6))

    this.onboardingDemoLabel
      .setPosition(clues.x + clues.captionX, clues.y + Math.max(34, clues.minTopInset - 14))
      .setFontSize(this.toFontPx(Math.max(10, typography.clueCaption - 1)))
  }

  private pulseOnboardingFocus(target: Phaser.GameObjects.Rectangle | undefined, duration: number) {
    if (!target) {
      return
    }

    this.tweens.killTweensOf(target)
    target.setAlpha(0.72)
    target.setScale(0.992)
    this.tweens.add({
      targets: target,
      alpha: 0,
      scaleX: 1.02,
      scaleY: 1.02,
      duration,
      ease: 'Cubic.Out',
      onComplete: () => {
        target.setScale(1)
      },
    })
  }

  private pulseOnboardingInputCue() {
    if (!this.guessBar) {
      return
    }

    this.tweens.killTweensOf(this.guessBar.container)
    this.tweens.add({
      targets: this.guessBar.container,
      scaleX: 1.012,
      scaleY: 1.012,
      duration: 110,
      yoyo: true,
      ease: 'Quad.Out',
      onComplete: () => {
        this.guessBar?.container.setScale(1)
      },
    })
    this.pulseHalo(COLORS.emeraldGlow, 0.14)
  }

  private beginOnboardingTapToBegin() {
    if (this.onboardingState !== 'playing') {
      return
    }

    this.markOnboardingDemoSeen()
    this.cleanupOnboardingDemoArtifacts()
    this.onboardingState = 'awaiting_tap'
    this.onboardingLayer?.setVisible(true)
    this.queueOnboardingStep(520, () => {
      if (this.onboardingState !== 'awaiting_tap') {
        return
      }

      this.showOnboardingBeginHint()
    })
  }

  private completeOnboardingTapToBegin() {
    if (this.onboardingState !== 'awaiting_tap') {
      return
    }

    this.onboardingSkipCooldownUntil = this.time.now + 180
    this.hideOnboardingBeginHint(90)
    this.onboardingState = 'complete'
    this.pulseOnboardingInputCue()
    this.queueOnboardingStep(110, () => {
      if (this.onboardingState === 'complete') {
        this.onboardingLayer?.setVisible(false)
      }
    })
    this.applySnapshot()
  }

  private setLiveClueStackOnboardingPresentation(active: boolean, immediate = false) {
    if (!this.clueStackRegion) {
      return
    }

    const targetAlpha = active ? 0 : 1
    this.tweens.killTweensOf(this.clueStackRegion)

    if (active || immediate) {
      this.clueStackRegion.setAlpha(targetAlpha)
      return
    }

    this.tweens.add({
      targets: this.clueStackRegion,
      alpha: targetAlpha,
      duration: active ? 180 : 220,
      ease: active ? 'Sine.Out' : 'Sine.InOut',
    })
  }

  private skipOnboardingDemo() {
    if (!this.isOnboardingBlockingInput()) {
      return
    }

    this.onboardingSkipCooldownUntil = this.time.now + 180
    this.onboardingState = 'skipped'
    this.setLiveClueStackOnboardingPresentation(false, true)
    this.finishOnboardingDemo(true)
  }

  private finishOnboardingDemo(markSeen: boolean) {
    if (markSeen) {
      this.markOnboardingDemoSeen()
    }

    this.cleanupOnboardingDemoArtifacts()
    this.onboardingState = markSeen ? 'complete' : 'inactive'
    this.applySnapshot()
  }

  private cleanupOnboardingDemoArtifacts() {
    this.onboardingEvents.forEach((event) => event.remove(false))
    this.onboardingEvents = []
    this.setLiveClueStackOnboardingPresentation(false, true)

    if (this.onboardingGhostGuess) {
      this.tweens.killTweensOf(this.onboardingGhostGuess)
      this.onboardingGhostGuess.setAlpha(0)
      this.onboardingGhostGuess.setText('')
    }
    if (this.onboardingHelperLabel) {
      this.tweens.killTweensOf(this.onboardingHelperLabel)
      this.onboardingHelperLabel.setAlpha(0)
      this.onboardingHelperLabel.setScale(1)
      this.onboardingHelperLabel.setText('')
    }
    if (this.onboardingBeginHint) {
      this.tweens.killTweensOf(this.onboardingBeginHint)
      this.onboardingBeginHint.setAlpha(0)
    }
    if (this.onboardingClueFocus) {
      this.tweens.killTweensOf(this.onboardingClueFocus)
      this.onboardingClueFocus.setAlpha(0)
      this.onboardingClueFocus.setScale(1)
    }
    if (this.onboardingSubmitFocus) {
      this.tweens.killTweensOf(this.onboardingSubmitFocus)
      this.onboardingSubmitFocus.setAlpha(0)
      this.onboardingSubmitFocus.setScale(1)
    }
    if (this.onboardingDemoLabel) {
      this.tweens.killTweensOf(this.onboardingDemoLabel)
      this.onboardingDemoLabel.destroy()
      this.onboardingDemoLabel = undefined
    }
    if (this.onboardingDemoClueContainer) {
      this.tweens.killTweensOf(this.onboardingDemoClueContainer)
      this.onboardingDemoClueContainer.destroy(true)
      this.onboardingDemoClueContainer = undefined
    }
    this.onboardingDemoClueWash = undefined
    this.onboardingDemoClueShadow = undefined
    this.onboardingDemoClueBackground = undefined
    this.onboardingDemoClueAccent = undefined
    this.onboardingDemoClueFrame = undefined
    this.onboardingDemoClueText = undefined
    if (this.onboardingSkipHint) {
      this.tweens.killTweensOf(this.onboardingSkipHint)
      this.onboardingSkipHint.setAlpha(0)
    }
    if (this.actionButtons?.submit) {
      this.setPressableVisualState(this.actionButtons.submit, 'rest')
    }
    this.onboardingLayer?.setVisible(false)
  }

  private markOnboardingDemoSeen() {
    try {
      window.localStorage.setItem(ONBOARDING_SEEN_STORAGE_KEY, '1')
    } catch {
      // Ignore persistence failures and continue with normal play.
    }
  }

  private handleScenePointerDown() {
    if (this.onboardingState === 'awaiting_tap') {
      this.completeOnboardingTapToBegin()
      return
    }

    if (this.isOnboardingBlockingInput()) {
      this.skipOnboardingDemo()
    }
  }

  private toFontPx(value: number) {
    return `${Math.max(1, Math.round(value))}px`
  }

  private setRectangleDimensions(target: Phaser.GameObjects.Rectangle, width: number, height: number) {
    target.setSize(width, height)
    target.setDisplaySize(width, height)
  }

  private setButtonFrame(view: PressableButtonView, width: number, height: number, fontSize: number) {
    this.setRectangleDimensions(view.glow, width + 10, height + 10)
    this.setRectangleDimensions(view.shadow, width, height)
    this.setRectangleDimensions(view.background, width, height)
    this.setRectangleDimensions(view.shine, Math.max(22, Math.round(width * 0.36)), Math.max(10, Math.round(height * 0.22)))
    view.shine.setPosition(Math.round(width * 0.12), Math.round(height * 0.18))
    view.label.setPosition(Math.round(width / 2), Math.round(height / 2))
    view.label.setFontSize(this.toFontPx(fontSize))
    if (view.enabled) {
      view.background.setInteractive({ useHandCursor: true })
    }
  }

  private refreshGuessBarScan(state: GuessBarState, color: number) {
    if (!this.guessBar) {
      return
    }

    const shouldScan = state === 'submitting' || state === 'correct'
    this.guessBar.scan.setFillStyle(color, shouldScan ? 0.16 : 0)

    if (!shouldScan) {
      this.guessBarScanTween?.stop()
      this.guessBarScanTween = undefined
      this.guessBar.scan.setAlpha(0)
      return
    }

    this.guessBar.scan.setVisible(true)
    this.guessBar.scan.setAlpha(state === 'submitting' ? 0.18 : 0.12)
    this.guessBar.scan.setX(-Math.round(this.layoutMetrics.guessBar.width * 0.22))

    if (this.guessBarScanTween?.isPlaying()) {
      return
    }

    this.guessBarScanTween = this.tweens.add({
      targets: this.guessBar.scan,
      x: this.layoutMetrics.guessBar.width + Math.round(this.layoutMetrics.guessBar.width * 0.18),
      duration: state === 'submitting' ? 520 : 780,
      ease: 'Sine.Out',
      repeat: -1,
      repeatDelay: state === 'submitting' ? 120 : 260,
      onRepeat: () => {
        this.guessBar?.scan.setX(-Math.round(this.layoutMetrics.guessBar.width * 0.22))
      },
    })
  }

  private refreshOverlayEffects(active: boolean, color: number) {
    if (!this.endOverlay) {
      return
    }

    this.overlayBeamTween?.stop()
    this.overlayBeamTween = undefined
    this.overlayDnaLoopEvent?.remove(false)
    this.overlayDnaLoopEvent = undefined

    if (!active) {
      this.endOverlay.beam.setAlpha(0)
      return
    }

    this.endOverlay.beam.setFillStyle(color, 0.16)
    this.endOverlay.beam.setAlpha(0.1)
    this.endOverlay.beam.setX(-Math.round(this.layoutMetrics.overlay.width * 0.22))
    this.overlayBeamTween = this.tweens.add({
      targets: this.endOverlay.beam,
      x: this.layoutMetrics.overlay.width + Math.round(this.layoutMetrics.overlay.width * 0.16),
      duration: 980,
      ease: 'Sine.Out',
      onComplete: () => {
        this.endOverlay?.beam.setAlpha(0)
      },
    })
    this.emitOverlayDnaWave(color)
  }

  private getKeyboardRowLayout(rowLength: number) {
    const { keyboard } = this.layoutMetrics
    const totalGapWidth = keyboard.keyGap * Math.max(0, rowLength - 1)
    const availableWidth = Math.max(1, keyboard.width - keyboard.sideInset * 2 - totalGapWidth)
    const baseWidth = Math.floor(availableWidth / rowLength)
    const remainder = availableWidth - baseWidth * rowLength
    const widths = Array.from({ length: rowLength }, (_, index) => baseWidth + (index < remainder ? 1 : 0))
    const positions: number[] = []
    let x = keyboard.sideInset

    widths.forEach((width) => {
      positions.push(x)
      x += width + keyboard.keyGap
    })

    return { widths, positions }
  }

  private ensureLabTextures() {
    if (!this.textures.exists(LAB_MOTE_TEXTURE)) {
      const mote = this.make.graphics({ x: 0, y: 0 }, false)
      mote.fillStyle(0xffffff, 1)
      mote.fillCircle(6, 6, 5)
      mote.lineStyle(1, 0xb6f5ff, 0.55)
      mote.strokeCircle(6, 6, 5)
      mote.generateTexture(LAB_MOTE_TEXTURE, 12, 12)
      mote.destroy()
    }

    if (!this.textures.exists(LAB_DNA_TEXTURE)) {
      const dna = this.make.graphics({ x: 0, y: 0 }, false)
      dna.lineStyle(2, 0x7dd3fc, 0.82)
      dna.strokeLineShape(new Phaser.Geom.Line(4, 2, 16, 22))
      dna.strokeLineShape(new Phaser.Geom.Line(16, 2, 4, 22))
      dna.fillStyle(0x67e8f9, 0.92)
      dna.fillCircle(4, 2, 2)
      dna.fillCircle(16, 2, 2)
      dna.fillCircle(10, 12, 2)
      dna.fillCircle(4, 22, 2)
      dna.fillCircle(16, 22, 2)
      dna.generateTexture(LAB_DNA_TEXTURE, 20, 24)
      dna.destroy()
    }
  }

  private createImagePool(texture: string, count: number, layer?: Phaser.GameObjects.Container, depth?: number) {
    return Array.from({ length: count }, () => {
      const image = this.add.image(0, 0, texture).setVisible(false).setAlpha(0)
      if (layer) {
        layer.add(image)
      }
      if (typeof depth === 'number') {
        image.setDepth(depth)
      }
      return image
    })
  }

  private getPoolItem(pool: Phaser.GameObjects.Image[], texture: string, layer?: Phaser.GameObjects.Container, depth?: number) {
    const hidden = pool.find((item) => !item.visible)
    if (hidden) {
      return hidden
    }

    const image = this.add.image(0, 0, texture).setVisible(false).setAlpha(0)
    if (layer) {
      layer.add(image)
    }
    if (typeof depth === 'number') {
      image.setDepth(depth)
    }
    pool.push(image)
    return image
  }

  private primeAmbientMotes() {
    if (!this.backdropLayer) {
      return
    }

    const { ambientMotes } = getLabVisualBudget(this.layoutMetrics.board)
    if (this.ambientMotes.length < ambientMotes) {
      const nextMotes = this.createImagePool(LAB_MOTE_TEXTURE, ambientMotes - this.ambientMotes.length, this.backdropLayer)
      this.ambientMotes.push(...nextMotes)
    }

    this.ambientMotes.forEach((mote, index) => {
      mote.setBlendMode(Phaser.BlendModes.ADD)
      this.layoutAmbientMote(mote, index)
      this.tweens.killTweensOf(mote)
      mote.setAlpha(0.08 + (index % 3) * 0.02)
    })
  }

  private layoutAmbientMote(mote: Phaser.GameObjects.Image, index: number) {
    const { board } = this.layoutMetrics
    const column = (index % 5) + 1
    const row = Math.floor(index / 5) + 1
    const x = board.x + Math.round((board.width / 6) * column) + ((index % 2 === 0) ? 6 : -6)
    const y = board.y + Math.round((board.height / 5.5) * row)

    mote.setPosition(x, y)
    mote.setVisible(true)
    mote.setScale(0.46 + (index % 4) * 0.03)
    mote.setTint(index % 2 === 0 ? 0x67e8f9 : 0x99f6e4)
  }

  private emitBurst(
    pool: Phaser.GameObjects.Image[],
    texture: string,
    originX: number,
    originY: number,
    color: number,
    count: number,
    layer?: Phaser.GameObjects.Container,
    depth?: number,
  ) {
    for (let index = 0; index < count; index += 1) {
      const particle = this.getPoolItem(pool, texture, layer, depth)
      const angle = Phaser.Math.DegToRad(-110 + (220 / Math.max(1, count - 1)) * index)
      const radius = 18 + (index % 4) * 8
      const driftX = Math.cos(angle) * radius
      const driftY = Math.sin(angle) * radius

      particle.setVisible(true)
      particle.setAlpha(0.95)
      particle.setTint(color)
      particle.setScale(0.45 + (index % 3) * 0.12)
      particle.setPosition(originX, originY)
      particle.setRotation(angle)
      this.tweens.killTweensOf(particle)
      this.tweens.add({
        targets: particle,
        x: originX + driftX,
        y: originY + driftY,
        alpha: 0,
        scaleX: 0.08,
        scaleY: 0.08,
        angle: particle.angle + ((index % 2 === 0) ? 90 : -90),
        duration: 360 + index * 18,
        ease: 'Cubic.Out',
        onComplete: () => {
          particle.setVisible(false)
        },
      })
    }
  }

  private emitOverlayDnaWave(color: number) {
    if (!this.endOverlay || !this.endOverlay.container.visible) {
      return
    }

    const { overlay } = this.layoutMetrics
    const { overlayDna } = getLabVisualBudget(this.layoutMetrics.board)
    const baseX = overlay.x + overlay.width - overlay.padding - 28
    const baseY = overlay.y + overlay.height - overlay.buttonBottomInset - overlay.buttonHeight - 10

    for (let index = 0; index < overlayDna; index += 1) {
      const helix = this.getPoolItem(this.overlayDnaPool, LAB_DNA_TEXTURE, this.overlayRoot, DEPTH.OVERLAY)
      const offsetX = ((index % 2 === 0) ? -1 : 1) * (8 + (index % 3) * 10)
      const startX = baseX + offsetX
      const startY = baseY + index * 3
      const targetY = startY - (42 + index * 10)

      helix.setVisible(true)
      helix.setAlpha(0.56)
      helix.setTint(color)
      helix.setBlendMode(Phaser.BlendModes.ADD)
      helix.setScale(0.34 + (index % 3) * 0.07)
      helix.setPosition(startX, startY)
      helix.setAngle(index % 2 === 0 ? -8 : 8)
      this.tweens.killTweensOf(helix)
      this.tweens.add({
        targets: helix,
        y: targetY,
        x: startX + ((index % 2 === 0) ? -12 : 12),
        alpha: 0,
        angle: helix.angle + ((index % 2 === 0) ? -28 : 28),
        duration: 620 + index * 45,
        ease: 'Sine.Out',
        onComplete: () => {
          helix.setVisible(false)
        },
      })
    }
  }

  private createDebugAuditOverlay() {
    const text = this.createText(10, 10, '', {
      fontFamily: 'Courier New',
      fontSize: '11px',
      color: '#9fb3c8',
      backgroundColor: 'rgba(4, 7, 13, 0.82)',
      padding: { x: 6, y: 4 },
      lineSpacing: 2,
    })
      .setDepth(DEPTH.DEBUG)
      .setScrollFactor(0)

    this.debugAuditText = text
    this.updateDebugAuditOverlay('boot')
  }

  private getObjectDisplaySize(target: unknown) {
    if (!target || typeof target !== 'object') {
      return { width: null, height: null }
    }

    const gameObject = target as {
      displayWidth?: number
      displayHeight?: number
      width?: number
      height?: number
    }
    const width = typeof gameObject.displayWidth === 'number' ? gameObject.displayWidth : typeof gameObject.width === 'number' ? gameObject.width : null
    const height =
      typeof gameObject.displayHeight === 'number' ? gameObject.displayHeight : typeof gameObject.height === 'number' ? gameObject.height : null

    return { width, height }
  }

  private getAncestorScaleAudit(target: Phaser.GameObjects.GameObject | undefined) {
    let current = target?.parentContainer
    const chain: string[] = []

    while (current) {
      if (isFractionalValue(current.scaleX) || isFractionalValue(current.scaleY) || Math.abs(current.scaleX - 1) > FRACTIONAL_EPSILON || Math.abs(current.scaleY - 1) > FRACTIONAL_EPSILON) {
        chain.push(`${current.type ?? 'Container'}(${formatAuditNumber(current.scaleX)},${formatAuditNumber(current.scaleY)})`)
      }
      current = current.parentContainer
    }

    return {
      ancestorScaled: chain.length > 0,
      ancestorScale: chain.length > 0 ? chain.join(' <- ') : 'none',
    }
  }

  private pushGeometryAuditEntry(entries: GeometryAuditEntry[], label: string, target: Phaser.GameObjects.GameObject | undefined) {
    if (!target) {
      return
    }

    const positionedTarget = target as Phaser.GameObjects.GameObject & {
      x?: number
      y?: number
      scaleX?: number
      scaleY?: number
      type?: string
    }
    const { width, height } = this.getObjectDisplaySize(target)
    const scaleX = typeof positionedTarget.scaleX === 'number' ? positionedTarget.scaleX : null
    const scaleY = typeof positionedTarget.scaleY === 'number' ? positionedTarget.scaleY : null
    const { ancestorScaled, ancestorScale } = this.getAncestorScaleAudit(target)

    entries.push({
      label,
      type: positionedTarget.type ?? target.constructor.name,
      x: typeof positionedTarget.x === 'number' ? positionedTarget.x : null,
      y: typeof positionedTarget.y === 'number' ? positionedTarget.y : null,
      width,
      height,
      scaleX,
      scaleY,
      fractional: [
        positionedTarget.x,
        positionedTarget.y,
        width,
        height,
        scaleX,
        scaleY,
      ].some((value) => isFractionalValue(typeof value === 'number' ? value : null)),
      ancestorScaled,
      ancestorScale,
    })
  }

  private collectGeometryAudit() {
    const entries: GeometryAuditEntry[] = []

    this.pushGeometryAuditEntry(entries, 'backdrop.base', this.backdropBase)
    this.pushGeometryAuditEntry(entries, 'backdrop.wash', this.backdropWash)
    this.pushGeometryAuditEntry(entries, 'clues.tray', this.clueStackTray)
    this.pushGeometryAuditEntry(entries, 'clues.shadow', this.clueStackShadow)
    this.pushGeometryAuditEntry(entries, 'clues.emptyText', this.clueEmptyText)

    Array.from(this.clueCards.values()).forEach((view, index) => {
      this.pushGeometryAuditEntry(entries, `clue.${index}.container`, view.container)
      this.pushGeometryAuditEntry(entries, `clue.${index}.background`, view.background)
      this.pushGeometryAuditEntry(entries, `clue.${index}.accent`, view.accent)
      this.pushGeometryAuditEntry(entries, `clue.${index}.typeText`, view.typeText)
      this.pushGeometryAuditEntry(entries, `clue.${index}.valueText`, view.valueText)
    })

    if (this.guessBar) {
      this.pushGeometryAuditEntry(entries, 'guess.container', this.guessBar.container)
      this.pushGeometryAuditEntry(entries, 'guess.background', this.guessBar.background)
      this.pushGeometryAuditEntry(entries, 'guess.border', this.guessBar.border)
      this.pushGeometryAuditEntry(entries, 'guess.value', this.guessBar.value)
    }

    this.pushGeometryAuditEntry(entries, 'keyboard.region', this.keyboardRegion)
    this.pushGeometryAuditEntry(entries, 'keyboard.tray', this.keyboardTray)
    this.pushGeometryAuditEntry(entries, 'keyboard.key.0.container', this.keyboardButtons[0]?.view.container)
    this.pushGeometryAuditEntry(entries, 'keyboard.key.0.background', this.keyboardButtons[0]?.view.background)
    this.pushGeometryAuditEntry(entries, 'keyboard.key.0.label', this.keyboardButtons[0]?.view.label)
    this.pushGeometryAuditEntry(entries, 'keyboard.space.container', this.spaceButton?.container)
    this.pushGeometryAuditEntry(entries, 'keyboard.space.background', this.spaceButton?.background)
    this.pushGeometryAuditEntry(entries, 'keyboard.space.label', this.spaceButton?.label)
    this.pushGeometryAuditEntry(entries, 'action.submit.container', this.actionButtons?.submit.container)
    this.pushGeometryAuditEntry(entries, 'action.submit.background', this.actionButtons?.submit.background)
    this.pushGeometryAuditEntry(entries, 'action.submit.label', this.actionButtons?.submit.label)

    if (this.feedbackLayer) {
      this.pushGeometryAuditEntry(entries, 'feedback.container', this.feedbackLayer.container)
      this.pushGeometryAuditEntry(entries, 'feedback.background', this.feedbackLayer.background)
      this.pushGeometryAuditEntry(entries, 'feedback.label', this.feedbackLayer.label)
    }

    if (this.endOverlay) {
      this.pushGeometryAuditEntry(entries, 'overlay.scrim', this.endOverlay.scrim)
      this.pushGeometryAuditEntry(entries, 'overlay.panel', this.endOverlay.panel)
      this.pushGeometryAuditEntry(entries, 'overlay.background', this.endOverlay.background)
      this.pushGeometryAuditEntry(entries, 'overlay.title', this.endOverlay.title)
      this.pushGeometryAuditEntry(entries, 'overlay.explanation.label', this.endOverlay.explanationButton.label)
    }

    if (this.statePanel) {
      this.pushGeometryAuditEntry(entries, 'state.container', this.statePanel.container)
      this.pushGeometryAuditEntry(entries, 'state.background', this.statePanel.background)
      this.pushGeometryAuditEntry(entries, 'state.title', this.statePanel.title)
      this.pushGeometryAuditEntry(entries, 'state.action.label', this.statePanel.actionButton.label)
    }

    return entries
  }

  private collectScaleAudit() {
    const entries: ScaleAuditEntry[] = []

    Array.from(this.clueCards.entries()).forEach(([id, view]) => {
      entries.push({
        label: `clue.${id}`,
        runtimeScaleX: view.container.scaleX,
        runtimeScaleY: view.container.scaleY,
        restScale: 'layout-driven 1.00 to 0.64 by age',
        hoverScale: 'none',
        pressScale: 'none',
        animationScale: 'new clue enters at targetScale * 0.96 then tweens to target',
        childContentScaled: true,
      })
    })

    const pushButtonScale = (label: string, view: PressableButtonView | undefined) => {
      if (!view) {
        return
      }

      entries.push({
        label,
        runtimeScaleX: view.container.scaleX,
        runtimeScaleY: view.container.scaleY,
        restScale: '1.00',
        hoverScale: '1.015',
        pressScale: '0.98',
        animationScale: 'none',
        childContentScaled: true,
      })
    }

    pushButtonScale('keyboard.key.0', this.keyboardButtons[0]?.view)
    pushButtonScale('keyboard.space', this.spaceButton)
    pushButtonScale('action.clear', this.actionButtons?.clear)
    pushButtonScale('action.submit', this.actionButtons?.submit)
    pushButtonScale('action.backspace', this.actionButtons?.backspace)
    pushButtonScale('overlay.explanation', this.endOverlay?.explanationButton)
    pushButtonScale('overlay.continue', this.endOverlay?.continueButton)
    pushButtonScale('state.retry', this.statePanel?.actionButton)

    if (this.guessBar) {
      entries.push({
        label: 'guess.bar',
        runtimeScaleX: this.guessBar.container.scaleX,
        runtimeScaleY: this.guessBar.container.scaleY,
        restScale: '1.00',
        hoverScale: 'none',
        pressScale: 'none',
        animationScale: 'submit 0.992, close 1.015, correct 1.02',
        childContentScaled: true,
      })
    }

    if (this.feedbackLayer) {
      entries.push({
        label: 'feedback.panel',
        runtimeScaleX: this.feedbackLayer.container.scaleX,
        runtimeScaleY: this.feedbackLayer.container.scaleY,
        restScale: '1.00',
        hoverScale: 'none',
        pressScale: 'none',
        animationScale: 'entry 0.94 -> 1.00',
        childContentScaled: true,
      })
    }

    if (this.endOverlay) {
      entries.push({
        label: 'overlay.panel',
        runtimeScaleX: this.endOverlay.panel.scaleX,
        runtimeScaleY: this.endOverlay.panel.scaleY,
        restScale: '1.00',
        hoverScale: 'none',
        pressScale: 'none',
        animationScale: 'position tween only',
        childContentScaled: false,
      })
    }

    return entries
  }

  private updateDebugAuditOverlay(reason: string) {
    if (!this.debugAuditText) {
      return
    }

    const { width: layoutWidth, height: layoutHeight } = this.getDisplayLayoutSize()
    const renderCanvas = this.getRenderCanvasSize()
    const renderResolution = this.getRenderResolutionFactor()
    const board = this.layoutMetrics.board
    const firstKey = this.keyboardButtons[0]?.view.background
    const newestClue = Array.from(this.clueCards.values()).at(-1)?.background
    const guessBackground = this.guessBar?.background
    const geometryEntries = this.collectGeometryAudit()
    const fractionalCount = geometryEntries.filter((entry) => entry.fractional).length

    const lines = [
      `AUDIT ${reason.toUpperCase()}`,
      `dpr ${formatAuditNumber(typeof window === 'undefined' ? 1 : window.devicePixelRatio)}`,
      `parent ${formatAuditNumber(this.scale.parentSize.width)} x ${formatAuditNumber(this.scale.parentSize.height)}`,
      `game ${formatAuditNumber(this.scale.gameSize.width)} x ${formatAuditNumber(this.scale.gameSize.height)}`,
      `canvas ${formatAuditNumber(renderCanvas.width)} x ${formatAuditNumber(renderCanvas.height)}`,
      `layout ${formatAuditNumber(layoutWidth)} x ${formatAuditNumber(layoutHeight)}`,
      `zoom ${formatAuditNumber(this.cameras.main.zoom)} factor ${formatAuditNumber(renderResolution)}`,
      `board ${formatAuditNumber(board.x)},${formatAuditNumber(board.y)} ${formatAuditNumber(board.width)}x${formatAuditNumber(board.height)}`,
      `boardInt ${!['x', 'y', 'width', 'height'].some((key) => isFractionalValue(board[key as keyof LayoutRect]))}`,
      `frac ${fractionalCount}/${geometryEntries.length}`,
      `key0 ${firstKey ? `${formatAuditNumber(firstKey.x)},${formatAuditNumber(firstKey.y)} ${formatAuditNumber(firstKey.displayWidth)}x${formatAuditNumber(firstKey.displayHeight)}` : 'n/a'}`,
      `clue ${newestClue ? `${formatAuditNumber(newestClue.x)},${formatAuditNumber(newestClue.y)} ${formatAuditNumber(newestClue.displayWidth)}x${formatAuditNumber(newestClue.displayHeight)}` : 'n/a'}`,
      `guess ${guessBackground ? `${formatAuditNumber(guessBackground.x)},${formatAuditNumber(guessBackground.y)} ${formatAuditNumber(guessBackground.displayWidth)}x${formatAuditNumber(guessBackground.displayHeight)}` : 'n/a'}`,
    ]

    this.debugAuditText.setText(lines.join('\n'))
    this.debugAuditText.setPosition(board.x + 8, board.y + 8)
  }

  public runRenderAudit(reason = 'manual') {
    if (!DEBUG_RENDER_AUDIT) {
      return
    }

    const { width: layoutWidth, height: layoutHeight } = this.getDisplayLayoutSize()
    const renderCanvas = this.getRenderCanvasSize()
    const renderResolution = this.getRenderResolutionFactor()
    const camera = this.cameras.main
    const geometryEntries = this.collectGeometryAudit()
    const scaleEntries = this.collectScaleAudit()
    const payload = {
      reason,
      dpr: typeof window === 'undefined' ? 1 : window.devicePixelRatio,
      parentSize: {
        width: this.scale.parentSize.width,
        height: this.scale.parentSize.height,
      },
      gameSize: {
        width: this.scale.gameSize.width,
        height: this.scale.gameSize.height,
      },
      renderCanvas,
      camera: {
        x: camera.x,
        y: camera.y,
        width: camera.width,
        height: camera.height,
        zoom: camera.zoom,
        visibleWorldWidth: camera.zoom === 0 ? null : camera.width / camera.zoom,
        visibleWorldHeight: camera.zoom === 0 ? null : camera.height / camera.zoom,
        worldViewWidth: camera.worldView.width,
        worldViewHeight: camera.worldView.height,
      },
      board: this.layoutMetrics.board,
      visualState: this.visualState,
      layoutSize: {
        width: layoutWidth,
        height: layoutHeight,
      },
      renderResolutionFactor: renderResolution,
      fractionalGeometryCount: geometryEntries.filter((entry) => entry.fractional).length,
      geometryCount: geometryEntries.length,
    }

    console.groupCollapsed(`[CaseScene render audit] ${reason}`)
    console.log(payload)
    console.table(geometryEntries)
    console.table(scaleEntries)
    console.groupEnd()

    ;(window as typeof window & { __DXLAB_CASE_SCENE_AUDIT__?: unknown }).__DXLAB_CASE_SCENE_AUDIT__ = {
      ...payload,
      geometryEntries,
      scaleEntries,
    }
    this.updateDebugAuditOverlay(reason)
  }

  private createBackdrop() {
    if (!this.backdropLayer) {
      return
    }

    const base = this.add
      .rectangle(0, 0, this.layoutMetrics.board.width, this.layoutMetrics.board.height, COLORS.bg)
      .setOrigin(0)
    const frame = this.add
      .rectangle(0, 0, this.layoutMetrics.board.width, this.layoutMetrics.board.height, 0xffffff, 0)
      .setOrigin(0)
      .setStrokeStyle(1, COLORS.border, 0.64)
    const grid = this.add.graphics()
    const well = this.add
      .ellipse(0, 0, Math.round(this.layoutMetrics.board.width * 0.56), Math.round(this.layoutMetrics.board.height * 0.2), COLORS.cyanSoft, 0.12)
      .setBlendMode(Phaser.BlendModes.SCREEN)
    const upperGlow = this.add
      .circle(0, 0, 128, COLORS.bgAccent, 0.54)
      .setBlendMode(Phaser.BlendModes.SCREEN)
    const lowerGlow = this.add
      .circle(0, 0, 136, COLORS.bgAccentSoft, 0.62)
      .setBlendMode(Phaser.BlendModes.SCREEN)
    const boardWash = this.add
      .rectangle(0, 0, this.layoutMetrics.board.width, this.layoutMetrics.board.height, 0x08111d, 0.26)
      .setOrigin(0)

    this.backdropLayer.add([base, frame, grid, well, upperGlow, lowerGlow, boardWash])
    this.backdropBase = base
    this.backdropFrame = frame
    this.backdropGrid = grid
    this.backdropWell = well
    this.backdropUpperGlow = upperGlow
    this.backdropLowerGlow = lowerGlow
    this.backdropWash = boardWash
    this.primeAmbientMotes()
    this.layoutBackdrop()
  }

  private createArtisticFrame() {
    if (!this.backdropLayer) {
      return
    }

    const container = this.add.container(0, 0)
    const bezel = this.add.graphics()
    const innerGlow = this.add
      .rectangle(0, 0, 10, 10, 0xffffff, 0)
      .setOrigin(0)
      .setBlendMode(Phaser.BlendModes.SCREEN)
      .setStrokeStyle(1, COLORS.cyan, 0.12)
    const vignette = this.add
      .rectangle(0, 0, 10, 10, 0xffffff, 0)
      .setOrigin(0)
      .setStrokeStyle(8, COLORS.shadow, 0.12)

    const cornerMotifs = Array.from({ length: 4 }, () => {
      return this.add
        .image(0, 0, LAB_DNA_TEXTURE)
        .setOrigin(0.5)
        .setTint(COLORS.borderSoft)
        .setAlpha(0.07)
    })

    container.add([vignette, bezel, innerGlow, ...cornerMotifs])
    this.backdropLayer.add(container)

    this.outerFrameContainer = container
    this.outerFrameBezel = bezel
    this.outerFrameInnerGlow = innerGlow
    this.outerFrameVignette = vignette
    this.outerFrameCornerMotifs = cornerMotifs
    this.outerFramePulseTween = this.tweens.add({
      targets: innerGlow,
      alpha: { from: 1, to: 0.8 },
      duration: 6200,
      ease: 'Sine.InOut',
      yoyo: true,
      repeat: -1,
      paused: true,
    })

    this.layoutArtisticFrame()
  }

  private layoutBackdrop() {
    const { board, insets } = this.layoutMetrics
    if (this.backdropBase) {
      this.backdropBase.setPosition(board.x, board.y)
      this.setRectangleDimensions(this.backdropBase, board.width, board.height)
    }

    if (this.backdropFrame) {
      this.backdropFrame.setPosition(board.x + 1, board.y + 1)
      this.setRectangleDimensions(this.backdropFrame, Math.max(1, board.width - 2), Math.max(1, board.height - 2))
    }

    if (this.backdropGrid) {
      const gridSpacing = Math.max(18, Math.round(board.width * (28 / LOGICAL_WIDTH)))
      this.backdropGrid.clear()
      this.backdropGrid.lineStyle(1, COLORS.border, 0.12)

      for (let x = board.x + gridSpacing; x < board.x + board.width; x += gridSpacing) {
        this.backdropGrid.lineBetween(x, board.y + Math.round(board.height * 0.06), x, board.y + board.height - Math.round(board.height * 0.05))
      }

      for (let y = board.y + Math.round(gridSpacing * 0.8); y < board.y + board.height; y += gridSpacing) {
        this.backdropGrid.lineBetween(board.x + Math.round(board.width * 0.06), y, board.x + board.width - Math.round(board.width * 0.06), y)
      }
    }

    if (this.backdropWell) {
      this.backdropWell.setPosition(board.x + Math.round(board.width * 0.52), board.y + Math.round(board.height * 0.18))
      this.backdropWell.setSize(Math.round(board.width * 0.54), Math.round(board.height * 0.18))
    }

    if (this.backdropUpperGlow) {
      this.backdropUpperGlow.setPosition(board.x + board.width - board.width * (28 / LOGICAL_WIDTH), board.y + board.height * (60 / LOGICAL_HEIGHT))
      this.backdropUpperGlow.setRadius(Math.round(board.width * (128 / LOGICAL_WIDTH)))
    }

    if (this.backdropLowerGlow) {
      this.backdropLowerGlow.setPosition(board.x + board.width * (78 / LOGICAL_WIDTH), board.y + board.height - board.height * (92 / LOGICAL_HEIGHT))
      this.backdropLowerGlow.setRadius(Math.round(board.width * (136 / LOGICAL_WIDTH)))
    }

    if (this.backdropWash) {
      this.backdropWash.setPosition(board.x + insets.left - 6, board.y + insets.top + 30)
      this.setRectangleDimensions(
        this.backdropWash,
        Math.max(1, board.width - insets.left - insets.right + 12),
        Math.max(1, board.height - insets.top - insets.bottom - 20),
      )
    }

    this.primeAmbientMotes()
    this.ambientMotes.forEach((mote, index) => {
      this.layoutAmbientMote(mote, index)
    })
  }

  private layoutArtisticFrame() {
    if (!this.outerFrameContainer || !this.outerFrameBezel || !this.outerFrameInnerGlow || !this.outerFrameVignette) {
      return
    }

    const { board } = this.layoutMetrics
    const frameInset = Phaser.Math.Clamp(Math.round(board.width * 0.01), 3, 5)
    const bezelOutset = Phaser.Math.Clamp(Math.round(board.width * 0.018), 6, 8)
    const x = board.x - bezelOutset
    const y = board.y - bezelOutset
    const width = board.width + bezelOutset * 2
    const height = board.height + bezelOutset * 2

    const motifInset = Phaser.Math.Clamp(Math.round(board.width * 0.028), 9, 13)
    const motifScale = Phaser.Math.Clamp(board.width / LOGICAL_WIDTH, 0.135, 0.19)

    this.outerFrameVignette.setPosition(board.x + 1, board.y + 1)
    this.setRectangleDimensions(this.outerFrameVignette, Math.max(1, board.width - 2), Math.max(1, board.height - 2))
    this.outerFrameVignette.setStrokeStyle(Phaser.Math.Clamp(Math.round(board.width * 0.02), 6, 9), COLORS.shadow, 0.12)

    this.outerFrameBezel.clear()
    this.outerFrameBezel.lineStyle(1, COLORS.border, 0.78)
    this.outerFrameBezel.strokeRect(x, y, width, height)
    this.outerFrameBezel.lineStyle(1, COLORS.inkLift, 0.56)
    this.outerFrameBezel.strokeRect(x + 1, y + 1, Math.max(1, width - 2), Math.max(1, height - 2))
    this.outerFrameBezel.lineStyle(1, COLORS.borderSoft, 0.2)
    this.outerFrameBezel.lineBetween(x + 2, y + motifInset, x + motifInset + 4, y + motifInset)
    this.outerFrameBezel.lineBetween(x + 2, y + motifInset, x + 2, y + motifInset + 9)
    this.outerFrameBezel.lineBetween(x + width - motifInset - 4, y + motifInset, x + width - 2, y + motifInset)
    this.outerFrameBezel.lineBetween(x + width - 2, y + motifInset, x + width - 2, y + motifInset + 9)
    this.outerFrameBezel.lineBetween(x + 2, y + height - motifInset, x + motifInset + 4, y + height - motifInset)
    this.outerFrameBezel.lineBetween(x + 2, y + height - motifInset, x + 2, y + height - motifInset - 9)
    this.outerFrameBezel.lineBetween(x + width - motifInset - 4, y + height - motifInset, x + width - 2, y + height - motifInset)
    this.outerFrameBezel.lineBetween(x + width - 2, y + height - motifInset, x + width - 2, y + height - motifInset - 9)

    this.outerFrameInnerGlow.setPosition(board.x + frameInset, board.y + frameInset)
    this.setRectangleDimensions(
      this.outerFrameInnerGlow,
      Math.max(1, board.width - frameInset * 2),
      Math.max(1, board.height - frameInset * 2),
    )
    this.outerFrameInnerGlow.setStrokeStyle(1, COLORS.cyan, 0.12)

    const corners: Array<{ x: number; y: number; angle: number }> = [
      { x: x + motifInset, y: y + motifInset, angle: -18 },
      { x: x + width - motifInset, y: y + motifInset, angle: 18 },
      { x: x + motifInset, y: y + height - motifInset, angle: 162 },
      { x: x + width - motifInset, y: y + height - motifInset, angle: 198 },
    ]

    this.outerFrameCornerMotifs.forEach((motif, index) => {
      if (!(motif instanceof Phaser.GameObjects.Image)) {
        return
      }
      const corner = corners[index]
      motif.setPosition(corner.x, corner.y)
      motif.setScale(motifScale)
      motif.setAngle(corner.angle)
      motif.setAlpha(0.07)
      motif.setTint(index % 2 === 0 ? COLORS.borderSoft : COLORS.cyanSoft)
    })
  }

  private createHeader() {
    if (!this.gameplayLayer) {
      return
    }

    const region = this.add.container(this.layoutMetrics.header.x, this.layoutMetrics.header.y)
    const shadow = this.add
      .rectangle(0, Math.round(this.layoutMetrics.header.height * 0.12), this.layoutMetrics.header.width, this.layoutMetrics.header.height, COLORS.shadow, 0.18)
      .setOrigin(0)
    const background = this.add
      .rectangle(0, 0, this.layoutMetrics.header.width, this.layoutMetrics.header.height, COLORS.inkLift, 0.96)
      .setOrigin(0)
      .setStrokeStyle(1, COLORS.border, 0.92)
    const innerPlate = this.add
      .rectangle(1, 1, this.layoutMetrics.header.width - 2, this.layoutMetrics.header.height - 3, COLORS.bgAccentSoft, 0.3)
      .setOrigin(0)
      .setStrokeStyle(1, COLORS.borderSoft, 0.46)
    const topAccent = this.add
      .rectangle(12, 1, Math.max(24, this.layoutMetrics.header.width - 24), 1, COLORS.cyan, 0.22)
      .setOrigin(0)
    const divider = this.add
      .rectangle(0, this.layoutMetrics.header.height - 1, this.layoutMetrics.header.width, 1, COLORS.cyan, 0.16)
      .setOrigin(0)
    const menuButton = this.createPressableButton(0, 0, 40, 24, '\u2630', () => {
      this.handleOpenMenuIntent()
    })
    const titleGlow = this.createText(Math.round(this.layoutMetrics.header.width / 2), Math.round(this.layoutMetrics.header.height / 2), 'Wardle', {
      fontFamily: 'Arial',
      fontSize: this.toFontPx(this.layoutMetrics.typography.headerProgress),
      color: '#67e8f9',
      fontStyle: 'bold',
    })
    titleGlow.setOrigin(0.5)
    titleGlow.setAlpha(0.14)
    const title = this.createText(Math.round(this.layoutMetrics.header.width / 2), Math.round(this.layoutMetrics.header.height / 2), 'Wardle', {
      fontFamily: 'Arial',
      fontSize: this.toFontPx(this.layoutMetrics.typography.headerProgress),
      color: '#e6f6ff',
      fontStyle: 'bold',
    })
    title.setOrigin(0.5)
    title.setAlpha(0.96)
    title.setShadow(0, 1, '#020617', 5, false, true)
    title.setStroke('#102338', 2)
    const titleAccent = this.add
      .rectangle(Math.round(this.layoutMetrics.header.width / 2), Math.round(this.layoutMetrics.header.height * 0.68), 52, 1, COLORS.cyan, 0.22)
      .setOrigin(0.5)
    const dnaIcon = this.add
      .image(0, 0, LAB_DNA_TEXTURE)
      .setOrigin(0.5)
      .setAlpha(0.56)
      .setTint(COLORS.cyan)
    const dnaRotationTween = this.tweens.add({
      targets: dnaIcon,
      angle: 360,
      duration: 14000,
      ease: 'Linear',
      repeat: -1,
    })
    const flashSweep = this.add
      .rectangle(0, 0, 10, 10, COLORS.cyan, 0)
      .setOrigin(0.5)
      .setAlpha(0)
      .setVisible(false)
      .setBlendMode(Phaser.BlendModes.ADD)
    const statsRegion = this.add.container(0, 0)
    const levelChip = this.add
      .rectangle(0, 0, 10, 10, COLORS.inkLift, 0.92)
      .setOrigin(0)
      .setStrokeStyle(1, COLORS.sky, 0.28)
    const levelText = this.createText(0, 0, '', {
      fontFamily: 'Arial',
      fontSize: this.toFontPx(Math.max(9, this.layoutMetrics.typography.headerStatus - 2)),
      color: '#dbeafe',
      fontStyle: 'bold',
    })
    const xpChip = this.add
      .rectangle(0, 0, 10, 10, COLORS.panelMuted, 0.96)
      .setOrigin(0)
      .setStrokeStyle(1, COLORS.cyan, 0.28)
    const xpText = this.createText(0, 0, '', {
      fontFamily: 'Arial',
      fontSize: this.toFontPx(Math.max(9, this.layoutMetrics.typography.headerStatus - 2)),
      color: '#e6f5ff',
      fontStyle: 'bold',
    })
    const hearts = this.add.container(0, 0)

    statsRegion.add([levelChip, xpChip, levelText, xpText, hearts])
    region.add([
      shadow,
      background,
      innerPlate,
      topAccent,
      divider,
      menuButton.container,
      titleGlow,
      dnaIcon,
      title,
      titleAccent,
      statsRegion,
      flashSweep,
    ])
    this.headerRegion = region
    this.headerShadow = shadow
    this.headerBackground = background
    this.headerInnerPlate = innerPlate
    this.headerTopAccent = topAccent
    this.headerDivider = divider
    this.headerMenuButton = menuButton
    this.headerTitleGlow = titleGlow
    this.headerTitleText = title
    this.headerTitleAccent = titleAccent
    this.headerDnaIcon = dnaIcon
    this.headerDnaRotationTween = dnaRotationTween
    this.headerFlashSweep = flashSweep
    this.headerStatsRegion = statsRegion
    this.headerLevelChip = levelChip
    this.headerLevelText = levelText
    this.headerXpChip = xpChip
    this.headerXpText = xpText
    this.headerHeartsContainer = hearts
    this.gameplayLayer.add(region)
    this.layoutHeader()
  }

  private layoutHeader() {
    if (!this.headerRegion) {
      return
    }

    const { header, typography } = this.layoutMetrics
    const horizontalPadding = Phaser.Math.Clamp(Math.round(header.width * 0.034), 10, 14)
    const verticalPadding = Phaser.Math.Clamp(Math.round(header.height * 0.2), 7, 10)
    const menuHeight = Math.max(22, header.height - verticalPadding * 2)
    const titleY = Math.round(header.height * 0.42)
    const titleAccentY = Math.round(header.height * 0.7)
    const titleFontSize = Math.max(typography.headerProgress + 1, Math.round(header.height * 0.36))

    this.headerRegion.setPosition(header.x, header.y)
    if (this.headerShadow) {
      this.headerShadow.setPosition(0, Math.round(header.height * 0.12))
      this.setRectangleDimensions(this.headerShadow, header.width, header.height)
    }
    if (this.headerBackground) {
      this.setRectangleDimensions(this.headerBackground, header.width, header.height)
    }
    if (this.headerInnerPlate) {
      this.headerInnerPlate.setPosition(1, 1)
      this.setRectangleDimensions(this.headerInnerPlate, Math.max(1, header.width - 2), Math.max(1, header.height - 3))
    }
    if (this.headerTopAccent) {
      this.headerTopAccent.setPosition(12, 1)
      this.setRectangleDimensions(this.headerTopAccent, Math.max(24, header.width - 24), 1)
    }
    if (this.headerDivider) {
      this.headerDivider.setPosition(0, Math.max(0, header.height - 1))
      this.setRectangleDimensions(this.headerDivider, header.width, 1)
    }
    if (this.headerMenuButton) {
      this.headerMenuButton.container.setPosition(horizontalPadding, Math.round((header.height - menuHeight) / 2))
      this.setButtonFrame(this.headerMenuButton, 42, menuHeight, Math.max(10, typography.headerStatus))
      this.applyButtonPalette(this.headerMenuButton, {
        fill: COLORS.inkLift,
        stroke: COLORS.cyan,
        text: '#d8f3ff',
        shadowAlpha: 0.12,
        alpha: 0.94,
        glowAlpha: 0.03,
        hoverGlowAlpha: 0.07,
        pressedGlowAlpha: 0.12,
        shineAlpha: 0.05,
      })
    }
    this.headerTitleGlow?.setPosition(Math.round(header.width / 2), titleY)
    this.headerTitleGlow?.setFontSize(this.toFontPx(titleFontSize))
    this.headerTitleText?.setPosition(Math.round(header.width / 2), titleY)
    this.headerTitleText?.setFontSize(this.toFontPx(titleFontSize))
    if (this.headerTitleAccent) {
      this.headerTitleAccent.setPosition(Math.round(header.width / 2), titleAccentY)
      this.setRectangleDimensions(this.headerTitleAccent, 52, 1)
    }
    if (this.headerDnaIcon) {
      const dnaHeight = Phaser.Math.Clamp(Math.round(header.height * 0.38), 18, 24)
      const dnaScale = dnaHeight / 24
      const titleWidth = this.headerTitleText?.width ?? 0
      const titleLeft = Math.round(header.width / 2 - titleWidth / 2)
      const dnaGap = Math.max(5, Math.round(header.height * 0.07))
      this.headerDnaIcon.setScale(dnaScale)
      this.headerDnaIcon.setPosition(
        titleLeft - Math.round((20 * dnaScale) / 2) - dnaGap,
        titleY,
      )
    }
    if (this.headerFlashSweep) {
      const sweepWidth = Math.max(36, Math.round(header.width * 0.38))
      this.headerFlashSweep.setPosition(-sweepWidth, Math.round(header.height / 2))
      this.setRectangleDimensions(this.headerFlashSweep, sweepWidth, Math.max(1, header.height + 6))
    }
    this.syncHeader(this.getSnapshot())
  }

  private createClueStack() {
    if (!this.gameplayLayer) {
      return
    }

    const region = this.add.container(this.layoutMetrics.clues.x, this.layoutMetrics.clues.y)
    const shadow = this.add
      .rectangle(0, 10, this.layoutMetrics.clues.width, this.layoutMetrics.clues.height, COLORS.shadow, 0.22)
      .setOrigin(0)
    const tray = this.add
      .rectangle(0, 0, this.layoutMetrics.clues.width, this.layoutMetrics.clues.height, 0x091522, 0.34)
      .setOrigin(0)
      .setStrokeStyle(1, COLORS.cyan, 0.3)
    const caption = this.createText(this.layoutMetrics.clues.captionX, this.layoutMetrics.clues.captionY, 'REVEALED CLUES', {
      fontFamily: 'Arial',
      fontSize: this.toFontPx(this.layoutMetrics.typography.clueCaption),
      color: COLORS.textQuiet,
      fontStyle: 'bold',
    })
    const cardLayer = this.add.container(0, 0)
    const empty = this.createText(this.layoutMetrics.clues.width / 2, this.layoutMetrics.clues.height / 2, 'Reveal a clue to begin the board.', {
      fontFamily: 'Arial',
      fontSize: this.toFontPx(this.layoutMetrics.typography.clueEmpty),
      color: COLORS.textQuiet,
      align: 'center',
    })
    empty.setOrigin(0.5)

    const maskGraphics = this.make.graphics({ x: 0, y: 0 }, false)
    maskGraphics.fillStyle(0xffffff, 1)
    maskGraphics.fillRect(0, 0, this.layoutMetrics.clues.width, this.layoutMetrics.clues.height)
    cardLayer.setMask(maskGraphics.createGeometryMask())

    region.add([shadow, tray, cardLayer, caption, empty])

    this.clueStackRegion = region
    this.clueStackShadow = shadow
    this.clueStackTray = tray
    this.clueStackCaption = caption
    this.clueCardLayer = cardLayer
    this.clueMaskGraphics = maskGraphics
    this.clueEmptyText = empty
    this.gameplayLayer.add(region)
    this.layoutClueStack()
  }

  private layoutClueStack() {
    const { clues, typography } = this.layoutMetrics
    if (!this.clueStackRegion || !this.clueStackShadow || !this.clueStackTray || !this.clueStackCaption) {
      return
    }

    this.clueStackRegion.setPosition(clues.x, clues.y)
    this.clueStackShadow.setY(Math.max(2, Math.round(clues.height * (10 / 340))))
    this.setRectangleDimensions(this.clueStackShadow, clues.width, clues.height)
    this.setRectangleDimensions(this.clueStackTray, clues.width, clues.height)
    this.clueStackCaption.setPosition(clues.captionX, clues.captionY)
    this.clueStackCaption.setFontSize(this.toFontPx(typography.clueCaption))

    if (this.clueEmptyText) {
      this.clueEmptyText.setPosition(Math.round(clues.width / 2), Math.round(clues.height / 2))
      this.clueEmptyText.setFontSize(this.toFontPx(typography.clueEmpty))
      this.clueEmptyText.setWordWrapWidth(clues.width - clues.cardInset * 2)
    }

    if (this.clueMaskGraphics) {
      this.clueMaskGraphics.clear()
      this.clueMaskGraphics.fillStyle(0xffffff, 1)
      this.clueMaskGraphics.fillRect(
        clues.x + clues.maskInset,
        clues.y + clues.maskInset,
        Math.max(1, clues.width - clues.maskInset * 2),
        Math.max(1, clues.height - clues.maskInset * 2),
      )
    }
  }

  private createGuessBar() {
    if (!this.gameplayLayer) {
      return
    }

    const { guessBar, typography } = this.layoutMetrics
    const region = this.add.container(guessBar.x, guessBar.y)
    const glow = this.add
      .rectangle(-guessBar.haloInset - 4, -guessBar.haloInset - 4, guessBar.width + guessBar.haloInset * 2 + 8, guessBar.height + guessBar.haloInset * 2 + 8, COLORS.cyan, 0.1)
      .setOrigin(0)
    const halo = this.add
      .rectangle(-guessBar.haloInset, -guessBar.haloInset, guessBar.width + guessBar.haloInset * 2, guessBar.height + guessBar.haloInset * 2, COLORS.sky, 0.1)
      .setOrigin(0)
    const background = this.add
      .rectangle(0, 0, guessBar.width, guessBar.height, 0x0e1b2b, 0.96)
      .setOrigin(0)
    const border = this.add
      .rectangle(0, 0, guessBar.width, guessBar.height, 0xffffff, 0)
      .setOrigin(0)
      .setStrokeStyle(2, COLORS.border, 1)
    const scan = this.add
      .rectangle(-Math.round(guessBar.width * 0.22), 6, Math.max(26, Math.round(guessBar.width * 0.18)), Math.max(guessBar.height - 12, 16), COLORS.cyan, 0.12)
      .setOrigin(0)
    scan.setVisible(true)
    scan.setAlpha(0)
    const label = this.createText(guessBar.width / 2, guessBar.labelY, 'DIAGNOSIS', {
      fontFamily: 'Arial',
      fontSize: this.toFontPx(typography.guessLabel),
      color: COLORS.textMuted,
    })
    label.setOrigin(0.5, 0)
    const value = this.createText(guessBar.width / 2, guessBar.valueY, 'YOUR DIAGNOSIS', {
      fontFamily: 'Arial',
      fontSize: this.toFontPx(typography.guessValue),
      color: COLORS.textQuiet,
      fontStyle: 'bold',
      align: 'center',
    })
    value.setOrigin(0.5, 0)
    const helper = this.createText(guessBar.width / 2, guessBar.height - guessBar.helperBottomInset, '', {
      fontFamily: 'Arial',
      fontSize: this.toFontPx(typography.guessHelper),
      color: COLORS.textQuiet,
    })
    helper.setOrigin(0.5, 1)

    region.add([glow, halo, background, border, scan, label, value, helper])

    this.guessBar = { container: region, glow, halo, background, border, scan, label, value, helper }
    this.gameplayLayer.add(region)
    this.layoutGuessBar()
  }

  private layoutGuessBar() {
    if (!this.guessBar) {
      return
    }

    const { guessBar, typography } = this.layoutMetrics
    this.guessBar.container.setPosition(guessBar.x, guessBar.y)
    this.guessBar.glow.setPosition(-guessBar.haloInset - 4, -guessBar.haloInset - 4)
    this.setRectangleDimensions(this.guessBar.glow, guessBar.width + guessBar.haloInset * 2 + 8, guessBar.height + guessBar.haloInset * 2 + 8)
    this.guessBar.halo.setPosition(-guessBar.haloInset, -guessBar.haloInset)
    this.setRectangleDimensions(this.guessBar.halo, guessBar.width + guessBar.haloInset * 2, guessBar.height + guessBar.haloInset * 2)
    this.setRectangleDimensions(this.guessBar.background, guessBar.width, guessBar.height)
    this.setRectangleDimensions(this.guessBar.border, guessBar.width, guessBar.height)
    this.guessBar.scan.setPosition(-Math.round(guessBar.width * 0.22), 6)
    this.setRectangleDimensions(this.guessBar.scan, Math.max(26, Math.round(guessBar.width * 0.18)), Math.max(guessBar.height - 12, 16))

    this.guessBar.label.setPosition(Math.round(guessBar.width / 2), guessBar.labelY)
    this.guessBar.label.setFontSize(this.toFontPx(typography.guessLabel))
    this.guessBar.value.setPosition(Math.round(guessBar.width / 2), guessBar.valueY)
    this.guessBar.helper.setPosition(Math.round(guessBar.width / 2), guessBar.height - guessBar.helperBottomInset)
    this.guessBar.helper.setFontSize(this.toFontPx(typography.guessHelper))
  }

  private startGuessCaretBlink() {
    this.guessCaretBlinkEvent?.remove(false)
    this.guessCaretVisible = true
    this.guessCaretBlinkEvent = this.time.addEvent({
      delay: 460,
      loop: true,
      callback: () => {
        this.guessCaretVisible = !this.guessCaretVisible
        if (this.sys.isActive()) {
          this.syncGuessBar(this.getSnapshot())
        }
      },
    })
  }

  private createActionRow() {
    if (!this.keyboardRegion) {
      return
    }

    const { actions } = this.layoutMetrics
    const region = this.add.container(actions.x - this.layoutMetrics.keyboard.x, actions.y - this.layoutMetrics.keyboard.y)
    const clear = this.createPressableButton(0, 0, actions.clearWidth, actions.height, 'Clear', () => {
      this.handleClearIntent()
    })
    const submit = this.createPressableButton(actions.clearWidth + actions.gap, 0, actions.submitWidth, actions.height, 'Submit', () => {
      this.handleSubmitIntent()
    })
    const backspace = this.createPressableButton(
      actions.clearWidth + actions.submitWidth + actions.gap * 2,
      0,
      actions.backspaceWidth,
      actions.height,
      'Del',
      () => {
        this.handleBackspaceIntent()
      },
    )

    region.add([clear.container, submit.container, backspace.container])
    this.actionRowRegion = region
    this.actionButtons = { clear, submit, backspace }
    this.keyboardRegion.add(region)
    this.layoutActionRow()
  }

  private layoutActionRow() {
    if (!this.keyboardRegion || !this.actionRowRegion || !this.actionButtons) {
      return
    }

    const { actions, keyboard, typography } = this.layoutMetrics
    this.actionRowRegion.setPosition(actions.x - keyboard.x, actions.y - keyboard.y)

    this.actionButtons.clear.container.setPosition(0, 0)
    this.setButtonFrame(this.actionButtons.clear, actions.clearWidth, actions.height, typography.actionLabel)

    this.actionButtons.submit.container.setPosition(actions.clearWidth + actions.gap, 0)
    this.setButtonFrame(this.actionButtons.submit, actions.submitWidth, actions.height, typography.actionLabel)

    this.actionButtons.backspace.container.setPosition(actions.clearWidth + actions.submitWidth + actions.gap * 2, 0)
    this.setButtonFrame(this.actionButtons.backspace, actions.backspaceWidth, actions.height, typography.actionLabel)
  }

  private createKeyboard() {
    if (!this.gameplayLayer) {
      return
    }

    const { keyboard } = this.layoutMetrics

    const region = this.add.container(keyboard.x, keyboard.y)
    const tray = this.add
      .rectangle(0, 0, keyboard.width, keyboard.height, 0x091522, 0.28)
      .setOrigin(0)
      .setStrokeStyle(1, COLORS.cyan, 0.38)
    region.add(tray)
    this.keyboardRegion = region
    this.keyboardTray = tray

    let y = keyboard.rowTop
    KEYBOARD_ROWS.forEach((row, rowIndex) => {
      const rowLayout = this.getKeyboardRowLayout(row.length)

      row.forEach((key, keyIndex) => {
        const keyWidth = rowLayout.widths[keyIndex]
        const x = rowLayout.positions[keyIndex]
        const button = this.createPressableButton(x, y, keyWidth, keyboard.keyHeight, key, () => {
          this.handleKeyPressIntent(key)
        })
        button.label.setFontSize(this.toFontPx(this.layoutMetrics.typography.keyLabel))
        region.add(button.container)
        this.keyboardButtons.push({ key, view: button })
      })

      y += keyboard.keyHeight + keyboard.rowGap
      if (rowIndex === 1) {
        y += Math.max(1, Math.round(keyboard.rowGap * 0.34))
      }
    })

    const spaceWidth = Math.min(keyboard.spaceWidth, keyboard.width - keyboard.sideInset * 2)
    const spaceX = Math.round((keyboard.width - spaceWidth) / 2)
    const space = this.createPressableButton(spaceX, y + keyboard.spaceTopGap, spaceWidth, keyboard.keyHeight, 'SPACE', () => {
      this.handleKeyPressIntent(' ')
    })
    space.label.setFontSize(this.toFontPx(Math.max(10, this.layoutMetrics.typography.keyLabel - 1)))
    region.add(space.container)

    this.spaceButton = space
    this.gameplayLayer.add(region)
    this.layoutKeyboard()
  }

  private layoutKeyboard() {
    if (!this.keyboardRegion || !this.keyboardTray) {
      return
    }

    const { keyboard, typography } = this.layoutMetrics
    this.keyboardRegion.setPosition(keyboard.x, keyboard.y)
    this.setRectangleDimensions(this.keyboardTray, keyboard.width, keyboard.height)

    let index = 0
    let y = keyboard.rowTop
    KEYBOARD_ROWS.forEach((row, rowIndex) => {
      const rowLayout = this.getKeyboardRowLayout(row.length)

      row.forEach((_, keyIndex) => {
        const entry = this.keyboardButtons[index]
        if (entry) {
          entry.view.container.setPosition(rowLayout.positions[keyIndex], y)
          this.setButtonFrame(entry.view, rowLayout.widths[keyIndex], keyboard.keyHeight, typography.keyLabel)
        }
        index += 1
      })

      y += keyboard.keyHeight + keyboard.rowGap
      if (rowIndex === 1) {
        y += Math.max(1, Math.round(keyboard.rowGap * 0.34))
      }
    })

    if (this.spaceButton) {
      const spaceWidth = Math.min(keyboard.spaceWidth, keyboard.width - keyboard.sideInset * 2)
      const spaceX = Math.round((keyboard.width - spaceWidth) / 2)
      this.spaceButton.container.setPosition(spaceX, y + keyboard.spaceTopGap)
      this.setButtonFrame(this.spaceButton, spaceWidth, keyboard.keyHeight, Math.max(10, typography.keyLabel - 1))
    }
  }

  private createFeedbackLayer() {
    if (!this.feedbackRoot) {
      return
    }

    const { feedback, typography } = this.layoutMetrics
    const region = this.add.container(feedback.x, feedback.y)
    const glow = this.add
      .rectangle(0, 0, feedback.width + 16, feedback.height + 16, COLORS.cyan, 0.08)
      .setOrigin(0.5)
    const background = this.add
      .rectangle(0, 0, feedback.width, feedback.height, COLORS.panelMuted, 0.95)
      .setOrigin(0.5)
      .setStrokeStyle(1, COLORS.border, 0.8)
    const label = this.createText(0, 1, '', {
      fontFamily: 'Arial',
      fontSize: this.toFontPx(typography.feedback),
      color: COLORS.text,
      fontStyle: 'bold',
      align: 'center',
    }, getCaseSceneTextResolution(0.94))
    label.setOrigin(0.5)

    region.add([glow, background, label])
    region.setAlpha(0)
    region.setVisible(false)

    this.feedbackLayer = { container: region, glow, background, label }
    this.feedbackRoot.add(region)
    this.layoutFeedbackLayer()
  }

  private layoutFeedbackLayer() {
    if (!this.feedbackLayer) {
      return
    }

    const { feedback, typography } = this.layoutMetrics
    this.feedbackLayer.container.setPosition(feedback.x, feedback.y)
    this.setRectangleDimensions(this.feedbackLayer.glow, feedback.width + 16, feedback.height + 16)
    this.setRectangleDimensions(this.feedbackLayer.background, feedback.width, feedback.height)
    this.feedbackLayer.label.setFontSize(this.toFontPx(typography.feedback))
  }

  private createRewardToast() {
    if (!this.feedbackRoot) {
      return
    }

    const { board } = this.layoutMetrics
    const region = this.add.container(board.x + Math.round(board.width / 2), board.y + Math.round(board.height * 0.22))
    const label = this.createText(0, 0, '', {
      fontFamily: 'Arial',
      fontSize: this.toFontPx(Math.max(18, this.layoutMetrics.typography.overlayDiagnosis)),
      color: COLORS.text,
      fontStyle: 'bold',
      align: 'center',
    })
    label.setOrigin(0.5)
    const sublabel = this.createText(0, 24, '', {
      fontFamily: 'Arial',
      fontSize: this.toFontPx(Math.max(11, this.layoutMetrics.typography.feedback - 1)),
      color: COLORS.textMuted,
      align: 'center',
    })
    sublabel.setOrigin(0.5)

    region.add([label, sublabel])
    region.setVisible(false)
    region.setAlpha(0)

    this.rewardToast = { container: region, label, sublabel }
    this.feedbackRoot.add(region)
    this.layoutRewardToast()
  }

  private layoutRewardToast() {
    if (!this.rewardToast) {
      return
    }

    const { board, typography } = this.layoutMetrics
    this.rewardToast.container.setPosition(board.x + Math.round(board.width / 2), board.y + Math.round(board.height * 0.2))
    this.rewardToast.label.setFontSize(this.toFontPx(Math.max(18, typography.overlayDiagnosis)))
    this.rewardToast.sublabel.setPosition(0, Math.max(20, Math.round(typography.overlayDiagnosis * 1.24)))
    this.rewardToast.sublabel.setFontSize(this.toFontPx(Math.max(11, typography.feedback - 1)))
  }

  private createEndOverlay() {
    if (!this.overlayRoot) {
      return
    }

    const { board, overlay, typography } = this.layoutMetrics
    const region = this.add.container(0, 0)
    const scrim = this.add.rectangle(board.x, board.y, board.width, board.height, COLORS.shadow, 0.52).setOrigin(0)
    const panel = this.add.container(overlay.x, overlay.y)
    const glow = this.add
      .rectangle(-6, -6, overlay.width + 12, overlay.height + 12, COLORS.cyan, 0.05)
      .setOrigin(0)
    const shadow = this.add
      .rectangle(0, overlay.shadowOffset, overlay.width, overlay.height, COLORS.shadow, 0.18)
      .setOrigin(0)
    const background = this.add
      .rectangle(0, 0, overlay.width, overlay.height, COLORS.panelSoft, 0.95)
      .setOrigin(0)
      .setStrokeStyle(1, COLORS.border, 1)
    const accent = this.add.rectangle(0, 0, overlay.width, overlay.accentHeight, COLORS.emerald, 0.95).setOrigin(0)
    const beam = this.add
      .rectangle(-Math.round(overlay.width * 0.22), overlay.accentHeight + 8, Math.max(32, Math.round(overlay.width * 0.16)), Math.max(overlay.height - overlay.accentHeight - 22, 20), COLORS.cyan, 0.14)
      .setOrigin(0)
    beam.setAlpha(0)
    const eyebrow = this.createText(overlay.padding, overlay.padding, 'ROUND COMPLETE', {
      fontFamily: 'Arial',
      fontSize: this.toFontPx(typography.overlayEyebrow),
      color: COLORS.textMuted,
      fontStyle: 'bold',
    })
    const title = this.createText(overlay.padding, overlay.padding + Math.round(22 * (overlay.height / 204)), 'Diagnosis locked in', {
      fontFamily: 'Arial',
      fontSize: this.toFontPx(typography.overlayTitle),
      color: COLORS.text,
      fontStyle: 'bold',
      wordWrap: { width: overlay.width - overlay.padding * 2, useAdvancedWrap: true },
    })
    const diagnosis = this.createText(overlay.padding, overlay.padding + Math.round(64 * (overlay.height / 204)), '', {
      fontFamily: 'Arial',
      fontSize: this.toFontPx(typography.overlayDiagnosis),
      color: COLORS.text,
      fontStyle: 'bold',
      wordWrap: { width: overlay.width - overlay.padding * 2, useAdvancedWrap: true },
    })
    const helper = this.createText(overlay.padding, overlay.padding + Math.round(102 * (overlay.height / 204)), 'Open the explanation or continue to the next case.', {
      fontFamily: 'Arial',
      fontSize: this.toFontPx(typography.overlayHelper),
      color: COLORS.textMuted,
      wordWrap: { width: overlay.width - overlay.padding * 2, useAdvancedWrap: true },
    })
    const explanationButton = this.createPressableButton(
      overlay.padding,
      overlay.height - overlay.buttonBottomInset - overlay.buttonHeight,
      overlay.buttonWidth,
      overlay.buttonHeight,
      'Why?',
      () => {
      if (!this.getSnapshot().canOpenExplanation) {
        return
      }

      this.getIntents().onOpenExplanation()
      },
    )
    const continueButton = this.createPressableButton(
      overlay.width - overlay.buttonWidth - overlay.padding,
      overlay.height - overlay.buttonBottomInset - overlay.buttonHeight,
      overlay.buttonWidth,
      overlay.buttonHeight,
      'Continue',
      () => {
        this.getIntents().onContinue()
      },
    )

    panel.add([
      glow,
      shadow,
      background,
      accent,
      beam,
      eyebrow,
      title,
      diagnosis,
      helper,
      explanationButton.container,
      continueButton.container,
    ])
    region.add([scrim, panel])
    region.setVisible(false)
    region.setAlpha(0)

    this.endOverlay = {
      container: region,
      scrim,
      panel,
      glow,
      shadow,
      background,
      accent,
      beam,
      eyebrow,
      title,
      diagnosis,
      helper,
      continueButton,
      explanationButton,
    }
    this.overlayRoot.add(region)
    this.layoutEndOverlay()
  }

  private layoutEndOverlay() {
    if (!this.endOverlay) {
      return
    }

    const { board, overlay, typography } = this.layoutMetrics
    this.endOverlay.scrim.setPosition(board.x, board.y)
    this.setRectangleDimensions(this.endOverlay.scrim, board.width, board.height)

    this.endOverlay.panel.setX(overlay.x)
    this.endOverlay.glow.setPosition(-6, -6)
    this.setRectangleDimensions(this.endOverlay.glow, overlay.width + 12, overlay.height + 12)
    this.endOverlay.shadow.setY(overlay.shadowOffset)
    this.setRectangleDimensions(this.endOverlay.shadow, overlay.width, overlay.height)
    this.setRectangleDimensions(this.endOverlay.background, overlay.width, overlay.height)
    this.setRectangleDimensions(this.endOverlay.accent, overlay.width, overlay.accentHeight)
    this.endOverlay.beam.setPosition(-Math.round(overlay.width * 0.22), overlay.accentHeight + 8)
    this.setRectangleDimensions(this.endOverlay.beam, Math.max(32, Math.round(overlay.width * 0.16)), Math.max(overlay.height - overlay.accentHeight - 22, 20))

    this.endOverlay.eyebrow.setPosition(overlay.padding, overlay.padding)
    this.endOverlay.eyebrow.setFontSize(this.toFontPx(typography.overlayEyebrow))
    this.endOverlay.title.setPosition(overlay.padding, overlay.padding + Math.round(22 * (overlay.height / 204)))
    this.endOverlay.title.setFontSize(this.toFontPx(typography.overlayTitle))
    this.endOverlay.title.setWordWrapWidth(overlay.width - overlay.padding * 2)
    this.endOverlay.diagnosis.setPosition(overlay.padding, overlay.padding + Math.round(64 * (overlay.height / 204)))
    this.endOverlay.diagnosis.setFontSize(this.toFontPx(typography.overlayDiagnosis))
    this.endOverlay.diagnosis.setWordWrapWidth(overlay.width - overlay.padding * 2)
    this.endOverlay.helper.setPosition(overlay.padding, overlay.padding + Math.round(102 * (overlay.height / 204)))
    this.endOverlay.helper.setFontSize(this.toFontPx(typography.overlayHelper))
    this.endOverlay.helper.setWordWrapWidth(overlay.width - overlay.padding * 2)

    this.endOverlay.explanationButton.container.setPosition(
      overlay.padding,
      overlay.height - overlay.buttonBottomInset - overlay.buttonHeight,
    )
    this.endOverlay.continueButton.container.setPosition(
      overlay.width - overlay.buttonWidth - overlay.padding,
      overlay.height - overlay.buttonBottomInset - overlay.buttonHeight,
    )
    this.setButtonFrame(this.endOverlay.explanationButton, overlay.buttonWidth, overlay.buttonHeight, this.layoutMetrics.typography.actionLabel)
    this.setButtonFrame(this.endOverlay.continueButton, overlay.buttonWidth, overlay.buttonHeight, this.layoutMetrics.typography.actionLabel)

    if (this.endOverlay.container.visible && this.endOverlay.container.alpha > 0) {
      this.endOverlay.panel.setY(overlay.y)
    }
  }

  private createStatePanel() {
    if (!this.stateLayer) {
      return
    }

    const { statePanel, typography } = this.layoutMetrics
    const region = this.add.container(statePanel.x, statePanel.y)
    const background = this.add
      .rectangle(0, 0, statePanel.width, statePanel.height, COLORS.panelSoft, 0.98)
      .setOrigin(0)
      .setStrokeStyle(1, COLORS.border, 1)
    const eyebrow = this.createText(statePanel.padding, statePanel.padding, '', {
      fontFamily: 'Arial',
      fontSize: this.toFontPx(typography.stateEyebrow),
      color: COLORS.textMuted,
      fontStyle: 'bold',
    })
    const title = this.createText(statePanel.padding, statePanel.padding + Math.round(34 * (statePanel.height / 236)), '', {
      fontFamily: 'Arial',
      fontSize: this.toFontPx(typography.stateTitle),
      color: COLORS.text,
      fontStyle: 'bold',
      wordWrap: { width: statePanel.width - statePanel.padding * 2, useAdvancedWrap: true },
    })
    const body = this.createText(statePanel.width / 2, statePanel.bodyY, '', {
      fontFamily: 'Arial',
      fontSize: this.toFontPx(typography.stateBody),
      color: COLORS.textMuted,
      align: 'center',
      wordWrap: { width: statePanel.width - statePanel.padding * 2, useAdvancedWrap: true },
    })
    body.setOrigin(0.5, 0)
    const menuButton = this.createPressableButton(
      statePanel.width - statePanel.padding - 64,
      statePanel.padding - 4,
      64,
      24,
      'Menu',
      () => {
        this.handleOpenMenuIntent()
      },
    )

    const actionButton = this.createPressableButton(
      (statePanel.width - statePanel.actionWidth) / 2,
      statePanel.height - statePanel.actionBottomInset - statePanel.actionHeight,
      statePanel.actionWidth,
      statePanel.actionHeight,
      'Try again',
      () => {
        this.getIntents().onReload()
      },
    )

    region.add([background, eyebrow, title, body, menuButton.container, actionButton.container])

    this.statePanel = { container: region, background, eyebrow, title, body, menuButton, actionButton }
    this.stateLayer.add(region)
    this.layoutStatePanel()
  }

  private layoutStatePanel() {
    if (!this.statePanel) {
      return
    }

    const { statePanel, typography } = this.layoutMetrics
    this.statePanel.container.setPosition(statePanel.x, statePanel.y)
    this.setRectangleDimensions(this.statePanel.background, statePanel.width, statePanel.height)

    this.statePanel.eyebrow.setPosition(statePanel.padding, statePanel.padding)
    this.statePanel.eyebrow.setFontSize(this.toFontPx(typography.stateEyebrow))
    this.statePanel.menuButton.container.setPosition(statePanel.width - statePanel.padding - 64, statePanel.padding - 4)
    this.setButtonFrame(this.statePanel.menuButton, 64, 24, Math.max(10, typography.headerStatus))
    this.applyButtonPalette(this.statePanel.menuButton, {
      fill: COLORS.ink,
      stroke: COLORS.border,
      text: COLORS.textMuted,
      shadowAlpha: 0.12,
      alpha: 0.96,
    })

    this.statePanel.title.setPosition(statePanel.padding, statePanel.padding + Math.round(34 * (statePanel.height / 236)))
    this.statePanel.title.setFontSize(this.toFontPx(typography.stateTitle))
    this.statePanel.title.setWordWrapWidth(statePanel.width - statePanel.padding * 2)

    this.statePanel.body.setPosition(Math.round(statePanel.width / 2), statePanel.bodyY)
    this.statePanel.body.setFontSize(this.toFontPx(typography.stateBody))
    this.statePanel.body.setWordWrapWidth(statePanel.width - statePanel.padding * 2)

    this.statePanel.actionButton.container.setPosition(
      (statePanel.width - statePanel.actionWidth) / 2,
      statePanel.height - statePanel.actionBottomInset - statePanel.actionHeight,
    )
    this.setButtonFrame(this.statePanel.actionButton, statePanel.actionWidth, statePanel.actionHeight, this.layoutMetrics.typography.actionLabel)
  }

  private applySnapshot = () => {
    const snapshot = this.getSnapshot()
    const previousSnapshot = this.previousSnapshot
    const showStatePanel =
      snapshot.mode === 'LOADING' || snapshot.mode === 'WAITING' || snapshot.mode === 'BLOCKED'
    this.syncVisualState(snapshot, previousSnapshot)

    if (snapshot.mode !== 'PLAYING' && this.isOnboardingBlockingInput()) {
      this.finishOnboardingDemo(false)
    }

    this.gameplayLayer?.setVisible(!showStatePanel)
    this.feedbackRoot?.setVisible(!showStatePanel)
    this.overlayRoot?.setVisible(!showStatePanel)
    this.stateLayer?.setVisible(showStatePanel)

    if (showStatePanel) {
      this.refreshOverlayEffects(false, COLORS.cyan)
      this.guessBarScanTween?.stop()
      this.guessBarScanTween = undefined
      if (this.guessBar) {
        this.guessBar.scan.setAlpha(0)
      }
      this.syncStatePanel(snapshot)
      if (this.endOverlay) {
        this.endOverlay.container.setVisible(false)
        this.endOverlay.container.setAlpha(0)
      }
      this.guessBarResetEvent?.remove(false)
      this.guessBarResetEvent = undefined
      this.feedbackHideEvent?.remove(false)
      this.feedbackHideEvent = undefined
      if (this.feedbackLayer) {
        this.feedbackLayer.container.setVisible(false)
        this.feedbackLayer.container.setAlpha(0)
      }
      this.previousSnapshot = cloneSnapshot(snapshot)
      if (DEBUG_RENDER_AUDIT) {
        this.updateDebugAuditOverlay('snapshot')
      }
      return
    }

    const rewardChanged = snapshot.reward?.receivedAt && snapshot.reward.receivedAt !== previousSnapshot?.reward?.receivedAt
    const attemptChanged = getAttemptKey(previousSnapshot?.latestAttempt ?? null) !== getAttemptKey(snapshot.latestAttempt)
    const enteredSubmitting = snapshot.mode === 'SUBMITTING' && previousSnapshot?.mode !== 'SUBMITTING'
    const becameReadyToCommit = isReadyToCommit(snapshot) && !isReadyToCommit(previousSnapshot)

    if (rewardChanged && snapshot.reward) {
      this.showRewardToast(snapshot.reward)
    }

    if (enteredSubmitting) {
      this.animateGuessSubmit()
    }

    if (attemptChanged && snapshot.latestAttempt) {
      switch (snapshot.latestAttempt.label) {
        case 'correct':
          this.animateCorrectGuess(snapshot.mode === 'FINAL_FEEDBACK')
          break
        case 'close':
          this.animateCloseGuess(snapshot.mode === 'FINAL_FEEDBACK')
          break
        default:
          this.animateWrongGuess(snapshot.mode === 'FINAL_FEEDBACK')
          break
      }
    } else if (!this.guessBarResetEvent && snapshot.mode !== 'FINAL_FEEDBACK') {
      this.guessBarState = getGuessBarBaseState(snapshot)
    }

    if (snapshot.mode === 'FINAL_FEEDBACK' && snapshot.feedbackLabel) {
      this.guessBarResetEvent?.remove(false)
      this.guessBarResetEvent = undefined
      this.guessBarState = snapshot.feedbackLabel
    }

    this.hudLayerModule.render(snapshot, previousSnapshot)
    this.cluePanelLayerModule.render(snapshot, previousSnapshot)
    this.actionRowLayerModule.render(snapshot, previousSnapshot)
    this.keyboardPanelLayerModule.render(snapshot, previousSnapshot)
    this.feedbackLayerModule.render(snapshot, previousSnapshot)
    this.diagnosisBarLayerModule.render(snapshot, previousSnapshot)
    this.overlayLayerModule.render(snapshot, previousSnapshot)
    this.rewardLayerModule.render(snapshot, previousSnapshot)

    this.maybeStartOnboardingDemo(snapshot)

    if (becameReadyToCommit && snapshot.mode === 'PLAYING') {
      this.animateReadyToCommit()
    }

    this.previousSnapshot = cloneSnapshot(snapshot)
    if (DEBUG_RENDER_AUDIT) {
      this.updateDebugAuditOverlay('snapshot')
    }
  }

  private syncStatePanel(snapshot: PhaserGameSessionSnapshot) {
    if (!this.statePanel) {
      return
    }

    let eyebrow = 'Case'
    let title = 'Loading case'
    let body = 'Preparing your next diagnostic challenge...'
    let showAction = false

    if (snapshot.mode === 'WAITING') {
      eyebrow = 'Case completed'
      title = 'Next case available in'
      body = snapshot.waitingCountdownText ?? '00:00:00'
    } else if (snapshot.mode === 'BLOCKED') {
      eyebrow = 'Unavailable'
      title = 'Play is paused'
      body = snapshot.unavailableReason ?? 'No case available right now.'
      showAction = snapshot.canRetry
    }

    this.statePanel.eyebrow.setText(eyebrow)
    this.statePanel.title.setText(title)
    this.statePanel.body.setText(body)
    this.statePanel.actionButton.container.setVisible(showAction)
    this.setPressableEnabled(this.statePanel.actionButton, showAction)

    if (showAction) {
      this.applyButtonPalette(this.statePanel.actionButton, {
        fill: COLORS.emerald,
        stroke: COLORS.emerald,
        text: COLORS.text,
        shadowAlpha: 0.22,
      })
    }
  }

  private getHeaderTensionState(viabilityRemaining: number, viabilityTotal: number): HeaderTensionState {
    if (viabilityTotal <= 0) {
      return 'safe'
    }

    const dangerThreshold = Math.max(1, Math.floor(viabilityTotal * 0.34))
    const warningThreshold = Math.max(dangerThreshold + 1, Math.ceil(viabilityTotal * 0.6))

    if (viabilityRemaining <= dangerThreshold) {
      return 'danger'
    }

    if (viabilityRemaining <= warningThreshold) {
      return 'warning'
    }

    return 'safe'
  }

  private getHeaderTensionPalette(state: HeaderTensionState) {
    switch (state) {
      case 'danger':
        return {
          heartColor: '#fb7185',
          heartAlpha: 1,
          heartInactiveColor: '#4a2330',
          heartInactiveAlpha: 0.34,
          backgroundAlpha: 0.28,
          dividerAlpha: 0.14,
          titleAlpha: 0.88,
        }
      case 'warning':
        return {
          heartColor: '#fbbf24',
          heartAlpha: 0.98,
          heartInactiveColor: '#4a3415',
          heartInactiveAlpha: 0.3,
          backgroundAlpha: 0.3,
          dividerAlpha: 0.15,
          titleAlpha: 0.9,
        }
      default:
        return {
          heartColor: '#7cf7b1',
          heartAlpha: 0.96,
          heartInactiveColor: '#31445e',
          heartInactiveAlpha: 0.26,
          backgroundAlpha: 0.32,
          dividerAlpha: 0.16,
          titleAlpha: 0.92,
        }
    }
  }

  private stopHeaderHeartPulse() {
    if (this.headerHeartPulseTween) {
      this.headerHeartPulseTween.stop()
      this.headerHeartPulseTween = undefined
    }

    if (this.headerHeartsContainer) {
      this.tweens.killTweensOf(this.headerHeartsContainer)
      this.headerHeartsContainer.setScale(1)
      this.headerHeartsContainer.setAlpha(1)
    }

    this.headerHeartPulseState = null
  }

  private refreshHeaderHeartPulse(state: HeaderTensionState, enabled: boolean, strongest = false) {
    if (!this.headerHeartsContainer) {
      return
    }

    if (!enabled) {
      this.stopHeaderHeartPulse()
      return
    }

    if (this.headerHeartPulseTween && this.headerHeartPulseState === state) {
      return
    }

    this.stopHeaderHeartPulse()
    this.headerHeartPulseState = state
    this.headerHeartPulseTween = this.tweens.add({
      targets: this.headerHeartsContainer,
      scaleX: strongest ? 1.024 : 1.018,
      scaleY: strongest ? 1.024 : 1.018,
      alpha: strongest ? 0.88 : 0.92,
      duration: strongest ? 560 : 640,
      ease: 'Sine.InOut',
      yoyo: true,
      repeat: -1,
    })
  }

  private animateHeaderStatSettle(targets: Array<Phaser.GameObjects.Rectangle | Phaser.GameObjects.Text>, scale: number) {
    this.tweens.killTweensOf(targets)
    targets.forEach((target) => target.setScale(1))
    this.tweens.add({
      targets,
      scaleX: scale,
      scaleY: scale,
      duration: 120,
      ease: 'Quad.Out',
      yoyo: true,
      hold: 36,
    })
  }

  private syncHeader(snapshot: PhaserGameSessionSnapshot) {
    this.headerTitleText?.setText('Wardle')
    this.headerTitleGlow?.setText('Wardle')

    if (
      !this.headerStatsRegion ||
      !this.headerHeartsContainer ||
      !this.headerLevelChip ||
      !this.headerLevelText ||
      !this.headerXpChip ||
      !this.headerXpText
    ) {
      return
    }

    const { header, typography } = this.layoutMetrics
    const chipFontSize = Math.max(9, typography.headerStatus - 1)
    const levelFontSize = Math.max(8, chipFontSize - 1)
    const xpFontSize = Math.max(levelFontSize + 1, chipFontSize)
    const chipHeight = Math.max(12, Math.round(header.height * 0.27))
    const levelChipHeight = Math.max(12, chipHeight - 1)
    const chipGap = Math.max(5, Math.round(header.width * 0.013))
    const chipPaddingX = Math.max(7, Math.round(header.width * 0.022))
    const clusterPaddingRight = Phaser.Math.Clamp(Math.round(header.width * 0.036), 11, 14)
    const clusterTopY = Math.max(4, Math.round(header.height * 0.16))
    const topRowY = 0
    const rowGap = Math.max(6, Math.round(header.height * 0.13))
    const heartFontSize = Math.max(11, typography.headerStatus + 1 + (snapshot.hud.viabilityTotal <= 5 ? 1 : 0))
    const heartGap = Math.max(2, Math.round(header.width * 0.007))
    const titleFontSize = Math.max(typography.headerProgress + 1, Math.round(header.height * 0.36))
    const titleY = Math.round(header.height * 0.42)
    const levelValue = snapshot.hud.level
    const xpTotalValue = snapshot.hud.xpTotal
    const levelNumber = typeof levelValue === 'number' ? levelValue : null
    const xpTotalNumber = typeof xpTotalValue === 'number' ? xpTotalValue : null
    const isFinalFeedback = snapshot.mode === 'FINAL_FEEDBACK'
    const previousXpTotal = typeof this.lastXp === 'number' ? this.lastXp : null
    const previousLevel = typeof this.lastLevel === 'number' ? this.lastLevel : null

    const showLevel = levelNumber !== null
    const showXp = xpTotalNumber !== null
    const viabilityTotal = Math.max(0, snapshot.hud.viabilityTotal)
    const viabilityRemaining = Phaser.Math.Clamp(snapshot.hud.viabilityRemaining, 0, viabilityTotal)
    const tensionState = this.getHeaderTensionState(viabilityRemaining, viabilityTotal)
    const tensionPalette = this.getHeaderTensionPalette(tensionState)
    const dangerState = tensionState === 'danger'
    const headerAlphaMultiplier = isFinalFeedback ? 0.88 : 1
    const accentColor = tensionState === 'danger' ? COLORS.rose : tensionState === 'warning' ? COLORS.amber : COLORS.cyan
    const frameToneColor = tensionState === 'danger' ? COLORS.rose : tensionState === 'warning' ? COLORS.amber : COLORS.cyan
    const frameToneAlpha = tensionState === 'danger' ? 0.16 : tensionState === 'warning' ? 0.13 : 0.11

    this.headerBackground?.setFillStyle(COLORS.inkLift, 0.96 * (isFinalFeedback ? 0.92 : 1))
    this.headerBackground?.setStrokeStyle(1, COLORS.border, isFinalFeedback ? 0.82 : 0.94)
    this.headerInnerPlate?.setFillStyle(COLORS.bgAccentSoft, 0.34 * (isFinalFeedback ? 0.84 : 1))
    this.headerInnerPlate?.setStrokeStyle(1, accentColor, isFinalFeedback ? 0.08 : 0.13)
    this.headerTopAccent?.setFillStyle(accentColor, isFinalFeedback ? 0.14 : 0.24)
    this.headerDivider?.setFillStyle(accentColor, tensionPalette.dividerAlpha * (isFinalFeedback ? 0.76 : 1.08))
    this.headerTitleGlow?.setFontSize(this.toFontPx(titleFontSize))
    this.headerTitleGlow?.setColor('#67e8f9')
    this.headerTitleGlow?.setAlpha((tensionState === 'danger' ? 0.11 : 0.16) * (isFinalFeedback ? 0.72 : 1))
    this.headerTitleText?.setFontSize(this.toFontPx(titleFontSize))
    this.headerTitleText?.setColor('#e6f6ff')
    this.headerTitleText?.setAlpha(tensionPalette.titleAlpha * (isFinalFeedback ? 0.9 : 1))
    this.headerTitleAccent?.setFillStyle(accentColor, isFinalFeedback ? 0.12 : 0.2)
    if (this.headerTitleAccent) {
      const titleAccentWidth = Phaser.Math.Clamp(Math.round((this.headerTitleText?.width ?? 60) * 0.46), 36, 64)
      this.setRectangleDimensions(this.headerTitleAccent, titleAccentWidth, 1)
    }
    if (this.headerDnaIcon) {
      const dnaHeight = Phaser.Math.Clamp(Math.round(header.height * 0.38), 18, 24)
      const dnaScale = dnaHeight / 24
      const titleWidth = this.headerTitleText?.width ?? 0
      const titleLeft = Math.round(header.width / 2 - titleWidth / 2)
      const dnaGap = Math.max(5, Math.round(header.height * 0.07))
      this.headerDnaIcon.setScale(dnaScale)
      this.headerDnaIcon.setPosition(
        titleLeft - Math.round((20 * dnaScale) / 2) - dnaGap,
        titleY,
      )
    }
    if (this.headerDnaIcon && this.headerDnaRotationTween) {
      if (this.isInDangerState === undefined) {
        this.headerDnaRotationTween.timeScale = dangerState ? 1.9 : 1
        this.headerDnaIcon.setTint(dangerState ? COLORS.rose : COLORS.cyan)
        this.headerDnaIcon.setAlpha(dangerState ? 0.8 : 0.56)
      } else if (this.isInDangerState !== dangerState) {
        this.headerDnaRotationTween.timeScale = dangerState ? 1.9 : 1
        this.headerDnaIcon.setTint(dangerState ? COLORS.rose : COLORS.cyan)
        this.tweens.add({
          targets: this.headerDnaIcon,
          alpha: dangerState ? 0.8 : 0.56,
          duration: 160,
          ease: 'Sine.Out',
        })
      }
    }
    if (this.outerFrameInnerGlow) {
      this.outerFrameInnerGlow.setStrokeStyle(1, frameToneColor, frameToneAlpha)
      this.outerFrameInnerGlow.setAlpha(tensionState === 'danger' ? 0.98 : 1)
    }
    if (this.outerFrameVignette) {
      const vignetteAlpha = tensionState === 'danger' ? 0.14 : tensionState === 'warning' ? 0.125 : 0.115
      const vignetteColor = tensionState === 'danger' ? COLORS.roseSoft : COLORS.shadow
      this.outerFrameVignette.setStrokeStyle(
        Phaser.Math.Clamp(Math.round(header.width * 0.02), 6, 9),
        vignetteColor,
        vignetteAlpha,
      )
    }
    this.outerFrameCornerMotifs.forEach((motif) => {
      if (!(motif instanceof Phaser.GameObjects.Image)) {
        return
      }
      motif.setTint(frameToneColor)
      motif.setAlpha(tensionState === 'danger' ? 0.085 : tensionState === 'warning' ? 0.075 : 0.065)
    })
    if (this.outerFramePulseTween && this.outerFrameInnerGlow) {
      if (this.isFrameInDangerState === undefined) {
        if (dangerState) {
          this.outerFramePulseTween.play()
        } else {
          this.outerFramePulseTween.pause()
          this.outerFrameInnerGlow.setAlpha(1)
        }
      } else if (this.isFrameInDangerState !== dangerState) {
        if (dangerState) {
          this.outerFrameInnerGlow.setAlpha(1)
          this.outerFramePulseTween.restart()
        } else {
          this.outerFramePulseTween.pause()
          this.outerFrameInnerGlow.setAlpha(1)
        }
      }
    }

    const configureChip = (
      background: Phaser.GameObjects.Rectangle,
      text: Phaser.GameObjects.Text,
      value: string,
      fill: number,
      stroke: number,
      color: string,
      fontSize: number,
      minWidth: number,
      height: number,
      fillAlpha: number,
    ) => {
      text.setText(value)
      text.setFontSize(this.toFontPx(fontSize))
      text.setColor(color)
      text.setVisible(true)
      background.setVisible(true)
      const width = Math.max(minWidth, Math.round(text.width) + chipPaddingX * 2)
      this.setRectangleDimensions(background, width, height)
      background.setFillStyle(fill, fillAlpha)
      background.setStrokeStyle(1, stroke, 0.76)
      return width
    }

    let cursorX = 0
    let topRowWidth = 0

    if (showLevel) {
      const levelDisplayValue = levelNumber ?? 0
      const levelWidth = configureChip(
        this.headerLevelChip,
        this.headerLevelText,
        `LV ${levelDisplayValue}`,
        COLORS.inkLift,
        COLORS.sky,
        '#dbeafe',
        levelFontSize,
        44,
        levelChipHeight,
        0.94,
      )
      this.headerLevelChip.setPosition(cursorX, topRowY)
      this.headerLevelText.setPosition(
        cursorX + chipPaddingX,
        topRowY + Math.round((levelChipHeight - this.headerLevelText.height) / 2) - 1,
      )
      cursorX += levelWidth
      topRowWidth += levelWidth
    } else {
      this.headerLevelChip.setVisible(false)
      this.headerLevelText.setVisible(false)
    }

    if (showXp) {
      const xpDisplayValue = xpTotalNumber ?? 0
      if (topRowWidth > 0) {
        cursorX += chipGap
        topRowWidth += chipGap
      }
      const xpWidth = configureChip(
        this.headerXpChip,
        this.headerXpText,
        `XP ${Math.round(xpDisplayValue).toLocaleString()}`,
        COLORS.panelMuted,
        COLORS.cyan,
        '#e6f5ff',
        xpFontSize,
        60,
        chipHeight,
        0.96,
      )
      this.headerXpChip.setPosition(cursorX, topRowY)
      this.headerXpText.setPosition(cursorX + chipPaddingX, topRowY + Math.round((chipHeight - this.headerXpText.height) / 2) - 1)
      topRowWidth += xpWidth
    } else {
      this.headerXpChip.setVisible(false)
      this.headerXpText.setVisible(false)
    }

    if (viabilityTotal !== this.lastHeaderViabilityTotal) {
      this.headerHeartIcons.forEach((heart) => heart.destroy())
      this.headerHeartIcons = []

      for (let index = 0; index < viabilityTotal; index += 1) {
        const heart = this.createText(0, 0, HEADER_HEART_EMPTY, {
          fontFamily: 'Arial',
          fontSize: this.toFontPx(heartFontSize),
          color: tensionPalette.heartInactiveColor,
          fontStyle: 'bold',
        })
        heart.setOrigin(0, 0.5)
        this.headerHeartsContainer.add(heart)
        this.headerHeartIcons.push(heart)
      }
    }

    let heartsWidth = 0
    this.headerHeartIcons.forEach((heart, index) => {
      const isActive = index < viabilityRemaining
      heart.setFontSize(this.toFontPx(heartFontSize))
      heart.setText(isActive ? HEADER_HEART_FULL : HEADER_HEART_EMPTY)
      heart.setColor(isActive ? tensionPalette.heartColor : tensionPalette.heartInactiveColor)
      heart.setAlpha(isActive ? tensionPalette.heartAlpha : tensionPalette.heartInactiveAlpha)
      heart.setScale(isActive ? 1 : 0.94)
      heart.setPosition(heartsWidth, 0)
      heartsWidth += Math.round(heart.width) + heartGap
    })
    heartsWidth = Math.max(0, heartsWidth - heartGap)
    const heartsY = topRowY + chipHeight + rowGap
    this.headerHeartsContainer.setPosition(0, heartsY)

    const clusterWidth = Math.max(topRowWidth, heartsWidth)
    const titleHalfWidth = Math.ceil((this.headerTitleText?.width ?? 0) / 2)
    const titleSafeRight = Math.round(header.width / 2) + titleHalfWidth + Math.max(12, Math.round(header.width * 0.03))
    const maxClusterWidth = Math.max(84, header.width - clusterPaddingRight - titleSafeRight)
    const clusterScale = clusterWidth > maxClusterWidth ? Phaser.Math.Clamp(maxClusterWidth / clusterWidth, 0.82, 1) : 1
    this.headerStatsRegion.setScale(clusterScale)
    this.headerStatsRegion.setAlpha(headerAlphaMultiplier)
    this.headerStatsRegion.setPosition(
      header.width - clusterPaddingRight - Math.round(clusterWidth * clusterScale),
      clusterTopY,
    )

    if (topRowWidth > 0) {
      const topRowOffset = Math.max(0, clusterWidth - topRowWidth)
      if (showLevel) {
        this.headerLevelChip.x += topRowOffset
        this.headerLevelText.x += topRowOffset
      }
      if (showXp) {
        this.headerXpChip.x += topRowOffset
        this.headerXpText.x += topRowOffset
      }
    }
    this.headerHeartsContainer.x = Math.max(0, clusterWidth - heartsWidth)

    const viabilityDropped = this.lastHeaderViabilityRemaining > viabilityRemaining && viabilityTotal > 0
    if (viabilityDropped) {
      const lostHeart = this.headerHeartIcons[viabilityRemaining]
      if (lostHeart) {
        this.tweens.killTweensOf(lostHeart)
        lostHeart.setScale(1.14)
        lostHeart.setAlpha(0.82)
        lostHeart.y = -1
        this.tweens.add({
          targets: lostHeart,
          scaleX: 0.94,
          scaleY: 0.94,
          alpha: tensionPalette.heartInactiveAlpha,
          y: 0,
          duration: 190,
          ease: 'Quad.Out',
        })
      }
    }

    const xpIncreased = showXp && previousXpTotal !== null && typeof xpTotalNumber === 'number' && xpTotalNumber > previousXpTotal
    const levelIncreased = showLevel && previousLevel !== null && typeof levelNumber === 'number' && levelNumber > previousLevel

    if (levelIncreased) {
      this.animateHeaderStatSettle([this.headerLevelChip, this.headerLevelText], 1.065)
      this.animateHeaderStatSettle([this.headerXpChip, this.headerXpText], 1.045)
      if (this.headerRegion && this.headerFlashSweep) {
        const { header } = this.layoutMetrics
        const sweepWidth = Math.max(36, Math.round(header.width * 0.38))
        this.tweens.killTweensOf(this.headerFlashSweep)
        this.headerFlashSweep.setVisible(true)
        this.headerFlashSweep.setAlpha(0)
        this.headerFlashSweep.setPosition(-sweepWidth, Math.round(header.height / 2))
        this.tweens.add({
          targets: this.headerFlashSweep,
          x: header.width + sweepWidth,
          alpha: 0.16,
          duration: 180,
          ease: 'Sine.Out',
          onComplete: () => {
            this.headerFlashSweep?.setVisible(false)
            this.headerFlashSweep?.setAlpha(0)
            this.headerFlashSweep?.setPosition(-sweepWidth, Math.round(header.height / 2))
          },
        })
      }
    } else if (xpIncreased) {
      this.animateHeaderStatSettle([this.headerXpChip, this.headerXpText], 1.04)
    }

    if (xpIncreased || levelIncreased) {
      if (this.headerRegion && this.headerXpChip && this.headerXpText) {
        const xpOriginX = Math.round(this.headerXpChip.x + this.headerXpChip.width / 2)
        const xpOriginY = Math.round(this.headerXpChip.y + this.headerXpChip.height / 2)
        const levelOriginX = this.headerLevelChip
          ? Math.round(this.headerLevelChip.x + this.headerLevelChip.width / 2)
          : xpOriginX
        const burstOriginX = levelIncreased ? Math.round((xpOriginX + levelOriginX) / 2) : xpOriginX
        const burstOriginY = xpOriginY
        const burstCount = levelIncreased ? 6 : 3

        this.emitBurst(this.feedbackBurstPool, LAB_MOTE_TEXTURE, burstOriginX, burstOriginY, COLORS.emeraldGlow, burstCount, this.headerRegion)
        this.emitBurst(this.feedbackBurstPool, LAB_MOTE_TEXTURE, burstOriginX, burstOriginY, COLORS.cyan, Math.max(2, burstCount - 1), this.headerRegion)
      }
    }

    this.refreshHeaderHeartPulse(
      tensionState,
      tensionState === 'danger' && viabilityRemaining > 0 && !isFinalFeedback,
      viabilityRemaining === 1,
    )

    this.lastHeaderViabilityRemaining = viabilityRemaining
    this.lastHeaderViabilityTotal = viabilityTotal
    this.lastXp = showXp ? xpTotalNumber ?? undefined : undefined
    this.lastLevel = showLevel ? levelNumber ?? undefined : undefined
    this.isInDangerState = dangerState
    this.isFrameInDangerState = dangerState
  }

  private syncClues(
    snapshot: PhaserGameSessionSnapshot,
    previousSnapshot: PhaserGameSessionSnapshot | undefined,
  ) {
    if (!this.clueCardLayer) {
      return
    }

    const { clues } = this.layoutMetrics
    const clueCardWidth = Math.max(120, clues.width - clues.cardInset * 2)

    const currentIds = new Set(snapshot.visibleClues.map((clue) => clue.id))
    this.clueCards.forEach((view, id) => {
      if (!currentIds.has(id)) {
        view.container.destroy(true)
        this.clueCards.delete(id)
      }
    })

    const hasClues = snapshot.visibleClues.length > 0
    if (this.clueEmptyText) {
      this.clueEmptyText.setVisible(!hasClues)
    }

    snapshot.visibleClues.forEach((clue) => {
      if (!this.clueCards.has(clue.id)) {
        const view = this.createClueCard(clue, clueCardWidth)
        this.clueCards.set(clue.id, view)
        this.clueCardLayer?.add(view.container)
      }
    })

    const total = snapshot.visibleClues.length
    const newestIndex = total - 1
    const itemGap = Math.max(6, Math.round(clues.height * (8 / 340)))

    const targets = snapshot.visibleClues.map((clue, index) => {
      const view = this.clueCards.get(clue.id)
      const age = newestIndex - index
      const scale = 1
      const alpha = age === 0 ? 1 : Phaser.Math.Clamp(0.9 - age * 0.08, 0.72, 0.9)
      const x = Math.round(clues.cardInset)

      this.refreshClueCard(view!, clue, age)
      const y = 0

      return { clue, view: view!, age, x, y, scale, alpha }
    })

    const totalHeight = targets.reduce((sum, target) => sum + target.view.height, 0) + Math.max(0, total - 1) * itemGap
    const contentBottom = clues.height - clues.stackBottomInset
    const minStartY = clues.minTopInset
    const startY = Math.min(minStartY, Math.round(contentBottom - totalHeight))
    let cursorY = startY
    targets.forEach((target) => {
      target.y = cursorY
      cursorY += target.view.height + itemGap
    })

    const previousCount = previousSnapshot?.visibleClues.length ?? 0

    targets.forEach((target, order) => {
      const { clue, view, scale, alpha } = target
      const x = target.x
      const y = target.y

      view.container.setDepth(order + 1)
      this.clueCardLayer?.bringToTop(view.container)

      const isNewReveal = !previousSnapshot || !previousSnapshot.visibleClues.some((item) => item.id === clue.id)
      if (isNewReveal && total >= previousCount) {
        this.animateNewClueCard(view, x, y, scale, alpha)
        return
      }

      this.tweens.killTweensOf(view.container)
      view.container.setPosition(x, y)
      view.container.setScale(scale)
      view.container.setAlpha(alpha)
    })
  }

  private syncGuessBar(snapshot: PhaserGameSessionSnapshot) {
    if (!this.guessBar) {
      return
    }

    if (snapshot.mode !== 'FINAL_FEEDBACK' && snapshot.mode !== 'SUBMITTING' && !this.guessBarResetEvent) {
      this.guessBarState = getGuessBarBaseState(snapshot)
    }

    const state = this.guessBarState
    const style = this.getGuessBarVisual(state)
    const readyToCommit = state === 'typing' && isReadyToCommit(snapshot)
    const baseValue =
      state === 'empty'
        ? 'YOUR DIAGNOSIS'
        : snapshot.guess || snapshot.finalDiagnosis || snapshot.latestAttempt?.guess || 'YOUR DIAGNOSIS'
    const onboardingGuessOverlayActive =
      this.isOnboardingBlockingInput() && (this.onboardingGhostGuess?.alpha ?? 0) > 0.02

    const slotStroke = readyToCommit ? COLORS.emeraldGlow : style.stroke
    const slotHaloColor = readyToCommit ? COLORS.emeraldGlow : style.haloColor
    const slotHaloAlpha = readyToCommit ? 0.2 : style.haloAlpha
    const slotFill = readyToCommit ? 0x103028 : style.fill
    const slotLabelColor = readyToCommit ? '#bbf7d0' : style.labelColor
    const borderWidth = readyToCommit ? 2 : state === 'empty' || state === 'disabled' ? 1 : 2

    const hasTypedGuess = snapshot.guess.trim().length > 0
    const showCaret = snapshot.canEditGuess && (state === 'typing' || (state === 'empty' && !hasTypedGuess)) && !snapshot.submitDisabled && this.guessCaretVisible

    this.guessBar.container.setAlpha(snapshot.mode === 'FINAL_FEEDBACK' ? 0.68 : 1)
    this.guessBar.halo.setFillStyle(slotHaloColor, slotHaloAlpha)
    this.guessBar.glow.setFillStyle(slotStroke, Phaser.Math.Clamp(slotHaloAlpha * 0.66, 0.06, 0.22))
    this.guessBar.background.setFillStyle(slotFill, state === 'empty' ? 0.9 : readyToCommit ? 0.97 : 0.95)
    this.guessBar.border.setStrokeStyle(borderWidth, slotStroke, 1)
    this.guessBar.label.setColor(slotLabelColor)
    this.guessBar.label.setAlpha(readyToCommit ? 0.86 : state === 'empty' ? 0.62 : 0.78)
    this.guessBar.value.setColor(style.valueColor)
    this.guessBar.value.setAlpha(
      onboardingGuessOverlayActive
        ? 0
        : snapshot.mode === 'FINAL_FEEDBACK'
        ? 0.9
        : state === 'empty'
        ? 0.78
        : 1,
    )
    const baseFontSize = this.layoutMetrics.typography.guessValue
    const adjustedFontSize =
      baseValue.length > 24
        ? Math.max(16, Math.round(baseFontSize * 0.67))
        : baseValue.length > 16
        ? Math.max(18, Math.round(baseFontSize * 0.8))
        : baseFontSize
    const maxChars = Math.max(
      10,
      Math.floor((this.layoutMetrics.guessBar.width - this.layoutMetrics.guessBar.textInset * 2) / Math.max(7, adjustedFontSize * 0.56)),
    )
    const clippedValue =
      baseValue.length > maxChars ? `${baseValue.slice(0, Math.max(6, maxChars - 1)).trimEnd()}...` : baseValue
    const renderedValue = onboardingGuessOverlayActive ? '' : showCaret ? `${clippedValue}|` : clippedValue

    this.guessBar.value.setText(renderedValue)
    this.guessBar.value.setFontSize(this.toFontPx(adjustedFontSize))
    this.guessBar.helper.setText(style.helper)
    this.guessBar.helper.setColor(style.helperColor)
    this.guessBar.helper.setAlpha(style.helper ? 1 : 0)

    this.refreshGuessBarGlow(state, style)
    this.refreshGuessBarScan(state, slotStroke)
  }

  private syncActionRow(snapshot: PhaserGameSessionSnapshot) {
    if (!this.actionButtons) {
      return
    }

    const hasGuess = snapshot.guess.trim().length > 0
    const canEdit = snapshot.canEditGuess
    const canClear = canEdit && hasGuess
    const canSubmit = !snapshot.submitDisabled
    const readyToCommit = isReadyToCommit(snapshot)
    const isSubmitting = snapshot.mode === 'SUBMITTING'

    this.actionButtons.submit.label.setText(snapshot.mode === 'SUBMITTING' ? 'Checking' : 'Submit')
    this.setPressableEnabled(this.actionButtons.clear, canClear)
    this.setPressableEnabled(this.actionButtons.backspace, canClear)
    this.setPressableEnabled(this.actionButtons.submit, canSubmit)
    this.actionButtons.clear.container.setAlpha(snapshot.mode === 'FINAL_FEEDBACK' ? 0.3 : 1)
    this.actionButtons.backspace.container.setAlpha(snapshot.mode === 'FINAL_FEEDBACK' ? 0.3 : 1)
    this.actionButtons.submit.container.setAlpha(snapshot.mode === 'FINAL_FEEDBACK' ? 0.4 : 1)

    this.applyButtonPalette(this.actionButtons.clear, {
      fill: canClear ? 0x122638 : COLORS.ink,
      stroke: canClear ? COLORS.cyan : COLORS.borderSoft,
      text: canClear ? '#d7f7ff' : COLORS.textQuiet,
      shadowAlpha: canClear ? 0.16 : 0.08,
      alpha: canEdit ? 1 : 0.76,
      glowAlpha: canClear ? 0.04 : 0.02,
      hoverGlowAlpha: canClear ? 0.08 : 0.03,
      pressedGlowAlpha: canClear ? 0.14 : 0.04,
    })

    this.applyButtonPalette(this.actionButtons.backspace, {
      fill: canClear ? 0x161f31 : COLORS.ink,
      stroke: canClear ? COLORS.amber : COLORS.borderSoft,
      text: canClear ? '#fde68a' : COLORS.textQuiet,
      shadowAlpha: canClear ? 0.16 : 0.08,
      alpha: canEdit ? 1 : 0.76,
      glowAlpha: canClear ? 0.04 : 0.02,
      hoverGlowAlpha: canClear ? 0.08 : 0.03,
      pressedGlowAlpha: canClear ? 0.14 : 0.04,
    })

    this.applyButtonPalette(this.actionButtons.submit, {
      fill: isSubmitting ? 0x0f3040 : readyToCommit ? 0x0f5d4f : canSubmit ? 0x0f5348 : 0x12342f,
      stroke: isSubmitting ? COLORS.cyan : canSubmit ? COLORS.emeraldGlow : 0x245148,
      text: COLORS.text,
      shadowAlpha: readyToCommit ? 0.32 : canSubmit ? 0.28 : 0.12,
      alpha: canSubmit ? 1 : 0.84,
      glowAlpha: readyToCommit ? 0.14 : canSubmit ? 0.1 : 0.03,
      hoverGlowAlpha: readyToCommit ? 0.22 : canSubmit ? 0.18 : 0.05,
      pressedGlowAlpha: readyToCommit ? 0.32 : canSubmit ? 0.28 : 0.08,
      strokeWidth: canSubmit ? 2 : 1,
      pressedStrokeWidth: readyToCommit ? 3 : canSubmit ? 2 : 1,
      shineAlpha: readyToCommit ? 0.14 : canSubmit ? 0.11 : 0.04,
    })
  }

  private syncKeyboard(snapshot: PhaserGameSessionSnapshot) {
    const canEdit = snapshot.canEditGuess
    if (this.keyboardRegion) {
      this.keyboardRegion.setAlpha(snapshot.mode === 'FINAL_FEEDBACK' ? 0.34 : 1)
    }
    const keyPalette: ButtonPalette = canEdit
      ? {
          fill: 0x102131,
          stroke: COLORS.cyan,
          text: '#e0f7ff',
          shadowAlpha: 0.16,
          glowAlpha: 0.05,
          hoverGlowAlpha: 0.12,
          pressedGlowAlpha: 0.22,
          shineAlpha: 0.09,
        }
      : {
          fill: COLORS.ink,
          stroke: COLORS.borderSoft,
          text: COLORS.textQuiet,
          shadowAlpha: 0.08,
          alpha: 0.8,
          glowAlpha: 0.02,
          hoverGlowAlpha: 0.03,
          pressedGlowAlpha: 0.05,
          shineAlpha: 0.03,
        }

    this.keyboardButtons.forEach(({ view }) => {
      this.setPressableEnabled(view, canEdit)
      this.applyButtonPalette(view, keyPalette)
    })

    if (this.spaceButton) {
      this.setPressableEnabled(this.spaceButton, canEdit)
      this.applyButtonPalette(this.spaceButton, keyPalette)
    }
  }

  private syncFeedback(
    snapshot: PhaserGameSessionSnapshot,
    previousSnapshot: PhaserGameSessionSnapshot | undefined,
  ) {
    if (!this.feedbackLayer) {
      return
    }

    const previousKey = getAttemptKey(previousSnapshot?.latestAttempt ?? null)
    const currentKey = getAttemptKey(snapshot.latestAttempt)

    if (currentKey && currentKey !== previousKey && snapshot.latestAttempt) {
      this.showFeedback(snapshot.latestAttempt.label, snapshot.mode === 'FINAL_FEEDBACK')
      return
    }

    if (snapshot.mode !== 'FINAL_FEEDBACK' && !this.feedbackHideEvent && this.feedbackLayer.container.alpha === 0) {
      this.feedbackLayer.container.setVisible(false)
    }
  }

  private syncEndOverlay(
    snapshot: PhaserGameSessionSnapshot,
    previousSnapshot: PhaserGameSessionSnapshot | undefined,
  ) {
    if (!this.endOverlay) {
      return
    }

    const { overlay } = this.layoutMetrics

    if (snapshot.mode !== 'FINAL_FEEDBACK') {
      if (!this.isOnboardingBlockingInput()) {
        this.clueStackRegion?.setAlpha(1)
      }
      this.refreshOverlayEffects(false, COLORS.cyan)
      if (previousSnapshot?.mode === 'FINAL_FEEDBACK') {
        this.tweens.add({
          targets: this.endOverlay.container,
          alpha: 0,
          duration: 180,
          ease: 'Quad.Out',
          onComplete: () => {
            this.endOverlay?.container.setVisible(false)
          },
        })
      } else {
        this.endOverlay.container.setVisible(false)
        this.endOverlay.container.setAlpha(0)
      }
      return
    }

    const label = snapshot.latestAttempt?.label ?? 'wrong'
    const outcomeTone = snapshot.outcomeTone ?? (label === 'correct' ? 'steady_save' : 'patient_lost')
    const diagnosisText = snapshot.finalDiagnosis ?? snapshot.latestAttempt?.guess ?? 'Diagnosis submitted'
    let eyebrow = 'PATIENT STABILIZED'
    let title = 'Good reasoning under pressure'
    let helper = 'You reached the diagnosis before the patient lost viability.'
    let accentColor: number = COLORS.emerald
    let eyebrowColor = '#6ee7b7'
    let continuePalette: ButtonPalette = {
      fill: COLORS.emerald,
      stroke: COLORS.emerald,
      text: COLORS.text,
      shadowAlpha: 0.24,
    }

    switch (outcomeTone) {
      case 'early_save':
        title = 'Excellent clinical judgment'
        helper = 'Diagnosed early, before the patient deteriorated. Open the explanation to see why it fit.'
        break
      case 'last_chance_save':
        eyebrow = 'JUST IN TIME'
        title = 'Saved just in time'
        helper = 'The final clue gave you enough signal to act before viability collapsed.'
        accentColor = COLORS.amber
        eyebrowColor = '#fcd34d'
        break
      case 'patient_lost':
        eyebrow = 'PATIENT LOST'
        title = 'The diagnosis was missed'
        helper = 'The patient deteriorated before the correct diagnosis was made. Review the explanation when you are ready.'
        accentColor = COLORS.rose
        eyebrowColor = '#fda4af'
        continuePalette = {
          fill: COLORS.panelMuted,
          stroke: COLORS.rose,
          text: COLORS.text,
          shadowAlpha: 0.14,
          alpha: 0.94,
        }
        break
      default:
        accentColor = COLORS.cyan
        eyebrowColor = '#67e8f9'
        break
    }

    this.endOverlay.eyebrow.setText(eyebrow)
    this.endOverlay.title.setText(title)
    this.endOverlay.diagnosis.setText(diagnosisText)
    this.endOverlay.helper.setText(helper)
    this.endOverlay.accent.setFillStyle(accentColor, 0.95)
    this.endOverlay.eyebrow.setColor(eyebrowColor)
    this.endOverlay.glow.setFillStyle(accentColor, 0.1)

    this.applyButtonPalette(this.endOverlay.continueButton, continuePalette)
    this.setPressableEnabled(this.endOverlay.continueButton, true)
    this.setPressableEnabled(this.endOverlay.explanationButton, snapshot.canOpenExplanation)
    this.applyButtonPalette(this.endOverlay.explanationButton, {
      fill: snapshot.canOpenExplanation ? COLORS.panelMuted : COLORS.ink,
      stroke: snapshot.canOpenExplanation ? COLORS.border : COLORS.borderSoft,
      text: snapshot.canOpenExplanation ? COLORS.text : COLORS.textQuiet,
      shadowAlpha: snapshot.canOpenExplanation ? 0.18 : 0.08,
      alpha: snapshot.canOpenExplanation ? 1 : 0.82,
    })

    if (previousSnapshot?.mode !== 'FINAL_FEEDBACK') {
      this.animateFinalRevealSettle()
      this.endOverlay.container.setVisible(true)
      this.endOverlay.container.setAlpha(0)
      this.endOverlay.panel.y = overlay.y + overlay.entryOffset
      this.endOverlay.glow.setAlpha(0.08)
      this.endOverlay.beam.setAlpha(0.14)
      this.tweens.add({
        targets: this.endOverlay.container,
        alpha: 1,
        duration: 170,
        ease: 'Quad.Out',
      })
      this.tweens.add({
        targets: this.endOverlay.panel,
        y: overlay.y,
        duration: 220,
        ease: 'Cubic.Out',
        onComplete: () => {
          this.refreshOverlayEffects(true, accentColor)
        },
      })
    } else {
      this.endOverlay.container.setVisible(true)
      this.endOverlay.container.setAlpha(1)
      this.endOverlay.panel.y = overlay.y
      this.refreshOverlayEffects(true, accentColor)
    }
  }

  private animateNewClueCard(
    view: ClueCardView,
    targetX: number,
    targetY: number,
    scale: number,
    alpha: number,
  ) {
    const dropInOffset = Math.max(2, Math.round(this.layoutMetrics.clues.height * (4 / 340)))
    view.container.setPosition(targetX, targetY + dropInOffset)
    view.container.setScale(scale)
    view.container.setAlpha(Math.min(0.56, alpha))
    this.tweens.killTweensOf(view.container)
    this.tweens.add({
      targets: view.container,
      x: targetX,
      y: targetY,
      alpha,
      scaleX: scale,
      scaleY: scale,
      duration: 150,
      ease: 'Sine.Out',
    })
  }

  private animateGuessSubmit() {
    if (!this.guessBar) {
      return
    }

    this.guessBarState = 'submitting'
    this.syncGuessBar(this.getSnapshot())
    this.guessBarResetEvent?.remove(false)
    this.guessBarResetEvent = undefined
    this.tweens.killTweensOf(this.guessBar.container)
    if (this.actionButtons?.submit) {
      this.tweens.killTweensOf(this.actionButtons.submit.container)
      this.tweens.killTweensOf(this.actionButtons.submit.glow)
      this.tweens.add({
        targets: this.actionButtons.submit.container,
        scaleX: 0.978,
        scaleY: 0.978,
        duration: 70,
        yoyo: true,
        ease: 'Quad.Out',
        onComplete: () => {
          this.actionButtons?.submit.container.setScale(1)
        },
      })
      this.tweens.add({
        targets: this.actionButtons.submit.glow,
        alpha: { from: this.actionButtons.submit.glow.alpha, to: 0.34 },
        duration: 90,
        yoyo: true,
        ease: 'Quad.Out',
      })
    }
    this.tweens.add({
      targets: this.guessBar.container,
      scaleX: 0.988,
      scaleY: 0.988,
      y: this.layoutMetrics.guessBar.y + 1,
      duration: 72,
      yoyo: true,
      ease: 'Quad.Out',
      onComplete: () => {
        this.guessBar?.container.setScale(1)
        this.guessBar?.container.setY(this.layoutMetrics.guessBar.y)
        this.syncGuessBar(this.getSnapshot())
      },
    })
  }

  private animateReadyToCommit() {
    if (!this.guessBar) {
      return
    }

    this.tweens.killTweensOf(this.guessBar.halo)
    this.tweens.add({
      targets: this.guessBar.halo,
      alpha: { from: Math.max(this.guessBar.halo.alpha, 0.18), to: 0.18 },
      scaleX: { from: 1.004, to: 1.02 },
      scaleY: { from: 1.004, to: 1.02 },
      duration: 130,
      ease: 'Cubic.Out',
      onComplete: () => {
        this.guessBar?.halo.setScale(1)
        this.syncGuessBar(this.getSnapshot())
      },
    })

    if (this.actionButtons?.submit) {
      this.tweens.killTweensOf(this.actionButtons.submit.container)
      this.tweens.killTweensOf(this.actionButtons.submit.glow)
      this.tweens.add({
        targets: this.actionButtons.submit.container,
        scaleX: 1.008,
        scaleY: 1.008,
        duration: 100,
        yoyo: true,
        ease: 'Quad.Out',
        onComplete: () => {
          this.actionButtons?.submit.container.setScale(1)
        },
      })
      this.tweens.add({
        targets: this.actionButtons.submit.glow,
        alpha: { from: this.actionButtons.submit.glow.alpha, to: Math.max(0.18, this.actionButtons.submit.glow.alpha) },
        duration: 110,
        yoyo: true,
        ease: 'Quad.Out',
      })
    }
  }

  private animateFinalRevealSettle() {
    if (this.clueStackRegion) {
      this.tweens.killTweensOf(this.clueStackRegion)
      this.tweens.add({
        targets: this.clueStackRegion,
        alpha: 0.84,
        duration: 180,
        ease: 'Quad.Out',
      })
    }

    if (this.guessBar) {
      this.tweens.killTweensOf(this.guessBar.container)
      this.tweens.add({
        targets: this.guessBar.container,
        alpha: 0.68,
        scaleX: 0.994,
        scaleY: 0.994,
        duration: 180,
        ease: 'Quad.Out',
        onComplete: () => {
          this.guessBar?.container.setScale(1)
        },
      })
    }
  }

  private animateWrongGuess(persist: boolean) {
    this.setGuessBarState('wrong', persist ? undefined : 900)
    this.shakeHorizontal(this.guessBar?.container, this.layoutMetrics.guessBar.x)
    this.pulseHalo(COLORS.rose, 0.28)
    this.emitBurst(
      this.feedbackBurstPool,
      LAB_MOTE_TEXTURE,
      this.layoutMetrics.guessBar.x + Math.round(this.layoutMetrics.guessBar.width * 0.5),
      this.layoutMetrics.guessBar.y + Math.round(this.layoutMetrics.guessBar.height * 0.42),
      COLORS.rose,
      getLabVisualBudget(this.layoutMetrics.board).feedbackBursts,
      this.feedbackRoot,
      DEPTH.FEEDBACK,
    )
  }

  private animateCloseGuess(persist: boolean) {
    this.setGuessBarState('close', persist ? undefined : 1050)
    this.pulseHalo(COLORS.amber, 0.28)
    this.emitBurst(
      this.feedbackBurstPool,
      LAB_MOTE_TEXTURE,
      this.layoutMetrics.guessBar.x + Math.round(this.layoutMetrics.guessBar.width * 0.5),
      this.layoutMetrics.guessBar.y + Math.round(this.layoutMetrics.guessBar.height * 0.42),
      COLORS.amber,
      Math.max(6, getLabVisualBudget(this.layoutMetrics.board).feedbackBursts - 1),
      this.feedbackRoot,
      DEPTH.FEEDBACK,
    )
    this.tweens.add({
      targets: this.guessBar?.container,
      scaleX: 1.015,
      scaleY: 1.015,
      duration: 110,
      yoyo: true,
      repeat: 1,
      ease: 'Sine.InOut',
      onComplete: () => {
        this.guessBar?.container.setScale(1)
      },
    })
  }

  private animateCorrectGuess(persist: boolean) {
    this.setGuessBarState('correct', persist ? undefined : 1300)
    this.pulseHalo(COLORS.emeraldGlow, 0.34)
    this.emitBurst(
      this.feedbackBurstPool,
      LAB_MOTE_TEXTURE,
      this.layoutMetrics.guessBar.x + Math.round(this.layoutMetrics.guessBar.width * 0.5),
      this.layoutMetrics.guessBar.y + Math.round(this.layoutMetrics.guessBar.height * 0.42),
      COLORS.emeraldGlow,
      getLabVisualBudget(this.layoutMetrics.board).feedbackBursts,
      this.feedbackRoot,
      DEPTH.FEEDBACK,
    )
    this.tweens.add({
      targets: this.guessBar?.container,
      scaleX: 1.012,
      scaleY: 1.012,
      duration: 110,
      yoyo: true,
      ease: 'Quad.Out',
      onComplete: () => {
        this.guessBar?.container.setScale(1)
      },
    })
  }

  private animateInvalidSubmit() {
    this.shakeHorizontal(this.guessBar?.container, this.layoutMetrics.guessBar.x, 4, 3)
    this.pulseHalo(COLORS.rose, 0.18)
  }

  private showRewardToast(reward: NonNullable<PhaserGameSessionSnapshot['reward']>) {
    if (!this.rewardToast || reward.xp <= 0) {
      return
    }

    const bonus = reward.streak ? `Streak ${reward.streak}` : 'Correct'
    this.rewardToast.label.setText(`+${reward.xp} XP`)
    this.rewardToast.sublabel.setText(bonus)
    this.rewardToast.container.setVisible(true)
    this.rewardToast.container.setAlpha(0)
    this.rewardToast.container.setScale(0.96)
    this.rewardToast.container.setY(this.layoutMetrics.board.y + Math.round(this.layoutMetrics.board.height * 0.24))
    this.tweens.killTweensOf(this.rewardToast.container)
    this.tweens.add({
      targets: this.rewardToast.container,
      alpha: 1,
      scaleX: 1,
      scaleY: 1,
      y: this.layoutMetrics.board.y + Math.round(this.layoutMetrics.board.height * 0.2),
      duration: 180,
      ease: 'Cubic.Out',
      yoyo: true,
      hold: 560,
      onComplete: () => {
        this.rewardToast?.container.setVisible(false)
      },
    })
  }

  private showFeedback(label: FeedbackLabel, persist: boolean) {
    if (!this.feedbackLayer) {
      return
    }

    const { feedback } = this.layoutMetrics

    const palette =
      label === 'correct'
        ? { fill: COLORS.emeraldSoft, stroke: COLORS.emerald, text: '#6ee7b7' }
        : label === 'close'
        ? { fill: COLORS.amberSoft, stroke: COLORS.amber, text: '#fcd34d' }
        : { fill: COLORS.roseSoft, stroke: COLORS.rose, text: '#fda4af' }

    this.feedbackHideEvent?.remove(false)
    this.feedbackHideEvent = undefined

    this.feedbackLayer.background.setFillStyle(palette.fill, 0.96)
    this.feedbackLayer.background.setStrokeStyle(1, palette.stroke, 1)
    this.feedbackLayer.glow.setFillStyle(palette.stroke, 0.12)
    this.feedbackLayer.label.setText(getFeedbackText(label))
    this.feedbackLayer.label.setColor(palette.text)
    this.feedbackLayer.container.setVisible(true)
    this.feedbackLayer.container.setAlpha(0)
    this.feedbackLayer.container.setScale(0.94)
    this.feedbackLayer.container.y = feedback.y + feedback.baselineOffset

    this.tweens.killTweensOf(this.feedbackLayer.container)
    this.tweens.add({
      targets: this.feedbackLayer.container,
      alpha: 1,
      scaleX: 1,
      scaleY: 1,
      y: feedback.y,
      duration: 200,
      ease: 'Cubic.Out',
    })

    if (!persist) {
      this.feedbackHideEvent = this.time.delayedCall(1100, () => {
        this.tweens.add({
          targets: this.feedbackLayer?.container,
          alpha: 0,
          y: feedback.y - Math.max(4, Math.round(feedback.baselineOffset * 1.34)),
          duration: 180,
          ease: 'Quad.In',
          onComplete: () => {
            this.feedbackLayer?.container.setVisible(false)
            if (this.feedbackLayer) {
              this.feedbackLayer.container.y = feedback.y
            }
          },
        })
        this.feedbackHideEvent = undefined
      })
    }
  }

  private setGuessBarState(state: GuessBarState, duration?: number) {
    this.guessBarState = state
    this.guessBarResetEvent?.remove(false)
    this.guessBarResetEvent = undefined
    this.syncGuessBar(this.getSnapshot())

    if (!duration) {
      return
    }

    this.guessBarResetEvent = this.time.delayedCall(duration, () => {
      this.guessBarState = getGuessBarBaseState(this.getSnapshot())
      this.guessBarResetEvent = undefined
      this.syncGuessBar(this.getSnapshot())
    })
  }

  private refreshGuessBarGlow(
    state: GuessBarState,
    style: { haloAlpha: number; haloColor: number },
  ) {
    if (!this.guessBar) {
      return
    }

    this.guessBarGlowTween?.stop()
    this.guessBarGlowTween = undefined
    this.guessBar.halo.setAlpha(state === 'typing' ? Math.min(0.16, style.haloAlpha + 0.04) : style.haloAlpha)
  }

  private pulseHalo(color: number, alpha: number) {
    if (!this.guessBar) {
      return
    }

    this.guessBar.halo.setFillStyle(color, alpha)
    this.tweens.killTweensOf(this.guessBar.halo)
    this.tweens.add({
      targets: this.guessBar.halo,
      alpha: { from: alpha, to: 0.05 },
      scaleX: { from: 1.01, to: 1.04 },
      scaleY: { from: 1.01, to: 1.04 },
      duration: 190,
      ease: 'Cubic.Out',
      onComplete: () => {
        this.guessBar?.halo.setScale(1)
        this.syncGuessBar(this.getSnapshot())
      },
    })
  }

  private shakeHorizontal(
    target: Phaser.GameObjects.Container | undefined,
    baseX: number,
    distance = 6,
    repeat = 4,
  ) {
    if (!target) {
      return
    }

    this.tweens.killTweensOf(target)
    this.tweens.add({
      targets: target,
      x: baseX + distance,
      duration: 42,
      yoyo: true,
      repeat,
      ease: 'Sine.InOut',
      onComplete: () => {
        target.x = baseX
      },
    })
  }

  private getGuessBarVisual(state: GuessBarState) {
    switch (state) {
      case 'typing':
        return {
          fill: 0x0f2133,
          stroke: COLORS.cyan,
          haloColor: COLORS.sky,
          haloAlpha: 0.18,
          labelColor: '#a5f3fc',
          valueColor: COLORS.text,
          helper: '',
          helperColor: COLORS.textMuted,
        }
      case 'submitting':
        return {
          fill: 0x0c1f2b,
          stroke: COLORS.cyan,
          haloColor: COLORS.cyan,
          haloAlpha: 0.18,
          labelColor: '#a5f3fc',
          valueColor: COLORS.text,
          helper: '',
          helperColor: '#a5f3fc',
        }
      case 'wrong':
        return {
          fill: COLORS.roseSoft,
          stroke: COLORS.rose,
          haloColor: COLORS.rose,
          haloAlpha: 0.18,
          labelColor: '#fecdd3',
          valueColor: COLORS.text,
          helper: '',
          helperColor: '#fda4af',
        }
      case 'close':
        return {
          fill: COLORS.amberSoft,
          stroke: COLORS.amber,
          haloColor: COLORS.amber,
          haloAlpha: 0.2,
          labelColor: '#fde68a',
          valueColor: COLORS.text,
          helper: '',
          helperColor: '#fcd34d',
        }
      case 'correct':
        return {
          fill: COLORS.emeraldSoft,
          stroke: COLORS.emerald,
          haloColor: COLORS.emeraldGlow,
          haloAlpha: 0.22,
          labelColor: '#bbf7d0',
          valueColor: COLORS.text,
          helper: '',
          helperColor: '#86efac',
        }
      case 'disabled':
        return {
          fill: 0x0a1521,
          stroke: COLORS.borderSoft,
          haloColor: COLORS.borderSoft,
          haloAlpha: 0.06,
          labelColor: COLORS.textQuiet,
          valueColor: COLORS.textQuiet,
          helper: 'LOCKED',
          helperColor: COLORS.textQuiet,
        }
      default:
        return {
          fill: 0x0d1a2a,
          stroke: COLORS.cyan,
          haloColor: COLORS.cyan,
          haloAlpha: 0.1,
          labelColor: '#93c5fd',
          valueColor: '#cbd5e1',
          helper: '',
          helperColor: COLORS.textQuiet,
        }
    }
  }

  private createClueCard(clue: PhaserVisibleClue, width: number): ClueCardView {
    const { clues, typography } = this.layoutMetrics
    const textInsetX = Math.max(12, Math.round(width * 0.045))
    const typeTop = Math.max(10, Math.round(clues.height * (12 / 340)))
    const valueTop = typeTop + Math.max(14, Math.round(typography.clueType * 1.8))
    const minHeight = Math.max(56, Math.round(clues.height * (72 / 340)))
    const shadowOffset = Math.max(4, Math.round(clues.height * (8 / 340)))
    const accentWidth = Math.max(4, Math.round(width * 0.017))

    const palette = getClueTone(clue.type)
    const container = this.add.container(0, 0)
    const typeText = this.createText(textInsetX, typeTop, clue.type.toUpperCase(), {
      fontFamily: 'Arial',
      fontSize: this.toFontPx(typography.clueType),
      color: palette.tag,
      fontStyle: 'bold',
    })
    const valueText = this.createText(textInsetX, valueTop, clue.value, {
      fontFamily: 'Arial',
      fontSize: this.toFontPx(typography.clueValue),
      color: COLORS.text,
      wordWrap: { width: width - textInsetX * 2, useAdvancedWrap: true },
      lineSpacing: Math.max(2, Math.round(typography.clueValue * 0.22)),
    })
    const height = Math.max(minHeight, Math.round(valueTop + valueText.height + Math.max(14, clues.height * (14 / 340))))
    const glow = this.add.rectangle(-4, -4, width + 8, height + 8, palette.stroke, 0.08).setOrigin(0)
    const shadow = this.add.rectangle(0, shadowOffset, width, height, COLORS.shadow, 0.22).setOrigin(0)
    const background = this.add
      .rectangle(0, 0, width, height, palette.fill, 0.94)
      .setOrigin(0)
      .setStrokeStyle(1, palette.stroke, 0.74)
    const accent = this.add.rectangle(0, 0, accentWidth, height, palette.stroke, 0.9).setOrigin(0)
    const frame = this.add
      .rectangle(3, 3, Math.max(1, width - 6), Math.max(1, height - 6), 0xffffff, 0)
      .setOrigin(0)
      .setStrokeStyle(1, palette.stroke, 0.2)
    const sheen = this.add
      .rectangle(-Math.max(28, Math.round(width * 0.18)), 4, Math.max(24, Math.round(width * 0.14)), Math.max(24, height - 8), 0xffffff, 0.18)
      .setOrigin(0)
    sheen.setVisible(false)
    sheen.setAlpha(0)

    container.add([glow, shadow, background, accent, frame, sheen, typeText, valueText])

    return {
      id: clue.id,
      container,
      glow,
      shadow,
      background,
      accent,
      frame,
      sheen,
      typeText,
      valueText,
      width,
      height,
    }
  }

  private refreshClueCard(view: ClueCardView, clue: PhaserVisibleClue, age: number) {
    const { clues, typography } = this.layoutMetrics
    const width = Math.max(120, clues.width - clues.cardInset * 2)
    const textInsetX = Math.max(12, Math.round(width * 0.045))
    const typeTop = Math.max(10, Math.round(clues.height * (12 / 340)))
    const valueTop = typeTop + Math.max(14, Math.round(typography.clueType * 1.8))
    const minHeight = Math.max(56, Math.round(clues.height * (72 / 340)))
    const shadowOffset = Math.max(4, Math.round(clues.height * (8 / 340)))
    const accentWidth = Math.max(4, Math.round(width * 0.017))
    const textResolution = getCaseSceneTextResolution(Math.max(0.5, 1 - age * 0.08))

    const palette = getClueTone(clue.type)
    const isLatest = age === 0
    const backgroundAlpha = isLatest ? 0.96 : Phaser.Math.Clamp(0.86 - age * 0.05, 0.74, 0.86)

    view.width = width
    view.typeText.setResolution(textResolution)
    view.typeText.setText(clue.type.toUpperCase())
    view.typeText.setPosition(textInsetX, typeTop)
    view.typeText.setFontSize(this.toFontPx(typography.clueType))
    view.typeText.setAlpha(isLatest ? 0.95 : 0.78)
    view.valueText.setResolution(textResolution)
    view.valueText.setText(clue.value)
    view.valueText.setPosition(textInsetX, valueTop)
    view.valueText.setFontSize(this.toFontPx(typography.clueValue))
    view.valueText.setLineSpacing(Math.max(2, Math.round(typography.clueValue * 0.22)))
    view.valueText.setWordWrapWidth(width - textInsetX * 2)
    view.valueText.setAlpha(isLatest ? 1 : 0.84)

    const nextHeight = Math.max(minHeight, Math.round(valueTop + view.valueText.height + Math.max(14, clues.height * (14 / 340))))
    view.height = nextHeight

    this.setRectangleDimensions(view.glow, width + 8, nextHeight + 8)
    view.glow.setPosition(-4, -4)
    this.setRectangleDimensions(view.shadow, width, nextHeight)
    view.shadow.setY(shadowOffset)
    this.setRectangleDimensions(view.background, width, nextHeight)
    this.setRectangleDimensions(view.accent, accentWidth, nextHeight)
    this.setRectangleDimensions(view.frame, Math.max(1, width - 6), Math.max(1, nextHeight - 6))
    view.frame.setPosition(3, 3)
    this.setRectangleDimensions(view.sheen, Math.max(24, Math.round(width * 0.14)), Math.max(24, nextHeight - 8))
    view.sheen.setY(4)

    view.typeText.setColor(isLatest ? '#bbf7d0' : palette.tag)
    view.typeText.setScale(1)
    view.valueText.setScale(1)
    view.background.setFillStyle(palette.fill, backgroundAlpha)
    view.background.setStrokeStyle(isLatest ? 2 : 1, palette.stroke, isLatest ? 0.94 : 0.34)
    view.accent.setFillStyle(palette.stroke, isLatest ? 0.94 : 0.5)
    view.glow.setFillStyle(palette.stroke, isLatest ? 0.06 : 0)
    view.frame.setStrokeStyle(1, palette.stroke, isLatest ? 0.22 : 0.08)
    view.shadow.setAlpha(isLatest ? 0.16 : 0.08)
  }

  private createPressableButton(
    x: number,
    y: number,
    width: number,
    height: number,
    label: string,
    onPress: () => void,
  ): PressableButtonView {
    const container = this.add.container(x, y)
    const glow = this.add.rectangle(-5, -5, width + 10, height + 10, COLORS.cyan, 0.06).setOrigin(0)
    const shadow = this.add.rectangle(0, 4, width, height, COLORS.shadow, 0.18).setOrigin(0)
    const background = this.add
      .rectangle(0, 0, width, height, COLORS.panelSoft, 0.98)
      .setOrigin(0)
      .setStrokeStyle(1, COLORS.border, 1)
    const shine = this.add
      .rectangle(Math.round(width * 0.12), Math.round(height * 0.18), Math.max(22, Math.round(width * 0.36)), Math.max(10, Math.round(height * 0.22)), 0xffffff, 0.08)
      .setOrigin(0)
    const text = this.createText(width / 2, height / 2, label, {
      fontFamily: 'Arial',
      fontSize: this.toFontPx(this.layoutMetrics.typography.actionLabel),
      color: COLORS.text,
      fontStyle: 'bold',
      align: 'center',
    })
    text.setOrigin(0.5)

    let isPressed = false
    const view: PressableButtonView = {
      container,
      glow,
      shadow,
      background,
      shine,
      label: text,
      enabled: true,
      palette: undefined,
    }

    background.setInteractive({ useHandCursor: true })
    background.on('pointerdown', () => {
      if (!view.enabled) {
        return
      }

      isPressed = true
      this.setPressableVisualState(view, 'pressed')
    })
    background.on('pointerover', () => {
      if (!view.enabled) {
        return
      }

      this.setPressableVisualState(view, 'hover')
    })
    background.on('pointerup', () => {
      if (!view.enabled) {
        isPressed = false
        return
      }

      if (isPressed) {
        onPress()
      }
      isPressed = false
      this.setPressableVisualState(view, 'rest')
    })
    background.on('pointerout', () => {
      isPressed = false
      this.setPressableVisualState(view, 'rest')
    })

    container.add([glow, shadow, background, shine, text])
    return view
  }

  private setPressableVisualState(view: PressableButtonView, state: 'rest' | 'hover' | 'pressed') {
    const palette = view.palette
    const baseGlow = palette?.glowAlpha ?? (view.enabled ? 0.06 : 0.02)
    const hoverGlow = palette?.hoverGlowAlpha ?? Math.max(baseGlow + 0.05, 0.1)
    const pressedGlow = palette?.pressedGlowAlpha ?? Math.max(baseGlow + 0.12, 0.18)
    const shineAlpha = palette?.shineAlpha ?? (view.enabled ? 0.08 : 0.03)
    const strokeWidth = palette?.strokeWidth ?? 1
    const pressedStrokeWidth = palette?.pressedStrokeWidth ?? Math.max(strokeWidth, 2)
    const height = Math.round(view.background.height)
    const width = Math.round(view.background.width)

    if (!view.enabled) {
      view.container.setScale(1)
      view.background.setY(0)
      view.label.setY(Math.round(height / 2))
      view.shine.setPosition(Math.round(width * 0.12), Math.round(height * 0.18))
      view.shine.setAlpha(Math.min(shineAlpha, 0.03))
      view.shadow.y = 4
      view.glow.setAlpha(baseGlow)
      view.background.setStrokeStyle(strokeWidth, palette?.stroke ?? COLORS.borderSoft, 1)
      return
    }

    if (state === 'pressed') {
      view.container.setScale(0.982)
      view.background.setY(1)
      view.label.setY(Math.round(height / 2) + 1)
      view.shine.setPosition(Math.round(width * 0.12), Math.round(height * 0.18) + 1)
      view.shine.setAlpha(Math.min(shineAlpha * 0.45, 0.05))
      view.shadow.y = 1
      view.glow.setAlpha(pressedGlow)
      view.background.setStrokeStyle(pressedStrokeWidth, palette?.stroke ?? COLORS.cyan, 1)
      return
    }

    view.container.setScale(state === 'hover' ? 1.006 : 1)
    view.background.setY(0)
    view.label.setY(Math.round(height / 2))
    view.shine.setPosition(Math.round(width * 0.12), Math.round(height * 0.18))
    view.shine.setAlpha(state === 'hover' ? Math.min(shineAlpha + 0.02, 0.14) : shineAlpha)
    view.shadow.y = state === 'hover' ? 3 : 4
    view.glow.setAlpha(state === 'hover' ? hoverGlow : baseGlow)
    view.background.setStrokeStyle(strokeWidth, palette?.stroke ?? COLORS.border, 1)
  }

  private applyButtonPalette(view: PressableButtonView, palette: ButtonPalette) {
    view.palette = palette
    view.glow.setFillStyle(palette.stroke, palette.glowAlpha ?? (view.enabled ? 0.06 : 0.02))
    view.background.setFillStyle(palette.fill, palette.alpha ?? 1)
    view.background.setStrokeStyle(palette.strokeWidth ?? 1, palette.stroke, 1)
    view.shine.setFillStyle(0xffffff, palette.shineAlpha ?? (view.enabled ? 0.08 : 0.03))
    view.shadow.setAlpha(palette.shadowAlpha)
    view.label.setColor(palette.text)
    view.container.setAlpha(palette.alpha ?? 1)
    this.setPressableVisualState(view, 'rest')
  }

  private setPressableEnabled(view: PressableButtonView, enabled: boolean) {
    if (view.enabled === enabled) {
      return
    }

    view.enabled = enabled

    if (enabled) {
      view.background.setInteractive({ useHandCursor: true })
      this.setPressableVisualState(view, 'rest')
      return
    }

    view.background.disableInteractive()
    this.setPressableVisualState(view, 'rest')
  }

  private handleKeyPressIntent(value: string) {
    if (this.isOnboardingBlockingInput() || this.isOnboardingSkipCooldownActive()) {
      return
    }

    const snapshot = this.getSnapshot()
    if (!snapshot.canEditGuess) {
      return
    }

    this.getIntents().onKeyPress(value)
  }

  private handleOpenMenuIntent() {
    if (this.isOnboardingBlockingInput() || this.isOnboardingSkipCooldownActive()) {
      return
    }

    this.getIntents().onOpenMenu()
  }

  private handleClearIntent() {
    if (this.isOnboardingBlockingInput() || this.isOnboardingSkipCooldownActive()) {
      return
    }

    const snapshot = this.getSnapshot()
    if (!snapshot.canEditGuess || snapshot.guess.length === 0) {
      return
    }

    this.getIntents().onClearGuess()
  }

  private handleBackspaceIntent() {
    if (this.isOnboardingBlockingInput() || this.isOnboardingSkipCooldownActive()) {
      return
    }

    const snapshot = this.getSnapshot()
    if (!snapshot.canEditGuess || snapshot.guess.length === 0) {
      return
    }

    this.getIntents().onBackspace()
  }

  private handleSubmitIntent() {
    if (this.isOnboardingBlockingInput() || this.isOnboardingSkipCooldownActive()) {
      return
    }

    const snapshot = this.getSnapshot()
    if (snapshot.submitDisabled) {
      this.animateInvalidSubmit()
      return
    }

    this.animateGuessSubmit()
    this.getIntents().onSubmit()
  }

  private createText(
    x: number,
    y: number,
    value: string,
    style: Phaser.Types.GameObjects.Text.TextStyle,
    resolution = getCaseSceneTextResolution(),
  ) {
    return this.add
      .text(Math.round(x), Math.round(y), value, style)
      .setResolution(resolution)
  }
}

export function createCaseScene(
  getSnapshot: () => PhaserGameSessionSnapshot,
  getIntents: () => PhaserGameSessionIntents,
) {
  return new RoundScene(getSnapshot, getIntents)
}

export { RoundScene as CaseScene }

export const caseSceneConfig = {
  key: SCENE_KEY,
  width: LOGICAL_WIDTH,
  height: LOGICAL_HEIGHT,
}

