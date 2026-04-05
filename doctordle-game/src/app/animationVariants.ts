import type { Variants, Transition } from 'framer-motion'

export const pageVariants: Variants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
}

export const pageTransition: Transition = {
  duration: 0.3,
  ease: 'easeOut',
}