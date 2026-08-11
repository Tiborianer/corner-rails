export class AudioBus {
  private context: AudioContext | null = null;
  private muted = true;

  get isMuted() {
    return this.muted;
  }

  async setMuted(muted: boolean) {
    this.muted = muted;
    if (!muted) {
      this.context ??= new AudioContext();
      await this.context.resume();
      this.tone(520, 0.08, "sine", 0.035);
      window.setTimeout(() => this.tone(740, 0.12, "sine", 0.028), 80);
    }
  }

  tone(frequency: number, duration: number, type: OscillatorType = "sine", volume = 0.035) {
    if (this.muted || !this.context) return;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    const now = this.context.currentTime;
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain).connect(this.context.destination);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.02);
  }

  approach(style: string) {
    if (style === "steam") {
      this.tone(180, 0.3, "sawtooth", 0.045);
      window.setTimeout(() => this.tone(260, 0.42, "square", 0.025), 170);
      return;
    }
    this.tone(style === "ice" || style === "measurement" ? 420 : 260, 0.24, "triangle", 0.032);
  }

  dwell() {
    this.tone(660, 0.1, "sine", 0.025);
    window.setTimeout(() => this.tone(880, 0.14, "sine", 0.022), 115);
  }

  reward() {
    [420, 560, 760].forEach((frequency, index) =>
      window.setTimeout(() => this.tone(frequency, 0.15, "triangle", 0.03), index * 90),
    );
  }

  clean() {
    this.tone(920, 0.08, "sine", 0.025);
    window.setTimeout(() => this.tone(1_180, 0.12, "sine", 0.022), 75);
  }
}

