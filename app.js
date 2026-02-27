const SUPPORTED_LANGS = [
  "de", "en", "es", "fr", "pt", "it", "nl", "tr", "pl", "ru", "uk",
  "ar", "hi", "bn", "ur", "id", "vi", "th", "ja", "ko", "zh-Hans", "zh-Hant"
];

const STORAGE_KEY = "site_lang";
const RTL_LANGS = new Set(["ar", "ur"]);
const CSP_POLICY = "default-src 'none'; style-src 'self'; script-src 'self'; connect-src 'self'; img-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; object-src 'none'; upgrade-insecure-requests";

let currentLang = "en";
let currentDict = null;
let englishDict = null;

function ensureCspMeta() {
  let cspMeta = document.querySelector("meta[http-equiv='Content-Security-Policy']");
  if (!cspMeta) {
    cspMeta = document.createElement("meta");
    cspMeta.setAttribute("http-equiv", "Content-Security-Policy");
    document.head.appendChild(cspMeta);
  }
  cspMeta.setAttribute("content", CSP_POLICY);
}

function mapLocaleToLang(locale) {
  if (!locale || typeof locale !== "string") {
    return null;
  }

  const lower = locale.trim().toLowerCase();
  if (["zh-tw", "zh-hk", "zh-mo"].includes(lower)) {
    return "zh-Hant";
  }
  if (["zh", "zh-cn", "zh-sg"].includes(lower)) {
    return "zh-Hans";
  }
  if (lower.startsWith("zh-hant")) {
    return "zh-Hant";
  }
  if (lower.startsWith("zh-hans")) {
    return "zh-Hans";
  }

  const base = lower.split("-")[0];
  return SUPPORTED_LANGS.includes(base) ? base : null;
}

function detectLanguage() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved && SUPPORTED_LANGS.includes(saved)) {
    return saved;
  }

  const locales = [];
  if (Array.isArray(navigator.languages)) {
    locales.push(...navigator.languages);
  }
  if (navigator.language) {
    locales.push(navigator.language);
  }

  for (const locale of locales) {
    const mapped = mapLocaleToLang(locale);
    if (mapped) {
      return mapped;
    }
  }
  return "en";
}

function getByPath(obj, path) {
  return path.split(".").reduce((acc, part) => {
    if (acc && Object.prototype.hasOwnProperty.call(acc, part)) {
      return acc[part];
    }
    return undefined;
  }, obj);
}

function t(key) {
  const primary = getByPath(currentDict, key);
  if (typeof primary === "string") {
    return primary;
  }
  const fallback = getByPath(englishDict, key);
  if (typeof fallback === "string") {
    return fallback;
  }
  return null;
}

async function fetchLanguageFile(lang) {
  const response = await fetch(`./i18n/${lang}.json`);
  if (!response.ok) {
    throw new Error(`i18n fetch failed for ${lang}`);
  }
  return response.json();
}

function setDocumentDirection(lang) {
  document.documentElement.lang = lang;
  document.documentElement.dir = RTL_LANGS.has(lang) ? "rtl" : "ltr";
}

function applyTranslations() {
  document.querySelectorAll("[data-i18n]").forEach((element) => {
    const key = element.getAttribute("data-i18n");
    const value = t(key);
    if (typeof value === "string") {
      element.textContent = value;
    }
  });
}

function renderLanguageControls() {
  const names = getByPath(currentDict, "app.languageNames") || getByPath(englishDict, "app.languageNames") || {};
  const select = document.getElementById("language-select");
  const container = document.getElementById("language-links");
  const label = t("app.languageSelectLabel") || "Language";

  select.setAttribute("aria-label", label.replace(":", "").trim());
  select.innerHTML = "";
  container.innerHTML = "";

  for (const code of SUPPORTED_LANGS) {
    const readable = `${names[code] || code} (${code})`;

    const option = document.createElement("option");
    option.value = code;
    option.textContent = readable;
    option.selected = code === currentLang;
    select.appendChild(option);

    const button = document.createElement("button");
    button.type = "button";
    button.className = "lang-button";
    if (code === currentLang) {
      button.classList.add("active");
    }
    button.textContent = readable;
    button.addEventListener("click", () => switchLanguage(code));
    container.appendChild(button);
  }
}

function hideLoading() {
  document.getElementById("loading-state").classList.add("hidden");
  document.getElementById("fatal-error").classList.add("hidden");
}

function showFatal(message) {
  document.getElementById("loading-state").classList.add("hidden");
  const fatal = document.getElementById("fatal-error");
  fatal.textContent = message;
  fatal.classList.remove("hidden");
}

function render() {
  applyTranslations();
  renderLanguageControls();
  setDocumentDirection(currentLang);

  const title = t("app.metaTitle");
  if (title) {
    document.title = title;
  }
  hideLoading();
}

async function loadDictionaries(lang) {
  try {
    const selected = await fetchLanguageFile(lang);
    const english = lang === "en" ? selected : await fetchLanguageFile("en");
    currentDict = selected;
    englishDict = english;
    currentLang = lang;
    return true;
  } catch {
    if (lang !== "en") {
      try {
        const english = await fetchLanguageFile("en");
        currentDict = english;
        englishDict = english;
        currentLang = "en";
        localStorage.setItem(STORAGE_KEY, "en");
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }
}

async function switchLanguage(lang) {
  if (!SUPPORTED_LANGS.includes(lang)) {
    return;
  }
  localStorage.setItem(STORAGE_KEY, lang);
  const ok = await loadDictionaries(lang);
  if (!ok) {
    showFatal("Translation files could not be loaded. Please verify ./i18n/*.json.");
    return;
  }
  render();
}

function registerHandlers() {
  document.getElementById("language-select").addEventListener("change", async (event) => {
    await switchLanguage(event.target.value);
  });
}

async function init() {
  ensureCspMeta();
  registerHandlers();
  const lang = detectLanguage();
  const ok = await loadDictionaries(lang);
  if (!ok) {
    showFatal("Translations could not be loaded (including English fallback).");
    return;
  }
  render();
}

init();
