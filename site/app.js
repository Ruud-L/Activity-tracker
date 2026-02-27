const SUPPORTED_LANGS = [
  "de", "en", "es", "fr", "pt", "it", "nl", "tr", "pl", "ru", "uk",
  "ar", "hi", "bn", "ur", "id", "vi", "th", "ja", "ko", "zh-Hans", "zh-Hant"
];

const RTL_LANGS = new Set(["ar", "ur"]);
const STORAGE_KEY = "site_lang";

function mapLocaleToLang(locale) {
  if (!locale) {
    return null;
  }

  const normalized = locale.trim();
  const lower = normalized.toLowerCase();

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
  switch (base) {
    case "de": return "de";
    case "en": return "en";
    case "es": return "es";
    case "fr": return "fr";
    case "pt": return "pt";
    case "it": return "it";
    case "nl": return "nl";
    case "tr": return "tr";
    case "pl": return "pl";
    case "ru": return "ru";
    case "uk": return "uk";
    case "ar": return "ar";
    case "hi": return "hi";
    case "bn": return "bn";
    case "ur": return "ur";
    case "id": return "id";
    case "vi": return "vi";
    case "th": return "th";
    case "ja": return "ja";
    case "ko": return "ko";
    case "zh": return "zh-Hans";
    default: return null;
  }
}

function getSavedLanguage() {
  const saved = localStorage.getItem(STORAGE_KEY);
  return SUPPORTED_LANGS.includes(saved) ? saved : null;
}

function detectBrowserLanguage() {
  const candidates = [];
  if (Array.isArray(navigator.languages)) {
    candidates.push(...navigator.languages);
  }
  if (navigator.language) {
    candidates.push(navigator.language);
  }

  for (const candidate of candidates) {
    const mapped = mapLocaleToLang(candidate);
    if (mapped && SUPPORTED_LANGS.includes(mapped)) {
      return mapped;
    }
  }

  return "en";
}

function getByPath(obj, path) {
  return path.split(".").reduce((acc, part) => (acc && acc[part] !== undefined ? acc[part] : undefined), obj);
}

async function loadI18n(lang) {
  const response = await fetch(`./i18n/${lang}.json`);
  if (!response.ok) {
    throw new Error(`Failed to load language file: ${lang}`);
  }
  return response.json();
}

function applyI18n(dict) {
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    const value = getByPath(dict, key);
    if (typeof value === "string") {
      el.textContent = value;
    }
  });
}

function languageLabel(nameMap, code) {
  const name = nameMap[code] || code;
  return `${name} (${code})`;
}

function renderLanguageDropdown(currentLang, nameMap, onChange) {
  const select = document.getElementById("language-select");
  select.innerHTML = "";

  for (const code of SUPPORTED_LANGS) {
    const option = document.createElement("option");
    option.value = code;
    option.textContent = languageLabel(nameMap, code);
    option.selected = code === currentLang;
    select.appendChild(option);
  }

  select.onchange = (event) => onChange(event.target.value);
}

function renderLanguageButtons(currentLang, nameMap, onChange) {
  const container = document.getElementById("language-links");
  container.innerHTML = "";

  for (const code of SUPPORTED_LANGS) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "lang-button";
    if (code === currentLang) {
      button.classList.add("active");
    }
    button.textContent = languageLabel(nameMap, code);
    button.addEventListener("click", () => onChange(code));
    container.appendChild(button);
  }
}

function applyDocumentDirection(lang) {
  document.documentElement.lang = lang;
  document.documentElement.dir = RTL_LANGS.has(lang) ? "rtl" : "ltr";
}

async function render(lang) {
  let dict;
  try {
    dict = await loadI18n(lang);
  } catch (error) {
    dict = await loadI18n("en");
    lang = "en";
    localStorage.setItem(STORAGE_KEY, lang);
  }

  applyDocumentDirection(lang);
  applyI18n(dict);

  if (dict.app && typeof dict.app.metaTitle === "string") {
    document.title = dict.app.metaTitle;
  }
  if (dict.app && typeof dict.app.languageSelectLabel === "string") {
    document.getElementById("language-select")
      .setAttribute("aria-label", dict.app.languageSelectLabel.replace(":", "").trim());
  }

  const names = (dict.app && dict.app.languageNames) ? dict.app.languageNames : {};
  const onLanguageChange = async (nextLang) => {
    localStorage.setItem(STORAGE_KEY, nextLang);
    await render(nextLang);
  };

  renderLanguageDropdown(lang, names, onLanguageChange);
  renderLanguageButtons(lang, names, onLanguageChange);
}

async function init() {
  const selected = getSavedLanguage() || detectBrowserLanguage();
  await render(selected);
}

init();
