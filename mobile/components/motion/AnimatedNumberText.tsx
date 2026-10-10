import React, { useEffect, useRef, useState } from 'react';
import { Text, type TextProps } from 'react-native';
import { useReduceMotion } from './useReduceMotion';

type Props = Omit<TextProps, 'children'> & {
  /** Already-formatted display string, e.g. "$12,345.67", "-$800", "18.5%". */
  value: string;
  duration?: number;
};

type Parsed = {
  prefix: string;
  suffix: string;
  amount: number;
  decimals: number;
  grouped: boolean;
};

/** Only strings with exactly one number animate; ranges and plain text render as-is. */
const SINGLE_NUMBER = /^(\D*?)(\d[\d,]*(?:\.\d+)?)(\D*)$/;

function parse(value: string): Parsed | null {
  const match = SINGLE_NUMBER.exec(value);
  if (!match) return null;
  const [, prefix, digits, suffix] = match;
  const amount = Number(digits.replace(/,/g, ''));
  if (!Number.isFinite(amount)) return null;
  const dot = digits.indexOf('.');
  return {
    prefix,
    suffix,
    amount,
    decimals: dot === -1 ? 0 : digits.length - dot - 1,
    grouped: digits.includes(','),
  };
}

function render(parsed: Parsed, amount: number): string {
  const body = amount.toLocaleString('en-US', {
    minimumFractionDigits: parsed.decimals,
    maximumFractionDigits: parsed.decimals,
    useGrouping: parsed.grouped,
  });
  return `${parsed.prefix}${body}${parsed.suffix}`;
}

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

/**
 * Text that counts up to a formatted number on mount and tweens between values on change.
 * Screen readers always get the final value.
 */
export default function AnimatedNumberText({ value, duration = 750, ...textProps }: Props) {
  const reduceMotion = useReduceMotion();
  const fromRef = useRef(0);
  const frameRef = useRef<number | null>(null);
  const [display, setDisplay] = useState(() => {
    const parsed = parse(value);
    return parsed && !reduceMotion ? render(parsed, 0) : value;
  });

  useEffect(() => {
    const parsed = parse(value);
    if (frameRef.current != null) cancelAnimationFrame(frameRef.current);

    if (!parsed || reduceMotion || fromRef.current === parsed.amount) {
      fromRef.current = parsed?.amount ?? 0;
      setDisplay(value);
      return;
    }

    const from = fromRef.current;
    const to = parsed.amount;
    const start = Date.now();
    const tick = () => {
      const t = Math.min(1, (Date.now() - start) / duration);
      const current = from + (to - from) * easeOutCubic(t);
      fromRef.current = current;
      if (t < 1) {
        setDisplay(render(parsed, current));
        frameRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = to;
        setDisplay(value);
        frameRef.current = null;
      }
    };
    frameRef.current = requestAnimationFrame(tick);

    return () => {
      if (frameRef.current != null) cancelAnimationFrame(frameRef.current);
    };
  }, [value, reduceMotion, duration]);

  return (
    <Text accessibilityLabel={value} {...textProps}>
      {display}
    </Text>
  );
}
