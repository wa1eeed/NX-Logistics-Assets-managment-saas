import { useEffect, useState } from 'react';
import { animate } from 'framer-motion';

/** Counts up to `value` on mount/change. */
export function AnimatedNumber({ value, duration = 0.9 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const controls = animate(0, value, {
      duration,
      ease: 'easeOut',
      onUpdate: (v) => setDisplay(Math.round(v)),
    });
    return () => controls.stop();
  }, [value, duration]);

  return <>{display.toLocaleString()}</>;
}
