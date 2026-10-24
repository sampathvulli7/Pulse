import React, { useEffect, useRef, useState } from 'react';
import { globalAudioGraph } from '../audio/AudioGraph';
import { usePlayerStore } from '../store/playerStore';

export const VisualizerCanvas: React.FC<{ height?: number }> = ({ height = 110 }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [mode, setMode] = useState<'bars' | 'wave'>('bars');
  const isPlaying = usePlayerStore((s) => s.isPlaying);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const h = canvas.height;

    // If paused, render an elegant, static idle frame and do not loop RAF (conserves mobile CPU & GPU)
    if (!isPlaying) {
      ctx.clearRect(0, 0, width, h);
      if (mode === 'bars') {
        const barCount = 44;
        const totalSpacing = barCount * 2;
        const barWidth = Math.max(2, (width - totalSpacing) / barCount);
        ctx.fillStyle = 'rgba(99, 102, 241, 0.25)';
        for (let i = 0; i < barCount; i++) {
          const barHeight = 4;
          ctx.beginPath();
          ctx.roundRect(i * (barWidth + 2) + 2, h - barHeight, barWidth, barHeight, [2, 2, 0, 0]);
          ctx.fill();
        }
      } else {
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = 'rgba(99, 102, 241, 0.3)';
        ctx.beginPath();
        ctx.moveTo(0, h / 2);
        ctx.lineTo(width, h / 2);
        ctx.stroke();
      }
      return;
    }

    let animationId: number;
    const bufferLength = globalAudioGraph.getFrequencyBinCount();
    const dataArray = new Uint8Array(bufferLength);

    const render = () => {
      animationId = requestAnimationFrame(render);

      ctx.clearRect(0, 0, width, h);

      if (mode === 'bars') {
        globalAudioGraph.getByteFrequencyData(dataArray);

        const barCount = 44;
        const totalSpacing = barCount * 2;
        const barWidth = Math.max(2, (width - totalSpacing) / barCount);
        const step = Math.floor(bufferLength / barCount) || 1;

        for (let i = 0; i < barCount; i++) {
          const value = dataArray[i * step] || 0;
          const barHeight = Math.max(3, (value / 255) * (h - 8));

          // Clean, refined gradient: deep indigo to soft violet
          const grad = ctx.createLinearGradient(0, h, 0, h - barHeight);
          grad.addColorStop(0, '#4f46e5');
          grad.addColorStop(1, '#818cf8');

          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.roundRect(i * (barWidth + 2) + 2, h - barHeight, barWidth, barHeight, [2, 2, 0, 0]);
          ctx.fill();
        }
      } else {
        globalAudioGraph.getByteTimeDomainData(dataArray);

        ctx.lineWidth = 2;
        const grad = ctx.createLinearGradient(0, 0, width, 0);
        grad.addColorStop(0, '#4f46e5');
        grad.addColorStop(0.5, '#6366f1');
        grad.addColorStop(1, '#a5b4fc');
        ctx.strokeStyle = grad;
        ctx.beginPath();

        const sliceWidth = width / bufferLength;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          const v = dataArray[i] / 128.0;
          const y = (v * h) / 2;

          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
          x += sliceWidth;
        }

        ctx.lineTo(width, h / 2);
        ctx.stroke();
      }
    };

    render();

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [mode, isPlaying]);

  return (
    <div className="relative w-full rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-3 shadow-xs">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Audio Spectrum Visualizer
        </span>
        <div className="flex bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200/60 dark:border-slate-700/60">
          <button
            onClick={() => setMode('bars')}
            className={`px-2.5 py-0.5 text-[11px] rounded-md font-medium transition ${
              mode === 'bars'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Bars
          </button>
          <button
            onClick={() => setMode('wave')}
            className={`px-2.5 py-0.5 text-[11px] rounded-md font-medium transition ${
              mode === 'wave'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Waveform
          </button>
        </div>
      </div>
      <canvas
        ref={canvasRef}
        width={400}
        height={height}
        className="w-full h-[110px] rounded-xl bg-slate-50 dark:bg-slate-950/80"
      />
    </div>
  );
};
