# Google Sheets Response Service

The contact form uses a Google Apps Script web app to store submissions in a Google Sheet and load the shared response list. Contact messages no longer use browser `localStorage`; the light/dark theme preference still does.

## Deploy the Apps Script

1. Create a Google spreadsheet for portfolio responses and copy its spreadsheet ID from the URL.
2. Open **Extensions → Apps Script** from that spreadsheet and replace the starter code with `apps-script/Code.gs`.
3. In Apps Script, open **Project Settings → Script Properties** and add `SHEET_ID` with the copied spreadsheet ID as its value. The script creates a `Responses` tab and header row on first use.
4. Choose **Deploy → New deployment → Web app**. Set **Execute as** to your account and **Who has access** to **Anyone**, then deploy and authorize it.
5. Copy the deployed web app URL. It should end in `/exec`.
6. In `script.js`, replace `PASTE_APPS_SCRIPT_WEB_APP_URL_HERE` in `appsScriptUrl` with that URL.
7. Reload the portfolio and submit a test response. Verify it appears in the sheet and in the Responses section.

## Data and Access

The sheet stores the submitter's name, email, message, generated ID, and server timestamp. The public response endpoint returns names, messages, and timestamps, but not email addresses. Anyone who can access the deployed web app can submit messages and read the public response list; the web app URL is not a secret or an authentication mechanism. Add abuse controls or use an authenticated backend before collecting sensitive information.

The website uses JSONP to read responses and a simple cross-origin POST to submit them. Serve the site from HTTPS or a local development server while testing. Apps Script changes may require a new deployment version after edits.