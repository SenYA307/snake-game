/**
 * Arcade Audio Manager (Singleton)
 * 
 * Manages background music (BGM) and sound effects (SFX) with clear state rules:
 * 
 * GAME STATES:
 * - IDLE: No audio
 * - PLAYING: BGM plays, SFX enabled
 * - DEAD: Explosion SFX plays once, then silence
 * - PAYWALL: No audio
 * 
 * BGM plays ONLY during PLAYING state.
 * On death: fade out BGM, play explosion, remain silent until new paid run.
 * 
 * Uses WebAudio API for procedural sound generation (no external files needed).
 */

import type { GameState } from './gameConstants';

// ============ STORAGE ============
const STORAGE_KEY = 'snakeAudioPrefs';

interface AudioPrefs {
  bgmMuted: boolean;
  sfxMuted: boolean;
  bgmVolume: number;  // 0-100
  sfxVolume: number;  // 0-100
}

// ============ SINGLETON STATE ============
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
    bgmVolume: 40,
    sfxVolume: 70,
  };
  
  // Melody configuration
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
      
      // Create separate gain nodes for BGM and SFX
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
    } catch {
      // Ignore
    }
  }
  
  private savePrefs(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.prefs));
    } catch {
      // Ignore
    }
  }
  
  private updateGains(): void {
    if (this.masterBgmGain) {
      const vol = this.prefs.bgmMuted ? 0 : (this.prefs.bgmVolume / 100) * 0.4;
      this.masterBgmGain.gain.setValueAtTime(vol, this.audioContext?.currentTime || 0);
    }
    if (this.masterSfxGain) {
      const vol = this.prefs.sfxMuted ? 0 : (this.prefs.sfxVolume / 100) * 0.6;
      this.masterSfxGain.gain.setValueAtTime(vol, this.audioContext?.currentTime || 0);
    }
  }
  
  // ============ PUBLIC PREFERENCE API ============
  
  getPrefs(): AudioPrefs {
    return { ...this.prefs };
  }
  
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
  
  /**
   * Set the current game state. Audio responds accordingly.
   * - IDLE/PAYWALL: Stop all audio
   * - PLAYING: Start BGM (if not muted)
   * - DEAD: Stop BGM, play explosion
   */
  setGameState(state: GameState): void {
    const previousState = this.currentGameState;
    this.currentGameState = state;
    
    console.log(`🎮 Audio state: ${previousState} -> ${state}`);
    
    if (state === 'PLAYING' && previousState !== 'PLAYING') {
      // Starting a new run - start BGM
      this.startBgm();
    } else if (state === 'DEAD' && previousState === 'PLAYING') {
      // Player died - fade out BGM, play explosion
      this.stopBgm(300);
      this.playExplosion();
    } else if (state === 'IDLE' || state === 'PAYWALL') {
      // Stop everything
      this.stopBgm(0);
    }
  }
  
  getGameState(): GameState {
    return this.currentGameState;
  }
  
  // ============ BACKGROUND MUSIC ============
  
  /**
   * Start background music. Must be called after user gesture.
   */
  startBgm(): void {
    if (this.isBgmPlaying) return;
    if (this.currentGameState !== 'PLAYING') return;
    
    if (!this.initContext()) return;
    this.resumeContext();
    
    // Reset beat counters
    this.noteIndex = 0;
    this.bassIndex = 0;
    this.beatCount = 0;
    
    // Start music loop at 150 BPM (200ms per 8th note)
    this.bgmIntervalId = window.setInterval(() => this.playBeat(), 200);
    this.isBgmPlaying = true;
    
    console.log('🎵 BGM started');
  }
  
  /**
   * Stop background music with optional fade.
   */
  stopBgm(fadeMs = 0): void {
    if (!this.isBgmPlaying) return;
    
    if (this.bgmIntervalId) {
      if (fadeMs > 0 && this.masterBgmGain && this.audioContext) {
        // Fade out
        const now = this.audioContext.currentTime;
        this.masterBgmGain.gain.setValueAtTime(this.masterBgmGain.gain.value, now);
        this.masterBgmGain.gain.linearRampToValueAtTime(0, now + fadeMs / 1000);
        
        // Stop after fade
        setTimeout(() => {
          if (this.bgmIntervalId) {
            clearInterval(this.bgmIntervalId);
            this.bgmIntervalId = null;
          }
          this.isBgmPlaying = false;
          this.updateGains(); // Restore gain value for next time
        }, fadeMs);
      } else {
        clearInterval(this.bgmIntervalId);
        this.bgmIntervalId = null;
        this.isBgmPlaying = false;
      }
    }
    
    console.log('🎵 BGM stopped');
  }
  
  private playBeat(): void {
    if (!this.audioContext || !this.masterBgmGain || this.prefs.bgmMuted) return;
    if (this.currentGameState !== 'PLAYING') {
      this.stopBgm(0);
      return;
    }
    
    // Melody - every other beat
    if (this.beatCount % 2 === 0) {
      const note = this.MELODY_NOTES[this.noteIndex % this.MELODY_NOTES.length];
      this.playTone(note, 0.15, 'square', this.masterBgmGain, 0.08);
      this.noteIndex = (this.noteIndex + Math.floor(Math.random() * 3) + 1) % this.MELODY_NOTES.length;
    }
    
    // Bass - every 4 beats
    if (this.beatCount % 4 === 0) {
      const bass = this.BASS_NOTES[this.bassIndex % this.BASS_NOTES.length];
      this.playTone(bass, 0.3, 'triangle', this.masterBgmGain, 0.12);
      this.bassIndex = (this.bassIndex + 1) % this.BASS_NOTES.length;
    }
    
    // Hi-hat on off-beats
    if (this.beatCount % 2 === 1) {
      this.playNoise(0.05, 0.03, this.masterBgmGain);
    }
    
    // Kick on beat 0 and 8
    if (this.beatCount % 8 === 0) {
      this.playKick(this.masterBgmGain);
    }
    
    this.beatCount = (this.beatCount + 1) % 16;
  }
  
  // ============ SOUND EFFECTS ============
  
  /**
   * Play explosion sound effect (WebAudio generated).
   * Noise burst with pitch drop - classic arcade explosion.
   */
  playExplosion(): void {
    if (!this.initContext()) return;
    this.resumeContext();
    if (!this.audioContext || !this.masterSfxGain || this.prefs.sfxMuted) return;
    
    const ctx = this.audioContext;
    const now = ctx.currentTime;
    
    // === Layer 1: Low frequency rumble ===
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(150, now);
    osc1.frequency.exponentialRampToValueAtTime(30, now + 0.5);
    gain1.gain.setValueAtTime(0.4, now);
    gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
    osc1.connect(gain1);
    gain1.connect(this.masterSfxGain);
    osc1.start(now);
    osc1.stop(now + 0.5);
    
    // === Layer 2: Noise burst ===
    const bufferSize = ctx.sampleRate * 0.4;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 2);
    }
    
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.5, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
    
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(4000, now);
    filter.frequency.exponentialRampToValueAtTime(200, now + 0.4);
    
    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.masterSfxGain);
    noise.start(now);
    
    // === Layer 3: Multiple crackle pops ===
    for (let i = 0; i < 5; i++) {
      const delay = i * 0.05 + Math.random() * 0.03;
      const pop = ctx.createOscillator();
      const popGain = ctx.createGain();
      pop.type = 'square';
      pop.frequency.setValueAtTime(200 - i * 30, now + delay);
      pop.frequency.exponentialRampToValueAtTime(50, now + delay + 0.1);
      popGain.gain.setValueAtTime(0.15, now + delay);
      popGain.gain.exponentialRampToValueAtTime(0.01, now + delay + 0.1);
      pop.connect(popGain);
      popGain.connect(this.masterSfxGain);
      pop.start(now + delay);
      pop.stop(now + delay + 0.1);
    }
    
    console.log('💥 Explosion SFX played');
  }
  
  /**
   * Play "eat food" sound effect.
   */
  playEat(): void {
    if (!this.initContext()) return;
    if (!this.audioContext || !this.masterSfxGain || this.prefs.sfxMuted) return;
    
    this.playTone(523.25, 0.08, 'square', this.masterSfxGain, 0.15);
    setTimeout(() => this.playTone(659.25, 0.08, 'square', this.masterSfxGain!, 0.15), 50);
  }
  
  /**
   * Play "bonus food" sound effect.
   */
  playBonus(): void {
    if (!this.initContext()) return;
    if (!this.audioContext || !this.masterSfxGain || this.prefs.sfxMuted) return;
    
    this.playTone(523.25, 0.08, 'square', this.masterSfxGain, 0.2);
    setTimeout(() => this.playTone(659.25, 0.08, 'square', this.masterSfxGain!, 0.2), 60);
    setTimeout(() => this.playTone(783.99, 0.12, 'square', this.masterSfxGain!, 0.2), 120);
  }
  
  // ============ AUDIO PRIMITIVES ============
  
  private playTone(
    frequency: number, 
    duration: number, 
    type: OscillatorType,
    destination: GainNode,
    volume: number
  ): void {
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
    
    gain.gain.setValueAtTime(0.25, this.audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.15);
    
    osc.connect(gain);
    gain.connect(destination);
    
    osc.start();
    osc.stop(this.audioContext.currentTime + 0.15);
  }
  
  // ============ CLEANUP ============
  
  /**
   * Stop all audio. Call on component unmount.
   */
  stopAll(): void {
    this.stopBgm(0);
    console.log('🔇 All audio stopped');
  }
  
  /**
   * Check if BGM is currently playing.
   */
  isBgmActive(): boolean {
    return this.isBgmPlaying;
  }
}

// ============ SINGLETON INSTANCE ============
const audioManager = new AudioManager();

// Export instance methods
export const setGameState = (state: GameState) => audioManager.setGameState(state);
export const getGameState = () => audioManager.getGameState();
export const startBgm = () => audioManager.startBgm();
export const stopBgm = (fadeMs?: number) => audioManager.stopBgm(fadeMs);
export const stopAll = () => audioManager.stopAll();
export const playExplosion = () => audioManager.playExplosion();
export const playEat = () => audioManager.playEat();
export const playBonus = () => audioManager.playBonus();
export const isBgmActive = () => audioManager.isBgmActive();

export const getPrefs = () => audioManager.getPrefs();
export const setBgmVolume = (v: number) => audioManager.setBgmVolume(v);
export const setSfxVolume = (v: number) => audioManager.setSfxVolume(v);
export const toggleBgmMute = () => audioManager.toggleBgmMute();
export const toggleSfxMute = () => audioManager.toggleSfxMute();

// Export manager for direct access if needed
export { audioManager };
