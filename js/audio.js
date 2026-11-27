// Синтезатор звуковых эффектов в стиле телестудии «Своя игра» (Web Audio API)

class StudioAudio {
  constructor() {
    this.ctx = null;
    this.muted = localStorage.getItem('si_muted') === '1';
    this.volume = 0.45;
    this.effectAppliedAudio = null;
    this.categoryShotAudioPool = [];
    if (typeof Audio !== 'undefined') this.categoryShotAudioPool.push(this._createCategoryShotAudio());
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    localStorage.setItem('si_muted', this.muted ? '1' : '0');
    if (!this.muted) {
      this.init();
      this.playTick();
    }
    return this.muted;
  }

  _tone(freq, startOffset, duration, type = 'sine', gainPeak = 0.25, slideTo = null) {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime + startOffset;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (slideTo) {
      osc.frequency.exponentialRampToValueAtTime(slideTo, now + duration);
    }

    const peak = gainPeak * this.volume;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(peak, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  playCellOpen() {
    this._tone(523.25, 0, 0.14, 'triangle', 0.3);     // C5
    this._tone(659.25, 0.07, 0.16, 'triangle', 0.32); // E5
    this._tone(783.99, 0.14, 0.26, 'sine', 0.35);     // G5
  }

  _createCategoryShotAudio() {
    const url = new URL('../packs/media/audio/effects/category-hit.wav', import.meta.url).href;
    const audio = new Audio(url);
    audio.preload = 'auto';
    audio.load();
    return audio;
  }

  _playTargetShotToneFallback() {
    this._tone(185, 0, 0.055, 'square', 0.22, 70);
    this._tone(90, 0.035, 0.09, 'sawtooth', 0.14, 42);
  }

  playTargetShot() {
    // Небольшая кинематографичная задержка: вспышка сначала видна, затем приходит резкий звук.
    if (this.muted) return;
    setTimeout(() => {
      if (this.muted) return;
      // Короткий impact из локального SFX-пула, чтобы быстрые выстрелы не обрывали друг друга.
      if (typeof Audio === 'undefined') {
        this._playTargetShotToneFallback();
        return;
      }

      let audio = this.categoryShotAudioPool.find((clip) => clip.paused || clip.ended);
      if (!audio) {
        audio = this._createCategoryShotAudio();
        this.categoryShotAudioPool.push(audio);
      }

      try {
        audio.currentTime = 0;
        audio.volume = Math.min(1, this.volume * 1.35);
        const playback = audio.play();
        if (playback?.catch) playback.catch(() => this._playTargetShotToneFallback());
      } catch (_) {
        this._playTargetShotToneFallback();
      }
    }, 110);
  }

  playBuzzReady() {
    this._tone(880, 0, 0.12, 'sine', 0.22);
    this._tone(1174.66, 0.06, 0.18, 'sine', 0.25);
  }

  playBuzz() {
    this._tone(587.33, 0, 0.12, 'triangle', 0.42);
    this._tone(880, 0.06, 0.28, 'triangle', 0.48);
    this._tone(1174.66, 0.08, 0.26, 'sine', 0.3);
  }

  playFalseStart() {
    this._tone(240, 0, 0.15, 'sawtooth', 0.25, 180);
    this._tone(190, 0.16, 0.22, 'sawtooth', 0.25, 140);
  }

  playCorrect() {
    this._tone(523.25, 0, 0.14, 'triangle', 0.35);
    this._tone(659.25, 0.09, 0.15, 'triangle', 0.35);
    this._tone(783.99, 0.18, 0.18, 'triangle', 0.38);
    this._tone(1046.5, 0.27, 0.42, 'sine', 0.42);
  }

  playWrong() {
    this._tone(311.13, 0, 0.22, 'sawtooth', 0.26, 277.18);
    this._tone(233.08, 0.2, 0.4, 'sawtooth', 0.28, 196.0);
  }

  playCat() {
    // Игривая загадочная музыкальная фраза «Кот в мешке»
    const notes = [440, 523.25, 659.25, 622.25, 659.25, 880];
    const times = [0, 0.11, 0.22, 0.34, 0.46, 0.6];
    notes.forEach((n, idx) => {
      this._tone(n, times[idx], idx === notes.length - 1 ? 0.42 : 0.14, 'triangle', 0.36);
    });
  }

  playAuction() {
    // Торжественная фанфара «Вопрос-аукцион»
    this._tone(392.0, 0, 0.14, 'sawtooth', 0.24);
    this._tone(523.25, 0.12, 0.14, 'sawtooth', 0.26);
    this._tone(659.25, 0.24, 0.16, 'sawtooth', 0.28);
    this._tone(783.99, 0.38, 0.5, 'triangle', 0.4);
    this._tone(523.25, 0.38, 0.5, 'sine', 0.3);
  }

  playNothingPersonal() {
    // Драматичный кинематографичный аккорд «Ничего личного»
    this._tone(146.83, 0, 0.55, 'sawtooth', 0.34, 110.0); // D3 -> A2
    this._tone(220.0, 0.05, 0.48, 'triangle', 0.32);
    this._tone(261.63, 0.12, 0.45, 'triangle', 0.32);
    this._tone(440.0, 0.22, 0.42, 'sine', 0.36, 415.3);
  }

  playZeroedOut() {
    // Звук «сгорания / обнуления» чужого счёта
    this._tone(587.33, 0, 0.12, 'sawtooth', 0.3, 392.0);
    this._tone(392.0, 0.11, 0.15, 'sawtooth', 0.32, 220.0);
    this._tone(220.0, 0.24, 0.42, 'sawtooth', 0.36, 98.0);
  }

  playSabotage() {
    // Озорной джингла-аккорд пакости / модификатора
    this._tone(311.13, 0, 0.13, 'square', 0.22);
    this._tone(369.99, 0.11, 0.13, 'square', 0.22);
    this._tone(415.3, 0.22, 0.15, 'square', 0.24);
    this._tone(622.25, 0.35, 0.35, 'triangle', 0.32, 466.16);
  }

  playEffectApplied() {
    if (this.muted || typeof Audio === 'undefined') return;
    if (!this.effectAppliedAudio) {
      const url = new URL('../packs/media/audio/effects/faaah.mp3', import.meta.url).href;
      this.effectAppliedAudio = new Audio(url);
      this.effectAppliedAudio.preload = 'auto';
    }
    try {
      this.effectAppliedAudio.pause();
      this.effectAppliedAudio.currentTime = 0;
      this.effectAppliedAudio.volume = this.volume;
      this.effectAppliedAudio.play().catch(() => {});
    } catch (_) {}
  }

  playClownDodge() {
    // Пружинка «Хоба! Мимо!» для убегающей кнопки
    this._tone(280, 0, 0.14, 'sine', 0.34, 780);
    this._tone(520, 0.1, 0.12, 'triangle', 0.28, 960);
  }

  playWipeSqueak() {
    // Скрип протирания запотевшего/грязного стекла
    this._tone(950, 0, 0.07, 'sine', 0.2, 1450);
  }

  playSteal() {
    // Звук кражи монеток «Грабёж / Вампир»
    this._tone(659.25, 0, 0.09, 'triangle', 0.28);
    this._tone(880.0, 0.08, 0.11, 'triangle', 0.32);
    this._tone(1318.5, 0.17, 0.28, 'sine', 0.34);
  }

  playStrikeTheme() {
    this._tone(480, 0, 0.18, 'triangle', 0.28, 220);
  }

  playTick() {
    this._tone(920, 0, 0.05, 'sine', 0.16);
  }

  playTimeUp() {
    this._tone(349.23, 0, 0.22, 'triangle', 0.35);
    this._tone(261.63, 0.22, 0.45, 'triangle', 0.38);
  }

  playRoundStart() {
    const chord = [261.63, 329.63, 392.0, 523.25, 659.25];
    chord.forEach((f, i) => {
      this._tone(f, i * 0.08, 0.45, 'triangle', 0.28);
    });
  }

  playHint() {
    const notes = [587.33, 739.99, 880.0, 1174.66];
    notes.forEach((f, i) => {
      this._tone(f, i * 0.065, 0.28, 'sine', 0.24);
    });
  }

  playVictory() {
    const melody = [
      [523.25, 0, 0.16],
      [659.25, 0.15, 0.16],
      [783.99, 0.3, 0.16],
      [1046.5, 0.46, 0.32],
      [783.99, 0.78, 0.16],
      [1046.5, 0.95, 0.65]
    ];
    melody.forEach(([f, t, d]) => {
      this._tone(f, t, d, 'triangle', 0.36);
      this._tone(f * 0.5, t, d, 'sine', 0.22);
    });
  }
}

export const sound = new StudioAudio();
