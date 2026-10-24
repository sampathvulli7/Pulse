import React, { useEffect, useState } from 'react';
import { X, Sliders, RotateCcw } from 'lucide-react';
import { usePlayerStore } from '../store/playerStore';
import { EQ_FREQUENCIES, globalAudioGraph } from '../audio/AudioGraph';
import { VisualizerCanvas } from './VisualizerCanvas';
import { EQPreset } from '../types/audio';

interface EQDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const EQDrawer: React.FC<EQDrawerProps> = ({ isOpen, onClose }) => {
  const { eqGains, preampGain, activePresetName, setEQBandGain, applyEQPreset } = usePlayerStore();
  const [presets, setPresets] = useState<EQPreset[]>([]);

  useEffect(() => {
    fetch('/api/eq-presets')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setPresets(data);
      })
      .catch((err) => console.warn('Could not load EQ presets:', err));
  }, []);

  if (!isOpen) return null;

  const handlePreampChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    globalAudioGraph.setPreampGain(val);
  };

  const handleReset = () => {
    const flatPreset: EQPreset = {
      id: 'flat',
      name: 'Flat',
      isDefault: true,
      preampGain: 0,
      bandGains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    };
    applyEQPreset(flatPreset);
  };

  return (
    <div className="fixed inset-y-0 right-0 w-full sm:w-[460px] z-[60] bg-white dark:bg-slate-950 shadow-2xl flex flex-col border-l border-slate-200 dark:border-slate-800 animate-in slide-in-from-right duration-200 transition-colors">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-800 dark:text-slate-200">
            <Sliders className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">Parametric Equalizer</h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">10-Band Web Audio DSP Engine</p>
          </div>
        </div>
        <button
          onClick={onClose}
          aria-label="Close"
          className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {/* Real-Time Canvas Visualizer */}
        <VisualizerCanvas height={110} />

        {/* Presets Row */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Presets
            </span>
            <button
              onClick={handleReset}
              className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900 dark:hover:text-white transition font-medium"
            >
              <RotateCcw className="w-3 h-3" />
              Reset Flat
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {presets.map((preset) => {
              const isActive = activePresetName === preset.name;
              return (
                <button
                  key={preset.id}
                  onClick={() => applyEQPreset(preset)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition ${
                    isActive
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-200/80 dark:hover:bg-slate-800 border border-slate-200/60 dark:border-slate-800'
                  }`}
                >
                  {preset.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* 10 Band Vertical Sliders */}
        <div className="rounded-2xl p-4 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Frequency Bands (±12 dB)
            </span>
            <span className="text-[10px] font-mono text-slate-400">0 dB Center Notch</span>
          </div>

          <div className="grid grid-cols-10 gap-1 h-52 items-center">
            {EQ_FREQUENCIES.map((freq, idx) => {
              const gain = eqGains[idx] || 0;
              const label = freq >= 1000 ? `${freq / 1000}k` : `${freq}`;
              return (
                <div key={freq} className="flex flex-col items-center h-full justify-between">
                  <span className={`text-[10px] font-mono font-semibold ${
                    gain !== 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'
                  }`}>
                    {gain > 0 ? `+${gain.toFixed(0)}` : gain.toFixed(0)}
                  </span>

                  <div className="relative flex items-center justify-center flex-1 w-full my-2">
                    <input
                      type="range"
                      min="-12"
                      max="12"
                      step="0.5"
                      value={gain}
                      onChange={(e) => setEQBandGain(idx, parseFloat(e.target.value))}
                      className="w-36 -rotate-90 origin-center cursor-pointer accent-indigo-600 dark:accent-indigo-500 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none h-1.5"
                    />
                  </div>

                  <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-300">{label}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Preamp Gain */}
        <div className="rounded-2xl p-4 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-xs">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Master Preamp Gain</span>
            <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
              {preampGain > 0 ? `+${preampGain.toFixed(1)}` : preampGain.toFixed(1)} dB
            </span>
          </div>
          <input
            type="range"
            min="-12"
            max="12"
            step="0.5"
            defaultValue={preampGain}
            onChange={handlePreampChange}
            className="w-full accent-indigo-600 dark:accent-indigo-500 bg-slate-200 dark:bg-slate-800 rounded-lg cursor-pointer h-1.5"
          />
        </div>
      </div>
    </div>
  );
};
