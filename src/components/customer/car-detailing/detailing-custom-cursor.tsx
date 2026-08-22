'use client';

import { AnimatePresence, motion, useMotionValue, useSpring } from 'framer-motion';
import { useEffect, useState, useSyncExternalStore } from 'react';

type CursorState = {
  label: string;
  size: number;
};

function subscribeFinePointer(callback: () => void) {
  const mq = window.matchMedia('(pointer: fine)');
  mq.addEventListener('change', callback);
  return () => mq.removeEventListener('change', callback);
}

const getFinePointer = () => window.matchMedia('(pointer: fine)').matches;
const getServerFinePointer = () => false;

export function DetailingCustomCursor() {
  const enabled = useSyncExternalStore(subscribeFinePointer, getFinePointer, getServerFinePointer);
  const [visible, setVisible] = useState(false);
  const [state, setState] = useState<CursorState>({ label: '', size: 16 });

  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 420, damping: 32 });
  const springY = useSpring(y, { stiffness: 420, damping: 32 });

  useEffect(() => {
    if (!enabled) return;

    document.body.classList.add('has-detailing-cursor');

    const onMove = (e: MouseEvent) => {
      x.set(e.clientX);
      y.set(e.clientY);
      setVisible(true);
    };

    const onLeave = () => setVisible(false);

    const onOver = (e: MouseEvent) => {
      const target = (e.target as HTMLElement)?.closest?.('[data-cursor]') as HTMLElement | null;

      if (target) {
        const label = target.dataset.cursorLabel || '';
        const size = Number(target.dataset.cursorSize || 56);
        setState({ label, size });
      } else {
        setState({ label: '', size: 16 });
      }
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseover', onOver);
    document.documentElement.addEventListener('mouseleave', onLeave);

    return () => {
      document.body.classList.remove('has-detailing-cursor');
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseover', onOver);
      document.documentElement.removeEventListener('mouseleave', onLeave);
    };
  }, [enabled, x, y]);

  if (!enabled) return null;

  return (
    <motion.div
      aria-hidden
      className="pointer-events-none fixed top-0 left-0 z-[9999] mix-blend-difference"
      style={{ x: springX, y: springY }}
    >
      <AnimatePresence>
        {visible && (
          <motion.div
            key="cursor"
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{
              opacity: 1,
              scale: 1,
              width: state.size,
              height: state.size,
            }}
            exit={{ opacity: 0, scale: 0.5 }}
            transition={{ type: 'spring', stiffness: 380, damping: 28 }}
            className="relative flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/90 bg-white/15"
          >
            {state.label ? (
              <span className="text-[10px] font-medium tracking-[0.12em] text-white uppercase">
                {state.label}
              </span>
            ) : null}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
