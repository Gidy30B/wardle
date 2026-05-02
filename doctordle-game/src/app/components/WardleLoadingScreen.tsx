import { motion, type Variants } from 'framer-motion'
import WardleLogo from '../../components/brand/WardleLogo'
import AnimatedContainer from './AnimatedContainer'

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      duration: 0.3,
      ease: 'easeOut',
      staggerChildren: 0.08,
    },
  },
}

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.28,
      ease: 'easeOut',
    },
  },
}

const clueRows = ['w-2/5', 'w-full', 'w-4/5'] as const

export default function WardleLoadingScreen() {
  return (
    <AnimatedContainer
      className="min-h-[100dvh] bg-[var(--wardle-color-charcoal)] text-[var(--wardle-color-mint)]"
      variants={containerVariants}
    >
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-xl flex-col items-center justify-center px-5 py-[calc(env(safe-area-inset-top)+2rem)] pb-[max(env(safe-area-inset-bottom),2rem)] md:px-8">
        <motion.div variants={itemVariants} className="relative flex size-24 items-center justify-center">
          <motion.div
            aria-hidden="true"
            className="absolute inset-2 rounded-[26px] bg-[rgba(0,180,166,0.12)] shadow-[0_22px_64px_rgba(0,0,0,0.34)]"
            animate={{ scale: [1, 1.04, 1], opacity: [0.88, 1, 0.88] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
          />
          <img
            src="/wardle-icon.png"
            alt=""
            className="relative size-20 rounded-[18px]"
            draggable={false}
          />
        </motion.div>

        <motion.div variants={itemVariants} className="mt-6 text-center">
          <WardleLogo size="lg" subtitle="daily diagnosis" />
          <p className="mt-5 text-base font-black text-[var(--wardle-color-mint)]">
            Scrubbing in...
          </p>
          <p className="mt-2 text-sm font-semibold text-white/48">
            Preparing today's case.
          </p>
        </motion.div>

        <motion.div
          variants={itemVariants}
          className="mt-7 w-full rounded-[22px] border border-[rgba(0,180,166,0.2)] bg-[rgba(26,60,94,0.36)] p-4 shadow-[0_18px_48px_rgba(0,0,0,0.22)]"
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-brand-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--wardle-color-teal)]/80">
                Case brief
              </p>
              <div className="mt-3 space-y-2">
                {clueRows.map((widthClass, index) => (
                  <motion.div
                    key={widthClass}
                    className={`h-2.5 rounded-full bg-white/14 ${widthClass}`}
                    animate={{ opacity: [0.26, 0.58, 0.26] }}
                    transition={{
                      duration: 1.5,
                      repeat: Infinity,
                      ease: 'easeInOut',
                      delay: index * 0.12,
                    }}
                  />
                ))}
              </div>
            </div>
            <div className="grid shrink-0 grid-cols-2 gap-1.5">
              {Array.from({ length: 6 }, (_, index) => (
                <motion.span
                  key={index}
                  className="size-2.5 rounded-full bg-[var(--wardle-color-teal)]"
                  animate={{ opacity: [0.28, 1, 0.28] }}
                  transition={{
                    duration: 1.4,
                    repeat: Infinity,
                    ease: 'easeInOut',
                    delay: index * 0.08,
                  }}
                />
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatedContainer>
  )
}
