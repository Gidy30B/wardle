export type GameLayoutMode =
  | 'compact-mobile'
  | 'standard-mobile'
  | 'tablet'
  | 'desktop'

export type ResponsiveGameLayout = {
  mode: GameLayoutMode
  isMobile: boolean
  isTablet: boolean
  isDesktop: boolean
  width: number
  height: number
}

export type GameStageFrame = {
  width: number
  height: number
}

export const GAME_LAYOUT_BREAKPOINTS = {
  mobile: 640,
  desktop: 1024,
} as const

export function resolveResponsiveGameLayout(
  width: number,
  height: number,
): ResponsiveGameLayout {
  const safeWidth = Math.max(0, Math.round(width))
  const safeHeight = Math.max(0, Math.round(height))
  const shortestSide = Math.min(safeWidth, safeHeight)

  let mode: GameLayoutMode
  if (safeWidth >= GAME_LAYOUT_BREAKPOINTS.desktop && safeHeight >= 680) {
    mode = 'desktop'
  } else if (safeWidth >= GAME_LAYOUT_BREAKPOINTS.mobile) {
    mode = 'tablet'
  } else if (shortestSide <= 360 || safeHeight <= 700) {
    mode = 'compact-mobile'
  } else {
    mode = 'standard-mobile'
  }

  return {
    mode,
    isMobile: mode === 'compact-mobile' || mode === 'standard-mobile',
    isTablet: mode === 'tablet',
    isDesktop: mode === 'desktop',
    width: safeWidth,
    height: safeHeight,
  }
}

export function resolveGameStageFrame(
  width: number,
  height: number,
): GameStageFrame {
  const responsiveLayout = resolveResponsiveGameLayout(width, height)
  const safeWidth = Math.max(0, Math.round(width))
  const safeHeight = Math.max(0, Math.round(height))

  if (safeWidth === 0 || safeHeight === 0 || responsiveLayout.isMobile) {
    return {
      width: safeWidth,
      height: safeHeight,
    }
  }

  if (responsiveLayout.isDesktop) {
    const widthCap =
      safeHeight >= 900
        ? 820
        : safeHeight >= 760
          ? 720
          : 620

    return {
      width: Math.min(safeWidth, widthCap),
      height: safeHeight,
    }
  }

  const widthCap = 640
  const widthFromHeight = Math.round(safeHeight * 0.84)
  const minWidth = 360
  const preferredWidth = Math.min(safeWidth, widthCap, widthFromHeight)

  return {
    width:
      safeWidth <= minWidth
        ? safeWidth
        : Math.max(minWidth, preferredWidth),
    height: safeHeight,
  }
}
