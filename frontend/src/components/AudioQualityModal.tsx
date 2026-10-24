import React from 'react';
import { X, Check, Disc, Volume2, Sparkles, Sliders, Waves, ShieldCheck } from 'lucide-react';
import { usePlayerStore } from '../store/playerStore';
import { AudioQualityTier, SpatialAudioMode } from '../types/audio';

export const AudioQualityModal: React.FC = () => {
  const {
    isAudioQualityModalOpen,
    setIsAudioQualityModalOpen,
    currentTrack,
    audioQualityTier,
    setAudioQualityTier,
    spatialAudioMode,
    setSpatialAudioMode,
    soundCheckEnabled,
    setSoundCheckEnabled,
  } = usePlayerStore();

  if (!isAudioQualityModalOpen) return null;

  const qualityTiers: { id: AudioQualityTier; title: string; subtitle: string; badge: string; desc: string }[] = [
    {
      id: 'high-efficiency',
      title: 'High Efficiency',
      subtitle: 'HE-AAC • 64-128 kbps',
      badge: 'AAC',
      desc: 'Optimized for mobile data networks with minimal footprint.',
    },
    {
      id: 'high-quality',
      title: 'High Quality',
      subtitle: 'AAC • 256-320 kbps',
      badge: 'HQ AAC',
      desc: 'Virtually indistinguishable from the original studio master for most listeners.',
    },
    {
      id: 'lossless',
      title: 'Lossless',
      subtitle: 'ALAC • Up to 24-bit / 48 kHz',
      badge: 'LOSSLESS',
      desc: 'Apple Lossless Audio Codec preserving all original sound details bit-for-bit.',
    },
    {
      id: 'hi-res-lossless',
      title: 'Hi-Res Lossless',
      subtitle: 'ALAC • Up to 24-bit / 192 kHz',
      badge: 'HI-RES LOSSLESS',
      desc: 'Maximum studio fidelity with massive dynamic headroom and micro-transient reproduction.',
    },
  ];

  const spatialModes: { id: SpatialAudioMode; title: string; desc: string }[] = [
    { id: 'off', title: 'Stereo (Off)', desc: 'Pure unadjusted 2-channel stereo audio master.' },
    { id: 'fixed', title: 'Spatial Audio (Binaural 3D)', desc: 'Apple Music style holographic soundstage with interaural time delay and pinna acoustic filtering.' },
    { id: 'wide-stage', title: 'Wide Concert Stage', desc: 'Extended stereo width with studio ambient early acoustic reflections.' },
  ];

  const activeFormatTitle = currentTrack?.isHiRes
    ? 'Hi-Res Lossless'
    : currentTrack?.isLossless
    ? 'Lossless'
    : 'High Quality AAC';

  const activeFormatDetails = currentTrack?.isHiRes
    ? 'Apple Lossless ALAC • 24-bit / 192 kHz • 9,216 kbps'
    : currentTrack?.isLossless
    ? 'Apple Lossless ALAC • 24-bit / 48 kHz • 1,411 kbps'
    : 'Advanced Audio Coding (AAC) • 320 kbps • 44.1 kHz';

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/40 dark:bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-xl bg-white dark:bg-[#1c1c1e] text-[#1d1d1f] dark:text-white rounded-2xl shadow-2xl border border-black/10 dark:border-white/10 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-5 border-b border-black/5 dark:border-white/5 flex items-center justify-between bg-slate-50/50 dark:bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#fa243c]/10 text-[#fa243c] flex items-center justify-center">
              <Disc className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold tracking-tight">Audio Quality & Lossless</h3>
              <p className="text-xs text-[#86868b] dark:text-[#a1a1a6]">Apple Music Fidelity & Spatial DSP Engine</p>
            </div>
          </div>
          <button
            onClick={() => setIsAudioQualityModalOpen(false)}
            aria-label="Close audio quality settings"
            className="p-2 text-[#86868b] hover:text-[#1d1d1f] dark:hover:text-white rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 space-y-6 overflow-y-auto">
          {/* Current Track Playback Badge Card */}
          <div className="p-4 rounded-xl bg-gradient-to-br from-slate-100/90 to-slate-50 dark:from-white/[0.06] dark:to-white/[0.02] border border-black/5 dark:border-white/5 flex items-center gap-4">
            <img
              src={currentTrack?.coverArtUrl || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=100&q=80'}
              alt=""
              className="w-14 h-14 rounded-lg object-cover shadow-sm"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="apple-lossless-badge font-bold text-[#fa243c] border-[#fa243c]/30 bg-[#fa243c]/10">
                  {currentTrack?.isHiRes ? 'Hi-Res Lossless' : currentTrack?.isLossless ? 'Lossless' : 'AAC'}
                </span>
                {spatialAudioMode !== 'off' && (
                  <span className="apple-lossless-badge font-bold text-sky-600 dark:text-sky-400 border-sky-400/30 bg-sky-500/10">
                    Spatial Audio
                  </span>
                )}
              </div>
              <h4 className="text-sm font-bold truncate">{currentTrack?.title || 'No Track Playing'}</h4>
              <p className="text-xs text-[#86868b] dark:text-[#a1a1a6] truncate">{activeFormatDetails}</p>
            </div>
          </div>

          {/* Streaming Quality Tier Selector */}
          <div>
            <label className="text-xs uppercase font-bold tracking-wider text-[#86868b] block mb-2.5">
              Lossless Audio Tiers
            </label>
            <div className="space-y-2">
              {qualityTiers.map((tier) => {
                const isSelected = audioQualityTier === tier.id;
                return (
                  <div
                    key={tier.id}
                    onClick={() => setAudioQualityTier(tier.id)}
                    className={`p-3.5 rounded-xl border transition cursor-pointer flex items-center justify-between ${
                      isSelected
                        ? 'bg-[#fa243c]/5 border-[#fa243c] dark:bg-[#fa243c]/10'
                        : 'bg-white dark:bg-white/[0.03] border-black/5 dark:border-white/5 hover:border-black/15 dark:hover:border-white/15'
                    }`}
                  >
                    <div className="min-w-0 pr-3">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">{tier.title}</span>
                        <span className="text-[10px] font-mono text-[#86868b] bg-black/5 dark:bg-white/10 px-1.5 py-0.5 rounded">
                          {tier.subtitle}
                        </span>
                      </div>
                      <p className="text-xs text-[#86868b] dark:text-[#a1a1a6] mt-0.5">{tier.desc}</p>
                    </div>
                    {isSelected && (
                      <div className="w-5 h-5 rounded-full bg-[#fa243c] text-white flex items-center justify-center shrink-0 shadow-sm">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Apple Music Spatial Audio */}
          <div>
            <div className="flex items-center gap-2 mb-2.5">
              <Waves className="w-4 h-4 text-[#fa243c]" />
              <label className="text-xs uppercase font-bold tracking-wider text-[#86868b]">
                Spatial Audio & Dolby Atmos Virtualizer
              </label>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {spatialModes.map((mode) => {
                const isSelected = spatialAudioMode === mode.id;
                return (
                  <button
                    key={mode.id}
                    onClick={() => setSpatialAudioMode(mode.id)}
                    className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                      isSelected
                        ? 'bg-[#fa243c]/5 border-[#fa243c] dark:bg-[#fa243c]/10 text-[#fa243c] font-semibold'
                        : 'bg-white dark:bg-white/[0.03] border-black/5 dark:border-white/5 hover:border-black/15 text-[#1d1d1f] dark:text-white'
                    }`}
                  >
                    <span className="text-xs font-bold block mb-1">{mode.title}</span>
                    <span className="text-[11px] text-[#86868b] leading-tight">{mode.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sound Check (Loudness Normalization) */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-black/5 dark:border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ShieldCheck className="w-5 h-5 text-[#fa243c]" />
              <div>
                <span className="text-sm font-semibold block">Sound Check</span>
                <span className="text-xs text-[#86868b] dark:text-[#a1a1a6]">
                  Normalizes loudness across tracks to -14 LUFS standard to prevent jarring volume jumps.
                </span>
              </div>
            </div>
            <button
              onClick={() => setSoundCheckEnabled(!soundCheckEnabled)}
              className={`w-12 h-6 rounded-full transition relative p-0.5 ${
                soundCheckEnabled ? 'bg-[#fa243c]' : 'bg-slate-300 dark:bg-white/20'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white shadow-md transition transform ${
                  soundCheckEnabled ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* DAC Signal Path */}
          <div className="p-3.5 rounded-xl border border-black/5 dark:border-white/5 bg-slate-50/50 dark:bg-black/20 text-xs">
            <span className="text-[10px] uppercase font-bold tracking-wider text-[#86868b] block mb-2">
              Studio Audio Signal Path
            </span>
            <div className="flex items-center justify-between text-[11px] font-mono text-[#6e6e73] dark:text-[#a1a1a6] overflow-x-auto py-1">
              <span className="bg-black/5 dark:bg-white/5 px-2 py-1 rounded">Source File</span>
              <span>→</span>
              <span className="bg-black/5 dark:bg-white/5 px-2 py-1 rounded">10-Band EQ</span>
              <span>→</span>
              <span className="bg-black/5 dark:bg-white/5 px-2 py-1 rounded">Binaural 3D Matrix</span>
              <span>→</span>
              <span className="bg-black/5 dark:bg-white/5 px-2 py-1 rounded">Limiter / DAC</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-black/5 dark:border-white/5 bg-slate-50/50 dark:bg-white/[0.02] flex justify-end">
          <button
            id="audio-quality-done-btn"
            onClick={() => setIsAudioQualityModalOpen(false)}
            className="px-5 py-2 rounded-full bg-[#fa243c] hover:bg-[#e01e35] text-white text-xs font-bold shadow-md transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
