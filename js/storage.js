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
   * @returns {Promise<IDBDatabase>}
   */
  async init() {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

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
        console.error("IndexedDB initialization error:", event.target.error);
        reject(event.target.error);
      };
    });
  }

  /**
   * Save a newly generated revision track into IndexedDB
   * @param {Object} track 
   * @returns {Promise<string>} track id
   */
  async saveTrack(track) {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], "readwrite");
      const store = transaction.objectStore(this.storeName);

      const record = {
        id: track.id || `track_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
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
    });
  }

  /**
   * Retrieve all cached revision tracks ordered by timestamp descending
   * @returns {Promise<Array<Object>>}
   */
  async getAllTracks() {
    await this.init();
    return new Promise((resolve, reject) => {
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
    });
  }

  /**
   * Get single track by ID
   * @param {string} id 
   * @returns {Promise<Object>}
   */
  async getTrackById(id) {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], "readonly");
      const store = transaction.objectStore(this.storeName);
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result);
      request.onerror = (e) => reject(e.target.error);
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
    const track = await this.getTrackById(id);
    if (!track) return null;

    track.syncStatus = status;
    if (driveLink) track.driveLink = driveLink;
    if (driveFileId) track.driveFileId = driveFileId;

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], "readwrite");
      const store = transaction.objectStore(this.storeName);
      const request = store.put(track);

      request.onsuccess = () => resolve(track);
      request.onerror = (e) => reject(e.target.error);
    });
  }

  /**
   * Delete track by ID
   * @param {string} id 
   */
  async deleteTrack(id) {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], "readwrite");
      const store = transaction.objectStore(this.storeName);
      const request = store.delete(id);

      request.onsuccess = () => resolve(true);
      request.onerror = (e) => reject(e.target.error);
    });
  }

  // =========================================================================
  // LocalStorage Settings Helper
  // =========================================================================
  static getSettings() {
    const keys = window.APP_CONFIG.STORAGE_KEYS;
    return {
      gcpApiKey: localStorage.getItem(keys.API_KEY_GCP) || "",
      hfParlerUrl: localStorage.getItem(keys.HF_SPACE_PARLER_URL) || window.APP_CONFIG.ENGINES.ENGINE_2_HF_PARLER.defaultSpaceUrl,
      hfIndicTTSUrl: localStorage.getItem(keys.HF_SPACE_INDICTTS_URL) || window.APP_CONFIG.ENGINES.ENGINE_3_HF_INDICTTS.defaultSpaceUrl,
      hfToken: localStorage.getItem(keys.HF_TOKEN) || "",
      appsScriptUrl: localStorage.getItem(keys.GOOGLE_APPS_SCRIPT_URL) || "",
      activeEngine: localStorage.getItem(keys.ACTIVE_ENGINE) || "demo_web_speech",
      activeMode: localStorage.getItem(keys.ACTIVE_MODE) || "two-speaker",
      pauseMs: parseInt(localStorage.getItem("ca_studio_pause_ms") || "400", 10),
      sampleRate: parseInt(localStorage.getItem("ca_studio_sample_rate") || "24000", 10)
    };
  }

  static saveSettings(settings) {
    const keys = window.APP_CONFIG.STORAGE_KEYS;
    if (settings.gcpApiKey !== undefined) localStorage.setItem(keys.API_KEY_GCP, settings.gcpApiKey.trim());
    if (settings.hfParlerUrl !== undefined) localStorage.setItem(keys.HF_SPACE_PARLER_URL, settings.hfParlerUrl.trim());
    if (settings.hfIndicTTSUrl !== undefined) localStorage.setItem(keys.HF_SPACE_INDICTTS_URL, settings.hfIndicTTSUrl.trim());
    if (settings.hfToken !== undefined) localStorage.setItem(keys.HF_TOKEN, settings.hfToken.trim());
    if (settings.appsScriptUrl !== undefined) localStorage.setItem(keys.GOOGLE_APPS_SCRIPT_URL, settings.appsScriptUrl.trim());
    if (settings.activeEngine !== undefined) localStorage.setItem(keys.ACTIVE_ENGINE, settings.activeEngine);
    if (settings.activeMode !== undefined) localStorage.setItem(keys.ACTIVE_MODE, settings.activeMode);
    if (settings.pauseMs !== undefined) localStorage.setItem("ca_studio_pause_ms", settings.pauseMs.toString());
    if (settings.sampleRate !== undefined) localStorage.setItem("ca_studio_sample_rate", settings.sampleRate.toString());
  }
}

window.StorageManager = StorageManager;
