import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

let cachedReduceMotion = false;
let primed = false;

function prime() {
  if (primed) return;
  primed = true;
  AccessibilityInfo.isReduceMotionEnabled()
    .then((value) => {
      cachedReduceMotion = value;
    })
    .catch(() => {});
  AccessibilityInfo.addEventListener('reduceMotionChanged', (value) => {
    cachedReduceMotion = value;
  });
}

prime();

/** System "Reduce Motion" setting. Seeded from a module-level cache so the first render is usually correct. */
export function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(cachedReduceMotion);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => alive && setReduce(value))
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);
  return reduce;
}
