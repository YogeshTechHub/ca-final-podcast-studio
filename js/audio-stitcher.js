/**
 * CA Final Audio Stitching Engine
 * Uses Web Audio API (OfflineAudioContext) to concatenate multi-speaker audio buffers,
 * insert natural conversational pauses, normalize gain, and export master WAV blob.
 */

class AudioStitcher {
  constructor(options = {}) {
    this.targetSampleRate = options.sampleRate || window.APP_CONFIG?.DEFAULT_SAMPLE_RATE || 24000;
    this.audioContext = null;
    this._initAudioContext();
  }

  _initAudioContext() {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    try {
      this.audioContext = new AudioCtx({
        sampleRate: this.targetSampleRate
      });
    } catch (e) {
      // Fallback if sampleRate option is unsupported by browser
      try {
        this.audioContext = new AudioCtx();
      } catch (err) {
        console.warn("Could not instantiate AudioContext:", err);
      }
    }
  }

  /**
   * Ensures AudioContext exists and resumes if suspended by browser autoplay policy
   * @returns {Promise<AudioContext>}
   */
  async ensureAudioContext() {
    if (!this.audioContext) {
      this._initAudioContext();
    }
    if (this.audioContext && this.audioContext.state === 'suspended') {
      try {
        await this.audioContext.resume();
      } catch (err) {
        console.warn("AudioContext.resume() deferred until next user interaction:", err);
      }
    }
    return this.audioContext;
  }

  /**
   * Decodes an ArrayBuffer or Blob into an AudioBuffer
   * @param {ArrayBuffer|Blob} audioData 
   * @returns {Promise<AudioBuffer>}
   */
  async decodeAudio(audioData) {
    if (!audioData) {
      throw new Error("No audio data provided for decoding.");
    }

    let arrayBuffer;
    if (audioData instanceof Blob) {
      arrayBuffer = await audioData.arrayBuffer();
    } else {
      arrayBuffer = audioData;
    }

    await this.ensureAudioContext();

    if (!this.audioContext) {
      throw new Error("AudioContext is not available in this browser environment.");
    }

    // arrayBuffer.slice(0) prevents detaching the source buffer in modern engines
    const bufferCopy = arrayBuffer.slice(0);

    return new Promise((resolve, reject) => {
      try {
        const promise = this.audioContext.decodeAudioData(
          bufferCopy,
          (decoded) => resolve(decoded),
          (err) => reject(err || new Error("Failed to decode audio data."))
        );
        if (promise && typeof promise.then === 'function') {
          promise.then(resolve).catch(reject);
        }
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Concatenate an array of audio buffers with configurable pause gaps
   * @param {Array<{ buffer: AudioBuffer, turn: Object }>} items - List of items with audio buffer & turn metadata
   * @param {number} pauseMs - Pause duration between speakers in milliseconds
   * @returns {Promise<{ masterBuffer: AudioBuffer, masterBlob: Blob, timeline: Array<Object>, totalDuration: number }>}
   */
  async stitch(items, pauseMs = 400) {
    const validItems = (items || []).filter(it => it && it.buffer);
    if (validItems.length === 0) {
      throw new Error("No audio buffers provided for stitching.");
    }

    const pauseSec = Math.max(0, pauseMs / 1000);
    const sampleRate = this.audioContext?.sampleRate || this.targetSampleRate;
    const numChannels = 1; // Master speech podcast is high-quality Mono

    // Calculate total duration & timeline offsets
    let currentOffset = 0;
    const timeline = [];

    for (let i = 0; i < validItems.length; i++) {
      const { buffer, turn } = validItems[i];
      const duration = buffer.duration || 0;
      const startTime = currentOffset;
      const endTime = startTime + duration;

      timeline.push({
        turnId: turn?.id || `turn_${i + 1}`,
        speaker: turn?.speaker || "speaker1",
        role: turn?.role || "Speaker",
        text: turn?.rawText || "",
        startTime: startTime,
        endTime: endTime,
        duration: duration
      });

      currentOffset = endTime;
      // Add pause gap after turn if not the final item
      if (i < validItems.length - 1) {
        currentOffset += pauseSec;
      }
    }

    const totalDuration = Math.max(0.1, currentOffset);
    const totalSamples = Math.max(1, Math.ceil(totalDuration * sampleRate));

    // Create OfflineAudioContext for glitch-free offline rendering
    const OfflineCtx = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (!OfflineCtx) {
      throw new Error("OfflineAudioContext is not supported in this browser.");
    }

    const offlineCtx = new OfflineCtx(
      numChannels,
      totalSamples,
      sampleRate
    );

    // Calculate gain normalization per buffer
    // Find target RMS to bring quiet voices in balance with louder voices
    const normalizedGains = this._calculateGains(validItems.map(it => it.buffer));

    // Schedule each buffer onto the offline timeline
    for (let i = 0; i < validItems.length; i++) {
      const { buffer } = validItems[i];
      const timeInfo = timeline[i];
      const gainMultiplier = normalizedGains[i] || 1.0;

      const source = offlineCtx.createBufferSource();
      source.buffer = buffer;

      const gainNode = offlineCtx.createGain();
      gainNode.gain.setValueAtTime(gainMultiplier, timeInfo.startTime);

      source.connect(gainNode);
      gainNode.connect(offlineCtx.destination);

      source.start(timeInfo.startTime);
    }

    // Render the final master buffer
    const masterBuffer = await offlineCtx.startRendering();

    // Encode to 16-bit PCM WAV Blob
    const masterBlob = window.WavEncoder.encode(masterBuffer);

    return {
      masterBuffer,
      masterBlob,
      timeline,
      totalDuration
    };
  }

  /**
   * Calculate gain multipliers to normalize speech volume across different speakers
   * @param {Array<AudioBuffer>} buffers 
   * @returns {Array<number>}
   */
  _calculateGains(buffers) {
    if (!buffers || buffers.length === 0) return [];

    const rmsValues = buffers.map(buf => {
      if (!buf || buf.numberOfChannels === 0 || buf.length === 0) return 0.05;
      const channel = buf.getChannelData(0);
      let sumSq = 0;
      // Sample subset if buffer is long
      const step = Math.max(1, Math.floor(channel.length / 5000));
      let count = 0;
      for (let i = 0; i < channel.length; i += step) {
        sumSq += channel[i] * channel[i];
        count++;
      }
      const rms = count > 0 ? Math.sqrt(sumSq / count) : 0.05;
      return (!isNaN(rms) && rms > 0) ? rms : 0.05;
    });

    const targetRMS = 0.15; // Clean conversational target
    return rmsValues.map(rms => {
      if (!rms || isNaN(rms) || rms <= 0.001) return 1.0;
      const factor = targetRMS / rms;
      // Clamp gain adjustment between 0.6x and 2.2x to prevent clipping
      return Math.max(0.6, Math.min(2.2, factor));
    });
  }
}

window.AudioStitcher = AudioStitcher;
