type InstallListener = (canInstall: boolean, isInstalled: boolean) => void;

class PwaService {
  private deferredPrompt: any = null;
  private isInstalled: boolean = false;
  private listeners: Set<InstallListener> = new Set();

  constructor() {
    this.checkStandaloneMode();
    this.setupListeners();
    this.registerServiceWorker();
  }

  private checkStandaloneMode() {
    if (typeof window === 'undefined') return;
    try {
      const isStandalone =
        (typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches) ||
        (window.navigator as any)?.standalone === true ||
        (typeof document !== 'undefined' && typeof document.referrer === 'string' && document.referrer.includes('android-app://'));
      this.isInstalled = !!isStandalone;
    } catch {
      this.isInstalled = false;
    }
  }

  private setupListeners() {
    if (typeof window === 'undefined') return;

    window.addEventListener('beforeinstallprompt', (e: Event) => {
      // Prevent browser default mini-infobar
      e.preventDefault();
      this.deferredPrompt = e;
      this.notify();
    });

    window.addEventListener('appinstalled', () => {
      this.deferredPrompt = null;
      this.isInstalled = true;
      this.notify();
    });
  }

  private registerServiceWorker() {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    const isNativeCapacitor =
      window.location.protocol === 'capacitor:' ||
      Boolean((window as any).Capacitor?.isNativePlatform?.()) ||
      (window.location.hostname === 'localhost' && Boolean((window as any).Capacitor));

    // In development mode or native mobile APK, NEVER run service workers
    // to avoid intercepting local asset requests and causing infinite blank/loading screens.
    if (import.meta.env.DEV || isNativeCapacitor || window.location.hostname === 'localhost') {
      navigator.serviceWorker.getRegistrations().then((regs) => {
        for (const reg of regs) {
          reg.unregister();
        }
      });
      if ('caches' in window) {
        caches.keys().then((keys) => {
          for (const key of keys) {
            if (key.startsWith('aura-music-pwa')) {
              caches.delete(key);
            }
          }
        });
      }
      return;
    }

    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => {
          console.log('Aura PWA ServiceWorker active:', reg.scope);
        })
        .catch((err) => {
          console.warn('ServiceWorker registration error:', err);
        });
    });
  }

  public async promptInstall(): Promise<boolean> {
    if (!this.deferredPrompt) {
      return false;
    }
    try {
      this.deferredPrompt.prompt();
      const choiceResult = await this.deferredPrompt.userChoice;
      if (choiceResult.outcome === 'accepted') {
        this.isInstalled = true;
        this.deferredPrompt = null;
        this.notify();
        return true;
      }
    } catch (err) {
      console.warn('PWA Install prompt error:', err);
    }
    return false;
  }

  public canInstall(): boolean {
    return !!this.deferredPrompt && !this.isInstalled;
  }

  public isAppInstalled(): boolean {
    return this.isInstalled;
  }

  public subscribe(listener: InstallListener): () => void {
    this.listeners.add(listener);
    listener(this.canInstall(), this.isInstalled);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    const can = this.canInstall();
    const installed = this.isInstalled;
    this.listeners.forEach((l) => l(can, installed));
  }
}

export const pwaService = new PwaService();
