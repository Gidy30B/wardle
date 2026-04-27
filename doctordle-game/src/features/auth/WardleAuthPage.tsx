import WardleLogo from '../../components/brand/WardleLogo'
import WardleAuthForm from './WardleAuthForm'

const tileIndexes = Array.from({ length: 25 }, (_, index) => index)

export default function WardleAuthPage() {
  return (
    <main className="flex min-h-[100dvh] items-center justify-center overflow-y-auto bg-[radial-gradient(circle_at_top,rgba(0,180,166,0.16),transparent_36%),linear-gradient(175deg,var(--wardle-color-navy)_0%,var(--wardle-color-charcoal)_58%)] px-4 py-[calc(env(safe-area-inset-top)+1.5rem)] text-white">
      <section className="w-full max-w-[440px] overflow-hidden rounded-[30px] border border-white/[0.07] bg-[linear-gradient(180deg,rgba(30,30,44,0.9),rgba(16,24,38,0.96))] shadow-[0_32px_90px_rgba(0,0,0,0.42)]">
        <div className="px-7 pb-2 pt-8 text-center">
          <div className="mb-5 flex justify-center">
            <div className="grid w-[68px] grid-cols-5 gap-1">
              {tileIndexes.map((index) => (
                <div
                  key={index}
                  className={`size-[11px] rounded-[2px] ${
                    index === 12
                      ? 'bg-[var(--wardle-color-teal)]'
                      : index % 7 === 0
                        ? 'bg-[rgba(0,180,166,0.28)]'
                        : 'bg-white/[0.12]'
                  }`}
                />
              ))}
            </div>
          </div>
          <WardleLogo size="lg" className="inline-block" />
          <p className="mt-2 text-sm italic text-white/48">Diagnose. Learn. Win.</p>
        </div>

        <div className="px-7 py-6">

          <WardleAuthForm />
        </div>
      </section>
    </main>
  )
}
