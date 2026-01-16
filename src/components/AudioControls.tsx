'use client';

import { useState, useEffect } from 'react';
import { 
  getPrefs,
  setBgmVolume,
  setSfxVolume,
  toggleBgmMute,
  toggleSfxMute,
  isBgmActive
} from '@/lib/audioManager';

/**
 * Audio Controls Component
 * 
 * Separate controls for Background Music (BGM) and Sound Effects (SFX).
 * Persists user preferences in localStorage.
 */
export function AudioControls() {
  const [bgmMuted, setBgmMuted] = useState(false);
  const [sfxMuted, setSfxMuted] = useState(false);
  const [bgmVol, setBgmVol] = useState(40);
  const [sfxVol, setSfxVol] = useState(70);
  const [isPlaying, setIsPlaying] = useState(false);

  // Load saved preferences on mount
  useEffect(() => {
    const prefs = getPrefs();
    setBgmMuted(prefs.bgmMuted);
    setSfxMuted(prefs.sfxMuted);
    setBgmVol(prefs.bgmVolume);
    setSfxVol(prefs.sfxVolume);
    
    // Poll for BGM status
    const interval = setInterval(() => {
      setIsPlaying(isBgmActive());
    }, 500);
    
    return () => clearInterval(interval);
  }, []);

  const handleBgmMute = () => {
    const newMuted = toggleBgmMute();
    setBgmMuted(newMuted);
  };

  const handleSfxMute = () => {
    const newMuted = toggleSfxMute();
    setSfxMuted(newMuted);
  };

  const handleBgmVolume = (e: React.ChangeEvent<HTMLInputElement>) => {
    const vol = parseInt(e.target.value, 10);
    setBgmVol(vol);
    setBgmVolume(vol);
    if (bgmMuted && vol > 0) {
      toggleBgmMute();
      setBgmMuted(false);
    }
  };

  const handleSfxVolume = (e: React.ChangeEvent<HTMLInputElement>) => {
    const vol = parseInt(e.target.value, 10);
    setSfxVol(vol);
    setSfxVolume(vol);
    if (sfxMuted && vol > 0) {
      toggleSfxMute();
      setSfxMuted(false);
    }
  };

  return (
    <div className="audio-controls">
      {/* BGM Controls */}
      <div className="audio-group">
        <button 
          className={`audio-btn ${bgmMuted ? 'muted' : ''}`} 
          onClick={handleBgmMute}
          title={bgmMuted ? 'Unmute Music' : 'Mute Music'}
        >
          {bgmMuted ? '🔇' : isPlaying ? '🎵' : '🎶'}
        </button>
        <input
          type="range"
          min="0"
          max="100"
          value={bgmVol}
          onChange={handleBgmVolume}
          className="volume-slider bgm"
          title={`Music: ${bgmVol}%`}
        />
      </div>

      {/* SFX Controls */}
      <div className="audio-group">
        <button 
          className={`audio-btn ${sfxMuted ? 'muted' : ''}`} 
          onClick={handleSfxMute}
          title={sfxMuted ? 'Unmute SFX' : 'Mute SFX'}
        >
          {sfxMuted ? '🔕' : '🔔'}
        </button>
        <input
          type="range"
          min="0"
          max="100"
          value={sfxVol}
          onChange={handleSfxVolume}
          className="volume-slider sfx"
          title={`SFX: ${sfxVol}%`}
        />
      </div>

      <style jsx>{`
        .audio-controls {
          display: flex;
          align-items: center;
          gap: 15px;
          padding: 8px 14px;
          background: rgba(0, 255, 136, 0.05);
          border: 1px solid rgba(0, 255, 136, 0.2);
          border-radius: 20px;
        }

        .audio-group {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .audio-btn {
          background: none;
          border: none;
          font-size: 1.1rem;
          cursor: pointer;
          padding: 4px 6px;
          border-radius: 4px;
          transition: all 0.2s;
          line-height: 1;
        }

        .audio-btn:hover {
          background: rgba(0, 255, 136, 0.15);
        }

        .audio-btn.muted {
          opacity: 0.5;
        }

        .volume-slider {
          width: 60px;
          height: 4px;
          -webkit-appearance: none;
          appearance: none;
          border-radius: 2px;
          cursor: pointer;
        }

        .volume-slider.bgm {
          background: rgba(0, 255, 136, 0.3);
        }

        .volume-slider.sfx {
          background: rgba(255, 170, 0, 0.3);
        }

        .volume-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 12px;
          height: 12px;
          border-radius: 50%;
          cursor: pointer;
        }

        .volume-slider.bgm::-webkit-slider-thumb {
          background: #00ff88;
        }

        .volume-slider.sfx::-webkit-slider-thumb {
          background: #ffaa00;
        }

        .volume-slider::-moz-range-thumb {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          cursor: pointer;
          border: none;
        }

        .volume-slider.bgm::-moz-range-thumb {
          background: #00ff88;
        }

        .volume-slider.sfx::-moz-range-thumb {
          background: #ffaa00;
        }

        @media (max-width: 500px) {
          .audio-controls {
            flex-direction: column;
            gap: 8px;
            padding: 10px;
          }
          
          .volume-slider {
            width: 50px;
          }
        }
      `}</style>
    </div>
  );
}
