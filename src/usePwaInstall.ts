import { useCallback, useEffect, useState } from 'react';
import { installOfferAllowed, isMobileBrowser, writeInstallOfferCooldown } from './installOffer';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

type InstallResult = 'accepted' | 'dismissed' | 'unavailable';

function isStandalone(): boolean {
  const navigatorWithStandalone = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia('(display-mode: standalone)').matches || navigatorWithStandalone.standalone === true;
}

export function usePwaInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(isStandalone);
  const [mobile] = useState(isMobileBrowser);
  const [cooldownActive, setCooldownActive] = useState(
    () => !installOfferAllowed(document.cookie),
  );
  const [verticalBrowseCount, setVerticalBrowseCount] = useState(0);
  const [offerOpen, setOfferOpen] = useState(false);

  useEffect(() => {
    const displayMode = window.matchMedia('(display-mode: standalone)');
    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setDeferredPrompt(null);
      setInstalled(true);
    };
    const onDisplayMode = () => setInstalled(isStandalone());

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    displayMode.addEventListener('change', onDisplayMode);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
      displayMode.removeEventListener('change', onDisplayMode);
    };
  }, []);

  useEffect(() => {
    if (installed) setOfferOpen(false);
  }, [installed]);

  useEffect(() => {
    if (mobile && !installed && !cooldownActive && verticalBrowseCount >= 2) {
      setOfferOpen(true);
    }
  }, [cooldownActive, installed, mobile, verticalBrowseCount]);

  const install = useCallback(async (): Promise<InstallResult> => {
    if (!deferredPrompt) return 'unavailable';
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    if (outcome === 'accepted') setInstalled(true);
    return outcome;
  }, [deferredPrompt]);

  const dismissOffer = useCallback(() => {
    writeInstallOfferCooldown();
    setCooldownActive(true);
    setOfferOpen(false);
  }, []);

  const recordVerticalBrowse = useCallback(() => {
    if (!mobile || installed || cooldownActive || offerOpen) return;
    setVerticalBrowseCount((count) => Math.min(2, count + 1));
  }, [cooldownActive, installed, mobile, offerOpen]);

  return {
    canInstall: deferredPrompt !== null && !installed,
    dismissOffer,
    installed,
    install,
    offerOpen,
    recordVerticalBrowse,
  };
}
