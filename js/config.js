/**
 * CA Final Revision Podcast Studio - Configuration & Templates
 * Includes: Default Voice Mappings, CA Subjects, Tanglish Dialogue & Solo Templates
 */

const APP_CONFIG = {
  APP_NAME: "CA Final Revision Podcast Studio",
  VERSION: "1.0.0",
  DEFAULT_SAMPLE_RATE: 24000,
  DEFAULT_PAUSE_MS: 400, // pause between speaker turns
  DEFAULT_SOLO_PAUSE_MS: 250, // pause between paragraph chunks in solo mode
  DEFAULT_CREDENTIALS: {
    GCP_API_KEY: "",
    HF_TOKEN: ""
  },
  STORAGE_KEYS: {
    API_KEY_GCP: "ca_studio_gcp_api_key",
    HF_SPACE_PARLER_URL: "ca_studio_hf_parler_url",
    HF_SPACE_INDICTTS_URL: "ca_studio_hf_indictts_url",
    HF_TOKEN: "ca_studio_hf_token",
    GOOGLE_APPS_SCRIPT_URL: "ca_studio_apps_script_url",
    APP_SETTINGS: "ca_studio_settings",
    ACTIVE_ENGINE: "ca_studio_active_engine",
    ACTIVE_MODE: "ca_studio_active_mode"
  },
  
  // Supported Podcast Generation Modes
  MODES: {
    TWO_SPEAKER: "two-speaker",    // Conversational Student & Mentor dialogue
    SINGLE_SPEAKER: "single-speaker" // Solo Revision Lecture / Audio Summary
  },

  // TTS Engine Definitions
  ENGINES: {
    ENGINE_1_GCP: {
      id: "gcp_neural2",
      name: "Google Cloud Neural2",
      badge: "High Quality (<1s)",
      description: "Fast sub-second latency with official Google Cloud Neural2 (ta-IN / en-IN). Free 1M chars/mo.",
      voices: {
        speaker1: {
          id: "ta-IN-Neural2-A",
          name: "Speaker 1: Meena (Curious Student)",
          gender: "FEMALE",
          languageCode: "ta-IN",
          pitch: 0.0,
          speakingRate: 1.05
        },
        speaker2: {
          id: "ta-IN-Neural2-B",
          name: "Speaker 2: Anna / Mentor (Senior Faculty)",
          gender: "MALE",
          languageCode: "ta-IN",
          pitch: -1.0,
          speakingRate: 1.0
        },
        // Alternate English-India voices if desired
        en_speaker1: {
          id: "en-IN-Neural2-A",
          name: "Student (English IN - Female)",
          gender: "FEMALE",
          languageCode: "en-IN",
          pitch: 0.0,
          speakingRate: 1.0
        },
        en_speaker2: {
          id: "en-IN-Neural2-B",
          name: "Mentor (English IN - Male)",
          gender: "MALE",
          languageCode: "en-IN",
          pitch: -0.5,
          speakingRate: 0.98
        }
      }
    },
    ENGINE_2_HF_PARLER: {
      id: "hf_parler",
      name: "AI4Bharat Parler-TTS",
      badge: "Custom HF Space",
      description: "AI4Bharat Parler-TTS on Hugging Face. Note: Public Space is paused; duplicate to your own HF Space & paste URL in Settings.",
      defaultSpaceUrl: "https://ai4bharat-indic-parler-tts.hf.space",
      speaker1Prompt: "A young female Indian student speaking in an expressive, curious Tanglish tone, close microphone, studio audio.",
      speaker2Prompt: "A knowledgeable Indian male mentor speaking calmly in clear, authoritative Tanglish, studio quality."
    },
    ENGINE_3_HF_INDICTTS: {
      id: "hf_indictts",
      name: "AI4Bharat Indic-TTS",
      badge: "Custom Gradio Space",
      description: "Connect your own Hugging Face Gradio Indic-TTS Space URL in Settings.",
      defaultSpaceUrl: "",
      genderA: "female",
      genderB: "male"
    },
    ENGINE_DEMO_WEB_SPEECH: {
      id: "demo_web_speech",
      name: "Browser Voices (Free)",
      badge: "100% Free · Ready Now",
      description: "Speaks using real Indian/English voices built into Chrome & Edge. Zero API keys, zero billing.",
      voices: {
        speaker1: {
          name: "Meena (Student)",
          gender: "FEMALE",
          preferredVoices: [
            "Microsoft Neerja Online (Natural) - English (India)",
            "Microsoft Heera",
            "Google हिन्दी",
            "Veena",
            "ta-IN",
            "en-IN"
          ],
          pitch: 1.12,
          rate: 1.04
        },
        speaker2: {
          name: "Anna / Mentor",
          gender: "MALE",
          preferredVoices: [
            "Microsoft Prabhat Online (Natural) - English (India)",
            "Microsoft Ravi",
            "Google US English",
            "Rishi",
            "ta-IN",
            "en-IN"
          ],
          pitch: 0.92,
          rate: 0.98
        }
      }
    }
  },

  // CA Final Subjects
  SUBJECTS: [
    { id: "audit", name: "Paper 3: Advanced Auditing, Assurance & Professional Ethics", code: "Auditing (SAs)" },
    { id: "dt", name: "Paper 4: Direct Tax Laws & International Taxation", code: "Direct Tax (DT)" },
    { id: "law", name: "Corporate & Economic Laws (IBC, Companies Act, SEBI)", code: "Corporate Law" },
    { id: "fr", name: "Paper 1: Financial Reporting (Ind AS & Conceptual Framework)", code: "Financial Reporting (Ind AS)" },
    { id: "idt", name: "Paper 5: Indirect Tax Laws (GST, Customs & FTP)", code: "Indirect Tax (GST)" },
    { id: "afm", name: "Paper 2: Advanced Financial Management (AFM)", code: "AFM (Forex & Portfolio)" }
  ],

  // Preloaded Script Templates (Both Two-Speaker Dialogue & Solo Revision)
  TEMPLATES: [
    {
      id: "dt_esop_80iac_dialogue",
      title: "Direct Tax: ESOP Taxation & Section 80-IAC (Two-Speaker Tanglish)",
      subjectId: "dt",
      topic: "ESOP Valuation and Section 80-IAC Startup Exemption",
      mode: "two-speaker",
      script: `Speaker 1: Anna, direct tax revision la Startup ESOP taxation pathi romba confusion irukku. When exactly is tax calculated and paid?
Speaker 2: Super question Meena! Listen carefully. Normal companies la ESOP tax comes in two stages. Stage 1 is Perquisite under Section 17(2) at the time of exercise. Fair Market Value minus exercise price is taxed in the hands of the employee.
Speaker 1: Oh okay Anna! Appo eligible startups under Section 80-IAC kum idhe rules thaan apply aaguma?
Speaker 2: Athu thaan key exam point! For eligible startups registered under Section 80-IAC, TDS and tax payment under Section 192(1C) is deferred. The tax must be paid within 14 days after the expiry of 48 months, or date of leaving the company, or date of sale of shares—whichever is earliest!
Speaker 1: Semba clear Anna! Appo Capital Gains second stage la calculate aagum correct ah?
Speaker 2: Exactly! When the employee sells those shares, Capital Gain is Sale Consideration minus Fair Market Value on exercise date under Section 49(2AA).
Fast Recap: Section 80-IAC startups get ESOP tax deferral up to 48 months or resignation or sale, whichever is earliest. Remember this timeline for MCQ 2 marks guaranteed!`
    },
    {
      id: "dt_esop_80iac_solo",
      title: "Direct Tax: Section 80-IAC Startup Exemption (Single-Speaker Solo Lecture)",
      subjectId: "dt",
      topic: "Section 80-IAC 100% Profit Deduction Solo Revision",
      mode: "single-speaker",
      script: `Welcome to CA Final Direct Tax Quick Capsule. Today we are revising Section 80-IAC deductions for eligible startups.

An eligible startup incorporated between 1st April 2016 and 31st March 2025 with total turnover not exceeding 100 Crores can claim 100% deduction of profits for 3 consecutive assessment years out of 10 years.

Key exam condition number one: It must be certified by the Inter-Ministerial Board of Certification. 

Key condition number two: It should not be formed by splitting up or reconstruction of an existing business, and not more than 20% second-hand machinery can be used.

For ESOP perquisite deferral under Section 192(1C), tax payment is deferred to 14 days from earliest of: expiry of 48 months from end of relevant assessment year, cessation of employment, or actual sale of shares. Revise this before stepping into the exam hall!`
    },
    {
      id: "audit_sa200_dialogue",
      title: "Auditing: SA 200 Independent Auditor Objectives (Two-Speaker Tanglish)",
      subjectId: "audit",
      topic: "SA 200 Professional Skepticism & Inherent Limitations",
      mode: "two-speaker",
      script: `Speaker 1: Anna, SA 200 la Professional Skepticism pathi eppozhum case study questions kekkuranga. How should we present the answer?
Speaker 2: Meena, SA 200 specifies overall objectives. Professional Skepticism means having an attitude that includes a questioning mind, being alert to conditions indicating possible misstatement due to error or fraud, and critical assessment of audit evidence.
Speaker 1: Anna, auditor absolute assurance thara mudiyuma? Can we guarantee that financial statements are 100 percent error-free?
Speaker 2: Never! An auditor can only obtain reasonable assurance, not absolute assurance. Because an audit has inherent limitations!
Speaker 1: Enna reasons Anna inherent limitations ku?
Speaker 2: Four major reasons: Nature of financial reporting involving management estimates, nature of audit procedures where management may conceal fraud, time and cost constraints, and balance between benefit and information cost.
Fast Recap: SA 200 mandates Reasonable Assurance, Professional Skepticism, and adherence to Code of Ethics. Absolute assurance is impossible due to inherent audit limitations.`
    },
    {
      id: "audit_sa200_solo",
      title: "Auditing: SA 200 Core Principles (Single-Speaker Solo Capsule)",
      subjectId: "audit",
      topic: "SA 200 Master Summary & Keywords",
      mode: "single-speaker",
      script: `This is your rapid audio revision for Standards on Auditing 200: Overall Objectives of the Independent Auditor and Conduct of an Audit in Accordance with Standards on Auditing.

The dual objectives under SA 200 are: First, to obtain reasonable assurance whether the financial statements as a whole are free from material misstatement, whether due to fraud or error; and second, to report on the financial statements and communicate as required by SAs.

Professional Skepticism requires three elements: Questioning mind, alertness to contradictory audit evidence, and critical evaluation of management representations.

Inherent limitations arise from: The subjective nature of financial reporting, legal limitations in gathering evidence, necessity for timely reporting, and cost-benefit considerations. Always quote paragraph references in your examination paper!`
    },
    {
      id: "fr_indas115_dialogue",
      title: "Financial Reporting: Ind AS 115 Revenue from Contracts (Two-Speaker)",
      subjectId: "fr",
      topic: "Ind AS 115 5-Step Model for Revenue Recognition",
      mode: "two-speaker",
      script: `Speaker 1: Anna, Ind AS 115 revenue recognition la 5-Step Model exam point of view la eppadi recall pandrathu?
Speaker 2: Super easy mnemonic Meena! Step 1: Identify the Contract with customer. Step 2: Identify separate Performance Obligations in the contract.
Speaker 1: Correct Anna! Then Step 3 is Determine the Transaction Price, right?
Speaker 2: Exactly. Considering variable consideration, significant financing component, and non-cash consideration.
Speaker 1: And Step 4 is allocate the transaction price to each performance obligation on relative standalone selling price basis!
Speaker 2: Spot on! And Step 5: Recognize revenue when or as the entity satisfies a performance obligation over time or at a point in time.
Fast Recap: Step 1 Contract, Step 2 Performance Obligation, Step 3 Transaction Price, Step 4 Allocation, Step 5 Recognition on satisfaction. Master this 5-step framework for 16 marks in FR!`
    },
    {
      id: "law_oppression_dialogue",
      title: "Corporate Law: Section 241-244 Prevention of Oppression & Mismanagement",
      subjectId: "law",
      topic: "Companies Act 2013 Section 241 and 244 Eligibility Thresholds",
      mode: "two-speaker",
      script: `Speaker 1: Anna, Companies Act 2013 la Oppression and Mismanagement section numbers confuse aaguthu.
Speaker 2: No tension Meena. Section 241 is Application to NCLT for relief. Section 244 defines who has the right to apply.
Speaker 1: Eligibility criteria enna Anna for company having share capital?
Speaker 2: Not less than 100 members, OR not less than one-tenth of total number of members, OR members holding not less than 10 percent of issued share capital with paid up calls.
Speaker 1: If company doesn't have share capital?
Speaker 2: Not less than one-fifth of total number of persons on company's register. And remember: NCLT has power to waive this condition!
Fast Recap: Section 241 application to Tribunal, Section 244 eligibility: 100 members or 1/10th members or 10% share capital. Tribunal waiver is discretionary.`
    }
  ]
};

// Export to window
window.APP_CONFIG = APP_CONFIG;
