const STORAGE_PREFIX = 'habrtok:';

export const platform = {
  haptic(): void {
    if ('vibrate' in navigator) navigator.vibrate(8);
  },

  openExternal(url: string): void {
    window.open(url, '_blank', 'noopener,noreferrer');
  },

  read(key: string): string | null {
    try {
      return window.localStorage.getItem(`${STORAGE_PREFIX}${key}`);
    } catch {
      return null;
    }
  },

  write(key: string, value: string): void {
    try {
      window.localStorage.setItem(`${STORAGE_PREFIX}${key}`, value);
    } catch {
      // Storage can be unavailable in privacy mode; the app remains usable.
    }
  },

  async share(title: string, text: string, url: string): Promise<'shared' | 'copied'> {
    if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
        return 'shared';
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return 'shared';
      }
    }
    await navigator.clipboard.writeText(url);
    return 'copied';
  },
};
