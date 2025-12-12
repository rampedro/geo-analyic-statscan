import React from 'react';
import { VisualSettings } from '../types';

interface SettingsPanelProps {
  settings: VisualSettings;
  onUpdate: (s: VisualSettings) => void;
  onClose: () => void;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({ settings, onUpdate, onClose }) => {
  return (
    <div className="absolute top-16 left-4 z-40 bg-gray-900/95 backdrop-blur-xl border border-gray-700 rounded-xl p-5 w-72 shadow-2xl animate-in fade-in zoom-in-95">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-white font-bold text-sm uppercase tracking-wider">Visual Config</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
      </div>
      
      <div className="space-y-4">
        <div>
          <label className="text-xs text-gray-400 mb-1 block">Glyph Scale ({settings.glyphSizeScale.toFixed(1)}x)</label>
          <input 
            type="range" 
            min="0.5" 
            max="3.0" 
            step="0.1"
            value={settings.glyphSizeScale}
            onChange={(e) => onUpdate({...settings, glyphSizeScale: parseFloat(e.target.value)})}
            className="w-full accent-primary h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer"
          />
        </div>

        <div>
          <label className="text-xs text-gray-400 mb-1 block">Opacity ({(settings.opacity * 100).toFixed(0)}%)</label>
          <input 
            type="range" 
            min="0.1" 
            max="1.0" 
            step="0.05"
            value={settings.opacity}
            onChange={(e) => onUpdate({...settings, opacity: parseFloat(e.target.value)})}
            className="w-full accent-primary h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer"
          />
        </div>

        <div>
          <label className="text-xs text-gray-400 mb-1 block">Stroke Width ({settings.strokeWidth}px)</label>
          <input 
            type="range" 
            min="1" 
            max="5" 
            step="0.5"
            value={settings.strokeWidth}
            onChange={(e) => onUpdate({...settings, strokeWidth: parseFloat(e.target.value)})}
            className="w-full accent-primary h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer"
          />
        </div>

        <div className="pt-2 border-t border-gray-700">
           <div className="text-[10px] text-gray-500 italic">
             Applies to all N-gon glyphs and shapes.
           </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPanel;