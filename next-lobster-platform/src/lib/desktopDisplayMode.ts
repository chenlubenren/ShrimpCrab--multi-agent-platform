'use client';

import { useEffect, useState } from 'react';

export type DesktopDisplayMode = 'professional' | 'traditional';

export const DESKTOP_DISPLAY_MODE_STORAGE_KEY = 'openclaw.desktopDisplayMode';
const DEFAULT_DESKTOP_DISPLAY_MODE: DesktopDisplayMode = 'traditional';
const DESKTOP_DISPLAY_MODE_EVENT = 'openclaw:desktop-display-mode-change';

function isDesktopDisplayMode(value: string | null | undefined): value is DesktopDisplayMode {
  return value === 'professional' || value === 'traditional';
}

function readDesktopDisplayMode(): DesktopDisplayMode {
  if (typeof window === 'undefined') return DEFAULT_DESKTOP_DISPLAY_MODE;
  const stored = window.localStorage.getItem(DESKTOP_DISPLAY_MODE_STORAGE_KEY);
  return isDesktopDisplayMode(stored) ? stored : DEFAULT_DESKTOP_DISPLAY_MODE;
}

function applyDesktopDisplayMode(mode: DesktopDisplayMode) {
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.desktopDisplayMode = mode;
  }
}

export function setStoredDesktopDisplayMode(mode: DesktopDisplayMode) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(DESKTOP_DISPLAY_MODE_STORAGE_KEY, mode);
  applyDesktopDisplayMode(mode);
  window.dispatchEvent(new CustomEvent(DESKTOP_DISPLAY_MODE_EVENT, { detail: { mode } }));
}

export function useDesktopDisplayMode() {
  const [mode, setMode] = useState<DesktopDisplayMode>(DEFAULT_DESKTOP_DISPLAY_MODE);

  useEffect(() => {
    const syncMode = () => {
      const nextMode = readDesktopDisplayMode();
      setMode(nextMode);
      applyDesktopDisplayMode(nextMode);
    };

    syncMode();
    window.addEventListener('storage', syncMode);
    window.addEventListener(DESKTOP_DISPLAY_MODE_EVENT, syncMode);
    return () => {
      window.removeEventListener('storage', syncMode);
      window.removeEventListener(DESKTOP_DISPLAY_MODE_EVENT, syncMode);
    };
  }, []);

  return [mode, setStoredDesktopDisplayMode] as const;
}
