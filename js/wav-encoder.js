/**
 * Pure JavaScript 16-bit PCM RIFF WAV Audio Encoder
 * Converts Web Audio API AudioBuffer into standard binary .wav Blob
 */

class WavEncoder {
  /**
   * Encode an AudioBuffer into a WAV Blob
   * @param {AudioBuffer} audioBuffer - Web Audio API AudioBuffer
   * @param {number} [targetSampleRate] - Optional target sample rate
   * @returns {Blob} WAV Audio Blob (audio/wav)
   */
  static encode(audioBuffer) {
    const numChannels = audioBuffer.numberOfChannels;
    const sampleRate = audioBuffer.sampleRate;
    const format = 1; // PCM
    const bitDepth = 16;
    const bytesPerSample = bitDepth / 8;
    const blockAlign = numChannels * bytesPerSample;

    // Interleave channels if stereo, or extract mono
    const length = audioBuffer.length;
    const interleaved = new Float32Array(length * numChannels);

    if (numChannels === 1) {
      interleaved.set(audioBuffer.getChannelData(0));
    } else {
      for (let ch = 0; ch < numChannels; ch++) {
        const channelData = audioBuffer.getChannelData(ch);
        for (let i = 0; i < length; i++) {
          interleaved[i * numChannels + ch] = channelData[i];
        }
      }
    }

    // Convert Float32 (-1.0 to 1.0) to Int16
    const dataByteLength = interleaved.length * bytesPerSample;
    const headerByteLength = 44;
    const totalLength = headerByteLength + dataByteLength;
    const buffer = new ArrayBuffer(totalLength);
    const view = new DataView(buffer);

    // RIFF identifier 'RIFF'
    this._writeString(view, 0, 'RIFF');
    // file length minus RIFF identifier & length = file length - 8
    view.setUint32(4, 36 + dataByteLength, true);
    // 'WAVE'
    this._writeString(view, 8, 'WAVE');
    // 'fmt ' chunk
    this._writeString(view, 12, 'fmt ');
    // SubChunk1Size (16 for PCM)
    view.setUint32(16, 16, true);
    // AudioFormat (1 for PCM)
    view.setUint16(20, format, true);
    // NumChannels
    view.setUint16(22, numChannels, true);
    // SampleRate
    view.setUint32(24, sampleRate, true);
    // ByteRate = SampleRate * NumChannels * BitsPerSample/8
    view.setUint32(28, sampleRate * blockAlign, true);
    // BlockAlign
    view.setUint16(32, blockAlign, true);
    // BitsPerSample
    view.setUint16(34, bitDepth, true);
    // 'data' chunk
    this._writeString(view, 36, 'data');
    // SubChunk2Size
    view.setUint32(40, dataByteLength, true);

    // Write 16-bit PCM audio samples
    let offset = 44;
    for (let i = 0; i < interleaved.length; i++, offset += 2) {
      let s = Math.max(-1, Math.min(1, interleaved[i]));
      // 16-bit signed integer range: -32768 to 32767
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }

    return new Blob([buffer], { type: 'audio/wav' });
  }

  static _writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  /**
   * Helper to convert Blob to Base64 string for webhook sync
   * @param {Blob} blob 
   * @returns {Promise<string>}
   */
  static blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        // Strip data:audio/wav;base64, prefix
        const base64 = reader.result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
}

window.WavEncoder = WavEncoder;
