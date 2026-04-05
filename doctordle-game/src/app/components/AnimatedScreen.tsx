import type { PropsWithChildren } from 'react'
import { motion } from 'framer-motion'
import { pageTransition, pageVariants } from '../animationVariants'

type AnimatedScreenProps = PropsWithChildren<{
  screenKey: string
  className?: string
}>

export default function AnimatedScreen({ screenKey, className, children }: AnimatedScreenProps) {
  return (
    <motion.div
      key={screenKey}
      className={className}
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={pageTransition}
    >
      {children}
    </motion.div>
  )
}