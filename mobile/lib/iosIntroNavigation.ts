/** Set when a new iOS user finishes the sample tour by subscribing, so the next app stack opens the dashboard. */
let openDashboardAfterIntro = false;

export function requestDashboardAfterIntro(): void {
  openDashboardAfterIntro = true;
}

export function peekDashboardAfterIntro(): boolean {
  return openDashboardAfterIntro;
}

export function consumeDashboardAfterIntro(): void {
  openDashboardAfterIntro = false;
}
