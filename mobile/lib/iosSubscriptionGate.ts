/**
 * Simulator-only escape from the required plan screen.
 * Production and TestFlight builds never set this.
 */
let devBypass = false;
const listeners = new Set<() => void>();

export function isIosPaywallDevBypass(): boolean {
  return devBypass;
}

export function setIosPaywallDevBypass(next: boolean): void {
  devBypass = next;
  listeners.forEach((listener) => listener());
}

export function subscribeIosPaywallDevBypass(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
