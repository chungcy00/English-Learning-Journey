export function isStandaloneApp(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  const nav = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true;
}

export function isMobileOrTablet(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;

  const nav = navigator as Navigator & { userAgentData?: { mobile?: boolean } };
  const touchMac = /Macintosh|MacIntel/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1;
  const mobileUserAgent = /Android|iPhone|iPad|iPod|Mobile|Tablet|Silk|Kindle/i.test(
    navigator.userAgent
  );
  const coarseTablet = window.matchMedia('(pointer: coarse) and (max-width: 1366px)').matches;

  return Boolean(nav.userAgentData?.mobile || touchMac || mobileUserAgent || coarseTablet);
}

export function isAppleMobileDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (/Macintosh|MacIntel/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
}

export function manualUpdatePlatform(standalone: boolean, mobile: boolean, appleMobile: boolean): boolean {
  return standalone && mobile && !appleMobile;
}

export function isManualUpdateApp(): boolean {
  return manualUpdatePlatform(isStandaloneApp(), isMobileOrTablet(), isAppleMobileDevice());
}

// Navigation follows device size/input rather than installation status.
export function usesBottomNavigation(viewportWidth: number, coarsePointer: boolean, mobileDevice = false): boolean {
  return viewportWidth < 1024 || coarsePointer || mobileDevice;
}

export function shouldUseBottomNavigation(): boolean {
  if (typeof window === 'undefined') return false;
  return usesBottomNavigation(window.innerWidth, window.matchMedia('(pointer: coarse)').matches, isMobileOrTablet());
}
