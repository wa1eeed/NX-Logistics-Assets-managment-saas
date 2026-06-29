import { motion } from 'framer-motion';

/** Animated aurora + dotted grid backdrop (Aceternity/Magic-style) for auth screens. */
export function Aurora() {
  return (
    <div className="absolute inset-0 overflow-hidden">
      <div className="aurora-bg absolute inset-0 animate-aurora" />
      <div className="grid-bg absolute inset-0 opacity-40" />
      <motion.div
        className="absolute -top-32 -start-24 h-96 w-96 rounded-full bg-primary/30 blur-3xl"
        animate={{ y: [0, 30, 0], x: [0, 20, 0] }}
        transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute bottom-0 end-0 h-[28rem] w-[28rem] rounded-full bg-sky-500/20 blur-3xl"
        animate={{ y: [0, -40, 0], x: [0, -20, 0] }}
        transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-slate-950/40" />
    </div>
  );
}
