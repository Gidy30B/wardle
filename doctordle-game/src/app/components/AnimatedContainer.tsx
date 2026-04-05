import type { PropsWithChildren } from 'react'
import { motion, type Variants } from 'framer-motion'

type AnimatedContainerProps = PropsWithChildren<{
  className?: string
  variants?: Variants
}>

const defaultVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0 },
}

export default function AnimatedContainer({
  children,
  className,
  variants = defaultVariants,
}: AnimatedContainerProps) {
  return (
    <motion.div
      className={className}
      variants={variants}
      initial="hidden"
      animate="show"
      exit="hidden"
      transition={{ duration: 0.35, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  )
}
