import React, { useEffect, useRef, useState } from 'react';
import { BarChart3, Activity, Disc, Sparkles } from 'lucide-react';
import { audioEffectsService } from '../../services/audioEffectsService';
import { VisualizerMode } from '../../types/music';

interface AudioVisualizerProps {
  isPlaying: boolean;
  className?: string;
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({ isPlaying, className = '' }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [mode, setMode] = useState<VisualizerMode>('spectrum');

  // Animation frame and peak storage
  const peaksRef = useRef<number[]>([]);
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let activeAnalyser = audioEffectsService.getAnalyserNode();
    const bufferLength = activeAnalyser ? activeAnalyser.frequencyBinCount : 128;
    const freqData = new Uint8Array(bufferLength);
    const timeData = new Uint8Array(bufferLength);

    // BUG-18 fix: Cancellation flag to avoid zombie animation loops
    let isCancelled = false;

    // Initialize peaks
    if (peaksRef.current.length !== bufferLength) {
      peaksRef.current = new Array(bufferLength).fill(0);
    }

    let rotation = 0;
    let logicalWidth = 300;
    let logicalHeight = 200;

    const render = () => {
      if (isCancelled) return;
      ctx.clearRect(0, 0, logicalWidth, logicalHeight);

      // BUG-17 fix: Dynamically retrieve analyser node if it was null on initial mount
      if (!activeAnalyser) {
        activeAnalyser = audioEffectsService.getAnalyserNode();
      }

      let hasSignal = false;
      if (activeAnalyser && isPlaying) {
        audioEffectsService.getFrequencyData(freqData);
        audioEffectsService.getTimeDomainData(timeData);
        hasSignal = true;
      } else {
        // Smoothly decay to zero when paused
        let maxVal = 0;
        for (let i = 0; i < freqData.length; i++) {
          freqData[i] = Math.max(0, Math.floor(freqData[i] * 0.92));
          if (freqData[i] > maxVal) maxVal = freqData[i];
          timeData[i] = 128;
        }
        let maxPeak = 0;
        for (let i = 0; i < peaksRef.current.length; i++) {
          if (peaksRef.current[i] > maxPeak) maxPeak = peaksRef.current[i];
        }
        if (maxVal > 1 || maxPeak > 1) {
          hasSignal = true;
        }
      }

      if (mode === 'spectrum') {
        renderSpectrum(ctx, logicalWidth, logicalHeight, freqData);
      } else if (mode === 'waveform') {
        renderWaveform(ctx, logicalWidth, logicalHeight, timeData);
      } else if (mode === 'radial') {
        renderRadial(ctx, logicalWidth, logicalHeight, freqData);
      }

      rotation += 0.005;

      // If paused and fully decayed, stop scheduling frames to save CPU/GPU
      if (!isPlaying && !hasSignal) {
        animFrameRef.current = null;
        return;
      }

      if (!isCancelled) {
        animFrameRef.current = requestAnimationFrame(render);
      }
    };

    // Render Mode 1: Neon Spectrum Bars
    const renderSpectrum = (
      ctx: CanvasRenderingContext2D,
      width: number,
      height: number,
      data: Uint8Array
    ) => {
      const barsCount = Math.min(64, Math.floor(width / 7));
      const barWidth = Math.max(3, (width / barsCount) - 3);
      const step = Math.floor(data.length / barsCount);

      for (let i = 0; i < barsCount; i++) {
        const val = data[i * step] || 0;
        const percent = val / 255;
        const barHeight = Math.max(4, percent * (height * 0.78));
        const x = i * (barWidth + 3) + (width - barsCount * (barWidth + 3)) / 2;
        const y = height - barHeight - 12;

        // Gradient for each bar
        const gradient = ctx.createLinearGradient(0, y, 0, height);
        gradient.addColorStop(0, '#818cf8'); // Indigo
        gradient.addColorStop(0.5, '#c084fc'); // Purple
        gradient.addColorStop(1, '#06b6d4'); // Cyan

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barHeight, [3, 3, 0, 0]);
        ctx.fill();

        // Falling Peak Caps
        let peak = peaksRef.current[i] || 0;
        if (barHeight > peak) {
          peak = barHeight;
        } else {
          peak = Math.max(0, peak - 1.6);
        }
        peaksRef.current[i] = peak;

        const peakY = height - peak - 16;
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = '#818cf8';
        ctx.shadowBlur = 8;
        ctx.fillRect(x, peakY, barWidth, 2);
        ctx.shadowBlur = 0; // reset
      }
    };

    // Render Mode 2: Oscilloscope Waveform
    const renderWaveform = (
      ctx: CanvasRenderingContext2D,
      width: number,
      height: number,
      data: Uint8Array
    ) => {
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#38bdf8';
      ctx.shadowColor = '#818cf8';
      ctx.shadowBlur = 12;

      ctx.beginPath();
      const sliceWidth = width / (data.length - 1);
      let x = 0;

      for (let i = 0; i < data.length; i++) {
        const v = data[i] / 128.0; // 0.0 to 2.0
        const y = (v * height) / 2;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
        x += sliceWidth;
      }

      ctx.stroke();

      // Semi-transparent under-fill
      ctx.lineTo(width, height);
      ctx.lineTo(0, height);
      ctx.closePath();
      const fillGrad = ctx.createLinearGradient(0, 0, 0, height);
      fillGrad.addColorStop(0, 'rgba(56, 189, 248, 0.15)');
      fillGrad.addColorStop(1, 'rgba(129, 140, 248, 0.01)');
      ctx.fillStyle = fillGrad;
      ctx.fill();
      ctx.shadowBlur = 0;
    };

    // Render Mode 3: Radial / Circular Pulse
    const renderRadial = (
      ctx: CanvasRenderingContext2D,
      width: number,
      height: number,
      data: Uint8Array
    ) => {
      const centerX = width / 2;
      const centerY = height / 2;
      const baseRadius = Math.min(width, height) * 0.22;
      const bars = 64;
      const step = Math.floor(data.length / bars);

      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(rotation);

      // Center glowing disc
      ctx.beginPath();
      ctx.arc(0, 0, baseRadius * 0.85, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
      ctx.strokeStyle = 'rgba(129, 140, 248, 0.3)';
      ctx.lineWidth = 2;
      ctx.shadowColor = '#6366f1';
      ctx.shadowBlur = 14;
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;

      for (let i = 0; i < bars; i++) {
        const val = data[i * step] || 0;
        const barHeight = Math.max(3, (val / 255) * (baseRadius * 0.9));
        const angle = (i * Math.PI * 2) / bars;

        const x1 = Math.cos(angle) * baseRadius;
        const y1 = Math.sin(angle) * baseRadius;
        const x2 = Math.cos(angle) * (baseRadius + barHeight);
        const y2 = Math.sin(angle) * (baseRadius + barHeight);

        ctx.strokeStyle = `hsl(${(i * 360) / bars}, 85%, 65%)`;
        ctx.lineWidth = 3.5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }

      ctx.restore();
    };

    // Canvas resize observer
    const handleResize = () => {
      if (!containerRef.current || !canvas) return;
      const rect = containerRef.current.getBoundingClientRect();
      const dpr = Math.max(1, window.devicePixelRatio || 1);
      logicalWidth = rect.width;
      logicalHeight = rect.height;
      canvas.width = Math.floor(rect.width * dpr);
      canvas.height = Math.floor(rect.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    animFrameRef.current = requestAnimationFrame(render);

    return () => {
      isCancelled = true;
      window.removeEventListener('resize', handleResize);
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
    };
  }, [isPlaying, mode]);

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full min-h-[260px] flex flex-col items-center justify-center overflow-hidden rounded-3xl bg-neutral-950/60 border border-white/5 shadow-2xl ${className}`}
    >
      {/* Mode Switcher Pill */}
      <div className="absolute top-4 right-4 z-10 flex items-center gap-1 p-1 bg-white/10 backdrop-blur-md rounded-2xl border border-white/10 shadow-lg">
        <button
          onClick={() => setMode('spectrum')}
          className={`p-2 rounded-xl transition-all ${
            mode === 'spectrum'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-neutral-400 hover:text-white'
          }`}
          title="Spectrum Bars"
        >
          <BarChart3 size={15} />
        </button>
        <button
          onClick={() => setMode('waveform')}
          className={`p-2 rounded-xl transition-all ${
            mode === 'waveform'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-neutral-400 hover:text-white'
          }`}
          title="Oscilloscope Wave"
        >
          <Activity size={15} />
        </button>
        <button
          onClick={() => setMode('radial')}
          className={`p-2 rounded-xl transition-all ${
            mode === 'radial'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-neutral-400 hover:text-white'
          }`}
          title="Radial Pulse"
        >
          <Disc size={15} />
        </button>
      </div>

      {/* Floating Info Tag */}
      <div className="absolute top-4 left-5 z-10 flex items-center gap-2 pointer-events-none">
        <Sparkles size={14} className="text-indigo-400 animate-pulse" />
        <span className="text-[11px] font-mono uppercase tracking-widest text-neutral-400">
          Realtime Visualizer • {mode.toUpperCase()}
        </span>
      </div>

      {/* Canvas */}
      <canvas ref={canvasRef} className="w-full h-full block" />
    </div>
  );
};
