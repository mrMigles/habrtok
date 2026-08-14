import { describe, expect, it } from 'vitest';
import {
  buildInstallOfferCooldownCookie,
  INSTALL_OFFER_COOLDOWN_SECONDS,
  installOfferAllowed,
  isMobileBrowser,
} from './installOffer';

const NOW = Date.UTC(2026, 7, 14, 12, 0, 0);

function navigatorLike(overrides: Partial<Navigator>): Navigator {
  return {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    platform: 'Win32',
    maxTouchPoints: 0,
    ...overrides,
  } as Navigator;
}

describe('install offer policy', () => {
  it('allows the offer without a valid cooldown cookie', () => {
    expect(installOfferAllowed('', NOW)).toBe(true);
    expect(installOfferAllowed('habrtok_install_offer_after=broken', NOW)).toBe(true);
  });

  it('suppresses the offer for a week and allows it afterwards', () => {
    const retryAfter = NOW + INSTALL_OFFER_COOLDOWN_SECONDS * 1000;
    const cookie = `theme=dark; habrtok_install_offer_after=${retryAfter}; another=value`;
    expect(installOfferAllowed(cookie, NOW)).toBe(false);
    expect(installOfferAllowed(cookie, retryAfter)).toBe(true);
  });

  it('builds a secure seven-day first-party cookie', () => {
    const cookie = buildInstallOfferCooldownCookie(NOW, true);
    expect(cookie).toContain(`Max-Age=${INSTALL_OFFER_COOLDOWN_SECONDS}`);
    expect(cookie).toContain('Path=/');
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).toContain('Secure');
  });

  it('recognizes phone and iPad browser signals without treating desktop as mobile', () => {
    expect(isMobileBrowser(navigatorLike({ userAgent: 'Mozilla/5.0 (Linux; Android 16; Mobile)' }))).toBe(true);
    expect(isMobileBrowser(navigatorLike({ platform: 'MacIntel', maxTouchPoints: 5 }))).toBe(true);
    expect(isMobileBrowser(navigatorLike({}))).toBe(false);
  });
});
