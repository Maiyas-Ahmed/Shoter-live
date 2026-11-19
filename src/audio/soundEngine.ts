import type { WeaponId } from '../game/rules';

class TacticalSoundEngine {
  private ctx: AudioContext | null = null;
  private muted = false;

  public isMuted(): boolean {
    return this.muted;
  }

  public setMuted(m: boolean): void {
    this.muted = m;
  }

  public toggleMute(): boolean {
    this.muted = !this.muted;
    return this.muted;
  }

  private ensureContext(): AudioContext | null {
    if (this.muted || typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private playNoiseBurst(duration: number, filterFreq: number, gainPeak: number, q = 1): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const sampleCount = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, sampleCount, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < sampleCount; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (sampleCount * 0.35));
    }

    const src = ctx.createBufferSource();
    src.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = filterFreq;
    filter.Q.value = q;

    const gain = ctx.createGain();
    const now = ctx.currentTime;
    gain.gain.setValueAtTime(gainPeak, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start(now);
  }

  public playGunshot(weaponId: WeaponId): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const jitter = 0.92 + Math.random() * 0.16;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    if (weaponId === 'mp40') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(280 * jitter, now);
      osc.frequency.exponentialRampToValueAtTime(75, now + 0.065);
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
      this.playNoiseBurst(0.06, 1700 * jitter, 0.22);
    } else if (weaponId === 'ak47') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(210 * jitter, now);
      osc.frequency.exponentialRampToValueAtTime(52, now + 0.11);
      gain.gain.setValueAtTime(0.26, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      this.playNoiseBurst(0.11, 1100 * jitter, 0.3);
    } else if (weaponId === 'm1887') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(140 * jitter, now);
      osc.frequency.exponentialRampToValueAtTime(34, now + 0.18);
      gain.gain.setValueAtTime(0.32, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.19);
      this.playNoiseBurst(0.2, 650 * jitter, 0.36, 0.7);
    } else {
      // AWM sniper resonant crack
      osc.type = 'square';
      osc.frequency.setValueAtTime(360 * jitter, now);
      osc.frequency.exponentialRampToValueAtTime(42, now + 0.24);
      gain.gain.setValueAtTime(0.28, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      this.playNoiseBurst(0.25, 2200 * jitter, 0.34, 0.9);
    }

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.28);
  }

  public playHitMarker(isHeadshot: boolean): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = isHeadshot ? 'sine' : 'triangle';
    osc.frequency.setValueAtTime(isHeadshot ? 1480 : 720, now);
    osc.frequency.exponentialRampToValueAtTime(isHeadshot ? 2100 : 480, now + 0.08);
    gain.gain.setValueAtTime(isHeadshot ? 0.24 : 0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.1);
  }

  public playHurt(): void {
    this.playNoiseBurst(0.09, 320, 0.22, 0.8);
  }

  public playGlooDeploy(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(190, now);
    osc.frequency.exponentialRampToValueAtTime(620, now + 0.14);
    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.18);
  }

  public playReload(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(540, now);
    osc.frequency.setValueAtTime(790, now + 0.08);
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.15);
  }

  public playFootstep(): void {
    const jitter = 0.92 + Math.random() * 0.16;
    this.playNoiseBurst(0.045, 240 * jitter, 0.06, 1.4);
  }

  public playRoundEnd(won: boolean): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const notes = won ? [440, 554.37, 659.25, 880] : [392, 349.23, 293.66];
    notes.forEach((freq, idx) => {
      const now = ctx.currentTime + idx * 0.09;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = won ? 'triangle' : 'sawtooth';
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.26);
    });
  }
}

export const soundEngine = new TacticalSoundEngine();
