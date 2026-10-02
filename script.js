const menuToggle = document.querySelector('.menu-toggle');
const primaryNav = document.querySelector('#primary-nav');
const themeToggle = document.querySelector('#theme-toggle');
const themeLabel = document.querySelector('#theme-label');
const themeStorageKey = 'resumePortfolioTheme';

function setTheme(theme, persist = false) {
  const isDark = theme === 'dark';
  document.documentElement.dataset.theme = isDark ? 'dark' : 'light';
  themeToggle.setAttribute('aria-pressed', String(isDark));
  themeToggle.setAttribute('aria-label', `Switch to ${isDark ? 'light' : 'dark'} theme`);
  themeToggle.title = `Switch to ${isDark ? 'light' : 'dark'} theme`;
  themeLabel.textContent = isDark ? 'Light' : 'Dark';

  if (persist) {
    try {
      localStorage.setItem(themeStorageKey, isDark ? 'dark' : 'light');
    } catch {
      themeLabel.textContent = isDark ? 'Light' : 'Dark';
    }
  }
}

let savedTheme = 'light';
try {
  savedTheme = localStorage.getItem(themeStorageKey) || 'light';
} catch {
  savedTheme = 'light';
}
setTheme(savedTheme);

themeToggle.addEventListener('click', () => {
  const nextTheme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  setTheme(nextTheme, true);
});

menuToggle.addEventListener('click', () => {
  const isExpanded = menuToggle.getAttribute('aria-expanded') === 'true';
  menuToggle.setAttribute('aria-expanded', String(!isExpanded));
  menuToggle.setAttribute('aria-label', isExpanded ? 'Open navigation' : 'Close navigation');
  primaryNav.classList.toggle('is-open', !isExpanded);
});

primaryNav.addEventListener('click', (event) => {
  if (event.target.closest('a')) {
    menuToggle.setAttribute('aria-expanded', 'false');
    menuToggle.setAttribute('aria-label', 'Open navigation');
    primaryNav.classList.remove('is-open');
  }
});

document.querySelector('#current-year').textContent = new Date().getFullYear();

const contactForm = document.querySelector('#contact-form');
const formNote = document.querySelector('#form-note');
const responsesList = document.querySelector('#responses-list');
const responseCount = document.querySelector('#response-count');
const responsesEmpty = document.querySelector('#responses-empty');
const exportButton = document.querySelector('#export-messages');
const submitButton = contactForm.querySelector('button[type="submit"]');
const appsScriptUrl = 'PASTE_APPS_SCRIPT_WEB_APP_URL_HERE';
let currentResponses = [];

function hasConfiguredEndpoint() {
  return /^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec$/.test(appsScriptUrl);
}

function fetchResponses() {
  return new Promise((resolve, reject) => {
    const callbackName = `__portfolioSheets_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const script = document.createElement('script');
    const endpoint = new URL(appsScriptUrl);
    const timeout = window.setTimeout(() => finish(new Error('The response service timed out.')), 15000);

    function finish(error, responses) {
      window.clearTimeout(timeout);
      delete window[callbackName];
      script.remove();
      if (error) {
        reject(error);
      } else {
        resolve(responses);
      }
    }

    window[callbackName] = (result) => {
      if (!result || result.ok !== true || !Array.isArray(result.responses)) {
        finish(new Error(result?.error || 'The response service returned invalid data.'));
        return;
      }

      finish(null, result.responses.filter((response) =>
        response &&
        typeof response.id === 'string' &&
        typeof response.name === 'string' &&
        typeof response.message === 'string' &&
        typeof response.createdAt === 'string'
      ));
    };

    script.onerror = () => finish(new Error('Could not connect to the response service.'));
    endpoint.searchParams.set('callback', callbackName);
    endpoint.searchParams.set('t', String(Date.now()));
    script.src = endpoint.href;
    document.head.append(script);
  });
}

function renderResponses(responses) {
  currentResponses = responses.slice().sort((first, second) =>
    Date.parse(second.createdAt) - Date.parse(first.createdAt)
  );
  responsesList.replaceChildren();
  responseCount.textContent = String(currentResponses.length);
  responsesEmpty.hidden = currentResponses.length > 0;
  responsesEmpty.textContent = 'No responses yet.';
  exportButton.disabled = currentResponses.length === 0;

  currentResponses.forEach((response) => {
    const item = document.createElement('li');
    const heading = document.createElement('strong');
    const text = document.createElement('p');
    const date = document.createElement('time');

    heading.textContent = response.name;
    text.textContent = response.message;
    date.dateTime = response.createdAt;
    date.textContent = new Date(response.createdAt).toLocaleString();
    item.append(heading, text, date);
    responsesList.append(item);
  });
}

async function loadResponses() {
  if (!hasConfiguredEndpoint()) {
    submitButton.disabled = true;
    formNote.textContent = 'Set the Apps Script web app URL in script.js to enable messages.';
    responsesEmpty.textContent = 'Connect the Google Sheets response service to load messages.';
    return;
  }

  try {
    formNote.textContent = 'Messages are sent to the connected Google Sheet.';
    renderResponses(await fetchResponses());
  } catch (error) {
    responsesEmpty.hidden = false;
    responsesEmpty.textContent = 'Responses could not be loaded. Please try again later.';
    formNote.textContent = error.message;
  }
}

contactForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = new FormData(contactForm);
  const message = {
    id: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    name: form.get('name').trim(),
    email: form.get('email').trim(),
    message: form.get('message').trim()
  };

  submitButton.disabled = true;
  formNote.textContent = 'Sending your message...';
  try {
    await fetch(appsScriptUrl, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
      body: JSON.stringify(message)
    });

    const responses = await fetchResponses();
    if (!responses.some((response) => response.id === message.id)) {
      throw new Error('The message was sent, but could not yet be confirmed. Please check again shortly.');
    }

    renderResponses(responses);
    contactForm.reset();
    formNote.textContent = 'Thanks. Your message was added to the responses.';
  } catch (error) {
    formNote.textContent = `${error.message} Your form contents are still here; you can retry.`;
  } finally {
    submitButton.disabled = false;
  }
});

exportButton.addEventListener('click', () => {
  try {
    const json = JSON.stringify(currentResponses, null, 2);
    const downloadUrl = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const downloadLink = document.createElement('a');
    downloadLink.href = downloadUrl;
    downloadLink.download = 'contact-messages.json';
    downloadLink.click();
    URL.revokeObjectURL(downloadUrl);
  } catch {
    formNote.textContent = 'Could not export saved messages from this browser.';
  }
});

loadResponses();