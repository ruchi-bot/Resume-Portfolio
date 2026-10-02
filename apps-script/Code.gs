const RESPONSE_SHEET_NAME = 'Responses';
const RESPONSE_HEADERS = ['id', 'name', 'email', 'message', 'createdAt'];
const MAX_NAME_LENGTH = 100;
const MAX_EMAIL_LENGTH = 254;
const MAX_MESSAGE_LENGTH = 5000;

function doGet(event) {
  let result;
  try {
    result = { ok: true, responses: readResponses_() };
  } catch (error) {
    result = { ok: false, error: 'Unable to read responses from the spreadsheet.' };
  }

  return output_(result, event && event.parameter && event.parameter.callback);
}

function doPost(event) {
  try {
    const request = JSON.parse(event && event.postData && event.postData.contents || '{}');
    const response = validateResponse_(request);
    const lock = LockService.getScriptLock();
    lock.waitLock(10000);

    try {
      const sheet = getResponseSheet_();
      sheet.appendRow([
        safeSheetValue_(response.id),
        safeSheetValue_(response.name),
        safeSheetValue_(response.email),
        safeSheetValue_(response.message),
        new Date().toISOString()
      ]);
    } finally {
      lock.releaseLock();
    }

    return output_({ ok: true, id: response.id });
  } catch (error) {
    return output_({ ok: false, error: 'The response could not be saved.' });
  }
}

function readResponses_() {
  const sheet = getResponseSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  return sheet.getRange(2, 1, lastRow - 1, RESPONSE_HEADERS.length).getValues()
    .filter(function (row) { return row[0] && row[1] && row[3]; })
    .map(function (row) {
      return {
        id: sheetValue_(row[0]),
        name: sheetValue_(row[1]),
        message: sheetValue_(row[3]),
        createdAt: sheetValue_(row[4])
      };
    })
    .sort(function (first, second) {
      return Date.parse(second.createdAt) - Date.parse(first.createdAt);
    });
}

function validateResponse_(request) {
  if (!request || typeof request !== 'object') throw new Error('Invalid request.');

  const id = textValue_(request.id, 80);
  const name = textValue_(request.name, MAX_NAME_LENGTH);
  const email = textValue_(request.email, MAX_EMAIL_LENGTH);
  const message = textValue_(request.message, MAX_MESSAGE_LENGTH);

  if (!id || !name || !message || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Required response fields are missing or invalid.');
  }

  return { id: id, name: name, email: email, message: message };
}

function textValue_(value, maxLength) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLength);
}

function getResponseSheet_() {
  const spreadsheetId = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  if (!spreadsheetId) throw new Error('Set the SHEET_ID script property.');

  const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
  let sheet = spreadsheet.getSheetByName(RESPONSE_SHEET_NAME);
  if (!sheet) sheet = spreadsheet.insertSheet(RESPONSE_SHEET_NAME);
  if (sheet.getLastRow() === 0) sheet.appendRow(RESPONSE_HEADERS);
  return sheet;
}

function safeSheetValue_(value) {
  return /^[=+@-]/.test(value) ? "'" + value : value;
}

function sheetValue_(value) {
  if (value instanceof Date) return value.toISOString();
  const text = String(value == null ? '' : value);
  return text.replace(/^'(?=[=+@-])/, '');
}

function output_(payload, callback) {
  const json = JSON.stringify(payload);
  if (callback) {
    if (!/^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*$/.test(callback)) {
      return ContentService.createTextOutput('{"ok":false,"error":"Invalid callback."}')
        .setMimeType(ContentService.MimeType.JSON);
    }
    return ContentService.createTextOutput(callback + '(' + json + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}