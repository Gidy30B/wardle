import { SignInButton } from '@clerk/clerk-react'
import { motion, type Variants } from 'framer-motion'
import AnimatedContainer from './AnimatedContainer'

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      duration: 0.45,
      ease: 'easeOut',
      staggerChildren: 0.12,
    },
  },
}

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 18 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
      ease: 'easeOut',
    },
  },
}

const guessListVariants: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
    },
  },
}

const guessRowVariants: Variants = {
  hidden: { opacity: 0, x: -8 },
  show: { opacity: 1, x: 0 },
}

export default function LandingScreen() {
  return (
    <AnimatedContainer className="relative min-h-screen overflow-hidden bg-gradient-to-b from-slate-900 via-slate-800 to-black" variants={containerVariants}>
      <motion.div
        className="pointer-events-none absolute inset-0 opacity-60"
        animate={{ backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'] }}
        transition={{ duration: 16, ease: 'easeInOut', repeat: Infinity }}
        style={{
          backgroundImage:
            'radial-gradient(circle at 20% 20%, rgba(56,189,248,0.18), transparent 45%), radial-gradient(circle at 80% 80%, rgba(30,64,175,0.22), transparent 40%)',
          backgroundSize: '180% 180%',
        }}
      />

      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl items-center px-5 pb-[max(env(safe-area-inset-bottom),2rem)] pt-10 md:px-8 lg:px-10 lg:pt-12">
        <div className="grid w-full gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,420px)] lg:items-center xl:gap-12">
          <div className="space-y-8 text-center lg:text-left">
            <motion.div className="w-full space-y-6" variants={itemVariants}>
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-sky-300/80">Wardle</p>
              <h1 className="text-4xl font-extrabold leading-tight text-white md:text-5xl lg:max-w-xl">
                Daily Diagnosis
              </h1>
              <p className="mx-auto max-w-xs text-sm text-slate-300 md:max-w-lg md:text-base lg:mx-0">
                Diagnose the patient. One guess at a time.
              </p>
            </motion.div>

            <motion.div className="w-full max-w-sm lg:max-w-md" variants={itemVariants}>
              <SignInButton mode="modal">
                <motion.button
                  type="button"
                  className="w-full rounded-2xl bg-sky-500 px-5 py-4 text-base font-semibold text-white shadow-xl shadow-sky-500/20 md:text-lg"
                  whileHover={{ scale: 1.02, y: -1 }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 24 }}
                >
                  Sign in to play
                </motion.button>
              </SignInButton>

              <p className="mt-3 text-center text-xs text-slate-400 lg:text-left">
                Secure sign-in powered by Clerk. No spoilers, no setup friction.
              </p>
            </motion.div>
          </div>

          <motion.div
            className="w-full rounded-2xl border border-white/10 bg-white/5 p-4 shadow-2xl backdrop-blur md:p-5 lg:justify-self-end"
            variants={itemVariants}
            animate={{ y: [0, -5, 0] }}
            transition={{ duration: 3.2, ease: 'easeInOut', repeat: Infinity }}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">Chest pain</h2>
              <span className="rounded-full border border-white/10 bg-white/10 px-2 py-1 text-[11px] text-slate-200">
                Case Preview
              </span>
            </div>

            <motion.div className="space-y-2 text-left" variants={guessListVariants}>
              <motion.div className="flex items-center justify-between rounded-xl border border-emerald-300/30 bg-emerald-400/10 px-3 py-2.5 md:px-4" variants={guessRowVariants}>
                <span className="text-sm text-emerald-100">Myocardial infarction</span>
                <span className="text-xs font-semibold text-emerald-300">Correct</span>
              </motion.div>
              <motion.div className="flex items-center justify-between rounded-xl border border-amber-300/30 bg-amber-400/10 px-3 py-2.5 md:px-4" variants={guessRowVariants}>
                <span className="text-sm text-amber-100">Angina</span>
                <span className="text-xs font-semibold text-amber-300">Close</span>
              </motion.div>
              <motion.div className="flex items-center justify-between rounded-xl border border-rose-300/30 bg-rose-400/10 px-3 py-2.5 md:px-4" variants={guessRowVariants}>
                <span className="text-sm text-rose-100">GERD</span>
                <span className="text-xs font-semibold text-rose-300">Wrong</span>
              </motion.div>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </AnimatedContainer>
  )
}
