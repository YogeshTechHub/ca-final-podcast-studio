/**
 * CA Final Revision Podcast Studio - Storage Engine
 * Manages:
 * 1. Browser IndexedDB for offline persistence of synthesized .wav audio blobs & metadata
 * 2. LocalStorage for API keys, Space URLs, and Webhook credentials
 */

class StorageManager {
  constructor() {
    this.dbName = "CA_Podcast_Studio_DB";
    this.dbVersion = 1;
    this.storeName = "revision_tracks";
    this.db = null;
  }

  /**
   * Initializes IndexedDB
   * @returns {Promise<IDBDatabase|null>}
   */
  async init() {
    if (this.db) return this.db;
    if (typeof window === "undefined" || !window.indexedDB) {
      console.warn("IndexedDB is not supported or accessible in this environment.");
      return null;
    }

    return new Promise((resolve) => {
      try {
        const request = window.indexedDB.open(this.dbName, this.dbVersion);

        request.onupgradeneeded = (event) => {
          const db = event.target.result;
          if (!db.objectStoreNames.contains(this.storeName)) {
            const store = db.createObjectStore(this.storeName, { keyPath: "id" });
            store.createIndex("timestamp", "timestamp", { unique: false });
            store.createIndex("subject", "subject", { unique: false });
          }
        };

        request.onsuccess = (event) => {
          this.db = event.target.result;
          resolve(this.db);
        };

        request.onerror = (event) => {
          console.warn("IndexedDB initialization warning:", event.target.error);
          resolve(null);
        };
      } catch (err) {
        console.warn("IndexedDB open error:", err);
        resolve(null);
      }
    });
  }

  /**
   * Save a newly generated revision track into IndexedDB
   * @param {Object} track 
   * @returns {Promise<string>} track id
   */
  async saveTrack(track) {
    await this.init();
    const fallbackId = track?.id || `track_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    if (!this.db) return fallbackId;

    return new Promise((resolve, reject) => {
      try {
        const transaction = this.db.transaction([this.storeName], "readwrite");
        const store = transaction.objectStore(this.storeName);

        const record = {
          id: fallbackId,
          timestamp: track.timestamp || new Date().toISOString(),
          title: track.title || "Untitled Revision Track",
          subject: track.subject || "CA Final",
          subjectCode: track.subjectCode || "AUDIT",
          topic: track.topic || "General Theory",
          mode: track.mode || "two-speaker",
          engine: track.engine || "Google Cloud Neural2",
          duration: track.duration || 0,
          turnCount: track.turnCount || 0,
          pauseMs: track.pauseMs || 400,
          wavBlob: track.wavBlob, // Binary audio blob
          timeline: track.timeline || [],
          scriptSummary: track.scriptSummary || "",
          syncStatus: track.syncStatus || "local", // "local" | "syncing" | "synced" | "failed"
          driveLink: track.driveLink || null,
          driveFileId: track.driveFileId || null
        };

        const request = store.put(record);
        request.onsuccess = () => resolve(record.id);
        request.onerror = (e) => reject(e.target.error);
        transaction.onerror = (e) => reject(transaction.error || e);
      } catch (err) {
        console.warn("IndexedDB saveTrack error:", err);
        resolve(fallbackId);
      }
    });
  }

  /**
   * Retrieve all cached revision tracks ordered by timestamp descending
   * @returns {Promise<Array<Object>>}
   */
  async getAllTracks() {
    await this.init();
    if (!this.db) return [];

    return new Promise((resolve, reject) => {
      try {
        const transaction = this.db.transaction([this.storeName], "readonly");
        const store = transaction.objectStore(this.storeName);
        const request = store.getAll();

        request.onsuccess = () => {
          const results = request.result || [];
          // Sort descending by timestamp
          results.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
          resolve(results);
        };

        request.onerror = (e) => reject(e.target.error);
      } catch (err) {
        console.warn("IndexedDB getAllTracks error:", err);
        resolve([]);
      }
    });
  }

  /**
   * Get single track by ID
   * @param {string} id 
   * @returns {Promise<Object>}
   */
  async getTrackById(id) {
    await this.init();
    if (!this.db || !id) return null;

    return new Promise((resolve, reject) => {
      try {
        const transaction = this.db.transaction([this.storeName], "readonly");
        const store = transaction.objectStore(this.storeName);
        const request = store.get(id);

        request.onsuccess = () => resolve(request.result || null);
        request.onerror = (e) => reject(e.target.error);
      } catch (err) {
        console.warn("IndexedDB getTrackById error:", err);
        resolve(null);
      }
    });
  }

  /**
   * Update sync status after Google Drive upload
   * @param {string} id 
   * @param {string} driveLink 
   * @param {string} driveFileId 
   * @param {string} status 
   */
  async updateSyncStatus(id, driveLink, driveFileId, status = "synced") {
    await this.init();
    if (!this.db || !id) return null;

    const track = await this.getTrackById(id);
    if (!track) return null;

    track.syncStatus = status;
    if (driveLink) track.driveLink = driveLink;
    if (driveFileId) track.driveFileId = driveFileId;

    return new Promise((resolve, reject) => {
      try {
        const transaction = this.db.transaction([this.storeName], "readwrite");
        const store = transaction.objectStore(this.storeName);
        const request = store.put(track);

        request.onsuccess = () => resolve(track);
        request.onerror = (e) => reject(e.target.error);
      } catch (err) {
        console.warn("IndexedDB updateSyncStatus error:", err);
        resolve(track);
      }
    });
  }

  /**
   * Delete track by ID
   * @param {string} id 
   */
  async deleteTrack(id) {
    await this.init();
    if (!this.db || !id) return false;

    return new Promise((resolve, reject) => {
      try {
        const transaction = this.db.transaction([this.storeName], "readwrite");
        const store = transaction.objectStore(this.storeName);
        const request = store.delete(id);

        request.onsuccess = () => resolve(true);
        request.onerror = (e) => reject(e.target.error);
      } catch (err) {
        console.warn("IndexedDB deleteTrack error:", err);
        resolve(false);
      }
    });
  }

  // =========================================================================
  // LocalStorage Settings Helper
  // =========================================================================
  static _getDefaultKeys() {
    return {
      API_KEY_GCP: "ca_studio_gcp_api_key",
      HF_SPACE_PARLER_URL: "ca_studio_hf_parler_url",
      HF_SPACE_INDICTTS_URL: "ca_studio_hf_indictts_url",
      HF_TOKEN: "ca_studio_hf_token",
      GOOGLE_APPS_SCRIPT_URL: "ca_studio_apps_script_url",
      ACTIVE_ENGINE: "ca_studio_active_engine",
      ACTIVE_MODE: "ca_studio_active_mode"
    };
  }

  static getSettings() {
    const keys = window.APP_CONFIG?.STORAGE_KEYS || StorageManager._getDefaultKeys();
    const defaults = window.APP_CONFIG?.DEFAULT_CREDENTIALS || {};
    const defaultParler = window.APP_CONFIG?.ENGINES?.ENGINE_2_HF_PARLER?.defaultSpaceUrl || "";
    const defaultIndic = window.APP_CONFIG?.ENGINES?.ENGINE_3_HF_INDICTTS?.defaultSpaceUrl || "";

    try {
      return {
        gcpApiKey: localStorage.getItem(keys.API_KEY_GCP) || defaults.GCP_API_KEY || "",
        hfParlerUrl: localStorage.getItem(keys.HF_SPACE_PARLER_URL) || defaultParler,
        hfIndicTTSUrl: localStorage.getItem(keys.HF_SPACE_INDICTTS_URL) || defaultIndic,
        hfToken: localStorage.getItem(keys.HF_TOKEN) || defaults.HF_TOKEN || "",
        appsScriptUrl: localStorage.getItem(keys.GOOGLE_APPS_SCRIPT_URL) || "",
        activeEngine: localStorage.getItem(keys.ACTIVE_ENGINE) || "demo_web_speech",
        activeMode: localStorage.getItem(keys.ACTIVE_MODE) || "two-speaker",
        pauseMs: parseInt(localStorage.getItem("ca_studio_pause_ms") || "400", 10),
        sampleRate: parseInt(localStorage.getItem("ca_studio_sample_rate") || "24000", 10)
      };
    } catch (e) {
      console.warn("LocalStorage access error:", e);
      return {
        gcpApiKey: defaults.GCP_API_KEY || "",
        hfParlerUrl: defaultParler,
        hfIndicTTSUrl: defaultIndic,
        hfToken: defaults.HF_TOKEN || "",
        appsScriptUrl: "",
        activeEngine: "demo_web_speech",
        activeMode: "two-speaker",
        pauseMs: 400,
        sampleRate: 24000
      };
    }
  }

  static saveSettings(settings) {
    if (!settings) return;
    const keys = window.APP_CONFIG?.STORAGE_KEYS || StorageManager._getDefaultKeys();
    try {
      if (settings.gcpApiKey !== undefined) localStorage.setItem(keys.API_KEY_GCP, (settings.gcpApiKey || "").trim());
      if (settings.hfParlerUrl !== undefined) localStorage.setItem(keys.HF_SPACE_PARLER_URL, (settings.hfParlerUrl || "").trim());
      if (settings.hfIndicTTSUrl !== undefined) localStorage.setItem(keys.HF_SPACE_INDICTTS_URL, (settings.hfIndicTTSUrl || "").trim());
      if (settings.hfToken !== undefined) localStorage.setItem(keys.HF_TOKEN, (settings.hfToken || "").trim());
      if (settings.appsScriptUrl !== undefined) localStorage.setItem(keys.GOOGLE_APPS_SCRIPT_URL, (settings.appsScriptUrl || "").trim());
      if (settings.activeEngine !== undefined) localStorage.setItem(keys.ACTIVE_ENGINE, settings.activeEngine);
      if (settings.activeMode !== undefined) localStorage.setItem(keys.ACTIVE_MODE, settings.activeMode);
      if (settings.pauseMs !== undefined) localStorage.setItem("ca_studio_pause_ms", settings.pauseMs.toString());
      if (settings.sampleRate !== undefined) localStorage.setItem("ca_studio_sample_rate", settings.sampleRate.toString());
    } catch (e) {
      console.warn("LocalStorage save error:", e);
    }
  }
}

window.StorageManager = StorageManager;
