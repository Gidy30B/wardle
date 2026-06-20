import { useEffect, useMemo, useRef, useState } from 'react'
import { useGameEngine } from '../features/game/useGameEngine'
import { useLearnLibrary } from '../features/game/useLearnLibrary'
import { useLeaderboard } from '../features/leaderboard/leaderboard.hook'
import type { LeaderboardMode } from '../features/leaderboard/leaderboard.types'
import AppGameShell from '../features/game/react/AppGameShell'
import type { AppGameTab } from '../features/game/react/AppBottomNav'
import PlayTabPage from '../features/game/react/PlayTabPage'
import LearnTabPage from '../features/game/react/LearnTabPage'
import type { LearnOpenIntent } from '../features/game/react/learn/learn.types'
import RankTabPage from '../features/game/react/RankTabPage'
import SettingsPage from '../features/game/pages/SettingsPage'
import { useUserOrganizations } from '../features/organizations/useUserOrganizations'
import { useUserStats } from '../features/user-stats/useUserStats'
import type { UserStatsReport } from '../features/user-stats/userStats.types'
import { APP_ICONS } from '../theme/icons'

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
  const [activeTab, setActiveTab] = useState<AppGameTab>('play')
  const [leaderboardMode, setLeaderboardMode] = useState<LeaderboardMode>('daily')
  const [isResultModalOpen, setIsResultModalOpen] = useState(false)
  const [learnOpenIntent, setLearnOpenIntent] = useState<LearnOpenIntent | null>(null)
  const lastResultModalKeyRef = useRef<string | null>(null)
  const learnOpenIntentCounterRef = useRef(0)
  const game = useGameEngine()
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
  const hasCompletedAnyCase = Boolean(
    game.latestResult?.gameOver ||
      game.latestPlayedLearningResult?.gameOver ||
      (userStats.report?.totals.casesCompleted ?? 0) > 0 ||
      (learnLibrary.library?.cases.length ?? 0) > 0,
  )

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

  return (
    <AppGameShell
      activeTab={activeTab}
      canOpenLearn
      onChangeTab={setActiveTab}
      hasCompletedAnyCase={hasCompletedAnyCase}
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
            game.continueGame()
          }}
          onReload={game.reloadSession}
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
    </AppGameShell>
  )
}
