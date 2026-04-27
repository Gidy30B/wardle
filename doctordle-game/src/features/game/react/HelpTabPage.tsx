import SurfaceCard from '../../../components/ui/SurfaceCard'
import WardleLogo from '../../../components/brand/WardleLogo'

export default function HelpTabPage() {
  return (
    <main className="flex h-full min-h-0 w-full flex-1 flex-col overflow-y-auto px-1 pb-4 pt-1 sm:px-2">
      <div className="space-y-4">
        <section className="relative overflow-hidden rounded-[26px] border border-white/[0.06] bg-[linear-gradient(145deg,rgba(26,60,94,0.88),rgba(30,30,44,0.98)_68%)] px-5 py-6 shadow-[0_22px_54px_rgba(0,0,0,0.22)]">
          <div className="pointer-events-none absolute -right-16 -top-16 size-44 rounded-full bg-[rgba(0,180,166,0.16)] blur-3xl" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-white/[0.06]" />
          <div className="relative">
            <WardleLogo size="sm" subtitle="Help" />
            <h1 className="mt-5 text-2xl font-black text-[var(--wardle-color-mint)]">
              Help
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-white/68">
              How Wardle works
            </p>
          </div>
        </section>

        <div className="grid gap-4 lg:grid-cols-2">
          <HelpCard
            eyebrow="How To Play"
            title="Round flow"
            items={[
              'Start with one revealed clinical clue.',
              'Study the case details before choosing a diagnosis.',
              'Submit from the diagnosis suggestion list, not from free text alone.',
              'Each wrong submission unlocks another clue until the case resolves.',
            ]}
          />
          <HelpCard
            eyebrow="Scoring"
            title="What improves your result"
            items={[
              'Fewer clues used means a stronger solve.',
              'Finishing earlier preserves more viability and usually yields better rewards.',
              'Correct outcomes can award XP and streak progress when the backend returns them.',
            ]}
          />
          <HelpCard
            eyebrow="Clue Rules"
            title="Reveal behavior"
            items={[
              'There are six visual clue slots in a round.',
              'Locked slots stay muted until the next reveal.',
              'After the case is complete, the play view can still show the full clue review state.',
            ]}
          />
          <HelpCard
            eyebrow="Diagnosis Selection"
            title="Why submit can be blocked"
            items={[
              'Typing alone is not enough when the engine requires a selected registry match.',
              'Changing the guess after selecting a suggestion creates a stale selection.',
              'Pick a fresh suggestion again before submitting.',
            ]}
          />
        </div>

        <HelpCard
          eyebrow="Rewards"
          title="Streaks and progression"
          items={[
            'Recent streak rewards come from the live game engine and websocket events.',
            'XP totals and level display in the rank view when progress data is available.',
            'If the backend does not return a reward for a round, the app shows only the real data it has.',
          ]}
        />
      </div>
    </main>
  )
}

function HelpCard({
  eyebrow,
  title,
  items,
}: {
  eyebrow: string
  title: string
  items: string[]
}) {
  return (
    <SurfaceCard eyebrow={eyebrow} title={title}>
      <ul className="space-y-3">
        {items.map((item) => (
          <li
            key={item}
            className="flex gap-3 rounded-[18px] border border-white/8 bg-white/5 px-4 py-3 text-sm leading-6 text-white/72"
          >
            <span className="mt-2 h-2 w-2 rounded-full bg-[var(--wardle-color-teal)]" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </SurfaceCard>
  )
}
