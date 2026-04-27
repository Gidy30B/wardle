import { useEffect, useMemo, useRef, useState } from 'react'
import { useGameEngine } from '../features/game/useGameEngine'
import { useTodayCases } from '../features/game/useTodayCases'
import { useLeaderboard } from '../features/leaderboard/leaderboard.hook'
import type { LeaderboardMode } from '../features/leaderboard/leaderboard.types'
import AppGameShell from '../features/game/react/AppGameShell'
import type { AppGameTab } from '../features/game/react/AppBottomNav'
import PlayTabPage from '../features/game/react/PlayTabPage'
import LearnTabPage from '../features/game/react/LearnTabPage'
import RankTabPage from '../features/game/react/RankTabPage'
import SettingsPage from '../features/game/pages/SettingsPage'
import { useUserOrganizations } from '../features/organizations/useUserOrganizations'
import { APP_ICONS } from '../theme/icons'

export default function GamePage() {
  const [activeTab, setActiveTab] = useState<AppGameTab>('play')
  const [leaderboardMode, setLeaderboardMode] = useState<LeaderboardMode>('daily')
  const [isResultModalOpen, setIsResultModalOpen] = useState(false)
  const lastResultModalKeyRef = useRef<string | null>(null)
  const game = useGameEngine()
  const leaderboard = useLeaderboard(leaderboardMode)
  const todayCases = useTodayCases()
  const organizations = useUserOrganizations()
  const currentStreak = game.progress?.currentStreak ?? null
  const organizationName = organizations.primaryOrganization?.name ?? null
  const shellXpTotal =
    typeof game.roundViewModel.hud.xpTotal === 'number'
      ? game.roundViewModel.hud.xpTotal
      : null

  const resultModalKey = useMemo(() => {
    if (!game.isFinalFeedback || !game.latestResult) {
      return null
    }

    return [
      game.latestResult.gameOverReason ?? game.latestResult.label,
      game.latestResult.attemptsCount ?? game.attempts.length,
      game.latestResult.score,
    ].join(':')
  }, [game.attempts.length, game.isFinalFeedback, game.latestResult])

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

  return (
    <AppGameShell
      activeTab={activeTab}
      canOpenLearn
      onChangeTab={setActiveTab}
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
            setIsResultModalOpen(false)
            setActiveTab('learn')
          }}
        />
      ) : null}

      {activeTab === 'learn' ? (
        <LearnTabPage
          explanation={game.explanation}
          latestResult={game.latestResult}
          latestPlayedExplanation={game.latestPlayedExplanation}
          latestPlayedResult={game.latestPlayedLearningResult}
          roundViewModel={game.roundViewModel}
          todayCases={todayCases.todayCases}
          tracksLoading={todayCases.loading}
          tracksError={todayCases.error}
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
          xpTotal={shellXpTotal}
          organizationName={organizationName}
          onPlay={() => setActiveTab('play')}
        />
      ) : null}

      {activeTab === 'settings' ? (
        <SettingsPage
          currentStreak={currentStreak}
          xpTotal={shellXpTotal}
          organizationName={organizationName}
          memberships={organizations.memberships}
        />
      ) : null}
    </AppGameShell>
  )
}
