import React, { useState } from 'react';
import { X, Sparkles, Plus, Trash2 } from 'lucide-react';
import { SmartRuleDTO } from '../types/audio';

interface SmartPlaylistModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export const SmartPlaylistModal: React.FC<SmartPlaylistModalProps> = ({ isOpen, onClose, onCreated }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [rules, setRules] = useState<any[]>([
    { field: 'genre', operator: 'contains', value: 'Synthwave', logic_gate: 'AND' },
  ]);
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const addRule = () => {
    setRules([...rules, { field: 'energy', operator: 'greater_than', value: '0.80', logic_gate: 'AND' }]);
  };

  const updateRule = (index: number, key: string, value: string) => {
    const updated = [...rules];
    updated[index][key] = value;
    setRules(updated);
  };

  const removeRule = (index: number) => {
    setRules(rules.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    try {
      const res = await fetch('/api/playlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || 'Dynamic smart rule-based playlist',
          is_smart: 1,
          rules,
        }),
      });

      if (res.ok) {
        onCreated();
        onClose();
      }
    } catch (err) {
      console.warn('Could not create smart playlist:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-5">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">Create Smart Rule-Based Playlist</h3>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400 block mb-1">
              Playlist Name
            </label>
            <input
              type="text"
              required
              placeholder="e.g. 120+ BPM Cyberpunk Focus"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full text-sm bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400 block mb-1">
              Description (Optional)
            </label>
            <input
              type="text"
              placeholder="Dynamic auto-updating playlist"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full text-sm bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Rules Builder */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Match Criteria</span>
              <button
                type="button"
                onClick={addRule}
                className="flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 font-medium"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Condition
              </button>
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {rules.map((rule, idx) => (
                <div key={idx} className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900/60 p-2 rounded-lg border border-slate-200 dark:border-slate-800">
                  {idx > 0 && (
                    <select
                      value={rule.logic_gate}
                      onChange={(e) => updateRule(idx, 'logic_gate', e.target.value)}
                      className="text-xs bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-1"
                    >
                      <option value="AND">AND</option>
                      <option value="OR">OR</option>
                    </select>
                  )}

                  <select
                    value={rule.field}
                    onChange={(e) => updateRule(idx, 'field', e.target.value)}
                    className="text-xs bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded px-2 py-1"
                  >
                    <option value="genre">Genre</option>
                    <option value="artist">Artist</option>
                    <option value="bpm">BPM</option>
                    <option value="energy">Energy</option>
                    <option value="duration">Duration (s)</option>
                  </select>

                  <select
                    value={rule.operator}
                    onChange={(e) => updateRule(idx, 'operator', e.target.value)}
                    className="text-xs bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded px-2 py-1"
                  >
                    <option value="equals">Equals</option>
                    <option value="contains">Contains</option>
                    <option value="greater_than">&gt;=</option>
                    <option value="less_than">&lt;=</option>
                  </select>

                  <input
                    type="text"
                    value={rule.value}
                    onChange={(e) => updateRule(idx, 'value', e.target.value)}
                    className="flex-1 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-slate-900 dark:text-white"
                  />

                  {rules.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeRule(idx)}
                      className="p-1 text-slate-400 hover:text-rose-500 rounded"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition shadow-md shadow-indigo-600/30"
            >
              {loading ? 'Creating...' : 'Create Smart Playlist'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
