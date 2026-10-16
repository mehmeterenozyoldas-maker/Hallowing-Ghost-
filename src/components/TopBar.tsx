import React from 'react';
import { ActiveTab, AudioState } from '../types';
import { Volume2, VolumeX, Mic } from 'lucide-react';

interface TopBarProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  audioState: AudioState;
  onToggleAudio: () => void;
  onToggleMic: () => void;
  isKidMode: boolean;
  onToggleKidMode: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  activeTab,
  onTabChange,
  audioState,
  onToggleAudio,
  onToggleMic,
  isKidMode,
  onToggleKidMode,
}) => {
  const tabs: { id: ActiveTab; label: string }[] = isKidMode
    ? [
        { id: 'stage', label: '🎈 Magic Playroom' },
        { id: 'choreography', label: '🎪 Ghost Show' },
        { id: 'sound', label: '🎵 Magic Sounds' },
        { id: 'props', label: '🎃 Spooky Toys & Friends' },
        { id: 'flyzone', label: '🏰 My Fly Area' },
        { id: 'shader', label: '🔮 Magic Shaders' },
      ]
    : [
        { id: 'stage', label: 'Haunting Stage' },
        { id: 'choreography', label: '🎭 Haunt Choreography' },
        { id: 'sound', label: '🎛️ Sound FX Studio' },
        { id: 'props', label: '🎃 Entities & Props' },
        { id: 'flyzone', label: 'Ghost Fly Area' },
        { id: 'projector', label: 'Projector Calibration' },
        { id: 'shroud', label: 'Hollow Shroud' },
        { id: 'shader', label: 'Spectral Shaders' },
        { id: 'sculptor', label: '2D Contour Sculptor' },
      ];


  return (
    <header className="flex items-center justify-between gap-6 px-6 py-3.5 bg-neutral-950/90 backdrop-blur-md border-b border-neutral-800/80 z-30 select-none">
      {/* Zone 1: Wordmark & Kid Mode toggle */}
      <div className="flex items-center gap-4 shrink-0">
        <div className="flex items-center gap-2.5">
          <span className="text-sm font-bold tracking-widest text-neutral-100 uppercase whitespace-nowrap">
            SPECTRAL TOWN HALL
          </span>
          <span className="text-[11px] font-mono text-cyan-400/80 tracking-normal hidden lg:inline">
            SPATIAL MAPPING
          </span>
        </div>

        {/* Kid Mode / Pro Studio Switcher */}
        <button
          onClick={onToggleKidMode}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer shadow-sm active:scale-95 ${
            isKidMode
              ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white ring-2 ring-pink-400/50'
              : 'bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border border-neutral-700'
          }`}
          title="Switch between Easy Kid Mode and Professional Studio Mode"
        >
          <span>{isKidMode ? '🎈 Easy Kid Mode' : '⚙️ Studio Mode'}</span>
          <span className="text-[10px] opacity-75 font-normal">
            ({isKidMode ? 'Tap for Pro' : 'Tap for Kids'})
          </span>
        </button>
      </div>

      {/* Zone 2: Navigation links */}
      <nav className="hidden md:flex items-center gap-5 text-xs font-medium text-neutral-400">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`transition-colors whitespace-nowrap shrink-0 py-1 cursor-pointer border-b-2 ${
                isActive
                  ? 'text-cyan-300 font-semibold border-cyan-400'
                  : 'text-neutral-400 hover:text-neutral-200 border-transparent'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </nav>

      {/* Zone 3: 1 primary action */}
      <div className="flex items-center gap-2.5 shrink-0">
        {audioState.enabled && (
          <button
            onClick={onToggleMic}
            title={audioState.mode === 'mic' ? 'Using Microphone' : 'Switch to Microphone'}
            className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 cursor-pointer ${
              audioState.mode === 'mic'
                ? 'bg-cyan-950 text-cyan-300 border border-cyan-700/60'
                : 'bg-neutral-900 text-neutral-400 hover:text-neutral-200 border border-neutral-800'
            }`}
          >
            <Mic className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{audioState.mode === 'mic' ? 'Mic Active' : 'Use Mic'}</span>
          </button>
        )}

        <button
          onClick={onToggleAudio}
          className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-2 cursor-pointer shadow-sm ${
            audioState.enabled
              ? 'bg-cyan-500 hover:bg-cyan-400 text-neutral-950 font-semibold'
              : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-200'
          }`}
        >
          {audioState.enabled ? (
            <>
              <Volume2 className="w-3.5 h-3.5" />
              <span>Sound Reactive</span>
              <span className="w-1.5 h-1.5 rounded-full bg-neutral-950 animate-pulse" />
            </>
          ) : (
            <>
              <VolumeX className="w-3.5 h-3.5 text-neutral-400" />
              <span>Enable Sound</span>
            </>
          )}
        </button>
      </div>
    </header>
  );
};
