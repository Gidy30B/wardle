import { motion, type Variants } from 'framer-motion'
import AnimatedContainer from './AnimatedContainer'

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      duration: 0.3,
      ease: 'easeOut',
      staggerChildren: 0.1,
    },
  },
}

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.3,
      ease: 'easeOut',
    },
  },
}

export default function AuthLoadingScreen() {
  return (
    <AnimatedContainer
      className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-black"
      variants={containerVariants}
    >
      <div className="mx-auto flex min-h-screen w-full max-w-xl flex-col items-center justify-center px-5 pb-[max(env(safe-area-inset-bottom),2rem)] md:px-8">
        <motion.div variants={itemVariants} className="relative">
          <motion.div
            className="h-14 w-14 rounded-full border-4 border-sky-200/20 border-t-sky-400"
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          />
          <motion.div
            className="absolute inset-0 rounded-full bg-sky-300/10"
            animate={{ scale: [1, 1.2, 1], opacity: [0.15, 0.35, 0.15] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
          />
        </motion.div>

        <motion.p variants={itemVariants} className="mt-5 text-base font-semibold text-white">
          Preparing your case...
        </motion.p>

        <motion.p variants={itemVariants} className="mt-1 text-sm text-slate-300">
          Syncing profile and loading today&apos;s diagnosis.
        </motion.p>

        <motion.div variants={itemVariants} className="mt-6 w-full rounded-2xl border border-white/10 bg-white/5 p-4 md:p-5">
          <motion.div
            className="h-4 w-2/5 rounded bg-slate-300/25"
            animate={{ opacity: [0.35, 0.75, 0.35] }}
            transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            className="mt-3 h-3 w-full rounded bg-slate-300/20"
            animate={{ opacity: [0.25, 0.55, 0.25] }}
            transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut', delay: 0.1 }}
          />
          <motion.div
            className="mt-2 h-3 w-4/5 rounded bg-slate-300/20"
            animate={{ opacity: [0.25, 0.55, 0.25] }}
            transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut', delay: 0.2 }}
          />
        </motion.div>
      </div>
    </AnimatedContainer>
  )
}
