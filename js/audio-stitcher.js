/**
 * CA Final Audio Stitching Engine
 * Uses Web Audio API (OfflineAudioContext) to concatenate multi-speaker audio buffers,
 * insert natural conversational pauses, normalize gain, and export master WAV blob.
 */

class AudioStitcher {
  constructor(options = {}) {
    this.targetSampleRate = options.sampleRate || window.APP_CONFIG?.DEFAULT_SAMPLE_RATE || 24000;
    this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
      sampleRate: this.targetSampleRate
    });
  }

  /**
   * Decodes an ArrayBuffer or Blob into an AudioBuffer
   * @param {ArrayBuffer|Blob} audioData 
   * @returns {Promise<AudioBuffer>}
   */
  async decodeAudio(audioData) {
    let arrayBuffer;
    if (audioData instanceof Blob) {
      arrayBuffer = await audioData.arrayBuffer();
    } else {
      arrayBuffer = audioData;
    }

    // Ensure audio context is running (browser autoplay policy)
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }

    return await this.audioContext.decodeAudioData(arrayBuffer);
  }

  /**
   * Concatenate an array of audio buffers with configurable pause gaps
   * @param {Array<{ buffer: AudioBuffer, turn: Object }>} items - List of items with audio buffer & turn metadata
   * @param {number} pauseMs - Pause duration between speakers in milliseconds
   * @returns {Promise<{ masterBuffer: AudioBuffer, masterBlob: Blob, timeline: Array<Object>, totalDuration: number }>}
   */
  async stitch(items, pauseMs = 400) {
    if (!items || items.length === 0) {
      throw new Error("No audio buffers provided for stitching.");
    }

    const pauseSec = Math.max(0, pauseMs / 1000);
    const sampleRate = this.targetSampleRate;
    const numChannels = 1; // Master speech podcast is high-quality Mono (or 2 if needed)

    // Calculate total duration & timeline offsets
    let currentOffset = 0;
    const timeline = [];

    for (let i = 0; i < items.length; i++) {
      const { buffer, turn } = items[i];
      const duration = buffer.duration;
      const startTime = currentOffset;
      const endTime = startTime + duration;

      timeline.push({
        turnId: turn.id,
        speaker: turn.speaker,
        role: turn.role,
        text: turn.rawText,
        startTime: startTime,
        endTime: endTime,
        duration: duration
      });

      currentOffset = endTime;
      // Add pause gap after turn if not the final item
      if (i < items.length - 1) {
        currentOffset += pauseSec;
      }
    }

    const totalDuration = currentOffset;
    const totalSamples = Math.ceil(totalDuration * sampleRate);

    // Create OfflineAudioContext for glitch-free offline rendering
    const offlineCtx = new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(
      numChannels,
      totalSamples,
      sampleRate
    );

    // Calculate gain normalization per buffer
    // Find target RMS to bring quiet voices in balance with louder voices
    const normalizedGains = this._calculateGains(items.map(it => it.buffer));

    // Schedule each buffer onto the offline timeline
    for (let i = 0; i < items.length; i++) {
      const { buffer } = items[i];
      const timeInfo = timeline[i];
      const gainMultiplier = normalizedGains[i];

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
    const rmsValues = buffers.map(buf => {
      const channel = buf.getChannelData(0);
      let sumSq = 0;
      // Sample subset if buffer is long
      const step = Math.max(1, Math.floor(channel.length / 5000));
      let count = 0;
      for (let i = 0; i < channel.length; i += step) {
        sumSq += channel[i] * channel[i];
        count++;
      }
      return Math.sqrt(sumSq / count) || 0.05;
    });

    const targetRMS = 0.15; // Clean conversational target
    return rmsValues.map(rms => {
      if (rms <= 0.001) return 1.0;
      const factor = targetRMS / rms;
      // Clamp gain adjustment between 0.6x and 2.2x to prevent clipping
      return Math.max(0.6, Math.min(2.2, factor));
    });
  }
}

window.AudioStitcher = AudioStitcher;
