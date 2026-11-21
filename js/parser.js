/**
 * CA Final Dialogue & Solo Script Parser
 * Parses multi-turn dialogue scripts into speech chunks with speaker tagging,
 * whitespace sanitization, and paragraph chunking (>400 chars) at punctuation marks.
 * Supports:
 *  1. Two-Speaker Mode: Speaker 1 (Student), Speaker 2 (Mentor), Fast Recap
 *  2. Single-Speaker Mode: Solo lecture / Audio Capsule with designated voice
 */

class DialogueParser {
  /**
   * Parse a raw script string based on selected mode
   * @param {string} rawScript - Text from script editor
   * @param {string} mode - "two-speaker" or "single-speaker"
   * @param {string} soloSpeakerVoice - 'speaker1' or 'speaker2' (used when mode === 'single-speaker')
   * @returns {Array<Object>} List of speech turn objects: { id, speaker, role, rawText, processedText, charCount }
   */
  static parse(rawScript, mode = "two-speaker", soloSpeakerVoice = "speaker2") {
    if (!rawScript || typeof rawScript !== "string" || !rawScript.trim()) {
      return [];
    }

    if (mode === "single-speaker") {
      return this._parseSingleSpeaker(rawScript, soloSpeakerVoice);
    } else {
      return this._parseTwoSpeaker(rawScript);
    }
  }

  /**
   * Parses two-speaker scripts with Speaker 1 / Speaker 2 / Fast Recap tags
   */
  static _parseTwoSpeaker(rawScript) {
    const lines = rawScript.split(/\r?\n/);
    const turns = [];
    let currentSpeaker = null;
    let currentText = [];

    // Tag matching regex
    const speaker1Regex = /^(?:Speaker\s*1|Meena|Student)\s*:\s*(.*)$/i;
    const speaker2Regex = /^(?:Speaker\s*2|Anna|Mentor|Faculty)\s*:\s*(.*)$/i;
    const fastRecapRegex = /^(?:Fast\s*Recap|Recap|Summary)\s*:\s*(.*)$/i;

    function flushCurrent() {
      if (currentSpeaker && currentText.length > 0) {
        const combined = currentText.join(" ").trim();
        if (combined) {
          turns.push({
            speaker: currentSpeaker,
            text: combined
          });
        }
      }
      currentText = [];
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      let match;
      if ((match = line.match(speaker1Regex))) {
        flushCurrent();
        currentSpeaker = "speaker1";
        if (match[1].trim()) currentText.push(match[1].trim());
      } else if ((match = line.match(speaker2Regex))) {
        flushCurrent();
        currentSpeaker = "speaker2";
        if (match[1].trim()) currentText.push(match[1].trim());
      } else if ((match = line.match(fastRecapRegex))) {
        flushCurrent();
        currentSpeaker = "fast_recap";
        if (match[1].trim()) currentText.push(match[1].trim());
      } else {
        // Continuation of current speaker or untagged fallback
        if (!currentSpeaker) {
          currentSpeaker = "speaker1"; // default initial speaker
        }
        currentText.push(line);
      }
    }
    flushCurrent();

    // Now chunk long turns (>400 characters) at punctuation marks
    const finalTurns = [];
    let globalIndex = 1;

    for (const turn of turns) {
      const chunks = this._chunkAtPunctuation(turn.text, 400);
      chunks.forEach((chunkText, subIdx) => {
        let roleName = "Student (Curious)";
        let speakerKey = turn.speaker;

        if (turn.speaker === "speaker2") {
          roleName = "Anna / Mentor (Explanatory)";
        } else if (turn.speaker === "fast_recap") {
          roleName = "Fast Recap (Rapid Summary)";
          speakerKey = "speaker2"; // Fast recap voiced by mentor
        }

        const processed = window.PhoneticsProcessor 
          ? window.PhoneticsProcessor.process(chunkText) 
          : chunkText;

        finalTurns.push({
          id: `turn_${globalIndex++}`,
          speaker: speakerKey,
          isRecap: turn.speaker === "fast_recap",
          role: roleName,
          subChunk: chunks.length > 1 ? `${subIdx + 1}/${chunks.length}` : null,
          rawText: chunkText,
          processedText: processed,
          charCount: chunkText.length
        });
      });
    }

    return finalTurns;
  }

  /**
   * Parses single-speaker scripts (e.g. lecture notes, capsule summaries)
   */
  static _parseSingleSpeaker(rawScript, soloSpeakerVoice = "speaker2") {
    // Strip any existing Speaker 1 / Speaker 2 tags to allow seamless solo conversion
    const sanitizedScript = rawScript
      .replace(/^(?:Speaker\s*[12]|Meena|Anna|Mentor|Student|Fast\s*Recap)\s*:\s*/gim, "");

    // Split by double newlines or substantial paragraph breaks
    const rawParagraphs = sanitizedScript.split(/\n\s*\n/);
    const finalTurns = [];
    let globalIndex = 1;

    const roleName = soloSpeakerVoice === "speaker1" 
      ? "Solo Revision (Student Voice)" 
      : "Solo Revision (Mentor Voice)";

    for (const paragraph of rawParagraphs) {
      const cleanPara = paragraph.replace(/\s+/g, " ").trim();
      if (!cleanPara) continue;

      const chunks = this._chunkAtPunctuation(cleanPara, 400);
      chunks.forEach((chunkText, subIdx) => {
        const processed = window.PhoneticsProcessor 
          ? window.PhoneticsProcessor.process(chunkText) 
          : chunkText;

        finalTurns.push({
          id: `solo_${globalIndex++}`,
          speaker: soloSpeakerVoice,
          isRecap: false,
          role: roleName,
          subChunk: chunks.length > 1 ? `${subIdx + 1}/${chunks.length}` : null,
          rawText: chunkText,
          processedText: processed,
          charCount: chunkText.length
        });
      });
    }

    return finalTurns;
  }

  /**
   * Chunks long text (>maxChars) at safe sentence or punctuation boundaries
   * @param {string} text - Input text
   * @param {number} maxChars - Maximum characters per chunk (default 400)
   * @returns {Array<string>} Array of chunked strings
   */
  static _chunkAtPunctuation(text, maxChars = 400) {
    if (text.length <= maxChars) return [text];

    const chunks = [];
    let remaining = text.trim();

    while (remaining.length > maxChars) {
      // Look for sentence-ending punctuation closest to maxChars
      const candidateSub = remaining.slice(0, maxChars);
      let splitIdx = -1;

      // Primary delimiters: . ! ? ;
      const primaryRegex = /[.!?؛;]\s+/g;
      let match;
      while ((match = primaryRegex.exec(candidateSub)) !== null) {
        splitIdx = match.index + match[0].length;
      }

      // Secondary delimiters: , :
      if (splitIdx === -1 || splitIdx < maxChars * 0.4) {
        const secondaryRegex = /[,:]\s+/g;
        while ((match = secondaryRegex.exec(candidateSub)) !== null) {
          splitIdx = match.index + match[0].length;
        }
      }

      // Fallback delimiter: space
      if (splitIdx === -1 || splitIdx < maxChars * 0.4) {
        splitIdx = candidateSub.lastIndexOf(" ");
      }

      // Hard break if no delimiter found
      if (splitIdx === -1 || splitIdx === 0) {
        splitIdx = maxChars;
      }

      const chunk = remaining.slice(0, splitIdx).trim();
      if (chunk) chunks.push(chunk);
      remaining = remaining.slice(splitIdx).trim();
    }

    if (remaining.length > 0) {
      chunks.push(remaining);
    }

    return chunks;
  }
}

window.DialogueParser = DialogueParser;
