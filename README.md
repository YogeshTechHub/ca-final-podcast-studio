# CA Final Revision Podcast Studio 🎙️📚

A production-ready, zero-build Single Page Application (SPA) hosted on **GitHub Pages** that converts two-speaker Tanglish/Tamil/English dialogue scripts and single-speaker theory notes (Auditing, Taxation, Corporate Law, Financial Reporting) into high-quality, stitched study audio podcasts.

---

## 🌟 Key Features

### 1. Triple-Engine TTS Switcher (Top Bar)
- **[Engine 1] Google Cloud Neural2 TTS (`ta-IN` / `en-IN`)**:
  - Uses Google Cloud Text-to-Speech REST API.
  - Sub-second latency (<1s per turn) with natural inflection.
  - **Speaker 1**: `ta-IN-Neural2-A` (Curious Student - Female)
  - **Speaker 2**: `ta-IN-Neural2-B` (Anna/Senior Faculty - Male)
  - API keys stored securely in browser `localStorage`.
  - **Free Tier**: 1 Million characters free per month.
- **[Engine 2] AI4Bharat Indic Parler-TTS on Hugging Face ZeroGPU**:
  - Connects to Hugging Face Spaces running AI4Bharat's 1B Parler-TTS model on an A10G GPU.
  - **ZeroGPU Allowance Protection**: Packs and dispatches all dialogue turns in a single batch request under one GPU lease instead of separate turn-by-turn API calls, preserving the 5-minute daily GPU quota.
- **[Engine 3] AI4Bharat Indic-TTS on Hugging Face Free CPU (100% Unlimited)**:
  - Connects to lightweight FastSpeech2/VITS Space running on 2 free vCPUs.
  - 100% unlimited, runs all day with zero quota anxiety.
  - Real-time turn-by-turn progress streaming with status indicators.
- **[Demo Mode] Instant Browser Speech & Acoustic Synthesis**:
  - Built-in offline testing engine that requires **zero API keys**. Any student can parse scripts, synthesize, stitch audio buffers, scrub waveforms, and test in 5 seconds.

### 2. Dual Podcast Modes: Two-Speaker & Single-Speaker
- **Two-Speaker Dialogue Mode**:
  - Accepts tags: `Speaker 1: ...`, `Speaker 2: ...`, and `Fast Recap: ...`.
  - Maps Student to Voice A and Mentor to Voice B with custom pitch and pacing.
- **Single-Speaker Solo Capsule Mode**:
  - Converts rapid exam capsules and raw study notes into single-voice revision lectures.
  - Select between **Mentor Voice** or **Student Voice**.

### 3. Smart CA Terminology & Tanglish Phonetics Pre-Processor
- Prevents TTS engines from mispronouncing Indian CA terms and section numbers:
  - `SA 200` &rarr; *"S A 200"*
  - `Section 80-IAC` &rarr; *"Section 80 I A C"*
  - `CARO 2020` &rarr; *"CARO 2020"*
  - `NCLT / NFRA / ITAT / CBDT / CBIC / IBC / SEBI / PMLA / GST / ITC` &rarr; expanded with natural pauses.
  - Conversational Tanglish cadences (*ah?*, *correct ah,*, *illa?*) adjusted for natural speech synthesis.

### 4. Web Audio API Offline Audio Stitcher & Master WAV Export
- Concatenates audio buffers using `OfflineAudioContext`.
- Inserts customizable conversational pause gaps (slider: 100ms – 1500ms, default 400ms).
- Gain normalization balances listening volume between loud and quiet speakers.
- Encodes clean, master 16-bit PCM RIFF `.wav` audio at 24 kHz or 44.1 kHz.

### 5. Interactive Study Player
- High-DPI Canvas waveform visualizer with click-and-drag scrubber.
- Fast exam revision speed toggles: **1.0x, 1.25x, 1.5x, 2.0x**.
- Skip buttons: **-10s** and **+10s**.
- Turn-by-turn synchronized highlighting (active speaker card lights up as audio plays).

### 6. Local Offline Storage & Google Platform Sync
- **Browser IndexedDB**: Stores audio files locally so past revisions can be played anytime offline.
- **1-Click Google Drive & Sheets Sync**: Webhook (`Code.gs`) saves the `.wav` file into Google Drive (`CA_Final_Revision_Audio/YYYY-MM-DD_[Subject]_[Topic].wav`) and logs metadata to a companion Google Sheet.

---

## 🚀 Setup & Deployment Guide

### STEP 1: Get Google Cloud TTS API Key (Engine 1)
1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project (e.g. `ca-podcast-studio`).
3. In the search bar, search for **"Cloud Text-to-Speech API"** and click **Enable**.
4. Go to **APIs & Services > Credentials**.
5. Click **+ Create Credentials > API Key**.
6. (Recommended) Click **Edit API Key** > under **API Restrictions**, select **Cloud Text-to-Speech API** and save.
7. Open **CA Final Revision Podcast Studio**, click the **Settings (Gear)** icon in the top right, and paste your API key into **Google Cloud TTS API Key**.

> 💡 **Google Cloud Free Tier:** Gives **1,000,000 characters per month free** for Neural2 voices every month.

---

### STEP 2: Deploy Hugging Face Spaces (Engines 2 & 3)

#### For Engine 2: AI4Bharat Indic Parler-TTS on ZeroGPU
1. Sign in to [Hugging Face](https://huggingface.co).
2. Go to the official [AI4Bharat Indic Parler-TTS Space](https://huggingface.co/spaces/ai4bharat/indic-parler-tts) or duplicate it to your own account.
3. In space settings, ensure hardware is set to **ZeroGPU** (free).
4. Copy the Space URL (e.g., `https://ai4bharat-indic-parler-tts.hf.space` or `https://<your-username>-indic-parler-tts.hf.space`).
5. Paste it in the Studio **Settings > Hugging Face Parler-TTS Space URL**.

#### For Engine 3: AI4Bharat Indic-TTS on Free CPU
1. Go to [AI4Bharat Indic-TTS Free Space](https://huggingface.co/spaces/ai4bharat/indic-tts-free) or duplicate it to a free 2 vCPU Space.
2. Copy the Space URL and paste it in **Settings > Hugging Face Indic-TTS Free CPU Space URL**.

---

### STEP 3: Deploy Companion Google Apps Script (`Code.gs`)

1. Open [Google Drive](https://drive.google.com).
2. Click **+ New > More > Google Apps Script**.
3. Replace the default code with the contents of [`backend/Code.gs`](backend/Code.gs).
4. Click **Deploy > New deployment**.
5. Choose gear icon **Select type > Web app**.
6. Fill in:
   - **Description**: `CA Final Podcast Studio Sync`
   - **Execute as**: `Me (your Google email)`
   - **Who has access**: `Anyone` *(Crucial: allows client-side fetch from GitHub Pages without requiring OAuth login)*
7. Click **Deploy** and grant Google Drive / Google Sheets permissions.
8. Copy the generated **Web App URL** (e.g., `https://script.google.com/macros/s/.../exec`).
9. In the Studio Settings modal, paste this URL into **Google Apps Script Web App URL** and click **Test Connection**.

---

### STEP 4: Deploy to GitHub Pages (1-Click Deployment)

Because this application uses a pure static web architecture (HTML5, vanilla JS ES6, CSS, and Tailwind CDN), **no Node.js build step is required**.

1. Create a new GitHub repository (e.g. `ca-final-podcast-studio`).
2. Push this project folder to your repository:
   ```bash
   git init
   git add .
   git commit -m "Initial release of CA Final Revision Podcast Studio"
   git branch -M main
   git remote add origin https://github.com/<your-username>/ca-final-podcast-studio.git
   git push -u origin main
   ```
3. On GitHub, navigate to your repository's **Settings > Pages**.
4. Under **Build and deployment > Source**, select **Deploy from a branch**.
5. Select branch `main` and folder `/ (root)`, then click **Save**.
6. Within 60 seconds, your site is live at:
   `https://<your-username>.github.io/ca-final-podcast-studio/`

---

## 📁 Repository Structure

```
.
├── index.html               # Main SPA entry point (Tailwind CSS CDN + Modern UI)
├── css/
│   └── custom.css           # Waveform canvas, animations, scrollbars, and turn card styles
├── js/
│   ├── config.js            # Voice mappings, CA subjects, and preloaded Tanglish templates
│   ├── phonetics.js         # CA acronyms & Tanglish pronunciation pre-processor
│   ├── parser.js            # Dialogue & Solo script parser with boundary chunking (<400 chars)
│   ├── wav-encoder.js       # Pure JS 16-bit PCM RIFF WAV audio encoder
│   ├── audio-stitcher.js    # OfflineAudioContext buffer concatenation, pause & gain normalizer
│   ├── tts-engines.js       # Triple-engine abstraction (Google Cloud, HF ZeroGPU, HF CPU, Demo)
│   ├── storage.js           # IndexedDB persistent audio cache & localStorage settings
│   ├── visualizer.js        # Canvas waveform visualizer, scrubber & real-time turn sync
│   └── app.js               # Application coordinator & event bindings
├── backend/
│   └── Code.gs              # Google Apps Script webhook for Google Drive & Sheets logging
└── README.md                # Complete architectural & deployment documentation
```

---

## 🎓 Included Preloaded CA Final Scripts
- **Direct Tax**: *ESOP Valuation & Section 80-IAC Startup Exemption (Tanglish Dialogue)*
- **Direct Tax**: *Section 80-IAC 100% Profit Deduction (Single-Speaker Solo Lecture)*
- **Auditing**: *SA 200 Professional Skepticism & Inherent Limitations (Tanglish Dialogue)*
- **Auditing**: *SA 200 Core Principles (Single-Speaker Solo Capsule)*
- **Financial Reporting**: *Ind AS 115 5-Step Model for Revenue Recognition (Tanglish Dialogue)*
- **Corporate Law**: *Companies Act Section 241-244 Oppression & Mismanagement (Tanglish Dialogue)*

---

## 🔒 Security & Privacy Notice
- API keys entered into the Settings modal are stored **exclusively in your browser's `localStorage`**.
- No keys, tokens, or audio files are ever sent to intermediate third-party servers.
- Direct API calls are made only to Google Cloud, Hugging Face, or your own Google Apps Script webhook.
