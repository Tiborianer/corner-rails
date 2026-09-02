export class AudioBus {
  private context: AudioContext | null = null;
  private muted = true;
  private pendingThunder = new Set<number>();

  get isMuted() {
    return this.muted;
  }

  async setMuted(muted: boolean) {
    this.muted = muted;
    if (muted) this.cancelThunder();
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

  thunder(delaySeconds: number) {
    if (this.muted || !this.context) return;
    const timer = window.setTimeout(() => {
      this.pendingThunder.delete(timer);
      this.playThunder();
    }, Math.max(0, delaySeconds) * 1_000);
    this.pendingThunder.add(timer);
  }

  cancelThunder() {
    this.pendingThunder.forEach((timer) => window.clearTimeout(timer));
    this.pendingThunder.clear();
  }

  private playThunder() {
    if (this.muted || !this.context) return;
    const context = this.context;
    const duration = 2.2;
    const sampleCount = Math.floor(context.sampleRate * duration);
    const buffer = context.createBuffer(1, sampleCount, context.sampleRate);
    const channel = buffer.getChannelData(0);
    let noiseSeed = 0x51f15e;
    for (let index = 0; index < sampleCount; index += 1) {
      noiseSeed = (Math.imul(noiseSeed, 1_664_525) + 1_013_904_223) >>> 0;
      const noise = (noiseSeed / 4_294_967_296) * 2 - 1;
      const time = index / context.sampleRate;
      channel[index] = noise * Math.exp(-time * 1.45) * (0.7 + 0.3 * Math.sin(time * 19));
    }
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    const now = context.currentTime;
    source.buffer = buffer;
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(340, now);
    filter.frequency.exponentialRampToValueAtTime(90, now + duration);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.11, now + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    source.connect(filter).connect(gain).connect(context.destination);
    source.start(now);
  }
}
