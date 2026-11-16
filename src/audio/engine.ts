// Звук через Web Audio: mp3/m4a → AudioBuffer → Analyser → динамики.
// Анализатор даёт громкость голоса в полосе 250–3000 Гц — по ней открывается рот Mo.
// На iPad Safari AudioContext можно запустить только из нажатия: unlock() зовём из кнопки «старт».

export interface Segment {
  /** URL файла или null, если озвучки ещё нет (тогда пауза по длине текста). */
  url: string | null;
  text: string;
}

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private bins: Uint8Array<ArrayBuffer> | null = null;
  private buffers = new Map<string, Promise<AudioBuffer | null>>();
  private current: AudioBufferSourceNode | null = null;
  private token = 0;
  private lo = 0;
  private hi = 0;
  speaking = false;

  /** Вызывать из обработчика нажатия. */
  unlock(): void {
    if (!this.ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AC();
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 1024;
      this.analyser.smoothingTimeConstant = 0.35;
      this.analyser.connect(this.ctx.destination);
      this.bins = new Uint8Array(new ArrayBuffer(this.analyser.frequencyBinCount));
      const hz = this.ctx.sampleRate / this.analyser.fftSize;
      this.lo = Math.max(1, Math.floor(250 / hz));
      this.hi = Math.min(this.analyser.frequencyBinCount - 1, Math.ceil(3000 / hz));
      // «пустой» звук, чтобы iOS разрешил дальнейшее воспроизведение
      const b = this.ctx.createBuffer(1, 1, 22050);
      const src = this.ctx.createBufferSource();
      src.buffer = b;
      src.connect(this.ctx.destination);
      src.start(0);
    }
    if (this.ctx.state !== 'running') void this.ctx.resume();
  }

  get unlocked(): boolean {
    return !!this.ctx;
  }

  load(url: string): Promise<AudioBuffer | null> {
    let p = this.buffers.get(url);
    if (!p) {
      p = fetch(url)
        .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
        .then((data) => this.decode(data))
        .catch((e) => {
          console.warn('[audio] не загрузился', url, e);
          this.buffers.delete(url);
          return null;
        });
      this.buffers.set(url, p);
    }
    return p;
  }

  private decode(data: ArrayBuffer): Promise<AudioBuffer> {
    if (!this.ctx) {
      // до unlock() декодируем во временном оффлайн-контексте
      const off = new OfflineAudioContext(1, 1, 44100);
      return off.decodeAudioData(data);
    }
    return this.ctx.decodeAudioData(data);
  }

  preload(urls: (string | null)[]): void {
    for (const u of urls) if (u) void this.load(u);
  }

  stop(): void {
    this.token++;
    if (this.current) {
      try {
        this.current.onended = null;
        this.current.stop();
      } catch {
        /* уже остановлен */
      }
    }
    this.current = null;
    this.speaking = false;
  }

  /**
   * Проиграть сегменты подряд. onSegment(i) — перед i-м сегментом (для подсветки).
   * Возвращает false, если прервано новым play()/stop().
   */
  async play(segs: Segment[], onSegment?: (i: number) => void): Promise<boolean> {
    this.stop();
    const my = this.token;
    const bufs = await Promise.all(segs.map((s) => (s.url ? this.load(s.url) : Promise.resolve(null))));
    if (my !== this.token) return false;
    for (let i = 0; i < segs.length; i++) {
      if (my !== this.token) return false;
      onSegment?.(i);
      const buf = bufs[i];
      if (buf && this.ctx && this.analyser) {
        if (this.ctx.state !== 'running') await this.ctx.resume().catch(() => {});
        await new Promise<void>((resolve) => {
          const src = this.ctx!.createBufferSource();
          src.buffer = buf;
          src.connect(this.analyser!);
          src.onended = () => resolve();
          this.current = src;
          this.speaking = true;
          src.start();
        });
        this.speaking = false;
        if (my !== this.token) return false;
        if (i < segs.length - 1) await wait(90);
      } else {
        // озвучки нет — держим паузу по длине текста, чтобы подпись успели увидеть
        await wait(Math.min(2600, 450 + 55 * segs[i].text.length));
      }
    }
    return my === this.token;
  }

  /** Громкость голоса 0..1 в полосе 250–3000 Гц. */
  level(): number {
    if (!this.analyser || !this.bins || !this.speaking) return 0;
    this.analyser.getByteFrequencyData(this.bins);
    let sum = 0;
    for (let i = this.lo; i <= this.hi; i++) sum += this.bins[i];
    const avg = sum / (this.hi - this.lo + 1);
    return Math.max(0, Math.min(1, (avg - 90) / 100));
  }
}

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
