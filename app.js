const SUPPORTED_LANGS = [
  "de", "en", "es", "fr", "pt", "it", "nl", "tr", "pl", "ru", "uk",
  "ar", "hi", "bn", "ur", "id", "vi", "th", "ja", "ko", "zh-Hans", "zh-Hant"
];

const STORAGE_KEY = "site_lang";
const RTL_LANGS = new Set(["ar", "ur"]);

let englishDict = null;
let currentDict = null;
let currentLang = "en";
let helpCollapsed = false;
const CSP_POLICY = "default-src 'none'; style-src 'self'; script-src 'self'; connect-src 'self'; img-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; object-src 'none'; upgrade-insecure-requests";

function mapLocaleToLang(locale) {
  if (!locale || typeof locale !== "string") {
    return null;
  }

  const lower = locale.trim().toLowerCase();

  if (lower === "zh-tw" || lower === "zh-hk" || lower === "zh-mo") {
    return "zh-Hant";
  }
  if (lower === "zh" || lower === "zh-cn" || lower === "zh-sg") {
    return "zh-Hans";
  }
  if (lower.startsWith("zh-hant")) {
    return "zh-Hant";
  }
  if (lower.startsWith("zh-hans")) {
    return "zh-Hans";
  }

  const base = lower.split("-")[0];
  if (SUPPORTED_LANGS.includes(base)) {
    return base;
  }
  return null;
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
  if (response.ok) {
    return response.json();
  }

  throw new Error(`i18n fetch failed for ${lang}`);
}

function setDirection(lang) {
  document.documentElement.lang = lang;
  document.documentElement.dir = RTL_LANGS.has(lang) ? "rtl" : "ltr";
}

function applyTextTranslations() {
  const elements = document.querySelectorAll("[data-i18n]");
  for (const element of elements) {
    const key = element.getAttribute("data-i18n");
    const value = t(key);
    if (value !== null) {
      element.textContent = value;
    }
  }
}

function getLanguageNames() {
  const names = getByPath(currentDict, "app.languageNames");
  const fallbackNames = getByPath(englishDict, "app.languageNames");
  if (names && typeof names === "object") {
    return { ...(fallbackNames || {}), ...names };
  }
  return fallbackNames || {};
}

function renderLanguageControls() {
  const names = getLanguageNames();
  const select = document.getElementById("language-select");
  const links = document.getElementById("language-links");
  const selectLabel = t("app.languageSelectLabel") || "Language";

  select.setAttribute("aria-label", selectLabel.replace(":", "").trim());
  select.innerHTML = "";
  links.innerHTML = "";

  for (const code of SUPPORTED_LANGS) {
    const label = `${names[code] || code} (${code})`;

    const option = document.createElement("option");
    option.value = code;
    option.textContent = label;
    option.selected = code === currentLang;
    select.appendChild(option);

    const button = document.createElement("button");
    button.type = "button";
    button.className = "lang-button";
    if (code === currentLang) {
      button.classList.add("active");
    }
    button.textContent = label;
    button.addEventListener("click", () => switchLanguage(code));
    links.appendChild(button);
  }
}

function updateHelpToggleText() {
  const toggle = document.getElementById("help-toggle");
  const labelKey = helpCollapsed ? "app.helpToggleExpand" : "app.helpToggleCollapse";
  toggle.textContent = t(labelKey) || (helpCollapsed ? "Expand" : "Collapse");
}

function render() {
  applyTextTranslations();
  renderLanguageControls();
  updateHelpToggleText();

  const title = t("app.metaTitle");
  if (title) {
    document.title = title;
  }

  setDirection(currentLang);

  const loading = document.getElementById("loading-state");
  loading.classList.add("hidden");
  document.getElementById("fatal-error").classList.add("hidden");
}

function showFatalError(message) {
  const loading = document.getElementById("loading-state");
  loading.classList.add("hidden");

  const errorEl = document.getElementById("fatal-error");
  errorEl.textContent = message;
  errorEl.classList.remove("hidden");
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
    showFatalError("Translation files could not be loaded. Please reload or check i18n files.");
    return;
  }
  render();
}

function registerHelpPanel() {
  const panel = document.getElementById("help-panel");
  const toggle = document.getElementById("help-toggle");
  toggle.addEventListener("click", () => {
    helpCollapsed = !helpCollapsed;
    panel.classList.toggle("collapsed", helpCollapsed);
    updateHelpToggleText();
  });
}

function scrollToTarget(id, focusElement) {
  const section = document.getElementById(id);
  if (!section) {
    return;
  }
  section.scrollIntoView({ behavior: "smooth", block: "start" });
  if (focusElement) {
    focusElement.focus({ preventScroll: true });
  }
}

function registerShortcuts() {
  document.addEventListener("keydown", (event) => {
    const target = event.target;
    const tagName = target && target.tagName ? target.tagName.toLowerCase() : "";
    if (tagName === "input" || tagName === "textarea" || tagName === "select") {
      return;
    }

    const key = event.key.toLowerCase();
    if (key === "d") {
      event.preventDefault();
      scrollToTarget("download", document.getElementById("download-link"));
    } else if (key === "s") {
      event.preventDefault();
      scrollToTarget("support", null);
    } else if (key === "l") {
      event.preventDefault();
      scrollToTarget("languages", null);
    }
  });
}

function registerLanguageSelect() {
  const select = document.getElementById("language-select");
  select.addEventListener("change", async (event) => {
    await switchLanguage(event.target.value);
  });
}

function ensureCspMeta() {
  let cspMeta = document.querySelector("meta[http-equiv='Content-Security-Policy']");
  if (!cspMeta) {
    cspMeta = document.createElement("meta");
    cspMeta.setAttribute("http-equiv", "Content-Security-Policy");
    document.head.appendChild(cspMeta);
  }
  cspMeta.setAttribute("content", CSP_POLICY);
}

async function init() {
  ensureCspMeta();
  registerHelpPanel();
  registerShortcuts();
  registerLanguageSelect();

  const targetLang = detectLanguage();
  const ok = await loadDictionaries(targetLang);
  if (!ok) {
    showFatalError("Translations could not be loaded (including English fallback).");
    return;
  }
  render();
}

init();
