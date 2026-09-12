import React, { useEffect, useState } from 'react';
import { Download, Sparkles, X, CheckCircle2 } from 'lucide-react';
import { pwaService } from '../../services/pwaService';

export const PwaInstallBanner: React.FC = () => {
  const [canInstall, setCanInstall] = useState(pwaService.canInstall());
  const [isInstalled, setIsInstalled] = useState(pwaService.isAppInstalled());
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const unsub = pwaService.subscribe((installable, installed) => {
      setCanInstall(installable);
      setIsInstalled(installed);
    });
    return unsub;
  }, []);

  if (dismissed || isInstalled) {
    return null;
  }

  // Show if browser fired beforeinstallprompt OR if not yet standalone
  if (!canInstall) {
    return null;
  }

  const handleInstall = async () => {
    const success = await pwaService.promptInstall();
    if (success) {
      setDismissed(true);
    }
  };

  return (
    <div className="fixed bottom-24 left-6 z-40 max-w-sm p-4 rounded-2xl bg-[#0e1118]/95 border border-indigo-500/30 backdrop-blur-2xl shadow-2xl shadow-indigo-600/20 animate-in slide-in-from-bottom-5 duration-300 select-none">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-md shadow-indigo-600/30 shrink-0">
            <Download size={18} />
          </div>
          <div>
            <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
              <span>Install Aura Music</span>
              <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                PWA
              </span>
            </h4>
            <p className="text-xs text-neutral-400 mt-0.5 leading-relaxed">
              Install as a desktop or mobile native app with zero lag & offline playback!
            </p>
          </div>
        </div>

        <button
          onClick={() => setDismissed(true)}
          className="p-1 rounded-lg text-neutral-500 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
          title="Dismiss"
        >
          <X size={15} />
        </button>
      </div>

      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/5">
        <button
          onClick={handleInstall}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-bold transition-all shadow-md shadow-indigo-600/25 cursor-pointer active:scale-95"
        >
          <Sparkles size={14} className="text-amber-300" />
          <span>Install Now</span>
        </button>

        <button
          onClick={() => setDismissed(true)}
          className="py-2 px-3 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white text-xs font-medium transition-colors cursor-pointer border border-white/5"
        >
          Maybe Later
        </button>
      </div>
    </div>
  );
};

/**
 * Sidebar button to install or show installed status
 */
export const SidebarPwaButton: React.FC = () => {
  const [canInstall, setCanInstall] = useState(pwaService.canInstall());
  const [isInstalled, setIsInstalled] = useState(pwaService.isAppInstalled());

  useEffect(() => {
    return pwaService.subscribe((installable, installed) => {
      setCanInstall(installable);
      setIsInstalled(installed);
    });
  }, []);

  if (isInstalled) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
        <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
        <span className="truncate">Installed Native App</span>
      </div>
    );
  }

  if (!canInstall) {
    return null;
  }

  return (
    <button
      onClick={() => pwaService.promptInstall()}
      className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-gradient-to-r from-indigo-600/20 to-purple-600/15 hover:from-indigo-600/30 hover:to-purple-600/25 border border-indigo-500/30 text-indigo-200 text-xs font-semibold transition-all cursor-pointer group shadow-sm"
    >
      <div className="flex items-center gap-2">
        <Download size={15} className="text-indigo-400 group-hover:animate-bounce" />
        <span>Install App</span>
      </div>
      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-indigo-500/30 text-indigo-300">
        PWA
      </span>
    </button>
  );
};
