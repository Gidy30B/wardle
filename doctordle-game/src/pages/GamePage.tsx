import { useEffect, useMemo, useRef, useState } from 'react'
import { useGameEngine } from '../features/game/useGameEngine'
import { useDailyCaseArchive } from '../features/game/useDailyCaseArchive'
import { getNextArchiveCase } from '../features/game/archiveDomain'
import { useLearnLibrary } from '../features/game/useLearnLibrary'
import { useLeaderboard } from '../features/leaderboard/leaderboard.hook'
import type { LeaderboardMode } from '../features/leaderboard/leaderboard.types'
import AppGameShell from '../features/game/react/AppGameShell'
import type { AppGameTab } from '../features/game/react/AppBottomNav'
import PlayTabPage from '../features/game/react/PlayTabPage'
import ArchiveTabPage from '../features/game/react/ArchiveTabPage'
import LearnTabPage from '../features/game/react/LearnTabPage'
import type { LearnOpenIntent } from '../features/game/react/learn/learn.types'
import RankTabPage from '../features/game/react/RankTabPage'
import SettingsPage from '../features/game/pages/SettingsPage'
import { useUserOrganizations } from '../features/organizations/useUserOrganizations'
import { useUserStats } from '../features/user-stats/useUserStats'
import type { UserStatsReport } from '../features/user-stats/userStats.types'
import { APP_ICONS } from '../theme/icons'

function getInitialRouteState(): {
  activeTab: AppGameTab
  dailyCaseId: string | null
} {
  const path = window.location.pathname
  const caseMatch = path.match(/^\/case\/([^/]+)$/)
  if (caseMatch?.[1]) {
    return {
      activeTab: 'play',
      dailyCaseId: decodeURIComponent(caseMatch[1]),
    }
  }

  if (path === '/archive') {
    return {
      activeTab: 'archive',
      dailyCaseId: null,
    }
  }

  return {
    activeTab: 'play',
    dailyCaseId: null,
  }
}

function buildLearnLibraryWithStats<T extends { performanceSummary?: unknown }>(
  learnLibrary: T | null,
  statsReport: UserStatsReport | null,
): T | null {
  if (!statsReport) {
    return learnLibrary
  }

  return {
    ...(learnLibrary ?? { generatedAt: new Date().toISOString(), cases: [] }),
    performanceSummary: {
      accuracyPct: statsReport.totals.accuracyPct,
      casesDone: statsReport.totals.casesCompleted,
      averageCluesUsed: statsReport.totals.averageCluesUsed,
      averageTimeSecs: statsReport.totals.averageTimeSecs,
      specialties: statsReport.bySpecialty.map((specialty) => ({
        key: specialty.key,
        label: specialty.label,
        casesDone: specialty.casesCompleted,
        accuracyPct: specialty.accuracyPct,
      })),
    },
  } as T
}

export default function GamePage() {
  const initialRouteRef = useRef(getInitialRouteState())
  const [activeTab, setActiveTab] = useState<AppGameTab>(
    initialRouteRef.current.activeTab,
  )
  const [selectedDailyCaseId, setSelectedDailyCaseId] = useState<string | null>(
    initialRouteRef.current.dailyCaseId,
  )
  const [leaderboardMode, setLeaderboardMode] = useState<LeaderboardMode>('daily')
  const [isResultModalOpen, setIsResultModalOpen] = useState(false)
  const [learnOpenIntent, setLearnOpenIntent] = useState<LearnOpenIntent | null>(null)
  const [pwaInstallResetKey, setPwaInstallResetKey] = useState(0)
  const [archiveCatchUpActive, setArchiveCatchUpActive] = useState(false)
  const [currentArchiveDailyCaseId, setCurrentArchiveDailyCaseId] = useState<string | null>(null)
  const lastResultModalKeyRef = useRef<string | null>(null)
  const learnOpenIntentCounterRef = useRef(0)
  const lastArchiveTerminalRef = useRef<string | null>(null)
  const lastArchiveBlockedRef = useRef<string | null>(null)
  const game = useGameEngine({ dailyCaseId: selectedDailyCaseId })
  const archive = useDailyCaseArchive()
  const leaderboard = useLeaderboard(leaderboardMode)
  const learnLibrary = useLearnLibrary()
  const organizations = useUserOrganizations()
  const userStats = useUserStats()
  const currentStreak = game.progress?.currentStreak ?? null
  const bestStreak = game.progress?.longestStreak ?? null
  const organizationName = organizations.primaryOrganization?.name ?? null
  const shellXpTotal =
    typeof game.roundViewModel.hud.xpTotal === 'number'
      ? game.roundViewModel.hud.xpTotal
      : null
  const resultModalKey = useMemo(() => {
    if (
      !game.isFinalFeedback ||
      game.finalFeedbackSource !== 'live_finish' ||
      !game.latestResult
    ) {
      return null
    }

    return [
      game.latestResult.gameOverReason ?? game.latestResult.label,
      game.latestResult.attemptsCount ?? game.attempts.length,
      game.latestResult.score,
    ].join(':')
  }, [
    game.attempts.length,
    game.finalFeedbackSource,
    game.isFinalFeedback,
    game.latestResult,
  ])
  const showPwaInstallBannerAfterCase = resultModalKey !== null

  useEffect(() => {
    if (!resultModalKey) {
      lastResultModalKeyRef.current = null
      return
    }

    if (lastResultModalKeyRef.current === resultModalKey) {
      return
    }

    lastResultModalKeyRef.current = resultModalKey
    setActiveTab('play')
    setIsResultModalOpen(true)
  }, [resultModalKey])

  useEffect(() => {
    const handlePopState = () => {
      const route = getInitialRouteState()
      setActiveTab(route.activeTab)
      setSelectedDailyCaseId(route.dailyCaseId)
      setIsResultModalOpen(false)
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  const navigateToTab = (tab: AppGameTab) => {
    setActiveTab(tab)
    if (tab === 'archive') {
      setSelectedDailyCaseId(null)
      window.history.pushState(null, '', '/archive')
      return
    }

    if (tab === 'play') {
      setArchiveCatchUpActive(false)
      setCurrentArchiveDailyCaseId(null)
      setSelectedDailyCaseId(null)
      window.history.pushState(null, '', '/')
      return
    }

    window.history.pushState(null, '', '/')
  }

  const openArchiveCase = (dailyCaseId: string) => {
    setArchiveCatchUpActive(true)
    setCurrentArchiveDailyCaseId(dailyCaseId)
    lastArchiveTerminalRef.current = null
    lastArchiveBlockedRef.current = null
    setSelectedDailyCaseId(dailyCaseId)
    setActiveTab('play')
    setIsResultModalOpen(false)
    window.history.pushState(null, '', `/case/${encodeURIComponent(dailyCaseId)}`)
  }

  const openNextArchiveCase = () => {
    const nextDailyCase = getNextArchiveCase(archive.items, [
      currentArchiveDailyCaseId,
    ])
    if (nextDailyCase) {
      openArchiveCase(nextDailyCase.dailyCaseId)
    }
  }

  const exitArchiveCatchUp = () => {
    setArchiveCatchUpActive(false)
    setCurrentArchiveDailyCaseId(null)
    setIsResultModalOpen(false)
    setActiveTab('archive')
    window.history.pushState(null, '', '/archive')
  }

  useEffect(() => {
    if (
      !archiveCatchUpActive ||
      !currentArchiveDailyCaseId ||
      !game.isFinalFeedback ||
      !game.latestResult ||
      lastArchiveTerminalRef.current === currentArchiveDailyCaseId
    ) {
      return
    }

    lastArchiveTerminalRef.current = currentArchiveDailyCaseId
    void archive.refetch()
  }, [
    archive,
    archiveCatchUpActive,
    currentArchiveDailyCaseId,
    game.isFinalFeedback,
    game.latestResult,
  ])

  useEffect(() => {
    if (
      !archiveCatchUpActive ||
      !currentArchiveDailyCaseId ||
      !game.isBlocked ||
      lastArchiveBlockedRef.current === currentArchiveDailyCaseId
    ) {
      return
    }

    lastArchiveBlockedRef.current = currentArchiveDailyCaseId
    void archive.refetch().then((result) => {
      const nextArchiveCase = getNextArchiveCase(result.data?.items ?? archive.items, [
        currentArchiveDailyCaseId,
      ])
      if (nextArchiveCase) {
        openArchiveCase(nextArchiveCase.dailyCaseId)
      }
    })
  }, [
    archive,
    archiveCatchUpActive,
    currentArchiveDailyCaseId,
    game.isBlocked,
  ])

  useEffect(() => {
    if (activeTab !== 'play' && isResultModalOpen) {
      setIsResultModalOpen(false)
    }
  }, [activeTab, isResultModalOpen])

  useEffect(() => {
    console.debug('[leaderboard-runtime]', {
      mode: leaderboardMode,
      leaderboard: leaderboard.leaderboard,
      currentUserPosition: leaderboard.currentUserPosition,
      loading: leaderboard.loading,
      error: leaderboard.error,
    })
  }, [
    leaderboard.error,
    leaderboard.leaderboard,
    leaderboard.loading,
    leaderboard.currentUserPosition,
    leaderboardMode,
  ])

  const learnLibraryWithStats = useMemo(
    () => buildLearnLibraryWithStats(learnLibrary.library, userStats.report),
    [learnLibrary.library, userStats.report],
  )
  const nextArchiveCase =
    archiveCatchUpActive && isResultModalOpen
      ? getNextArchiveCase(archive.items, [currentArchiveDailyCaseId])
      : null
  const archiveCatchUpResultActions =
    archiveCatchUpActive && isResultModalOpen
      ? {
          nextLabel: nextArchiveCase?.displayLabel ?? null,
          caughtUp: !nextArchiveCase,
          onNextArchiveCase: openNextArchiveCase,
          onBackToArchive: exitArchiveCatchUp,
          onExitArchive: exitArchiveCatchUp,
        }
      : undefined

  return (
    <AppGameShell
      activeTab={activeTab}
      canOpenLearn
      onChangeTab={navigateToTab}
      showPwaInstallBannerAfterCase={showPwaInstallBannerAfterCase}
      pwaInstallResetKey={pwaInstallResetKey}
      streak={currentStreak}
      xpTotal={shellXpTotal}
      organizationName={organizationName}
    >
      {activeTab === 'play' ? (
        <PlayTabPage
          iconSet={APP_ICONS}
          roundViewModel={game.roundViewModel}
          isResultModalOpen={isResultModalOpen}
          currentStreak={currentStreak}
          organizationName={organizationName}
          onInputCharacter={game.appendGuessCharacter}
          onChangeGuess={game.changeGuess}
          onClearGuess={game.clearGuess}
          onClearSelectedSuggestion={game.clearSelectedSuggestion}
          onBackspace={game.backspaceGuess}
          onMoveSuggestionHighlight={game.moveSuggestionHighlight}
          onSelectSuggestion={(index) => {
            const suggestion = game.suggestions[index]
            if (suggestion) {
              game.selectSuggestion(suggestion)
            }
          }}
          onSelectHighlightedSuggestion={game.selectHighlightedSuggestion}
          onSubmit={game.submitGuess}
          onContinue={() => {
            setIsResultModalOpen(false)
            setPwaInstallResetKey((current) => current + 1)
            game.continueGame()
          }}
          onReload={() => {
            setPwaInstallResetKey((current) => current + 1)
            game.reloadSession()
          }}
          onCloseResultModal={() => setIsResultModalOpen(false)}
          onReviewLearning={() => {
            learnOpenIntentCounterRef.current += 1
            const latestPlayedResult = game.latestPlayedLearningResult ?? game.latestResult
            setLearnOpenIntent({
              intentId: `result-modal:${learnOpenIntentCounterRef.current}`,
              source: 'result-modal',
              sessionId: game.roundViewModel.sessionId ?? undefined,
              caseId: latestPlayedResult?.case?.id ?? game.roundViewModel.caseId ?? undefined,
              openLatestPlayedCase: true,
            })
            setIsResultModalOpen(false)
            setActiveTab('learn')
            void learnLibrary.refetch()
          }}
          archiveCatchUp={archiveCatchUpResultActions}
        />
      ) : null}

      {activeTab === 'learn' ? (
        <LearnTabPage
          explanation={game.explanation}
          latestResult={game.latestResult}
          latestPlayedExplanation={game.latestPlayedExplanation}
          latestPlayedResult={game.latestPlayedLearningResult}
          learnLibrary={learnLibraryWithStats}
          libraryLoading={learnLibrary.loading}
          libraryError={learnLibrary.error}
          onRetryLibrary={() => {
            void learnLibrary.refetch()
          }}
          openIntent={learnOpenIntent}
          onOpenIntentConsumed={(intentId) => {
            setLearnOpenIntent((current) =>
              current?.intentId === intentId ? null : current,
            )
          }}
          roundViewModel={game.roundViewModel}
        />
      ) : null}

      {activeTab === 'rank' ? (
        <RankTabPage
          iconSet={APP_ICONS}
          mode={leaderboardMode}
          onModeChange={setLeaderboardMode}
          leaderboard={leaderboard.leaderboard}
          loading={leaderboard.loading}
          error={leaderboard.error}
          currentUserId={leaderboard.currentUserId}
          currentUserPosition={leaderboard.currentUserPosition}
          currentStreak={currentStreak}
          organizationName={organizationName}
          accuracy={userStats.report?.totals.accuracyPct ?? null}
          onPlay={() => setActiveTab('play')}
        />
      ) : null}

      {activeTab === 'settings' ? (
        <SettingsPage
          currentStreak={currentStreak}
          bestStreak={bestStreak}
          xpTotal={shellXpTotal}
          organizationName={organizationName}
          memberships={organizations.memberships}
          statsReport={userStats.report}
          statsLoading={userStats.loading}
          statsError={userStats.error}
          onRetryStats={() => {
            void userStats.refetch()
          }}
        />
      ) : null}

      {activeTab === 'archive' ? (
        <ArchiveTabPage
          items={archive.items}
          loading={archive.loading}
          error={archive.error}
          onRetry={() => {
            void archive.refetch()
          }}
          onOpenCase={openArchiveCase}
          onPlayToday={() => navigateToTab('play')}
          onContinueArchive={openArchiveCase}
        />
      ) : null}
    </AppGameShell>
  )
}
