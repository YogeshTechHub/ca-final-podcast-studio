/**
 * CA Final Study Player & Canvas Waveform Visualizer
 * Provides:
 * - High-DPI Canvas waveform rendering
 * - Interactive click-to-scrub
 * - Playback speed controls (1.0x, 1.25x, 1.5x, 2.0x)
 * - ±10s jump controls
 * - Real-time turn synchronizer (highlights current speaker turn in UI)
 */

class AudioPlayerVisualizer {
  constructor(canvasElement, audioElement, options = {}) {
    this.canvas = canvasElement;
    this.audio = audioElement;
    this.ctx = canvasElement ? canvasElement.getContext('2d') : null;
    this.options = Object.assign({
      waveformColor: "#4f46e5",       // Indigo-600
      progressColor: "#10b981",       // Emerald-500
      cursorColor: "#f59e0b",         // Amber-500
      backgroundColor: "#0f172a",     // Slate-900
      barWidth: 3,
      barGap: 1.5
    }, options);

    this.audioBuffer = null;
    this.peaks = [];
    this.timeline = []; // [{ turnId, startTime, endTime, speaker }]
    this.onTurnActive = options.onTurnActive || (() => {});
    this.isDragging = false;
    this.activeTurnId = null;

    this._bindEvents();
  }

  /**
   * Loads an AudioBuffer and generates waveform peaks
   * @param {AudioBuffer} audioBuffer 
   * @param {Array<Object>} timeline 
   */
  loadBuffer(audioBuffer, timeline = []) {
    this.audioBuffer = audioBuffer;
    this.timeline = timeline;
    this._computePeaks();
    this.draw();
  }

  _bindEvents() {
    if (!this.canvas) return;

    // Canvas click & scrub
    this.canvas.addEventListener('click', (e) => this._handleScrub(e));
    this.canvas.addEventListener('mousedown', (e) => {
      this.isDragging = true;
      this._handleScrub(e);
    });
    window.addEventListener('mousemove', (e) => {
      if (this.isDragging) this._handleScrub(e);
    });
    window.addEventListener('mouseup', () => {
      this.isDragging = false;
    });

    // Audio timeupdate
    this.audio.addEventListener('timeupdate', () => {
      this.draw();
      this._updateActiveTurn();
    });

    // Resize observer for responsive canvas
    window.addEventListener('resize', () => {
      this._resizeCanvas();
      this._computePeaks();
      this.draw();
    });

    this._resizeCanvas();
  }

  _resizeCanvas() {
    if (!this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = (rect.width || 600) * dpr;
    this.canvas.height = (rect.height || 100) * dpr;
    if (this.ctx) {
      this.ctx.scale(dpr, dpr);
    }
  }

  _computePeaks() {
    if (!this.audioBuffer || !this.canvas) return;
    const channelData = this.audioBuffer.getChannelData(0);
    const rect = this.canvas.getBoundingClientRect();
    const width = rect.width || 600;
    const totalBars = Math.floor(width / (this.options.barWidth + this.options.barGap));
    const step = Math.floor(channelData.length / totalBars);

    this.peaks = [];
    for (let i = 0; i < totalBars; i++) {
      let min = 1.0;
      let max = -1.0;
      const start = i * step;
      const end = Math.min(start + step, channelData.length);

      for (let j = start; j < end; j++) {
        const val = channelData[j];
        if (val < min) min = val;
        if (val > max) max = val;
      }
      // Peak amplitude height (0.05 to 1.0)
      const peak = Math.max(0.08, Math.max(Math.abs(min), Math.abs(max)));
      this.peaks.push(peak);
    }
  }

  /**
   * Renders the waveform on Canvas
   */
  draw() {
    if (!this.canvas || !this.ctx) return;
    const rect = this.canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    this.ctx.clearRect(0, 0, width, height);

    if (!this.peaks || this.peaks.length === 0) {
      // Draw idle placeholder line
      this.ctx.fillStyle = "#334155";
      this.ctx.fillRect(0, height / 2 - 1, width, 2);
      return;
    }

    const duration = this.audio.duration || 1;
    const currentTime = this.audio.currentTime || 0;
    const progressRatio = Math.min(1, Math.max(0, currentTime / duration));
    const currentBarIdx = Math.floor(progressRatio * this.peaks.length);

    const barWidth = this.options.barWidth;
    const barGap = this.options.barGap;
    const midY = height / 2;

    for (let i = 0; i < this.peaks.length; i++) {
      const x = i * (barWidth + barGap);
      const peakHeight = this.peaks[i] * (height * 0.85);
      const halfHeight = peakHeight / 2;

      // Color based on playback progress
      if (i <= currentBarIdx) {
        this.ctx.fillStyle = this.options.progressColor;
      } else {
        this.ctx.fillStyle = "#475569";
      }

      this._drawRoundedBar(x, midY - halfHeight, barWidth, peakHeight, 2);
    }

    // Draw playhead cursor
    const cursorX = progressRatio * width;
    this.ctx.fillStyle = this.options.cursorColor;
    this.ctx.fillRect(cursorX - 1.5, 0, 3, height);
  }

  _drawRoundedBar(x, y, width, height, radius) {
    this.ctx.beginPath();
    this.ctx.roundRect 
      ? this.ctx.roundRect(x, y, width, height, radius)
      : this.ctx.rect(x, y, width, height);
    this.ctx.fill();
  }

  _handleScrub(event) {
    if (!this.canvas || !this.audio || !this.audio.duration) return;
    const rect = this.canvas.getBoundingClientRect();
    const clientX = event.clientX;
    const offsetX = Math.max(0, Math.min(rect.width, clientX - rect.left));
    const ratio = offsetX / rect.width;
    this.audio.currentTime = ratio * this.audio.duration;
    this.draw();
    this._updateActiveTurn();
  }

  _updateActiveTurn() {
    if (!this.timeline || this.timeline.length === 0) return;
    const currentTime = this.audio.currentTime;

    const currentTurn = this.timeline.find(t => 
      currentTime >= t.startTime && currentTime <= t.endTime
    );

    const turnId = currentTurn ? currentTurn.turnId : null;
    if (turnId !== this.activeTurnId) {
      this.activeTurnId = turnId;
      this.onTurnActive(turnId, currentTurn);
    }
  }

  /**
   * Set playback speed (1.0, 1.25, 1.5, 2.0)
   * @param {number} rate 
   */
  setSpeed(rate) {
    if (this.audio) {
      this.audio.playbackRate = rate;
    }
  }

  /**
   * Jump relative seconds (-10 or +10)
   * @param {number} seconds 
   */
  jump(seconds) {
    if (this.audio) {
      this.audio.currentTime = Math.max(0, Math.min(this.audio.duration || 0, this.audio.currentTime + seconds));
    }
  }
}

window.AudioPlayerVisualizer = AudioPlayerVisualizer;
