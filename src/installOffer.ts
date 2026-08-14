export const INSTALL_OFFER_COOKIE_NAME = 'habrtok_install_offer_after';
export const INSTALL_OFFER_COOLDOWN_SECONDS = 60 * 60 * 24 * 7;

export function installOfferAllowed(cookieHeader: string, now = Date.now()): boolean {
  const prefix = `${INSTALL_OFFER_COOKIE_NAME}=`;
  const rawValue = cookieHeader
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix))
    ?.slice(prefix.length);
  if (!rawValue) return true;

  const retryAfter = Number.parseInt(decodeURIComponent(rawValue), 10);
  return !Number.isFinite(retryAfter) || retryAfter <= now;
}

export function buildInstallOfferCooldownCookie(now = Date.now(), secure = false): string {
  const retryAfter = now + INSTALL_OFFER_COOLDOWN_SECONDS * 1000;
  return [
    `${INSTALL_OFFER_COOKIE_NAME}=${retryAfter}`,
    `Max-Age=${INSTALL_OFFER_COOLDOWN_SECONDS}`,
    `Expires=${new Date(retryAfter).toUTCString()}`,
    'Path=/',
    'SameSite=Lax',
    ...(secure ? ['Secure'] : []),
  ].join('; ');
}

export function isMobileBrowser(navigatorValue: Navigator = navigator): boolean {
  const navigatorWithHints = navigatorValue as Navigator & {
    userAgentData?: { mobile?: boolean };
  };
  if (navigatorWithHints.userAgentData?.mobile === true) return true;

  const mobileUserAgent = /Android|iPhone|iPad|iPod|IEMobile|Opera Mini|Mobile/i.test(
    navigatorValue.userAgent,
  );
  const desktopModeIpad =
    navigatorValue.platform === 'MacIntel' && navigatorValue.maxTouchPoints > 1;
  return mobileUserAgent || desktopModeIpad;
}

export function writeInstallOfferCooldown(now = Date.now()): void {
  document.cookie = buildInstallOfferCooldownCookie(now, window.location.protocol === 'https:');
}
