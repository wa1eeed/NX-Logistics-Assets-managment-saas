import { useRef, type ReactNode, type MouseEvent } from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';

interface GlowCardProps {
  children: ReactNode;
  className?: string;
  delay?: number;
}

/**
 * Card with a cursor-following radial highlight (Aceternity-style hover effect)
 * plus a Framer Motion mount animation.
 */
export function GlowCard({ children, className, delay = 0 }: GlowCardProps) {
  const ref = useRef<HTMLDivElement>(null);

  function onMouseMove(e: MouseEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty('--mx', `${e.clientX - rect.left}px`);
    el.style.setProperty('--my', `${e.clientY - rect.top}px`);
  }

  return (
    <motion.div
      ref={ref}
      onMouseMove={onMouseMove}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: 'easeOut' }}
      whileHover={{ y: -4 }}
      className={cn(
        'group relative overflow-hidden rounded-lg border bg-card shadow-soft transition-shadow hover:shadow-card',
        className,
      )}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background:
            'radial-gradient(360px circle at var(--mx) var(--my), hsl(var(--primary) / 0.12), transparent 60%)',
        }}
      />
      <div className="relative">{children}</div>
    </motion.div>
  );
}
