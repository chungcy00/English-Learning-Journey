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
