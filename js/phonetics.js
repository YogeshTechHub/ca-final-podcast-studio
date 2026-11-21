/**
 * CA Final Phonetic & Tanglish Pronunciation Pre-Processor
 * Solves common Indian CA terminology mispronunciations in TTS engines.
 */

const PhoneticsProcessor = {
  // Common CA abbreviations expanded with natural phonetic pauses
  ACRONYMS: [
    { pattern: /\bSA\s*(\d{3,4})\b/gi, replacement: "S A $1" },
    { pattern: /\bInd\s*AS\s*(\d{1,3})\b/gi, replacement: "Ind A S $1" },
    { pattern: /\bSec\.\s*(\d+)/gi, replacement: "Section $1" },
    { pattern: /\bSection\s*(\d+)-([A-Z]{1,4})\b/gi, replacement: "Section $1 $2" },
    { pattern: /\b80-IAC\b/gi, replacement: "80 I A C" },
    { pattern: /\b80-IA\b/gi, replacement: "80 I A" },
    { pattern: /\b115BAB\b/gi, replacement: "115 B A B" },
    { pattern: /\b115BAA\b/gi, replacement: "115 B A A" },
    { pattern: /\bCARO\b/gi, replacement: "CARO" },
    { pattern: /\bNCLT\b/gi, replacement: "N C L T" },
    { pattern: /\bNCLAT\b/gi, replacement: "N C L A T" },
    { pattern: /\bNFRA\b/gi, replacement: "N F R A" },
    { pattern: /\bITAT\b/gi, replacement: "I T A T" },
    { pattern: /\bCBDT\b/gi, replacement: "C B D T" },
    { pattern: /\bCBIC\b/gi, replacement: "C B I C" },
    { pattern: /\bPMLA\b/gi, replacement: "P M L A" },
    { pattern: /\bIBC\b/gi, replacement: "I B C" },
    { pattern: /\bSEBI\b/gi, replacement: "S E B I" },
    { pattern: /\bTDS\b/gi, replacement: "T D S" },
    { pattern: /\bTCS\b/gi, replacement: "T C S" },
    { pattern: /\bITC\b/gi, replacement: "I T C" },
    { pattern: /\bGST\b/gi, replacement: "G S T" },
    { pattern: /\bROC\b/gi, replacement: "R O C" },
    { pattern: /\bDIN\b/gi, replacement: "D I N" },
    { pattern: /\bMCA\b/gi, replacement: "M C A" },
    { pattern: /\bICAI\b/gi, replacement: "I C A I" },
    { pattern: /\bMCQ\b/gi, replacement: "M C Q" },
    { pattern: /\bMCQs\b/gi, replacement: "M C Qs" },
    { pattern: /\bFMV\b/gi, replacement: "Fair Market Value" },
    { pattern: /\bESOP\b/gi, replacement: "E S O P" },
    { pattern: /\bESOPs\b/gi, replacement: "E S O Ps" }
  ],

  // Tanglish Conversational fillers - ensure natural punctuation for speech synthesis
  TANGLISH_POLISHERS: [
    { pattern: /\bah\?/gi, replacement: " ah?" },
    { pattern: /\baa\?/gi, replacement: " aa?" },
    { pattern: /\billa\?/gi, replacement: " illa?" },
    { pattern: /\bcorrect ah\b/gi, replacement: "correct ah," }
  ],

  /**
   * Preprocesses raw text for natural pronunciation
   * @param {string} text - Raw input dialogue string
   * @returns {string} - Cleaned text ready for TTS synthesis
   */
  process(text) {
    if (!text) return "";
    let cleaned = text;

    // Apply Acronym transformations
    for (const item of this.ACRONYMS) {
      cleaned = cleaned.replace(item.pattern, item.replacement);
    }

    // Apply Tanglish speech cadences
    for (const item of this.TANGLISH_POLISHERS) {
      cleaned = cleaned.replace(item.pattern, item.replacement);
    }

    // Clean whitespace and normalize hyphens/dashes
    cleaned = cleaned.replace(/—|–/g, ", ");
    cleaned = cleaned.replace(/\s+/g, " ").trim();

    return cleaned;
  },

  /**
   * Wraps text into SSML format for Google Cloud Neural2 TTS if SSML is enabled
   * @param {string} text - Processed text
   * @param {number} rate - Speaking rate
   * @param {number} pitch - Pitch adjustment
   * @returns {string} - Valid SSML
   */
  toSSML(text, rate = 1.0, pitch = 0.0) {
    const pitchStr = pitch >= 0 ? `+${pitch}st` : `${pitch}st`;
    const rateStr = `${Math.round(rate * 100)}%`;
    // Escape XML entities
    const safeText = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");

    return `<speak><prosody rate="${rateStr}" pitch="${pitchStr}">${safeText}</prosody></speak>`;
  }
};

window.PhoneticsProcessor = PhoneticsProcessor;
