const CONFIG_ = Object.freeze({
  spreadsheetId: '1T7FnYrQsvke3ktocDuykok8chlmQS86-mq17AGzp2gM',
  sheetName: 'MindaNOW Registrations',
  organizerEmail: 'almanalaysay93@gmail.com',
  eventName: '5th Transplant MindaNOW',
  professions: ['Transplant Surgeon', 'Transplant Nurse', 'Nephrologist', 'Transplant Anesthesiologist', 'General Practitioner', 'Guest']
});
const HEADERS_ = ['Registered at', 'Reference', 'First name', 'Last name', 'Email', 'Phone', 'Profession', 'Institution', 'City / Province', 'Consent', 'Consent version', 'Guest email', 'Organizer email', 'Last email attempt', 'Email attempts', 'Email note'];

function doGet() {
  const template = HtmlService.createTemplateFromFile('Index');
  return template.evaluate().setTitle(CONFIG_.eventName + ' | Registration')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

// The page on the public domain posts the registration here as JSON text.
// The reply never includes an error detail, so a caller learns nothing about the sheet.
function doPost(e) {
  let reply;
  try {
    reply = registerGuest(JSON.parse(e.postData.contents));
  } catch (error) {
    reply = { ok: false };
  }
  return ContentService.createTextOutput(JSON.stringify(reply)).setMimeType(ContentService.MimeType.JSON);
}

// Only this registration action is exposed to the HTML client.
function registerGuest(payload) {
  const guest = validate_(payload);
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) throw new Error('Registration is busy. Please try again.');
  try {
    const sheet = sheet_();
    const count = sheet.getLastRow();
    if (count > 1) {
      const emails = sheet.getRange(2, 5, count - 1, 1).getValues();
      if (emails.some(function (row) { return raw_(row[0]).toLowerCase() === guest.email; })) {
        return { ok: true, duplicate: true };
      }
    }
    const reference = 'MN-' + Utilities.getUuid().replace(/-/g, '').slice(0, 12).toUpperCase();
    const row = [new Date(), reference, guest.firstName, guest.lastName, guest.email, guest.phone,
      guest.profession, guest.institution, guest.city, 'Yes', '2026-10-07', 'pending', 'pending', '', 0, ''];
    sheet.appendRow(row.map(safeCell_));
    SpreadsheetApp.flush();
    const rowNumber = sheet.getLastRow();
    // The reply does not wait for email. A one-time trigger sends the two emails about a minute later.
    // A saved registration stays successful even when the trigger or the mail fails.
    if (queueEmailRun_()) return { ok: true, reference: reference, emailStatus: 'queued' };
    try { deliver_(sheet, rowNumber, row); } catch (error) { console.warn('Email queue remains pending.'); }
    return { ok: true, reference: reference, emailStatus: row[11] === 'sent' ? 'sent' : 'pending' };
  } finally {
    lock.releaseLock();
  }
}

// Schedules one email run. Returns false when it cannot, and the caller then sends the email at once.
// The hourly retry trigger still covers every row that stays pending.
function queueEmailRun_() {
  try {
    const properties = PropertiesService.getScriptProperties();
    const queuedAt = Number(properties.getProperty('emailRunQueuedAt')) || 0;
    // A run that was scheduled in the last 2 minutes has not started, so it also sends this row.
    if (Date.now() - queuedAt < 120000) return true;
    ScriptApp.newTrigger('sendQueuedEmails_').timeBased().after(1000).create();
    properties.setProperty('emailRunQueuedAt', String(Date.now()));
    return true;
  } catch (error) {
    console.warn('Email run was not scheduled.');
    return false;
  }
}

function sendQueuedEmails_() {
  // Clear the marker first, so a registration that arrives during this run schedules a new run.
  PropertiesService.getScriptProperties().deleteProperty('emailRunQueuedAt');
  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    if (trigger.getHandlerFunction() === 'sendQueuedEmails_') ScriptApp.deleteTrigger(trigger);
  });
  retryPendingEmails_();
}

function validate_(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('Please complete the registration form.');
  if (payload.website) throw new Error('Unable to accept this submission.');
  if (payload.consent !== true) throw new Error('Please accept the registration privacy notice.');
  const guest = {};
  [['firstName', 80, true], ['lastName', 80, true], ['email', 254, true], ['phone', 30, false],
    ['profession', 60, true], ['institution', 160, true], ['city', 100, true]].forEach(function (field) {
    const value = payload[field[0]];
    if (value != null && typeof value !== 'string') throw new Error('Invalid ' + field[0] + '.');
    const text = (value || '').trim();
    if ((field[2] && !text) || text.length > field[1] || /[\u0000-\u001f\u007f]/.test(text)) {
      throw new Error('Please check ' + field[0] + '.');
    }
    guest[field[0]] = text;
  });
  guest.email = guest.email.toLowerCase();
  if (!/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/i.test(guest.email)) {
    throw new Error('Please enter a valid email address.');
  }
  if (guest.phone && !/^[+()0-9 .-]{5,30}$/.test(guest.phone)) throw new Error('Please check your phone number.');
  if (CONFIG_.professions.indexOf(guest.profession) < 0) throw new Error('Please select your profession.');
  return guest;
}

function safeCell_(value) {
  return typeof value === 'string' && /^[=+\-@]/.test(value) ? "'" + value : value;
}

function raw_(value) {
  return String(value == null ? '' : value).replace(/^'(?=[=+\-@])/, '');
}

function sheet_() {
  const spreadsheet = SpreadsheetApp.openById(CONFIG_.spreadsheetId);
  let sheet = spreadsheet.getSheetByName(CONFIG_.sheetName);
  if (!sheet) sheet = spreadsheet.insertSheet(CONFIG_.sheetName);
  if (sheet.getLastRow() === 0) sheet.getRange(1, 1, 1, HEADERS_.length).setValues([HEADERS_]);
  const actual = sheet.getRange(1, 1, 1, HEADERS_.length).getValues()[0];
  if (!HEADERS_.every(function (header, index) { return actual[index] === header; })) {
    throw new Error('Registration is temporarily unavailable. Please contact the organizer.');
  }
  return sheet;
}

// Run once from the Apps Script editor as the deployment owner.
function setup_() {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sheet = sheet_();
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, HEADERS_.length).setFontWeight('bold').setBackground('#092f64').setFontColor('#ffffff');
    const rows = Math.max(sheet.getMaxRows() - 1, 1);
    sheet.getRange(2, 1, rows, 1).setNumberFormat('yyyy-mm-dd hh:mm:ss');
    sheet.getRange(2, 2, rows, 12).setNumberFormat('@');
    sheet.getRange(2, 14, rows, 1).setNumberFormat('yyyy-mm-dd hh:mm:ss');
    sheet.setColumnWidth(5, 260);
    sheet.setColumnWidth(7, 220);
    sheet.setColumnWidth(8, 260);
    if (!ScriptApp.getProjectTriggers().some(function (trigger) { return trigger.getHandlerFunction() === 'retryPendingEmails_'; })) {
      ScriptApp.newTrigger('retryPendingEmails_').timeBased().everyHours(1).create();
    }
    // This call requests mail permission before the first guest arrives.
    MailApp.getRemainingDailyQuota();
    return 'Setup complete. The hourly email retry trigger is installed.';
  } finally { lock.releaseLock(); }
}

function deliver_(sheet, rowNumber, row) {
  const guestEmail = raw_(row[4]);
  const name = raw_(row[2]) + ' ' + raw_(row[3]);
  const details = 'Reference: ' + row[1] + '\nName: ' + name + '\nProfession: ' + raw_(row[6]) +
    '\nInstitution / Organization: ' + raw_(row[7]) + '\nCity / Province: ' + raw_(row[8]);
  const pending = '\n\nEvent date: November 5, 2026.\nVenue: Mahogany Room, JICA Building (JICA OPD Building), Southern Philippines Medical Center, Davao City.\nThe program is subject to confirmation.';
  const messages = [
    { column: 11, to: guestEmail, subject: 'RSVP received | ' + CONFIG_.eventName,
      body: 'Hello ' + name + ',\n\nWe received your registration for ' + CONFIG_.eventName + '.\n\n' + details + pending +
        '\n\nKeep this email as your registration record.\nFor questions or corrections, reply to this email.\n\n' + CONFIG_.eventName + ' Organizing Team' },
    { column: 12, to: CONFIG_.organizerEmail, subject: 'New registration | ' + CONFIG_.eventName,
      body: 'A participant registered for ' + CONFIG_.eventName + '.\n\n' + details + '\nEmail: ' + guestEmail +
        '\nPhone: ' + (raw_(row[5]) || 'Not provided') + '\nConsent: Yes' + pending +
        '\n\nRegistration sheet: https://docs.google.com/spreadsheets/d/' + CONFIG_.spreadsheetId + '/edit' }
  ];
  let attempted = false;
  let note = '';
  messages.forEach(function (message) {
    if (row[message.column] === 'sent') return;
    try {
      if (MailApp.getRemainingDailyQuota() < 1) { note = 'Pending: email quota. Automatic retry is scheduled.'; return; }
      if (!attempted) { row[13] = new Date(); row[14] = Number(row[14] || 0) + 1; attempted = true; }
      MailApp.sendEmail({ to: message.to, subject: message.subject, body: message.body,
        name: CONFIG_.eventName, replyTo: CONFIG_.organizerEmail });
      row[message.column] = 'sent';
      // Save each delivery separately so later failures do not resend successful mail.
      sheet.getRange(rowNumber, message.column + 1).setValue('sent');
      SpreadsheetApp.flush();
    } catch (error) {
      note = 'Pending: email service error. Automatic retry is scheduled.';
      console.warn('Registration email service error.');
    }
  });
  row[15] = row[11] === 'sent' && row[12] === 'sent' ? '' : note;
  sheet.getRange(rowNumber, 14, 1, 3).setValues([[row[13], row[14], row[15]]]);
}

function retryPendingEmails_() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return;
  try {
    const sheet = sheet_();
    if (sheet.getLastRow() < 2) return;
    const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, HEADERS_.length).getValues();
    const properties = PropertiesService.getScriptProperties();
    const cursor = (Number(properties.getProperty('emailRetryCursor')) || 0) % rows.length;
    let next = cursor;
    const started = Date.now();
    let attempted = 0;
    for (let offset = 0; offset < rows.length; offset++) {
      if (Date.now() - started > 45000 || attempted >= 30 || MailApp.getRemainingDailyQuota() < 1) break;
      const index = (cursor + offset) % rows.length;
      next = (index + 1) % rows.length;
      if (rows[index][11] === 'sent' && rows[index][12] === 'sent') continue;
      try { deliver_(sheet, index + 2, rows[index]); } catch (error) { console.warn('Email queue update failed.'); }
      attempted++;
    }
    properties.setProperty('emailRetryCursor', String(next));
  } finally { lock.releaseLock(); }
}
