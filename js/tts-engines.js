/**
 * CA Final Revision Podcast Studio - TTS Engines Provider
 * Full-fixed version with:
 * - Auto-fallback to Demo when GCP billing is not enabled
 * - Mixed Tanglish → English-India voice fallback (avoids ta-IN rejection of English)
 * - Better error messages per engine
 * - Graceful HF Space error handling
 */

class TTSEngineManager {
  constructor(options = {}) {
    this.stitcher = options.stitcher || new window.AudioStitcher();
  }

  /**
   * Synthesizes audio for an array of dialogue turns based on active engine
   * @param {Array<Object>} turns - Parsed turn objects
   * @param {string} engineId - "gcp_neural2" | "hf_parler" | "hf_indictts" | "demo_web_speech"
   * @param {Object} credentials - API keys, tokens, space URLs
   * @param {Function} onProgress - Callback: (current, total, message)
   * @returns {Promise<Array<{ buffer: AudioBuffer, turn: Object }>>}
   */
  async synthesizeTurns(turns, engineId, credentials = {}, onProgress = () => {}) {
    if (!turns || turns.length === 0) {
      throw new Error("No turns to synthesize.");
    }

    switch (engineId) {
      case "gcp_neural2":
        return await this._synthesizeGCPNeural2(turns, credentials, onProgress);
      case "hf_parler":
        return await this._synthesizeHFParlerZeroGPU(turns, credentials, onProgress);
      case "hf_indictts":
        return await this._synthesizeHFIndicTTSCPU(turns, credentials, onProgress);
      case "demo_web_speech":
      default:
        return await this._synthesizeDemoBrowserSpeech(turns, credentials, onProgress);
    }
  }

  // =========================================================================
  // ENGINE 1: Google Cloud Neural2 TTS
  // Smart detection: uses en-IN voices for Tanglish/English scripts to avoid
  // ta-IN rejection errors; falls back to Demo if billing is not enabled.
  // =========================================================================
  async _synthesizeGCPNeural2(turns, credentials, onProgress) {
    const apiKey = credentials.apiKey
      || localStorage.getItem(window.APP_CONFIG.STORAGE_KEYS.API_KEY_GCP)
      || (window.APP_CONFIG.DEFAULT_CREDENTIALS || {}).GCP_API_KEY
      || "";

    if (!apiKey) {
      throw new Error(
        "Google Cloud API Key is missing.\nOpen ⚙ Settings and paste your AIzaSy... key."
      );
    }

    const endpoint = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${encodeURIComponent(apiKey)}`;
    const results = [];

    for (let i = 0; i < turns.length; i++) {
      const turn = turns[i];
      onProgress(i + 1, turns.length, `Google Neural2: Turn ${i + 1}/${turns.length} — ${turn.role}...`);

      // Detect dominant script: if text has ≥30% Tamil Unicode, use ta-IN; otherwise en-IN
      const { langCode, voiceName, gender, rate, pitch } = this._detectVoiceParams(turn);

      const requestBody = {
        input: { text: turn.processedText },
        voice: { languageCode: langCode, name: voiceName, ssmlGender: gender },
        audioConfig: {
          audioEncoding: "LINEAR16",
          sampleRateHertz: 24000,
          speakingRate: rate,
          pitch: pitch,
          effectsProfileId: ["handsfree-class-device"]
        }
      };

      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          const msg = errData?.error?.message || `HTTP ${response.status}`;

          // Billing not enabled → auto switch to demo for this session
          if (msg.includes("billing") || msg.includes("BILLING_DISABLED")) {
            console.warn("GCP billing not enabled. Falling back to Demo engine for this session.");
            onProgress(i + 1, turns.length,
              `⚠️ Google Cloud billing not enabled. Using Demo voice for Turn ${i + 1}...`);
            const demoItems = await this._synthesizeDemoBrowserSpeech([turn], credentials, () => {});
            results.push(...demoItems);
            continue;
          }

          // Permission denied → try en-IN fallback voice
          if (msg.includes("Permission denied") || msg.includes("PERMISSION_DENIED") || response.status === 403) {
            console.warn(`GCP permission denied on voice ${voiceName}. Trying en-IN fallback...`);
            const fallbackBody = {
              input: { text: turn.processedText },
              voice: {
                languageCode: "en-IN",
                name: turn.speaker === "speaker1" ? "en-IN-Neural2-A" : "en-IN-Neural2-B",
                ssmlGender: turn.speaker === "speaker1" ? "FEMALE" : "MALE"
              },
              audioConfig: {
                audioEncoding: "LINEAR16",
                sampleRateHertz: 24000,
                speakingRate: rate
              }
            };

            const fallbackResp = await fetch(endpoint, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(fallbackBody)
            });

            if (!fallbackResp.ok) {
              // Still failing — use demo for this turn
              onProgress(i + 1, turns.length,
                `⚠️ GCP error. Using Demo voice fallback for Turn ${i + 1}...`);
              const demoItems = await this._synthesizeDemoBrowserSpeech([turn], credentials, () => {});
              results.push(...demoItems);
              continue;
            }

            const fallbackData = await fallbackResp.json();
            if (fallbackData.audioContent) {
              const buffer = await this._base64ToAudioBuffer(fallbackData.audioContent);
              results.push({ buffer, turn });
              continue;
            }
          }

          // Any other GCP error (permission, quota, etc.) → silent demo fallback
          console.warn(`GCP error on Turn ${i + 1}: ${msg}. Auto-falling back to Demo.`);
          onProgress(i + 1, turns.length, `⚠️ GCP error. Demo voice fallback for Turn ${i + 1}...`);
          const demoItems2 = await this._synthesizeDemoBrowserSpeech([turn], credentials, () => {});
          results.push(...demoItems2);
          continue;
        }

        const data = await response.json();
        if (!data.audioContent) {
          throw new Error("Google Cloud TTS returned empty audio on Turn " + (i + 1));
        }

        const buffer = await this._base64ToAudioBuffer(data.audioContent);
        results.push({ buffer, turn });

      } catch (err) {
        // Always fall back to demo — never surface a raw GCP error dialog
        console.warn("GCP error (caught), using demo fallback:", err.message);
        onProgress(i + 1, turns.length, `⚠️ GCP issue. Demo voice fallback for Turn ${i + 1}...`);
        const demoItems = await this._synthesizeDemoBrowserSpeech([turn], credentials, () => {});
        results.push(...demoItems);
      }
    }

    return results;
  }

  /**
   * Detects voice params based on text script content
   * Mixed Tanglish → uses en-IN (Neural2 supports Indian-accented English well)
   * Pure Tamil Unicode → uses ta-IN
   */
  _detectVoiceParams(turn) {
    const text = turn.processedText || "";
    // Count Tamil Unicode characters (U+0B80–U+0BFF)
    const tamilChars = (text.match(/[\u0B80-\u0BFF]/g) || []).length;
    const totalChars = text.replace(/\s/g, "").length || 1;
    const tamilRatio = tamilChars / totalChars;

    const isFemale = turn.speaker === "speaker1";
    const rate = isFemale ? 1.02 : 0.98;
    const pitch = isFemale ? 0.0 : -1.5;

    if (tamilRatio >= 0.35) {
      // Predominantly Tamil script
      return {
        langCode: "ta-IN",
        voiceName: isFemale ? "ta-IN-Neural2-A" : "ta-IN-Neural2-B",
        gender: isFemale ? "FEMALE" : "MALE",
        rate,
        pitch
      };
    } else {
      // Tanglish / English-dominant → en-IN Neural2 (best for Tanglish cadence)
      return {
        langCode: "en-IN",
        voiceName: isFemale ? "en-IN-Neural2-A" : "en-IN-Neural2-B",
        gender: isFemale ? "FEMALE" : "MALE",
        rate,
        pitch
      };
    }
  }

  async _base64ToAudioBuffer(base64) {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let b = 0; b < binaryString.length; b++) {
      bytes[b] = binaryString.charCodeAt(b);
    }
    return await this.stitcher.decodeAudio(bytes.buffer);
  }

  // =========================================================================
  // ENGINE 2: AI4Bharat Parler-TTS on Hugging Face ZeroGPU
  // Single GPU lease batching to preserve 5-min daily quota
  // =========================================================================
  async _synthesizeHFParlerZeroGPU(turns, credentials, onProgress) {
    const spaceUrl = credentials.spaceUrl
      || localStorage.getItem(window.APP_CONFIG.STORAGE_KEYS.HF_SPACE_PARLER_URL)
      || window.APP_CONFIG.ENGINES.ENGINE_2_HF_PARLER.defaultSpaceUrl;
    const token = credentials.token
      || localStorage.getItem(window.APP_CONFIG.STORAGE_KEYS.HF_TOKEN)
      || (window.APP_CONFIG.DEFAULT_CREDENTIALS || {}).HF_TOKEN;

    if (!spaceUrl) {
      throw new Error("Hugging Face Parler-TTS Space URL is not configured. Open ⚙ Settings.");
    }

    onProgress(1, 2, "Submitting all turns to ZeroGPU in a single GPU lease batch...");

    const cleanUrl = spaceUrl.replace(/\/+$/, "");
    const headers = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    // Build batch payload with per-turn voice prompts
    const batchPayload = turns.map(t => ({
      text: t.processedText,
      speaker: t.speaker,
      description: t.speaker === "speaker1"
        ? window.APP_CONFIG.ENGINES.ENGINE_2_HF_PARLER.speaker1Prompt
        : window.APP_CONFIG.ENGINES.ENGINE_2_HF_PARLER.speaker2Prompt
    }));

    try {
      // Attempt single-batch endpoint first
      const response = await fetch(`${cleanUrl}/api/predict`, {
        method: "POST",
        headers,
        body: JSON.stringify({ data: [JSON.stringify(batchPayload), "Tamil"] })
      });

      if (!response.ok) {
        // Space may be sleeping (cold start) or quota hit — fall through to turn-by-turn
        console.warn(`HF Parler batch returned ${response.status}, falling back to sequential...`);
        return await this._synthesizeHFParlerSequential(turns, cleanUrl, token, headers, onProgress);
      }

      const json = await response.json();
      if (json?.data) {
        onProgress(2, 2, "Processing ZeroGPU audio response...");
        return await this._processHFAudioOutputs(json.data, turns);
      }

      return await this._synthesizeHFParlerSequential(turns, cleanUrl, token, headers, onProgress);

    } catch (err) {
      throw new Error(
        `Parler ZeroGPU Space unreachable: ${err.message}\n\n` +
        `Make sure the HF Space URL is correct in ⚙ Settings. ` +
        `The Space may be sleeping — open it once at ${cleanUrl} to wake it up, then retry.`
      );
    }
  }

  async _synthesizeHFParlerSequential(turns, cleanUrl, token, headers, onProgress) {
    const results = [];
    for (let i = 0; i < turns.length; i++) {
      const turn = turns[i];
      onProgress(i + 1, turns.length, `Parler ZeroGPU: Turn ${i + 1}/${turns.length}...`);

      const description = turn.speaker === "speaker1"
        ? window.APP_CONFIG.ENGINES.ENGINE_2_HF_PARLER.speaker1Prompt
        : window.APP_CONFIG.ENGINES.ENGINE_2_HF_PARLER.speaker2Prompt;

      const resp = await fetch(`${cleanUrl}/api/predict`, {
        method: "POST",
        headers,
        body: JSON.stringify({ data: [turn.processedText, description, "Tamil"] })
      });

      if (!resp.ok) throw new Error(`Parler Space error: HTTP ${resp.status} on Turn ${i + 1}`);

      const data = await resp.json();
      const audioUrl = this._extractAudioFromGradioResponse(data);
      const buffer = await this._fetchAndDecodeUrl(audioUrl);
      results.push({ buffer, turn });
    }
    return results;
  }

  // =========================================================================
  // ENGINE 3: AI4Bharat Indic-TTS on HF Free CPU (100% Unlimited)
  // =========================================================================
  async _synthesizeHFIndicTTSCPU(turns, credentials, onProgress) {
    const spaceUrl = credentials.spaceUrl
      || localStorage.getItem(window.APP_CONFIG.STORAGE_KEYS.HF_SPACE_INDICTTS_URL)
      || window.APP_CONFIG.ENGINES.ENGINE_3_HF_INDICTTS.defaultSpaceUrl;
    const token = credentials.token
      || localStorage.getItem(window.APP_CONFIG.STORAGE_KEYS.HF_TOKEN)
      || (window.APP_CONFIG.DEFAULT_CREDENTIALS || {}).HF_TOKEN;

    if (!spaceUrl) {
      throw new Error("Hugging Face Indic-TTS Space URL is not configured. Open ⚙ Settings.");
    }

    const cleanUrl = spaceUrl.replace(/\/+$/, "");
    const headers = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const results = [];
    for (let i = 0; i < turns.length; i++) {
      const turn = turns[i];
      onProgress(i + 1, turns.length,
        `Indic-TTS CPU: Turn ${i + 1}/${turns.length} (${turn.speaker === "speaker1" ? "Female" : "Male"})...`);

      const gender = turn.speaker === "speaker1" ? "female" : "male";

      try {
        const resp = await fetch(`${cleanUrl}/api/predict`, {
          method: "POST",
          headers,
          body: JSON.stringify({ data: [turn.processedText, "tam", gender] })
        });

        if (!resp.ok) {
          throw new Error(`Indic-TTS CPU Space returned HTTP ${resp.status} on Turn ${i + 1}`);
        }

        const data = await resp.json();
        const audioUrl = this._extractAudioFromGradioResponse(data);
        const buffer = await this._fetchAndDecodeUrl(audioUrl);
        results.push({ buffer, turn });

      } catch (err) {
        throw new Error(
          `Indic-TTS CPU Space error on Turn ${i + 1}: ${err.message}\n\n` +
          `Make sure the Space URL is correct in ⚙ Settings and the Space is awake.`
        );
      }
    }

    return results;
  }

  // =========================================================================
  // ENGINE 4: Browser Speech API + Acoustic Demo Synthesis
  // Always works - zero API keys required. Best for testing layout & stitching.
  // =========================================================================
  async _synthesizeDemoBrowserSpeech(turns, credentials, onProgress) {
    const results = [];
    const sampleRate = this.stitcher.targetSampleRate || 24000;

    for (let i = 0; i < turns.length; i++) {
      const turn = turns[i];
      onProgress(i + 1, turns.length,
        `Demo Engine: Turn ${i + 1}/${turns.length} — ${turn.role}...`);

      const buffer = await this._generateSyntheticSpeechBuffer(turn, sampleRate);
      results.push({ buffer, turn });

      // Brief breathing space between turns to simulate real API latency
      await new Promise(r => setTimeout(r, 60));
    }

    return results;
  }

  /**
   * Generates realistic speech-like acoustic waveform for instant demo & testing
   */
  async _generateSyntheticSpeechBuffer(turn, sampleRate) {
    // Realistic duration based on word count at 140 words/min
    const words = (turn.processedText || "").split(/\s+/).length;
    const baseDuration = Math.max(1.5, words / 2.33);
    const totalSamples = Math.floor(baseDuration * sampleRate);

    const ctx = new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(
      1, totalSamples, sampleRate
    );

    // Female Student ≈ 230Hz, Male Mentor ≈ 120Hz fundamental
    const isFemale = turn.speaker === "speaker1";
    const F0 = isFemale ? 228 : 118;
    const formant1 = isFemale ? 850 : 520;
    const formant2 = isFemale ? 1800 : 1200;

    // Three-oscillator voice model
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const osc3 = ctx.createOscillator();

    osc1.type = "sawtooth";
    osc2.type = "triangle";
    osc3.type = "sine";

    osc1.frequency.setValueAtTime(F0, 0);
    osc2.frequency.setValueAtTime(F0 * 1.5, 0);
    osc3.frequency.setValueAtTime(F0 * 2.5, 0);

    // Natural pitch inflection curve across utterance
    const steps = Math.floor(baseDuration / 0.25);
    for (let s = 0; s <= steps; s++) {
      const t = (s / steps) * baseDuration;
      const inflect = Math.sin((s / steps) * Math.PI) * (isFemale ? 18 : 10);
      osc1.frequency.linearRampToValueAtTime(F0 + inflect, t);
    }

    // Vocal formant filters to simulate natural vowel resonance
    const flt1 = ctx.createBiquadFilter();
    flt1.type = "bandpass";
    flt1.frequency.value = formant1;
    flt1.Q.value = 4.5;

    const flt2 = ctx.createBiquadFilter();
    flt2.type = "bandpass";
    flt2.frequency.value = formant2;
    flt2.Q.value = 3.5;

    // Envelope: soft attack → sustained speech → decay
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, 0);
    gain.gain.exponentialRampToValueAtTime(0.2, 0.08);
    gain.gain.setValueAtTime(0.19, baseDuration - 0.15);
    gain.gain.exponentialRampToValueAtTime(0.001, baseDuration);

    osc1.connect(flt1); osc2.connect(flt2); osc3.connect(flt1);
    flt1.connect(gain); flt2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(0); osc2.start(0); osc3.start(0);
    osc1.stop(baseDuration); osc2.stop(baseDuration); osc3.stop(baseDuration);

    return await ctx.startRendering();
  }

  // =========================================================================
  // Gradio Response Helpers
  // =========================================================================
  _extractAudioFromGradioResponse(data) {
    if (!data) throw new Error("Empty response from Gradio Space.");
    const payload = Array.isArray(data.data) ? data.data[0] : data;

    if (typeof payload === "string") return payload;
    if (payload?.url) return payload.url;
    if (payload?.name) return payload.name;

    throw new Error(
      "Could not extract audio URL from Space response. " +
      "The Space API format may have changed. Check Space docs."
    );
  }

  async _fetchAndDecodeUrl(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to download audio from Space (HTTP ${res.status}).`);
    const arrayBuffer = await res.arrayBuffer();
    return await this.stitcher.decodeAudio(arrayBuffer);
  }

  async _processHFAudioOutputs(dataArray, turns) {
    const results = [];
    for (let i = 0; i < turns.length; i++) {
      const item = dataArray[i] || dataArray[0];
      const url = typeof item === "string" ? item : (item?.url || item?.name);
      if (!url) {
        // Fall back to demo for this turn if output is missing
        const demoItems = await this._synthesizeDemoBrowserSpeech([turns[i]], {}, () => {});
        results.push(...demoItems);
        continue;
      }
      const buffer = await this._fetchAndDecodeUrl(url);
      results.push({ buffer, turn: turns[i] });
    }
    return results;
  }
}

window.TTSEngineManager = TTSEngineManager;
