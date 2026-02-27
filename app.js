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
let currentExampleSrc = "";

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

function registerExampleModal() {
  const cards = Array.from(document.querySelectorAll(".feature-card[data-example-src]"));
  const modal = document.getElementById("example-modal");
  const backdrop = document.getElementById("example-backdrop");
  const closeBtn = document.getElementById("example-close");
  const image = document.getElementById("example-image");
  const title = document.getElementById("example-modal-title");

  if (!modal || cards.length === 0 || !backdrop || !closeBtn || !image || !title) {
    return;
  }

  const closeModal = () => {
    modal.classList.add("hidden");
    image.removeAttribute("src");
    image.alt = "";
    title.textContent = "";
    currentExampleSrc = "";
    document.body.style.overflow = "";
  };

  const openModalFromCard = (card) => {
    const src = card.getAttribute("data-example-src");
    if (!src) {
      return;
    }
    if (!modal.classList.contains("hidden") && currentExampleSrc === src) {
      closeModal();
      return;
    }
    const heading = card.querySelector("h3");
    const headingText = heading ? heading.textContent.trim() : "";
    currentExampleSrc = src;
    image.src = src;
    image.alt = headingText || "Example image";
    title.textContent = headingText;
    modal.classList.remove("hidden");
    document.body.style.overflow = "hidden";
    closeBtn.focus({ preventScroll: true });
  };

  cards.forEach((card) => {
    card.addEventListener("click", () => openModalFromCard(card));
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openModalFromCard(card);
      }
    });
  });

  backdrop.addEventListener("click", closeModal);
  closeBtn.addEventListener("click", closeModal);

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !modal.classList.contains("hidden")) {
      closeModal();
    }
  });
}

function registerRevealAnimations() {
  const panels = Array.from(document.querySelectorAll(".panel"));
  if (panels.length === 0) {
    return;
  }

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion || typeof IntersectionObserver === "undefined") {
    panels.forEach((panel) => panel.classList.add("is-visible"));
    return;
  }

  panels.forEach((panel, index) => {
    panel.classList.add("reveal");
    if (index === 0) {
      panel.classList.add("is-visible");
    }
  });

  const observer = new IntersectionObserver((entries, obs) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        obs.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.14,
    rootMargin: "0px 0px -8% 0px"
  });

  panels.forEach((panel, index) => {
    if (index !== 0) {
      observer.observe(panel);
    }
  });
}

async function init() {
  ensureCspMeta();
  registerHandlers();
  registerExampleModal();
  registerRevealAnimations();
  const lang = detectLanguage();
  const ok = await loadDictionaries(lang);
  if (!ok) {
    showFatal("Translations could not be loaded (including English fallback).");
    return;
  }
  render();
}

init();
