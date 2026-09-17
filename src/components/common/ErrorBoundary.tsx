import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Aura Uncaught Error Boundary caught:', error, errorInfo);
  }

  private handleHardReload = async () => {
    try {
      // Clear service worker caches to flush any stale asset hashes
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const reg of registrations) {
          await reg.unregister();
        }
      }
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
    } catch (e) {
      console.warn('Cache clearing error:', e);
    }
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-screen flex flex-col items-center justify-center bg-[#090b10] text-[#e2e8f0] p-6 text-center select-none">
          <div className="max-w-md w-full p-8 rounded-3xl bg-white/[0.03] border border-white/10 shadow-2xl backdrop-blur-2xl flex flex-col items-center">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-5 shadow-lg shadow-amber-500/10">
              <AlertTriangle size={32} />
            </div>

            <h2 className="text-xl font-black tracking-tight text-white mb-2">
              Something went wrong
            </h2>
            <p className="text-xs text-neutral-400 mb-6 leading-relaxed">
              {this.state.error?.message || 'A network hiccup or stale version was detected. Refreshing will update to the latest version.'}
            </p>

            <div className="flex flex-col sm:flex-row gap-3 w-full">
              <button
                onClick={this.handleHardReload}
                className="flex-1 py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30 active:scale-95 cursor-pointer"
              >
                <RefreshCw size={14} />
                <span>Reload & Update</span>
              </button>
              <button
                onClick={() => {
                  this.setState({ hasError: false, error: null });
                  window.location.href = '/';
                }}
                className="py-3 px-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-semibold transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-2"
              >
                <Home size={14} />
                <span>Go Home</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
