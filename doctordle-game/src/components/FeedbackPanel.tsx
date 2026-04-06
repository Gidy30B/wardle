import { motion, type Variants } from 'framer-motion'
import type { GameResult } from '../features/game/game.types'

type FeedbackPanelProps = {
  result: GameResult | null
  hasActiveSession?: boolean
  currentStreak?: number
  xpEarned?: number
  attemptLabels?: { guess: string; label: 'correct' | 'close' | 'wrong' }[]
}

const labelStyles: Record<GameResult['label'], string> = {
  correct: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/30',
  close: 'bg-amber-500/15 text-amber-300 border-amber-400/30',
  wrong: 'bg-rose-500/15 text-rose-300 border-rose-400/30',
}

const containerStyles = {
  correct: 'border-emerald-400/30 bg-emerald-500/5',
  close: 'border-amber-400/30 bg-amber-500/5',
  wrong: 'border-rose-400/30 bg-rose-500/5',
} as const

const gameOverVariants: Variants = {
  idle: {
    opacity: 1,
    y: 0,
    scale: 1,
    x: 0,
  },

  correct: {
    opacity: 1,
    y: 0,
    scale: [1, 1.03, 1],
    x: 0,
    boxShadow: [
      '0 0 0 rgba(16,185,129,0)',
      '0 0 20px rgba(16,185,129,0.25)',
      '0 0 0 rgba(16,185,129,0)',
    ],
    transition: {
      duration: 0.4,
      ease: 'easeOut',
    },
  },

  wrong: {
    opacity: 1,
    y: 0,
    scale: 1,
    x: [0, -6, 6, -4, 4, 0],
    transition: {
      duration: 0.35,
      ease: 'easeInOut',
    },
  },
}

export default function FeedbackPanel({
  result,
  hasActiveSession = true,
  currentStreak = 0,
  xpEarned = 0,
  attemptLabels,
}: FeedbackPanelProps) {
  if (!result) {
    return (
      <motion.section
        className="rounded-3xl border border-dashed border-white/10 bg-white/5 p-4 text-sm text-white/60 shadow-sm"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
      >
        {hasActiveSession ? 'Submit a guess to see feedback' : 'Daily limit reached'}
      </motion.section>
    )
  }

  const signals =
    (
      result as GameResult & {
        feedback?: {
          signals?: {
            exact?: boolean
            synonym?: boolean
            embedding?: number
            ontology?: {
              score?: number
            }
          }
        }
      }
    ).feedback?.signals ?? undefined

  const displaySignals =
    result.label === 'correct'
      ? {
          ...signals,
          exact: true,
          synonym: true,
          embedding: Math.max(signals?.embedding ?? 0, 0.9),
          ontology: {
            ...signals?.ontology,
            score: 1,
          },
        }
      : signals

  const feedbackLevel =
    displaySignals?.exact
      ? 'correct'
      : displaySignals?.ontology?.score === 1 || displaySignals?.synonym
      ? 'close'
      : (displaySignals?.embedding ?? 0) > 0.5
      ? 'close'
      : 'wrong'

  const message = result.gameOver
    ? feedbackLevel === 'wrong'
      ? 'Answer revealed'
      : feedbackLevel === 'correct'
      ? 'Correct'
      : 'Close'
    : feedbackLevel === 'correct'
    ? 'Correct'
    : feedbackLevel === 'close'
    ? 'Close'
    : 'Try again'

  const gameOverState = result.gameOver ? (feedbackLevel === 'correct' ? 'correct' : 'wrong') : 'idle'

  return (
    <motion.section
      className={`relative rounded-3xl border p-4 shadow-sm ${containerStyles[result.label]}`}
      initial={{ opacity: 0, y: 12 }}
      animate={gameOverState}
      variants={gameOverVariants}
    >
      {result.gameOver && result.label === 'correct' && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {['🎉', '✨', '🧠', '🏆'].map((emoji, index) => (
            <motion.span
              key={emoji}
              className="absolute text-lg"
              style={{ left: `${18 + index * 20}%`, bottom: '10%' }}
              initial={{ opacity: 0, y: 0, scale: 0.9 }}
              animate={{ opacity: [0, 0.95, 0], y: [0, -28, -52], scale: [0.9, 1, 1] }}
              transition={{ duration: 0.9, delay: index * 0.08, ease: 'easeOut' }}
            >
              {emoji}
            </motion.span>
          ))}
        </div>
      )}

      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/60">Feedback</p>
          <h2 className="mt-1 text-lg font-semibold text-white">{message}</h2>
        </div>
        <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${labelStyles[result.label]}`}>
          {result.label}
        </span>
      </div>

      <div className="rounded-2xl bg-white/5 p-3">
        {attemptLabels && attemptLabels.length > 0 && (
          <motion.div
            className="mb-3 space-y-2"
            initial="hidden"
            animate="show"
            variants={{
              hidden: {},
              show: { transition: { staggerChildren: 0.06 } },
            }}
          >
            {attemptLabels.map((a, i) => {
              const isLatest = i === attemptLabels.length - 1

              const rowStyle =
                a.label === 'correct'
                  ? 'border-emerald-300/30 bg-emerald-400/10'
                  : a.label === 'close'
                  ? 'border-amber-300/30 bg-amber-400/10'
                  : 'border-rose-300/30 bg-rose-400/10'

              const textStyle =
                a.label === 'correct'
                  ? 'text-emerald-300'
                  : a.label === 'close'
                  ? 'text-amber-300'
                  : 'text-rose-300'

              return (
                <motion.div
                  key={i}
                  variants={{
                    hidden: { opacity: 0, x: -6 },
                    show: { opacity: 1, x: 0 },
                  }}
                  className={`flex items-center justify-between rounded-xl border px-3 py-2 ${rowStyle} ${
                    isLatest ? 'ring-1 ring-white/20' : 'opacity-80'
                  }`}
                >
                  <span className="text-sm text-white">{a.guess}</span>
                  <span className={`text-xs font-semibold ${textStyle}`}>
                    {a.label === 'correct' ? 'Correct' : a.label === 'close' ? 'Close' : 'Wrong'}
                  </span>
                </motion.div>
              )
            })}
          </motion.div>
        )}

        <div className="rounded-xl border border-white/10 bg-black/20 p-3">
          {message && <p className="text-base font-semibold text-white">{message}</p>}
          <p className="mt-1 text-sm text-white/70">Score {result.score}</p>
          <p className="text-sm text-white/70">Attempts {result.attemptsCount ?? 0}</p>
        </div>

        {!result.gameOver && (
          <div className="mt-3 space-y-1 text-xs text-white/60">
            {feedbackLevel === 'correct' && (
              <>
                <p className="text-emerald-300">✔ Strong clinical match</p>
                {displaySignals?.exact && <p>✔ Exact match</p>}
                {displaySignals?.synonym && <p>✔ Equivalent clinical term</p>}
                {(displaySignals?.embedding ?? 0) > 0.5 && <p>✔ High semantic similarity</p>}
                {displaySignals?.ontology?.score === 1 && <p>✔ Same disease category</p>}
              </>
            )}

            {feedbackLevel === 'close' && (
              <>
                {(displaySignals?.embedding ?? 0) > 0.5 && <p>✔ Clinically similar condition</p>}
                {displaySignals?.ontology?.score === 1 && <p>✔ Related disease category</p>}
                {!displaySignals?.exact && <p className="text-amber-300">• Not an exact match</p>}
              </>
            )}

            {feedbackLevel === 'wrong' && (
              <>
                <p className="text-rose-300">✖ No strong clinical match</p>
                {(displaySignals?.embedding ?? 0) > 0.2 && (
                  <p className="text-white/50">• Slight semantic similarity detected</p>
                )}
              </>
            )}
          </div>
        )}

        {result.gameOver && (
          <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm">
            <p className="text-base font-semibold text-white">
              {result.gameOverReason === 'clues_exhausted' ? 'Case ended' : 'Diagnosis complete'}
            </p>

            {result.label !== 'correct' && (
              <div className="mt-2 rounded-xl border border-amber-400/30 bg-amber-500/10 p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-300">Answer</p>
                <p className="mt-1 text-sm font-semibold text-white">
                  {result.explanation?.diagnosis ?? 'Diagnosis unavailable'}
                </p>
              </div>
            )}

            <div className="mt-2 flex items-center justify-between text-sm">
              <span className="text-white/80">+{xpEarned} XP</span>
              <span className="text-white/70">
                🔥 <span className="font-semibold text-emerald-400">{currentStreak}</span>
              </span>
            </div>

            <details className="mt-3">
              <summary className="cursor-pointer list-none rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm font-medium text-white/85">
                View explanation
              </summary>

              <div className="mt-2 rounded-xl border border-white/10 bg-black/20 p-3">
                <p className="text-sm font-semibold text-white">
                  {result.explanation?.diagnosis ?? 'Diagnosis unavailable'}
                </p>
                <p className="mt-1 text-sm leading-6 text-white/70">
                  {result.explanation?.summary ?? 'Explanation not available yet.'}
                </p>
              </div>
            </details>
          </div>
        )}
      </div>
    </motion.section>
  )
}
