import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { cn } from '../lib/utils';

/**
 * Modern, technical page loader — concentric tracks + a rotating accent ring,
 * a radar sweep, an orbiting node and a pulsing brand mark. Theme-aware (--primary).
 */
export function PageLoader({ label, fullScreen = false }: { label?: string; fullScreen?: boolean }) {
  const { t } = useTranslation();
  return (
    <div className={cn('grid w-full place-items-center', fullScreen ? 'min-h-screen' : 'min-h-[60vh]')}>
      <div className="flex flex-col items-center gap-6">
        <div className="relative h-24 w-24">
          {/* static outer track */}
          <div className="absolute inset-0 rounded-full border border-primary/15" />
          <div className="absolute inset-2 rounded-full border border-dashed border-primary/10" />

          {/* radar sweep */}
          <motion.div
            className="absolute inset-1 rounded-full"
            style={{ background: 'conic-gradient(from 0deg, transparent 0deg, hsl(var(--primary) / 0.22) 70deg, transparent 130deg)' }}
            animate={{ rotate: 360 }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'linear' }}
          />

          {/* rotating accent ring */}
          <motion.div
            className="absolute inset-0 rounded-full border-[3px] border-transparent border-t-primary border-e-primary/50"
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          />

          {/* orbiting node */}
          <motion.div
            className="absolute inset-0"
            animate={{ rotate: 360 }}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'linear' }}
          >
            <span className="absolute -top-1 left-1/2 h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-primary shadow-glow" />
          </motion.div>

          {/* pulsing brand mark */}
          <motion.div
            className="absolute inset-0 grid place-items-center"
            animate={{ scale: [1, 1.08, 1] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
          >
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-sm font-extrabold text-white shadow-glow">
              NX
            </div>
          </motion.div>
        </div>

        <div className="flex items-center gap-0.5 text-sm font-medium tracking-wide text-muted-foreground">
          <span>{label ?? t('common.loading')}</span>
          {[0, 1, 2].map((i) => (
            <motion.span key={i} animate={{ opacity: [0.2, 1, 0.2] }} transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}>.</motion.span>
          ))}
        </div>
      </div>
    </div>
  );
}
