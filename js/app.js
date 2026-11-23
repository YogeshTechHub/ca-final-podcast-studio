/**
 * CA Final Revision Podcast Studio - Main Application Controller
 * Orchestrates Script Parsing, Multi-Engine TTS, Web Audio Stitching,
 * Waveform Visualization, IndexedDB Caching, and Google Drive Webhook Sync.
 */

document.addEventListener("DOMContentLoaded", async () => {
  // Instances
  const storage = new window.StorageManager();
  await storage.init();

  let stitcher = new window.AudioStitcher({
    sampleRate: StorageManager.getSettings().sampleRate
  });
  let engineManager = new window.TTSEngineManager({ stitcher });

  // UI State
  let state = {
    activeEngine: StorageManager.getSettings().activeEngine,
    activeMode: StorageManager.getSettings().activeMode,
    soloVoice: "speaker2", // 'speaker2' (Mentor) or 'speaker1' (Student)
    currentSubject: window.APP_CONFIG.SUBJECTS[0],
    currentTopic: "SA 200 Audit Principles",
    parsedTurns: [],
    currentMasterBuffer: null,
    currentMasterBlob: null,
    currentTimeline: [],
    currentTrackId: null,
    isPlaying: false,
    pauseMs: StorageManager.getSettings().pauseMs,
    sampleRate: StorageManager.getSettings().sampleRate
  };

  // DOM Elements
  const els = {
    // Top Bar & Mode Toggles
    engineButtons: document.querySelectorAll("[data-engine-btn]"),
    engineBadge: document.getElementById("activeEngineBadge"),
    engineDesc: document.getElementById("activeEngineDesc"),
    modeTwoSpeakerBtn: document.getElementById("modeTwoSpeakerBtn"),
    modeSingleSpeakerBtn: document.getElementById("modeSingleSpeakerBtn"),
    soloVoiceOptions: document.getElementById("soloVoiceOptions"),
    soloVoiceSelect: document.getElementById("soloVoiceSelect"),

    // Script & Subject Selectors
    subjectSelect: document.getElementById("subjectSelect"),
    topicInput: document.getElementById("topicInput"),
    templateSelect: document.getElementById("templateSelect"),
    scriptEditor: document.getElementById("scriptEditor"),
    charCountSpan: document.getElementById("charCountSpan"),
    estDurationSpan: document.getElementById("estDurationSpan"),
    btnParseScript: document.getElementById("btnParseScript"),
    btnClearScript: document.getElementById("btnClearScript"),

    // Generation Controls & Progress
    btnGeneratePodcast: document.getElementById("btnGeneratePodcast"),
    generationProgressBox: document.getElementById("generationProgressBox"),
    progressBarFill: document.getElementById("progressBarFill"),
    progressText: document.getElementById("progressText"),
    progressPercent: document.getElementById("progressPercent"),
    turnPreviewContainer: document.getElementById("turnPreviewContainer"),
    turnCountBadge: document.getElementById("turnCountBadge"),
    pauseSlider: document.getElementById("pauseSlider"),
    pauseValueDisplay: document.getElementById("pauseValueDisplay"),

    // Player Elements
    playerSection: document.getElementById("playerSection"),
    audioPlayer: document.getElementById("masterAudioPlayer"),
    waveformCanvas: document.getElementById("waveformCanvas"),
    btnPlayPause: document.getElementById("btnPlayPause"),
    playPauseIcon: document.getElementById("playPauseIcon"),
    currentTimeDisplay: document.getElementById("currentTimeDisplay"),
    totalDurationDisplay: document.getElementById("totalDurationDisplay"),
    btnSkipBack: document.getElementById("btnSkipBack"),
    btnSkipForward: document.getElementById("btnSkipForward"),
    speedButtons: document.querySelectorAll("[data-speed-btn]"),
    btnDownloadWav: document.getElementById("btnDownloadWav"),
    btnSyncDrive: document.getElementById("btnSyncDrive"),
    syncStatusBadge: document.getElementById("syncStatusBadge"),

    // History Tray
    historyTableBody: document.getElementById("historyTableBody"),
    historyEmptyState: document.getElementById("historyEmptyState"),

    // Settings Modal
    btnOpenSettings: document.getElementById("btnOpenSettings"),
    btnCloseSettings: document.getElementById("btnCloseSettings"),
    settingsModal: document.getElementById("settingsModal"),
    settingGcpKey: document.getElementById("settingGcpKey"),
    settingHfParlerUrl: document.getElementById("settingHfParlerUrl"),
    settingHfIndicUrl: document.getElementById("settingHfIndicUrl"),
    settingHfToken: document.getElementById("settingHfToken"),
    settingAppsScriptUrl: document.getElementById("settingAppsScriptUrl"),
    settingSampleRate: document.getElementById("settingSampleRate"),
    btnSaveSettings: document.getElementById("btnSaveSettings"),
    btnTestAppsScript: document.getElementById("btnTestAppsScript"),
    settingsToast: document.getElementById("settingsToast")
  };

  // Initialize Waveform Visualizer
  const visualizer = new window.AudioPlayerVisualizer(
    els.waveformCanvas,
    els.audioPlayer,
    {
      onTurnActive: (turnId, turnData) => {
        highlightActiveTurn(turnId);
      }
    }
  );

  // =========================================================================
  // 1. Initial Setup & UI Hydration
  // =========================================================================
  function initApp() {
    // One-time migration: if user previously saved "gcp_neural2" as their engine
    // and billing is not enabled, reset to demo so they don't get error dialogs
    const savedEngine = localStorage.getItem("ca_studio_active_engine");
    if (savedEngine === "gcp_neural2") {
      // Keep their choice but warn them in the console; GCP now auto-falls back silently
      console.info("Engine: gcp_neural2 saved. GCP errors will auto-fallback to Demo silently.");
    }
    populateSubjectDropdown();
    populateTemplateDropdown();
    loadSettingsIntoUI();
    applyActiveEngine(state.activeEngine);
    applyActiveMode(state.activeMode);
    loadDefaultTemplate();
    renderHistoryTable();
    updateScriptMetrics();
  }

  function populateSubjectDropdown() {
    els.subjectSelect.innerHTML = window.APP_CONFIG.SUBJECTS.map(s => 
      `<option value="${s.id}">${s.code} - ${s.name}</option>`
    ).join("");
    els.subjectSelect.value = state.currentSubject.id;
  }

  function populateTemplateDropdown() {
    els.templateSelect.innerHTML = `<option value="">-- Load CA Quick Template --</option>` +
      window.APP_CONFIG.TEMPLATES.map(t => 
        `<option value="${t.id}">[${t.mode === 'two-speaker' ? '2-Speaker' : 'Solo'}] ${t.title}</option>`
      ).join("");
  }

  function loadSettingsIntoUI() {
    const s = StorageManager.getSettings();
    els.settingGcpKey.value = s.gcpApiKey;
    els.settingHfParlerUrl.value = s.hfParlerUrl;
    els.settingHfIndicUrl.value = s.hfIndicTTSUrl;
    els.settingHfToken.value = s.hfToken;
    els.settingAppsScriptUrl.value = s.appsScriptUrl;
    els.settingSampleRate.value = s.sampleRate.toString();
    els.pauseSlider.value = s.pauseMs;
    els.pauseValueDisplay.textContent = `${s.pauseMs}ms`;
    state.pauseMs = s.pauseMs;
  }

  function loadDefaultTemplate() {
    const defaultTpl = window.APP_CONFIG.TEMPLATES[0];
    applyTemplate(defaultTpl);
  }

  function applyTemplate(tpl) {
    if (!tpl) return;
    els.scriptEditor.value = tpl.script;
    els.topicInput.value = tpl.topic;
    state.currentTopic = tpl.topic;

    const matchedSub = window.APP_CONFIG.SUBJECTS.find(s => s.id === tpl.subjectId);
    if (matchedSub) {
      state.currentSubject = matchedSub;
      els.subjectSelect.value = matchedSub.id;
    }

    applyActiveMode(tpl.mode);
    parseCurrentScript();
  }

  // =========================================================================
  // 2. Engine & Mode Switching
  // =========================================================================
  function applyActiveEngine(engineId) {
    state.activeEngine = engineId;
    StorageManager.saveSettings({ activeEngine: engineId });

    els.engineButtons.forEach(btn => {
      const isTarget = btn.getAttribute("data-engine-btn") === engineId;
      if (isTarget) {
        btn.classList.add("bg-indigo-600", "text-white", "shadow-sm");
        btn.classList.remove("text-slate-300", "hover:bg-slate-800");
      } else {
        btn.classList.remove("bg-indigo-600", "text-white", "shadow-sm");
        btn.classList.add("text-slate-300", "hover:bg-slate-800");
      }
    });

    let config = Object.values(window.APP_CONFIG.ENGINES).find(e => e.id === engineId);
    if (config) {
      els.engineBadge.textContent = config.badge;
      els.engineDesc.textContent = config.description;
    }

    // Show GCP billing alert only when Google Cloud engine is selected
    const billingAlert = document.getElementById("gcpBillingAlert");
    if (billingAlert) {
      if (engineId === "gcp_neural2") {
        billingAlert.classList.remove("hidden");
      } else {
        billingAlert.classList.add("hidden");
      }
    }
  }

  function applyActiveMode(mode) {
    state.activeMode = mode;
    StorageManager.saveSettings({ activeMode: mode });

    if (mode === "single-speaker") {
      els.modeSingleSpeakerBtn.classList.add("bg-emerald-600", "text-white");
      els.modeSingleSpeakerBtn.classList.remove("text-slate-400");
      els.modeTwoSpeakerBtn.classList.remove("bg-emerald-600", "text-white");
      els.modeTwoSpeakerBtn.classList.add("text-slate-400");
      els.soloVoiceOptions.classList.remove("hidden");
    } else {
      els.modeTwoSpeakerBtn.classList.add("bg-emerald-600", "text-white");
      els.modeTwoSpeakerBtn.classList.remove("text-slate-400");
      els.modeSingleSpeakerBtn.classList.remove("bg-emerald-600", "text-white");
      els.modeSingleSpeakerBtn.classList.add("text-slate-400");
      els.soloVoiceOptions.classList.add("hidden");
    }

    parseCurrentScript();
  }

  // =========================================================================
  // 3. Script Parsing & Turn Breakdown
  // =========================================================================
  function parseCurrentScript() {
    const rawText = els.scriptEditor.value;
    state.parsedTurns = window.DialogueParser.parse(
      rawText,
      state.activeMode,
      state.soloVoice
    );

    updateScriptMetrics();
    renderTurnBreakdown();
  }

  function updateScriptMetrics() {
    const text = els.scriptEditor.value || "";
    const chars = text.length;
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    // Estimate based on standard 135 wpm speech speed + pauses
    const estSec = Math.round((words / 135) * 60) + (state.parsedTurns.length * (state.pauseMs / 1000));
    const mins = Math.floor(estSec / 60);
    const secs = Math.round(estSec % 60);

    els.charCountSpan.textContent = `${chars.toLocaleString()} chars (${words} words)`;
    els.estDurationSpan.textContent = `~${mins}m ${secs < 10 ? '0' : ''}${secs}s`;
    els.turnCountBadge.textContent = `${state.parsedTurns.length} Turns`;
  }

  function renderTurnBreakdown() {
    if (!state.parsedTurns || state.parsedTurns.length === 0) {
      els.turnPreviewContainer.innerHTML = `
        <div class="text-center py-8 text-slate-500 text-sm">
          No dialogue turns detected. Type dialogue tags ("Speaker 1:", "Speaker 2:", or "Fast Recap:") or switch to Single-Speaker Solo Mode.
        </div>
      `;
      return;
    }

    els.turnPreviewContainer.innerHTML = state.parsedTurns.map((turn, idx) => {
      const isSpeaker1 = turn.speaker === "speaker1";
      const isRecap = turn.isRecap;

      let badgeBg = isSpeaker1 ? "bg-pink-500/10 text-pink-400 border-pink-500/30" : "bg-blue-500/10 text-blue-400 border-blue-500/30";
      let iconColor = isSpeaker1 ? "text-pink-400" : "text-blue-400";
      let speakerTitle = turn.role;

      if (isRecap) {
        badgeBg = "bg-amber-500/10 text-amber-400 border-amber-500/30";
        iconColor = "text-amber-400";
      }

      return `
        <div id="card_${turn.id}" class="turn-card p-3 rounded-lg border border-slate-800 bg-slate-900/60 hover:border-slate-700 transition">
          <div class="flex items-center justify-between mb-1.5">
            <div class="flex items-center space-x-2">
              <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${badgeBg}">
                ${speakerTitle}
              </span>
              ${turn.subChunk ? `<span class="text-[10px] text-slate-500 font-mono">Chunk ${turn.subChunk}</span>` : ""}
            </div>
            <span class="text-[11px] text-slate-500 font-mono">#${idx + 1} (${turn.charCount}c)</span>
          </div>
          <p class="text-xs text-slate-300 leading-relaxed font-sans">${escapeHtml(turn.rawText)}</p>
        </div>
      `;
    }).join("");
  }

  function highlightActiveTurn(turnId) {
    document.querySelectorAll(".turn-card").forEach(el => el.classList.remove("active-turn"));
    if (turnId) {
      const activeCard = document.getElementById(`card_${turnId}`);
      if (activeCard) {
        activeCard.classList.add("active-turn");
        activeCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    }
  }

  // =========================================================================
  // 4. Synthesis & Audio Stitching Engine Execution
  // =========================================================================
  async function generatePodcast() {
    parseCurrentScript();

    if (!state.parsedTurns || state.parsedTurns.length === 0) {
      alert("Please add script dialogue before generating podcast.");
      return;
    }

    // Set UI to Generating State
    setGeneratingState(true);

    try {
      const settings = StorageManager.getSettings();

      // Step 1: Synthesize all turns using selected engine
      const synthesizedItems = await engineManager.synthesizeTurns(
        state.parsedTurns,
        state.activeEngine,
        {
          apiKey: settings.gcpApiKey,
          spaceUrl: state.activeEngine === "hf_parler" ? settings.hfParlerUrl : settings.hfIndicTTSUrl,
          token: settings.hfToken
        },
        (current, total, message) => {
          updateProgress(current, total, message);
        }
      );

      // Step 2: Audio Stitching via Web Audio OfflineAudioContext
      updateProgress(state.parsedTurns.length, state.parsedTurns.length, "Stitching audio buffers & inserting natural pauses...");
      const stitchedResult = await stitcher.stitch(synthesizedItems, state.pauseMs);

      state.currentMasterBuffer = stitchedResult.masterBuffer;
      state.currentMasterBlob = stitchedResult.masterBlob;
      state.currentTimeline = stitchedResult.timeline;

      // Step 3: Load into Audio Player & Visualizer
      const audioUrl = URL.createObjectURL(stitchedResult.masterBlob);
      els.audioPlayer.src = audioUrl;
      visualizer.loadBuffer(stitchedResult.masterBuffer, stitchedResult.timeline);

      // Step 4: Cache Track in IndexedDB
      const trackRecord = {
        title: `${state.currentSubject.code}: ${state.currentTopic}`,
        subject: state.currentSubject.name,
        subjectCode: state.currentSubject.code,
        topic: state.currentTopic,
        mode: state.activeMode,
        engine: getEngineDisplayName(state.activeEngine),
        duration: stitchedResult.totalDuration,
        turnCount: state.parsedTurns.length,
        pauseMs: state.pauseMs,
        wavBlob: stitchedResult.masterBlob,
        timeline: stitchedResult.timeline,
        scriptSummary: state.parsedTurns.map(t => `${t.speaker}: ${t.rawText.substring(0, 50)}`).join(" | "),
        syncStatus: "local"
      };

      const trackId = await storage.saveTrack(trackRecord);
      state.currentTrackId = trackId;

      // Update UI
      els.playerSection.classList.remove("opacity-50", "pointer-events-none");
      updateTotalDuration(stitchedResult.totalDuration);
      setSyncStatusBadge("local");
      await renderHistoryTable();

      // Auto-start playback
      await playAudio();

    } catch (err) {
      console.error("Podcast Generation Error:", err);

      // Show user-friendly error panel instead of a raw browser alert
      const friendlyErrors = {
        "billing": "⚠️ Google Cloud Billing Not Enabled\n\nYour API key is working, but billing needs to be activated on the project (it's FREE – just needs a card linked).\n\nFix: Visit → https://console.developers.google.com/billing/enable?project=283371616265\n\nOR: Switch to 'Demo' engine (top bar) to generate audio instantly without billing!",
        "BILLING_DISABLED": "⚠️ Google Cloud Billing Not Enabled. Switch to 'Demo' or 'Indic-TTS CPU' engine to continue.",
        "Permission denied": "⚠️ GCP Permission Denied\n\nYour API key doesn't have Cloud Text-to-Speech API enabled.\n\nFix:\n1. Open https://console.cloud.google.com/apis/library/texttospeech.googleapis.com\n2. Click 'Enable'\n3. Wait 60 seconds and retry.\n\nOR: Use Demo / Indic-TTS CPU engine which requires no API key!",
        "API key not valid": "⚠️ Invalid Google Cloud API Key\n\nPlease open ⚙ Settings and double-check your key starts with 'AIzaSy...'"
      };

      let displayMsg = err.message;
      for (const [keyword, friendly] of Object.entries(friendlyErrors)) {
        if (err.message.includes(keyword)) {
          displayMsg = friendly;
          break;
        }
      }

      showErrorBanner(displayMsg);
    } finally {
      setGeneratingState(false);
    }
  }

  // =========================================================================
  // Error Banner (non-blocking, dismissable, with action buttons)
  // =========================================================================
  function showErrorBanner(message) {
    // Remove any existing banner
    const existingBanner = document.getElementById("errorBanner");
    if (existingBanner) existingBanner.remove();

    const banner = document.createElement("div");
    banner.id = "errorBanner";
    banner.className = "fixed bottom-4 right-4 max-w-md bg-red-950 border border-red-500/50 rounded-xl p-4 shadow-2xl z-50 text-sm";

    const lines = message.split("\n").filter(l => l.trim());
    const title = lines[0];
    const body = lines.slice(1).join("\n").trim();

    banner.innerHTML = `
      <div class="flex items-start justify-between mb-2">
        <div class="flex items-center space-x-2">
          <svg class="w-5 h-5 text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span class="font-bold text-red-300 text-xs uppercase tracking-wider">Synthesis Error</span>
        </div>
        <button onclick="document.getElementById('errorBanner').remove()" class="text-red-400 hover:text-white ml-3 text-lg leading-none">×</button>
      </div>
      <p class="text-red-200 text-xs font-semibold mb-1">${escapeHtml(title)}</p>
      ${body ? `<pre class="text-red-300/80 text-[11px] whitespace-pre-wrap leading-relaxed mt-1">${escapeHtml(body)}</pre>` : ""}
      <div class="flex items-center space-x-2 mt-3">
        <button onclick="document.getElementById('errorBanner').remove(); document.querySelector('[data-engine-btn=demo_web_speech]').click();" 
                class="px-3 py-1 bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold rounded-lg transition">
          Switch to Demo Engine
        </button>
        <button onclick="document.getElementById('errorBanner').remove()" 
                class="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs rounded-lg transition">
          Dismiss
        </button>
      </div>
    `;

    document.body.appendChild(banner);

    // Auto-dismiss after 20 seconds
    setTimeout(() => {
      if (document.getElementById("errorBanner")) {
        document.getElementById("errorBanner").remove();
      }
    }, 20000);
  }

  function setGeneratingState(isGenerating) {
    if (isGenerating) {
      els.btnGeneratePodcast.disabled = true;
      els.btnGeneratePodcast.classList.add("opacity-50", "cursor-not-allowed");
      els.generationProgressBox.classList.remove("hidden");
      // Clear any previous error banner when starting new generation
      const existingBanner = document.getElementById("errorBanner");
      if (existingBanner) existingBanner.remove();
    } else {
      els.btnGeneratePodcast.disabled = false;
      els.btnGeneratePodcast.classList.remove("opacity-50", "cursor-not-allowed");
      els.generationProgressBox.classList.add("hidden");
    }
  }

  function updateProgress(current, total, message) {
    const percent = Math.min(100, Math.round((current / total) * 100));
    els.progressBarFill.style.width = `${percent}%`;
    els.progressPercent.textContent = `${percent}%`;
    els.progressText.textContent = message;
  }

  // =========================================================================
  // 5. Audio Player Controls
  // =========================================================================
  async function playAudio() {
    try {
      await els.audioPlayer.play();
      state.isPlaying = true;
      updatePlayPauseButton(true);
    } catch (err) {
      console.warn("Autoplay was prevented by browser policy:", err);
    }
  }

  function pauseAudio() {
    els.audioPlayer.pause();
    state.isPlaying = false;
    updatePlayPauseButton(false);
  }

  function togglePlayPause() {
    if (state.isPlaying) {
      pauseAudio();
    } else {
      playAudio();
    }
  }

  function updatePlayPauseButton(isPlaying) {
    if (isPlaying) {
      els.playPauseIcon.innerHTML = `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />`;
      els.btnPlayPause.classList.add("ring-2", "ring-indigo-500");
    } else {
      els.playPauseIcon.innerHTML = `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />`;
      els.btnPlayPause.classList.remove("ring-2", "ring-indigo-500");
    }
  }

  function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }

  function updateTotalDuration(duration) {
    els.totalDurationDisplay.textContent = formatTime(duration);
  }

  // =========================================================================
  // 6. Google Drive & Sheets Sync Webhook
  // =========================================================================
  async function syncCurrentTrackToDrive() {
    if (!state.currentMasterBlob) {
      alert("No master audio track available to sync.");
      return;
    }

    const scriptUrl = StorageManager.getSettings().appsScriptUrl;
    if (!scriptUrl) {
      alert("Please configure your Google Apps Script Web App URL in Settings first!");
      openSettingsModal();
      return;
    }

    setSyncStatusBadge("syncing");
    els.btnSyncDrive.disabled = true;

    try {
      // Convert Blob to Base64
      const base64Audio = await window.WavEncoder.blobToBase64(state.currentMasterBlob);

      const payload = {
        base64Audio: base64Audio,
        metadata: {
          subject: state.currentSubject.name,
          subjectCode: state.currentSubject.code,
          topic: state.currentTopic,
          mode: state.activeMode,
          duration: state.currentMasterBuffer ? state.currentMasterBuffer.duration : 0,
          scriptSummary: state.parsedTurns.map(t => `${t.speaker}: ${t.rawText}`).join("\n")
        }
      };

      // POST to Google Apps Script Web App
      // Note: GAS returns 302 redirect, 'follow' redirect ensures payload delivery
      const response = await fetch(scriptUrl, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" }, // text/plain prevents CORS preflight issues on GAS
        body: JSON.stringify(payload),
        redirect: "follow"
      });

      const result = await response.json().catch(() => ({}));

      if (result && result.success) {
        setSyncStatusBadge("synced", result.driveLink);
        if (state.currentTrackId) {
          await storage.updateSyncStatus(state.currentTrackId, result.driveLink, result.fileId, "synced");
          await renderHistoryTable();
        }
        alert(`Success! Podcast saved to Google Drive: \n${result.fileName}\n\nDrive Link: ${result.driveLink}`);
      } else {
        throw new Error(result.error || "Google Apps Script rejected the sync request.");
      }
    } catch (err) {
      console.error("Drive Sync Error:", err);
      setSyncStatusBadge("failed");
      alert(`Sync Failed: ${err.message}. Make sure your Apps Script is deployed as Web App with Access: 'Anyone'.`);
    } finally {
      els.btnSyncDrive.disabled = false;
    }
  }

  function setSyncStatusBadge(status, driveLink = null) {
    if (status === "syncing") {
      els.syncStatusBadge.className = "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/30";
      els.syncStatusBadge.textContent = "Syncing to Drive...";
    } else if (status === "synced") {
      els.syncStatusBadge.className = "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30";
      els.syncStatusBadge.innerHTML = driveLink 
        ? `<a href="${driveLink}" target="_blank" class="hover:underline flex items-center space-x-1"><span>✓ Synced to Drive</span><svg class="w-3 h-3 ml-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg></a>`
        : "✓ Synced to Drive";
    } else if (status === "failed") {
      els.syncStatusBadge.className = "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/30";
      els.syncStatusBadge.textContent = "Sync Failed";
    } else {
      els.syncStatusBadge.className = "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-800 text-slate-400 border border-slate-700";
      els.syncStatusBadge.textContent = "Saved Locally (IndexedDB)";
    }
  }

  // =========================================================================
  // 7. History Tray Management
  // =========================================================================
  async function renderHistoryTable() {
    const tracks = await storage.getAllTracks();
    if (!tracks || tracks.length === 0) {
      els.historyEmptyState.classList.remove("hidden");
      els.historyTableBody.innerHTML = "";
      return;
    }

    els.historyEmptyState.classList.add("hidden");
    els.historyTableBody.innerHTML = tracks.map(track => {
      const date = new Date(track.timestamp);
      const formattedDate = date.toLocaleDateString("en-IN", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      });

      const isCurrent = track.id === state.currentTrackId;

      return `
        <tr class="border-b border-slate-800/60 hover:bg-slate-800/30 transition text-xs ${isCurrent ? 'bg-indigo-950/20' : ''}">
          <td class="py-2.5 px-3">
            <div class="font-medium text-slate-200">${escapeHtml(track.title)}</div>
            <div class="text-[10px] text-slate-500">${formattedDate} • ${track.engine}</div>
          </td>
          <td class="py-2.5 px-3">
            <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${track.mode === 'single-speaker' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'}">
              ${track.mode === 'single-speaker' ? 'Solo Lecture' : '2-Speaker'}
            </span>
          </td>
          <td class="py-2.5 px-3 font-mono text-slate-400">
            ${formatTime(track.duration)}
          </td>
          <td class="py-2.5 px-3">
            ${track.driveLink 
              ? `<a href="${track.driveLink}" target="_blank" class="text-indigo-400 hover:text-indigo-300 inline-flex items-center space-x-1"><span>Drive</span><svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg></a>`
              : `<span class="text-slate-500">Local DB</span>`
            }
          </td>
          <td class="py-2.5 px-3 text-right space-x-1">
            <button data-load-track="${track.id}" class="px-2 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-[11px] font-medium transition" title="Play">
              Play
            </button>
            <button data-download-track="${track.id}" class="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[11px] transition" title="Download WAV">
              WAV
            </button>
            <button data-delete-track="${track.id}" class="px-2 py-1 bg-red-950/40 hover:bg-red-900/60 text-red-400 rounded text-[11px] transition" title="Delete">
              ×
            </button>
          </td>
        </tr>
      `;
    }).join("");

    // Attach dynamic click listeners
    els.historyTableBody.querySelectorAll("[data-load-track]").forEach(btn => {
      btn.addEventListener("click", () => loadTrackFromHistory(btn.getAttribute("data-load-track")));
    });
    els.historyTableBody.querySelectorAll("[data-download-track]").forEach(btn => {
      btn.addEventListener("click", () => downloadTrackFromHistory(btn.getAttribute("data-download-track")));
    });
    els.historyTableBody.querySelectorAll("[data-delete-track]").forEach(btn => {
      btn.addEventListener("click", () => deleteTrackFromHistory(btn.getAttribute("data-delete-track")));
    });
  }

  async function loadTrackFromHistory(trackId) {
    const track = await storage.getTrackById(trackId);
    if (!track) return;

    state.currentTrackId = track.id;
    state.currentTopic = track.topic;
    state.currentMasterBlob = track.wavBlob;
    state.currentTimeline = track.timeline || [];

    // Decode blob into AudioBuffer for visualizer
    const arrayBuffer = await track.wavBlob.arrayBuffer();
    const audioBuffer = await stitcher.decodeAudio(arrayBuffer);
    state.currentMasterBuffer = audioBuffer;

    const audioUrl = URL.createObjectURL(track.wavBlob);
    els.audioPlayer.src = audioUrl;
    visualizer.loadBuffer(audioBuffer, track.timeline);

    els.playerSection.classList.remove("opacity-50", "pointer-events-none");
    updateTotalDuration(track.duration);
    setSyncStatusBadge(track.syncStatus, track.driveLink);

    renderHistoryTable();
    await playAudio();
  }

  async function downloadTrackFromHistory(trackId) {
    const track = await storage.getTrackById(trackId);
    if (!track || !track.wavBlob) return;
    downloadBlob(track.wavBlob, `${sanitizeFilename(track.title)}.wav`);
  }

  async function deleteTrackFromHistory(trackId) {
    if (!confirm("Are you sure you want to delete this revision podcast from history?")) return;
    await storage.deleteTrack(trackId);
    if (state.currentTrackId === trackId) {
      pauseAudio();
      state.currentTrackId = null;
    }
    renderHistoryTable();
  }

  // =========================================================================
  // 8. Event Listeners & Wiring
  // =========================================================================
  // Engine switch pills
  els.engineButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      const engineId = btn.getAttribute("data-engine-btn");
      applyActiveEngine(engineId);
    });
  });

  // Mode toggles
  els.modeTwoSpeakerBtn.addEventListener("click", () => applyActiveMode("two-speaker"));
  els.modeSingleSpeakerBtn.addEventListener("click", () => applyActiveMode("single-speaker"));
  els.soloVoiceSelect.addEventListener("change", (e) => {
    state.soloVoice = e.target.value;
    parseCurrentScript();
  });

  // Subject & Template changes
  els.subjectSelect.addEventListener("change", (e) => {
    const sub = window.APP_CONFIG.SUBJECTS.find(s => s.id === e.target.value);
    if (sub) state.currentSubject = sub;
  });

  els.topicInput.addEventListener("input", (e) => {
    state.currentTopic = e.target.value.trim() || "Revision Topic";
  });

  els.templateSelect.addEventListener("change", (e) => {
    const tplId = e.target.value;
    const tpl = window.APP_CONFIG.TEMPLATES.find(t => t.id === tplId);
    if (tpl) applyTemplate(tpl);
  });

  // Editor events
  els.scriptEditor.addEventListener("input", () => {
    updateScriptMetrics();
  });

  els.btnParseScript.addEventListener("click", () => {
    parseCurrentScript();
  });

  els.btnClearScript.addEventListener("click", () => {
    if (confirm("Clear current script editor text?")) {
      els.scriptEditor.value = "";
      parseCurrentScript();
    }
  });

  // Pause Slider
  els.pauseSlider.addEventListener("input", (e) => {
    state.pauseMs = parseInt(e.target.value, 10);
    els.pauseValueDisplay.textContent = `${state.pauseMs}ms`;
    StorageManager.saveSettings({ pauseMs: state.pauseMs });
    updateScriptMetrics();
  });

  // Generation Trigger
  els.btnGeneratePodcast.addEventListener("click", generatePodcast);

  // Player Controls
  els.btnPlayPause.addEventListener("click", togglePlayPause);
  els.btnSkipBack.addEventListener("click", () => visualizer.jump(-10));
  els.btnSkipForward.addEventListener("click", () => visualizer.jump(10));

  els.speedButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      const speed = parseFloat(btn.getAttribute("data-speed-btn"));
      visualizer.setSpeed(speed);
      els.speedButtons.forEach(b => {
        b.classList.remove("bg-indigo-600", "text-white");
        b.classList.add("bg-slate-800", "text-slate-300");
      });
      btn.classList.add("bg-indigo-600", "text-white");
      btn.classList.remove("bg-slate-800", "text-slate-300");
    });
  });

  els.audioPlayer.addEventListener("timeupdate", () => {
    els.currentTimeDisplay.textContent = formatTime(els.audioPlayer.currentTime);
  });

  els.audioPlayer.addEventListener("ended", () => {
    state.isPlaying = false;
    updatePlayPauseButton(false);
    highlightActiveTurn(null);
  });

  // Download Master WAV
  els.btnDownloadWav.addEventListener("click", () => {
    if (!state.currentMasterBlob) return;
    const filename = `${sanitizeFilename(state.currentSubject.code)}_${sanitizeFilename(state.currentTopic)}.wav`;
    downloadBlob(state.currentMasterBlob, filename);
  });

  // Google Drive Sync
  els.btnSyncDrive.addEventListener("click", syncCurrentTrackToDrive);

  // Settings Modal Handlers
  els.btnOpenSettings.addEventListener("click", openSettingsModal);
  els.btnCloseSettings.addEventListener("click", closeSettingsModal);
  els.settingsModal.addEventListener("click", (e) => {
    if (e.target === els.settingsModal) closeSettingsModal();
  });

  els.btnSaveSettings.addEventListener("click", () => {
    const updated = {
      gcpApiKey: els.settingGcpKey.value,
      hfParlerUrl: els.settingHfParlerUrl.value,
      hfIndicTTSUrl: els.settingHfIndicUrl.value,
      hfToken: els.settingHfToken.value,
      appsScriptUrl: els.settingAppsScriptUrl.value,
      sampleRate: parseInt(els.settingSampleRate.value, 10)
    };
    StorageManager.saveSettings(updated);

    // Reinitialize stitcher if sample rate changed
    if (updated.sampleRate !== state.sampleRate) {
      state.sampleRate = updated.sampleRate;
      stitcher = new window.AudioStitcher({ sampleRate: updated.sampleRate });
      engineManager = new window.TTSEngineManager({ stitcher });
    }

    showSettingsToast("Settings successfully saved!");
    setTimeout(closeSettingsModal, 400);
  });

  // Test Apps Script Webhook
  els.btnTestAppsScript.addEventListener("click", async () => {
    const url = els.settingAppsScriptUrl.value.trim();
    if (!url) {
      alert("Please enter a Google Apps Script Web App URL first.");
      return;
    }

    els.btnTestAppsScript.disabled = true;
    els.btnTestAppsScript.textContent = "Pinging...";

    try {
      const resp = await fetch(url, { method: "GET" });
      const data = await resp.json();
      if (data && data.status === "online") {
        alert("Webhook Connected Successfully! Web App is online and ready for Drive sync.");
      } else {
        alert("Webhook replied, but returned unexpected response. Check Code.gs deployment.");
      }
    } catch (err) {
      alert(`Webhook connection failed: ${err.message}. Ensure deployment access is set to 'Anyone'.`);
    } finally {
      els.btnTestAppsScript.disabled = false;
      els.btnTestAppsScript.textContent = "Test Connection";
    }
  });

  function openSettingsModal() {
    loadSettingsIntoUI();
    els.settingsModal.classList.remove("hidden");
  }

  function closeSettingsModal() {
    els.settingsModal.classList.add("hidden");
  }

  function showSettingsToast(msg) {
    els.settingsToast.textContent = msg;
    els.settingsToast.classList.remove("hidden");
    setTimeout(() => {
      els.settingsToast.classList.add("hidden");
    }, 2500);
  }

  // =========================================================================
  // Helpers
  // =========================================================================
  function getEngineDisplayName(id) {
    const eng = Object.values(window.APP_CONFIG.ENGINES).find(e => e.id === id);
    return eng ? eng.name : id;
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function sanitizeFilename(str) {
    return (str || "CA_Revision").replace(/[^a-zA-Z0-9_-]/g, "_").replace(/_+/g, "_");
  }

  function escapeHtml(text) {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return (text || '').replace(/[&<>"']/g, m => map[m]);
  }

  // Start the App
  initApp();
});
