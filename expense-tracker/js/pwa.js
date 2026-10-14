// Install prompt, service worker and persistent storage.

let deferredPrompt = null;
let persisted = null;
const listeners = new Set();
const notify = () => listeners.forEach((fn) => fn());

export const onPWAChange = (fn) => listeners.add(fn);

export function initPWA() {
  // Android/desktop Chrome: keep the install prompt so Settings can show an Install button.
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    notify();
  });

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('./sw.js').catch((err) => console.warn('Service worker not registered', err));
  }
}

export const canPromptInstall = () => deferredPrompt !== null;

export async function promptInstall() {
  if (!deferredPrompt) return false;
  const prompt = deferredPrompt;
  deferredPrompt = null;
  prompt.prompt();
  const { outcome } = await prompt.userChoice;
  notify();
  return outcome === 'accepted';
}

export function isStandalone() {
  return window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;
}

export function platform() {
  const ua = navigator.userAgent;
  if (/iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) return 'ios';
  if (/android/i.test(ua)) return 'android';
  return 'other';
}

/**
 * Asks the browser not to clear Saveit's data when space runs low or the app
 * goes unused (Safari can otherwise clear it after a few weeks).
 */
export async function requestPersistence() {
  try {
    persisted = (await navigator.storage?.persisted?.()) || (await navigator.storage?.persist?.()) || false;
  } catch {
    persisted = false;
  }
  notify();
  return persisted;
}

export const isStoragePersisted = () => persisted;
