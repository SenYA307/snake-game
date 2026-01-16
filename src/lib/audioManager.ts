/**
 * Arcade Audio Manager (Singleton)
 * 
 * Manages background music (BGM) and sound effects (SFX) with clear state rules:
 * 
 * GAME STATES & AUDIO:
 * - IDLE/PAYWALL/DEAD_PROMPT/PAYING/VERIFYING: No audio
 * - PLAYING: BGM plays, SFX enabled
 * - PAUSED: BGM paused, SFX enabled
 * - DYING_GLITCH: BGM fades out, glitch zap SFX plays
 * - DYING_FADE: Descending "sad" notes play, then silence
 * 
 * BGM plays ONLY during PLAYING state.
 */

import type { GameState } from './gameConstants';

const STORAGE_KEY = 'snakeAudioPrefs';

interface AudioPrefs {
  bgmMuted: boolean;
  sfxMuted: boolean;
  bgmVolume: number;
  sfxVolume: number;
}

class AudioManager {
  private audioContext: AudioContext | null = null;
  private masterBgmGain: GainNode | null = null;
  private masterSfxGain: GainNode | null = null;
  
  private bgmIntervalId: number | null = null;
  private isBgmPlaying = false;
  private currentGameState: GameState = 'IDLE';
  
  private prefs: AudioPrefs = {
    bgmMuted: false,
    sfxMuted: false,
    bgmVolume: 35,
    sfxVolume: 60,
  };
  
  private noteIndex = 0;
  private bassIndex = 0;
  private beatCount = 0;
  
  private readonly MELODY_NOTES = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33, 659.25];
  private readonly BASS_NOTES = [65.41, 73.42, 82.41, 98.00, 110.00];
  
  constructor() {
    this.loadPrefs();
  }
  
  // ============ INITIALIZATION ============
  
  private initContext(): boolean {
    if (this.audioContext) return true;
    
    try {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audioContext = new AudioContextClass();
      
      this.masterBgmGain = this.audioContext.createGain();
      this.masterSfxGain = this.audioContext.createGain();
      
      this.masterBgmGain.connect(this.audioContext.destination);
      this.masterSfxGain.connect(this.audioContext.destination);
      
      this.updateGains();
      return true;
    } catch (e) {
      console.warn('WebAudio not supported:', e);
      return false;
    }
  }
  
  private resumeContext(): void {
    if (this.audioContext?.state === 'suspended') {
      this.audioContext.resume();
    }
  }
  
  // ============ PREFERENCES ============
  
  private loadPrefs(): void {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        this.prefs = { ...this.prefs, ...parsed };
      }
    } catch { /* ignore */ }
  }
  
  private savePrefs(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.prefs));
    } catch { /* ignore */ }
  }
  
  private updateGains(): void {
    if (this.masterBgmGain) {
      const vol = this.prefs.bgmMuted ? 0 : (this.prefs.bgmVolume / 100) * 0.35;
      this.masterBgmGain.gain.setValueAtTime(vol, this.audioContext?.currentTime || 0);
    }
    if (this.masterSfxGain) {
      const vol = this.prefs.sfxMuted ? 0 : (this.prefs.sfxVolume / 100) * 0.5;
      this.masterSfxGain.gain.setValueAtTime(vol, this.audioContext?.currentTime || 0);
    }
  }
  
  // ============ PUBLIC PREFERENCE API ============
  
  getPrefs(): AudioPrefs { return { ...this.prefs }; }
  
  setBgmVolume(volume: number): void {
    this.prefs.bgmVolume = Math.max(0, Math.min(100, volume));
    this.updateGains();
    this.savePrefs();
  }
  
  setSfxVolume(volume: number): void {
    this.prefs.sfxVolume = Math.max(0, Math.min(100, volume));
    this.updateGains();
    this.savePrefs();
  }
  
  toggleBgmMute(): boolean {
    this.prefs.bgmMuted = !this.prefs.bgmMuted;
    this.updateGains();
    this.savePrefs();
    return this.prefs.bgmMuted;
  }
  
  toggleSfxMute(): boolean {
    this.prefs.sfxMuted = !this.prefs.sfxMuted;
    this.updateGains();
    this.savePrefs();
    return this.prefs.sfxMuted;
  }
  
  // ============ GAME STATE MANAGEMENT ============
  
  setGameState(state: GameState): void {
    const previousState = this.currentGameState;
    this.currentGameState = state;
    
    console.log(`🎮 Audio: ${previousState} -> ${state}`);
    
    if (state === 'PLAYING') {
      if (previousState === 'PAUSED') {
        this.resumeBgm();
      } else if (previousState !== 'PLAYING') {
        this.startBgm();
      }
    } else if (state === 'PAUSED') {
      this.pauseBgm();
    } else if (state === 'DYING_GLITCH') {
      // Start of death: fade BGM quickly, play glitch zap
      this.stopBgm(250);
      this.playGlitchZap();
    } else if (state === 'DYING_FADE') {
      // Fade phase: play sad descending notes
      this.playSadNotes();
    } else {
      // IDLE, PAYWALL, DEAD_PROMPT, PAYING, VERIFYING
      this.stopBgm(0);
    }
  }
  
  getGameState(): GameState { return this.currentGameState; }
  
  // ============ BACKGROUND MUSIC ============
  
  startBgm(): void {
    if (this.isBgmPlaying) return;
    if (this.currentGameState !== 'PLAYING') return;
    
    if (!this.initContext()) return;
    this.resumeContext();
    
    this.noteIndex = 0;
    this.bassIndex = 0;
    this.beatCount = 0;
    
    this.bgmIntervalId = window.setInterval(() => this.playBeat(), 180);
    this.isBgmPlaying = true;
  }
  
  pauseBgm(): void {
    if (this.bgmIntervalId) {
      clearInterval(this.bgmIntervalId);
      this.bgmIntervalId = null;
    }
  }
  
  resumeBgm(): void {
    if (!this.isBgmPlaying || this.bgmIntervalId) return;
    this.bgmIntervalId = window.setInterval(() => this.playBeat(), 180);
  }
  
  stopBgm(fadeMs = 0): void {
    if (!this.isBgmPlaying) return;
    
    if (this.bgmIntervalId) {
      if (fadeMs > 0 && this.masterBgmGain && this.audioContext) {
        const now = this.audioContext.currentTime;
        this.masterBgmGain.gain.setValueAtTime(this.masterBgmGain.gain.value, now);
        this.masterBgmGain.gain.linearRampToValueAtTime(0, now + fadeMs / 1000);
        
        setTimeout(() => {
          if (this.bgmIntervalId) {
            clearInterval(this.bgmIntervalId);
            this.bgmIntervalId = null;
          }
          this.isBgmPlaying = false;
          this.updateGains();
        }, fadeMs);
      } else {
        clearInterval(this.bgmIntervalId);
        this.bgmIntervalId = null;
        this.isBgmPlaying = false;
      }
    }
  }
  
  private playBeat(): void {
    if (!this.audioContext || !this.masterBgmGain || this.prefs.bgmMuted) return;
    if (this.currentGameState !== 'PLAYING') {
      this.stopBgm(0);
      return;
    }
    
    if (this.beatCount % 2 === 0) {
      const note = this.MELODY_NOTES[this.noteIndex % this.MELODY_NOTES.length];
      this.playTone(note, 0.12, 'square', this.masterBgmGain, 0.07);
      this.noteIndex = (this.noteIndex + Math.floor(Math.random() * 3) + 1) % this.MELODY_NOTES.length;
    }
    
    if (this.beatCount % 4 === 0) {
      const bass = this.BASS_NOTES[this.bassIndex % this.BASS_NOTES.length];
      this.playTone(bass, 0.25, 'triangle', this.masterBgmGain, 0.1);
      this.bassIndex = (this.bassIndex + 1) % this.BASS_NOTES.length;
    }
    
    if (this.beatCount % 2 === 1) {
      this.playNoise(0.04, 0.025, this.masterBgmGain);
    }
    
    if (this.beatCount % 8 === 0) {
      this.playKick(this.masterBgmGain);
    }
    
    this.beatCount = (this.beatCount + 1) % 16;
  }
  
  // ============ DEATH SOUND EFFECTS ============
  
  /**
   * Glitch zap sound - quick digital noise burst
   * Plays during the glitch phase
   */
  playGlitchZap(): void {
    if (!this.initContext()) return;
    this.resumeContext();
    if (!this.audioContext || !this.masterSfxGain || this.prefs.sfxMuted) return;
    
    const ctx = this.audioContext;
    const now = ctx.currentTime;
    
    // Quick noise burst (glitch)
    const bufferSize = ctx.sampleRate * 0.08;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    
    for (let i = 0; i < bufferSize; i++) {
      // Harsh digital noise with random clipping
      const noise = Math.random() * 2 - 1;
      data[i] = Math.sign(noise) * Math.pow(Math.abs(noise), 0.3) * (1 - i / bufferSize);
    }
    
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.25, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
    
    // Bandpass filter for digital sound
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(2000, now);
    filter.Q.setValueAtTime(2, now);
    
    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.masterSfxGain);
    noise.start(now);
    
    // Add a quick pitch-shifted beep
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(200, now + 0.06);
    oscGain.gain.setValueAtTime(0.12, now);
    oscGain.gain.exponentialRampToValueAtTime(0.01, now + 0.06);
    osc.connect(oscGain);
    oscGain.connect(this.masterSfxGain);
    osc.start(now);
    osc.stop(now + 0.06);
  }
  
  /**
   * Sad descending notes - "wah-wah" style
   * Plays during the fade phase
   */
  playSadNotes(): void {
    if (!this.initContext()) return;
    this.resumeContext();
    if (!this.audioContext || !this.masterSfxGain || this.prefs.sfxMuted) return;
    
    const ctx = this.audioContext;
    const now = ctx.currentTime;
    
    // Descending minor notes with vibrato
    const notes = [392, 349.23, 293.66]; // G4, F4, D4 (sad minor feel)
    const durations = [0.22, 0.22, 0.35];
    
    let time = now + 0.05; // Small delay after glitch
    
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const vibrato = ctx.createOscillator();
      const vibratoGain = ctx.createGain();
      
      // Main tone
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, time);
      
      // Add slight pitch bend down
      osc.frequency.exponentialRampToValueAtTime(freq * 0.92, time + durations[i]);
      
      // Vibrato
      vibrato.type = 'sine';
      vibrato.frequency.setValueAtTime(5, time);
      vibratoGain.gain.setValueAtTime(freq * 0.02, time);
      vibrato.connect(vibratoGain);
      vibratoGain.connect(osc.frequency);
      
      // Volume envelope
      const volume = i === 2 ? 0.18 : 0.15;
      gain.gain.setValueAtTime(0, time);
      gain.gain.linearRampToValueAtTime(volume, time + 0.02);
      gain.gain.setValueAtTime(volume, time + durations[i] * 0.6);
      gain.gain.exponentialRampToValueAtTime(0.01, time + durations[i]);
      
      osc.connect(gain);
      gain.connect(this.masterSfxGain);
      
      vibrato.start(time);
      vibrato.stop(time + durations[i]);
      osc.start(time);
      osc.stop(time + durations[i]);
      
      time += durations[i] * 0.85; // Slight overlap
    });
  }
  
  // ============ OTHER SOUND EFFECTS ============
  
  playEat(): void {
    if (!this.initContext()) return;
    if (!this.audioContext || !this.masterSfxGain || this.prefs.sfxMuted) return;
    
    this.playTone(523.25, 0.06, 'square', this.masterSfxGain, 0.12);
    setTimeout(() => this.playTone(659.25, 0.06, 'square', this.masterSfxGain!, 0.12), 40);
  }
  
  playBonus(): void {
    if (!this.initContext()) return;
    if (!this.audioContext || !this.masterSfxGain || this.prefs.sfxMuted) return;
    
    this.playTone(523.25, 0.06, 'square', this.masterSfxGain, 0.15);
    setTimeout(() => this.playTone(659.25, 0.06, 'square', this.masterSfxGain!, 0.15), 50);
    setTimeout(() => this.playTone(783.99, 0.1, 'square', this.masterSfxGain!, 0.15), 100);
  }
  
  playSparkle(): void {
    if (!this.initContext()) return;
    if (!this.audioContext || !this.masterSfxGain || this.prefs.sfxMuted) return;
    
    const ctx = this.audioContext;
    const now = ctx.currentTime;
    
    for (let i = 0; i < 3; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800 + i * 200 + Math.random() * 100, now + i * 0.03);
      gain.gain.setValueAtTime(0.05, now + i * 0.03);
      gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.03 + 0.08);
      osc.connect(gain);
      gain.connect(this.masterSfxGain);
      osc.start(now + i * 0.03);
      osc.stop(now + i * 0.03 + 0.08);
    }
  }
  
  // ============ AUDIO PRIMITIVES ============
  
  private playTone(frequency: number, duration: number, type: OscillatorType, destination: GainNode, volume: number): void {
    if (!this.audioContext) return;
    
    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();
    
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
    
    gain.gain.setValueAtTime(volume, this.audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);
    
    osc.connect(gain);
    gain.connect(destination);
    
    osc.start();
    osc.stop(this.audioContext.currentTime + duration);
  }
  
  private playNoise(duration: number, volume: number, destination: GainNode): void {
    if (!this.audioContext) return;
    
    const bufferSize = this.audioContext.sampleRate * duration;
    const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
    const data = buffer.getChannelData(0);
    
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    
    const noise = this.audioContext.createBufferSource();
    noise.buffer = buffer;
    
    const gain = this.audioContext.createGain();
    gain.gain.setValueAtTime(volume, this.audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);
    
    const filter = this.audioContext.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(8000, this.audioContext.currentTime);
    
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(destination);
    
    noise.start();
  }
  
  private playKick(destination: GainNode): void {
    if (!this.audioContext) return;
    
    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, this.audioContext.currentTime);
    osc.frequency.exponentialRampToValueAtTime(40, this.audioContext.currentTime + 0.1);
    
    gain.gain.setValueAtTime(0.2, this.audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.12);
    
    osc.connect(gain);
    gain.connect(destination);
    
    osc.start();
    osc.stop(this.audioContext.currentTime + 0.12);
  }
  
  // ============ CLEANUP ============
  
  stopAll(): void {
    this.stopBgm(0);
  }
  
  isBgmActive(): boolean {
    return this.isBgmPlaying;
  }
}

// ============ SINGLETON INSTANCE ============
const audioManager = new AudioManager();

export const setGameState = (state: GameState) => audioManager.setGameState(state);
export const getGameState = () => audioManager.getGameState();
export const startBgm = () => audioManager.startBgm();
export const stopBgm = (fadeMs?: number) => audioManager.stopBgm(fadeMs);
export const stopAll = () => audioManager.stopAll();
export const playGlitchZap = () => audioManager.playGlitchZap();
export const playSadNotes = () => audioManager.playSadNotes();
export const playEat = () => audioManager.playEat();
export const playBonus = () => audioManager.playBonus();
export const playSparkle = () => audioManager.playSparkle();
export const isBgmActive = () => audioManager.isBgmActive();

export const getPrefs = () => audioManager.getPrefs();
export const setBgmVolume = (v: number) => audioManager.setBgmVolume(v);
export const setSfxVolume = (v: number) => audioManager.setSfxVolume(v);
export const toggleBgmMute = () => audioManager.toggleBgmMute();
export const toggleSfxMute = () => audioManager.toggleSfxMute();

export { audioManager };
