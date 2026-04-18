import type { PhaserGameSessionSnapshot } from './gameSessionBridge'

export interface RoundLayer {
  create(): void
  relayout(): void
  render(viewModel: PhaserGameSessionSnapshot, previous?: PhaserGameSessionSnapshot): void
}

export interface RoundLayerHost {
  bootHudLayer(): void
  relayoutHudLayer(): void
  renderHudLayer(viewModel: PhaserGameSessionSnapshot): void

  bootCluePanelLayer(): void
  relayoutCluePanelLayer(): void
  renderCluePanelLayer(viewModel: PhaserGameSessionSnapshot, previous?: PhaserGameSessionSnapshot): void

  bootDiagnosisBarLayer(): void
  relayoutDiagnosisBarLayer(): void
  renderDiagnosisBarLayer(viewModel: PhaserGameSessionSnapshot): void

  bootActionRowLayer(): void
  relayoutActionRowLayer(): void
  renderActionRowLayer(viewModel: PhaserGameSessionSnapshot): void

  bootKeyboardPanelLayer(): void
  relayoutKeyboardPanelLayer(): void
  renderKeyboardPanelLayer(viewModel: PhaserGameSessionSnapshot): void

  bootFeedbackLayer(): void
  relayoutFeedbackLayer(): void
  renderFeedbackLayer(viewModel: PhaserGameSessionSnapshot, previous?: PhaserGameSessionSnapshot): void

  bootRewardLayer(): void
  relayoutRewardLayer(): void
  renderRewardLayer(_viewModel: PhaserGameSessionSnapshot): void

  bootOverlayLayer(): void
  relayoutOverlayLayer(): void
  renderOverlayLayer(viewModel: PhaserGameSessionSnapshot, previous?: PhaserGameSessionSnapshot): void
}

class HostBoundLayer implements RoundLayer {
  constructor(
    private readonly createFn: () => void,
    private readonly relayoutFn: () => void,
    private readonly renderFn: (viewModel: PhaserGameSessionSnapshot, previous?: PhaserGameSessionSnapshot) => void,
  ) {}

  create() {
    this.createFn()
  }

  relayout() {
    this.relayoutFn()
  }

  render(viewModel: PhaserGameSessionSnapshot, previous?: PhaserGameSessionSnapshot) {
    this.renderFn(viewModel, previous)
  }
}

export class HudLayer extends HostBoundLayer {
  constructor(host: RoundLayerHost) {
    super(
      () => host.bootHudLayer(),
      () => host.relayoutHudLayer(),
      (viewModel) => host.renderHudLayer(viewModel),
    )
  }
}

export class CluePanelLayer extends HostBoundLayer {
  constructor(host: RoundLayerHost) {
    super(
      () => host.bootCluePanelLayer(),
      () => host.relayoutCluePanelLayer(),
      (viewModel, previous) => host.renderCluePanelLayer(viewModel, previous),
    )
  }
}

export class DiagnosisBarLayer extends HostBoundLayer {
  constructor(host: RoundLayerHost) {
    super(
      () => host.bootDiagnosisBarLayer(),
      () => host.relayoutDiagnosisBarLayer(),
      (viewModel) => host.renderDiagnosisBarLayer(viewModel),
    )
  }
}

export class ActionRowLayer extends HostBoundLayer {
  constructor(host: RoundLayerHost) {
    super(
      () => host.bootActionRowLayer(),
      () => host.relayoutActionRowLayer(),
      (viewModel) => host.renderActionRowLayer(viewModel),
    )
  }
}

export class KeyboardPanelLayer extends HostBoundLayer {
  constructor(host: RoundLayerHost) {
    super(
      () => host.bootKeyboardPanelLayer(),
      () => host.relayoutKeyboardPanelLayer(),
      (viewModel) => host.renderKeyboardPanelLayer(viewModel),
    )
  }
}

export class FeedbackLayerModule extends HostBoundLayer {
  constructor(host: RoundLayerHost) {
    super(
      () => host.bootFeedbackLayer(),
      () => host.relayoutFeedbackLayer(),
      (viewModel, previous) => host.renderFeedbackLayer(viewModel, previous),
    )
  }
}

export class RewardLayer extends HostBoundLayer {
  constructor(host: RoundLayerHost) {
    super(
      () => host.bootRewardLayer(),
      () => host.relayoutRewardLayer(),
      (viewModel) => host.renderRewardLayer(viewModel),
    )
  }
}

export class OverlayLayer extends HostBoundLayer {
  constructor(host: RoundLayerHost) {
    super(
      () => host.bootOverlayLayer(),
      () => host.relayoutOverlayLayer(),
      (viewModel, previous) => host.renderOverlayLayer(viewModel, previous),
    )
  }
}
