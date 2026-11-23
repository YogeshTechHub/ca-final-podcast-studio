/**
 * CA Final Revision Podcast Studio - Google Apps Script Webhook
 * 
 * Instructions:
 * 1. Open Google Drive (https://drive.google.com).
 * 2. Click "New" > "More" > "Google Apps Script".
 * 3. Paste this entire code into `Code.gs`.
 * 4. Click "Deploy" > "New deployment".
 * 5. Select type: "Web app".
 * 6. Configuration:
 *    - Description: "CA Final Podcast Studio Sync Webhook"
 *    - Execute as: "Me (your email)"
 *    - Who has access: "Anyone" (allows zero-auth POST from your GitHub Pages frontend)
 * 7. Click "Deploy", authorize permissions, and copy the Web App URL into the web app settings modal.
 */

const FOLDER_NAME = "CA_Final_Revision_Audio";
const SPREADSHEET_NAME = "CA_Final_Revision_Podcast_Logs";

/**
 * Handle OPTIONS preflight for CORS safety
 */
function doOptions(e) {
  return ContentService.createTextOutput("")
    .setMimeType(ContentService.MimeType.TEXT);
}

/**
 * Handle GET request for easy health-check in browser
 */
function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    status: "online",
    message: "CA Final Revision Podcast Studio Webhook is active and ready.",
    timestamp: new Date().toISOString()
  })).setMimeType(ContentService.MimeType.JSON);
}

/**
 * Handle POST request receiving base64 audio and podcast metadata
 */
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return responseJSON({ success: false, error: "Empty request payload" }, 400);
    }

    let payload;
    try {
      payload = JSON.parse(e.postData.contents);
    } catch (parseErr) {
      return responseJSON({ success: false, error: "Invalid JSON in request payload" }, 400);
    }

    const base64Audio = payload.base64Audio;
    const metadata = payload.metadata || {};

    if (!base64Audio) {
      return responseJSON({ success: false, error: "Missing base64Audio in payload" }, 400);
    }

    // 1. Get or Create Google Drive Folder (skipping trashed folders)
    const folder = getOrCreateFolder(FOLDER_NAME);

    // 2. Format File Name: YYYY-MM-DD_[Subject]_[Topic].wav
    const now = new Date();
    const dateStr = Utilities.formatDate(now, "Asia/Kolkata", "yyyy-MM-dd");
    const subjectClean = sanitizeName(metadata.subjectCode || metadata.subject || "CA_FINAL");
    const topicClean = sanitizeName(metadata.topic || "Revision_Capsule");
    const fileName = `${dateStr}_[${subjectClean}]_${topicClean}.wav`;

    // 3. Decode Base64 and Save File to Drive
    const audioBytes = Utilities.base64Decode(base64Audio);
    const audioBlob = Utilities.newBlob(audioBytes, "audio/wav", fileName);
    const driveFile = folder.createFile(audioBlob);
    
    // Set file view permission to anyone with link for easy playback from logs
    try {
      driveFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (shareErr) {
      Logger.log("Notice: Set sharing error: " + shareErr.toString());
    }
    const driveFileUrl = driveFile.getUrl();
    const driveFileId = driveFile.getId();

    // 4. Log to Companion Google Sheet (resilient: sheet errors do not abort Drive sync)
    let sheetUrl = "";
    try {
      sheetUrl = logToGoogleSheet({
        timestamp: Utilities.formatDate(now, "Asia/Kolkata", "yyyy-MM-dd HH:mm:ss"),
        subject: metadata.subject || "CA Final",
        topic: metadata.topic || "Revision",
        mode: metadata.mode || "two-speaker",
        duration: formatDuration(metadata.duration || 0),
        driveLink: driveFileUrl,
        scriptSummary: (metadata.scriptSummary || "").substring(0, 500)
      });
    } catch (sheetErr) {
      Logger.log("Warning: Google Sheet logging failed: " + sheetErr.toString());
      sheetUrl = "Warning: File saved to Drive, but Sheet log was not updated.";
    }

    return responseJSON({
      success: true,
      message: "Podcast audio successfully synced to Google Drive & Sheet",
      fileName: fileName,
      fileId: driveFileId,
      driveLink: driveFileUrl,
      sheetUrl: sheetUrl
    }, 200);

  } catch (error) {
    Logger.log("doPost Error: " + error.toString());
    return responseJSON({
      success: false,
      error: error.toString()
    }, 500);
  }
}

/**
 * Get or create folder in Google Drive (filtering out trashed folders)
 */
function getOrCreateFolder(folderName) {
  const folders = DriveApp.getFoldersByName(folderName);
  while (folders.hasNext()) {
    const folder = folders.next();
    if (!folder.isTrashed()) {
      return folder;
    }
  }
  return DriveApp.createFolder(folderName);
}

/**
 * Log record to Google Sheet (filtering out trashed sheets)
 */
function logToGoogleSheet(data) {
  let spreadsheet = null;
  const files = DriveApp.getFilesByName(SPREADSHEET_NAME);
  
  while (files.hasNext()) {
    const file = files.next();
    if (!file.isTrashed()) {
      spreadsheet = SpreadsheetApp.open(file);
      break;
    }
  }

  if (!spreadsheet) {
    spreadsheet = SpreadsheetApp.create(SPREADSHEET_NAME);
    const sheet = spreadsheet.getActiveSheet();
    sheet.setName("Podcast_Logs");
    // Write headers
    sheet.appendRow([
      "Timestamp (IST)", 
      "Subject", 
      "Topic", 
      "Mode", 
      "Duration", 
      "Google Drive Audio Link", 
      "Script Summary / Tags"
    ]);
    sheet.getRange("A1:G1").setFontWeight("bold").setBackground("#e0e7ff");
    sheet.setFrozenRows(1);
  }

  const sheet = spreadsheet.getSheetByName("Podcast_Logs") || spreadsheet.getActiveSheet();
  sheet.appendRow([
    data.timestamp,
    data.subject,
    data.topic,
    data.mode,
    data.duration,
    data.driveLink,
    data.scriptSummary
  ]);

  return spreadsheet.getUrl();
}

/**
 * Helper to sanitize filenames
 */
function sanitizeName(str) {
  if (!str) return "Capsule";
  return String(str)
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .replace(/_+/g, "_")
    .substring(0, 40) || "Capsule";
}

/**
 * Format duration in seconds to MM:SS
 */
function formatDuration(sec) {
  const sNum = Number(sec) || 0;
  const m = Math.floor(sNum / 60);
  const s = Math.floor(sNum % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

/**
 * Clean CORS JSON response helper
 */
function responseJSON(obj, status) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
