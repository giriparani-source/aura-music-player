/**
 * src/utils/apiConfig.ts
 *
 * Centralized API configuration and URL resolution for Aura Music Player.
 * In development and client-side production on Vercel, requests default to relative paths (/api/...)
 * which resolve against the origin automatically without CORS issues.
 *
 * If a custom backend or cross-origin deployment is required, set VITE_API_BASE_URL.
 */

export function getApiBaseUrl(): string {
  const envBase = (import.meta as any).env?.VITE_API_BASE_URL;
  if (envBase && typeof envBase === 'string') {
    return envBase.replace(/\/+$/, '');
  }
  
  // When running inside Android Capacitor native APK
  if (typeof window !== 'undefined') {
    const isCapacitorNative = 
      window.location.protocol === 'capacitor:' || 
      Boolean((window as any).Capacitor?.isNativePlatform?.());
    if (isCapacitorNative) {
      return 'https://aura-music-player-omega.vercel.app';
    }
  }

  return '';
}

export function buildApiUrl(path: string): string {
  const base = getApiBaseUrl();
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${cleanPath}`;
}
