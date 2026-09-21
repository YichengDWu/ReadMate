const DEFAULT_TRANSLATION_API_URL = "https://api.openai.com/v1/chat/completions";

const DEFAULT_SETTINGS = {
  provider: "inworld",
  inworldApiKey: "",
  inworldVoiceId: "",
  inworldModelId: "inworld-tts-1.5-mini",
  cartesiaApiKey: "",
  cartesiaVoiceId: "",
  cartesiaModelId: "sonic-3.6",
  cartesiaLanguage: "",
  fishApiKey: "",
  fishVoiceId: "",
  fishModelId: "s2.1-pro-free",
  // Legacy aliases for backward compatibility
  apiKey: "",
  voiceId: "",
  modelId: "inworld-tts-1.5-mini",
  audioEncoding: "LINEAR16",
  sampleRateHertz: 22050,
  temperature: 1,
  applyTextNormalization: "ON",
  languageFilter: "",
  enableWordHighlight: true,
  autoPlayOnSelection: false,
  keepPlayerVisibleAfterPlayback: false,
  translationProviderPreset: "custom",
  translationEnabled: false,
  translationTargetLanguage: "",
  translationApiUrl: DEFAULT_TRANSLATION_API_URL,
  translationApiKey: "",
  translationModel: "",
  uiLanguage: InworldI18n.getInitialUiLanguage(),
};

const TRANSLATION_PRESETS = {
  deepseek: {
    apiUrl: "https://api.deepseek.com/chat/completions",
    model: "deepseek-chat",
  },
  siliconflow: {
    apiUrl: "https://api.siliconflow.cn/v1/chat/completions",
    model: "Qwen/Qwen2.5-7B-Instruct",
  },
  openai: {
    apiUrl: "https://api.openai.com/v1/chat/completions",
    model: "gpt-4o-mini",
  },
  ollama: {
    apiUrl: "http://localhost:11434/v1/chat/completions",
    model: "qwen2.5:7b",
  },
};

function normalizeTranslationApiUrl(rawValue) {
  let value = String(rawValue ?? DEFAULT_TRANSLATION_API_URL).trim();
  if (!value) {
    value = DEFAULT_TRANSLATION_API_URL;
  }

  if (!/^https?:\/\//i.test(value)) {
    if (/^(localhost|127\.0\.0\.1)(:\d+)?/i.test(value)) {
      value = `http://${value}`;
    } else {
      value = `https://${value}`;
    }
  }

  const parsedUrl = new URL(value);
  let pathname = parsedUrl.pathname.replace(/\/+$/, "");

  if (pathname.endsWith("/chat/completions")) {
    parsedUrl.pathname = pathname;
    return parsedUrl.toString();
  }

  if (/\/v\d+([a-zA-Z0-9_-]+)?$/i.test(pathname)) {
    parsedUrl.pathname = `${pathname}/chat/completions`;
    return parsedUrl.toString();
  }

  if (parsedUrl.hostname === "api.deepseek.com") {
    parsedUrl.pathname = `${pathname}/chat/completions`.replace(/\/\/+/g, "/");
    return parsedUrl.toString();
  }

  if (!pathname || pathname === "/") {
    parsedUrl.pathname = "/v1/chat/completions";
    return parsedUrl.toString();
  }

  parsedUrl.pathname = `${pathname}/chat/completions`;
  return parsedUrl.toString();
}

function mapTargetLanguageToPreset(rawLang) {
  const lang = String(rawLang ?? "").trim().toLowerCase();
  if (!lang) return "Simplified Chinese";
  if (
    lang === "simplified chinese" ||
    lang === "简体中文" ||
    lang === "中文" ||
    lang === "zh" ||
    lang === "zh-cn" ||
    lang === "chinese"
  ) {
    return "Simplified Chinese";
  }
  if (
    lang === "english" ||
    lang === "英语" ||
    lang === "en" ||
    lang === "en-us" ||
    lang === "en-gb"
  ) {
    return "English";
  }
  if (
    lang === "traditional chinese" ||
    lang === "繁体中文" ||
    lang === "繁體中文" ||
    lang === "zh-tw" ||
    lang === "zh-hk"
  ) {
    return "Traditional Chinese";
  }
  if (lang === "japanese" || lang === "日语" || lang === "日本語" || lang === "ja") {
    return "Japanese";
  }
  if (lang === "korean" || lang === "韩语" || lang === "한국어" || lang === "ko") {
    return "Korean";
  }
  if (lang === "french" || lang === "法语" || lang === "français" || lang === "fr") {
    return "French";
  }
  if (lang === "spanish" || lang === "西班牙语" || lang === "español" || lang === "es") {
    return "Spanish";
  }
  if (lang === "german" || lang === "德语" || lang === "deutsch" || lang === "de") {
    return "German";
  }
  if (lang === "russian" || lang === "俄语" || lang === "русский" || lang === "ru") {
    return "Russian";
  }
  if (lang === "italian" || lang === "意大利语" || lang === "italiano" || lang === "it") {
    return "Italian";
  }
  if (lang === "portuguese" || lang === "葡萄牙语" || lang === "português" || lang === "pt") {
    return "Portuguese";
  }
  if (lang === "arabic" || lang === "阿拉伯语" || lang === "ar") {
    return "Arabic";
  }
  return null;
}

const form = document.getElementById("settings-form");
const uiLanguageInput = document.getElementById("uiLanguage");
const ttsProviderSelect = document.getElementById("ttsProvider");
const inworldSettingsGroup = document.getElementById("inworldSettingsGroup");
const cartesiaSettingsGroup = document.getElementById("cartesiaSettingsGroup");
const fishaudioSettingsGroup = document.getElementById("fishaudioSettingsGroup");

const apiKeyInput = document.getElementById("apiKey");
const voiceIdInput = document.getElementById("voiceId");
const modelSelect = document.getElementById("modelId");
const languageFilterInput = document.getElementById("languageFilter");
const sampleRateInput = document.getElementById("sampleRateHertz");
const temperatureInput = document.getElementById("temperature");
const normalizationSelect = document.getElementById("applyTextNormalization");
const audioEncodingSelect = document.getElementById("audioEncoding");

const cartesiaApiKeyInput = document.getElementById("cartesiaApiKey");
const cartesiaVoiceIdInput = document.getElementById("cartesiaVoiceId");
const cartesiaModelSelect = document.getElementById("cartesiaModelId");
const cartesiaLanguageInput = document.getElementById("cartesiaLanguage");

const fishApiKeyInput = document.getElementById("fishApiKey");
const fishModelSelect = document.getElementById("fishModelId");
const fishVoiceIdInput = document.getElementById("fishVoiceId");

const enableWordHighlightInput = document.getElementById("enableWordHighlight");
const autoPlayOnSelectionInput = document.getElementById("autoPlayOnSelection");
const keepPlayerVisibleAfterPlaybackInput = document.getElementById("keepPlayerVisibleAfterPlayback");
const translationPresetSelect = document.getElementById("translationPreset");
const translationEnabledInput = document.getElementById("translationEnabled");
const translationTargetLanguageSelect = document.getElementById("translationTargetLanguageSelect");
const customTargetLanguageInput = document.getElementById("customTargetLanguage");
const translationApiUrlInput = document.getElementById("translationApiUrl");
const translationApiKeyInput = document.getElementById("translationApiKey");
const translationModelInput = document.getElementById("translationModel");
const testTranslationButton = document.getElementById("testTranslationButton");
const testTranslationStatus = document.getElementById("testTranslationStatus");
const loadVoicesButton = document.getElementById("loadVoicesButton");
const saveButton = document.getElementById("saveButton");
const statusMessage = document.getElementById("statusMessage");
const voiceSelect = document.getElementById("voiceSelect");
const voiceDescription = document.getElementById("voiceDescription");
const testText = document.getElementById("testText");
const testButton = document.getElementById("testButton");
const stopButton = document.getElementById("stopButton");

let previewAudio = null;
let previewObjectUrl = null;
let loadedVoices = [];
let hasLoadedVoices = false;
let currentUiLanguage = InworldI18n.getInitialUiLanguage();
let lastAppliedTestTextDefault = "";

void initialize();

async function initialize() {
  await loadSettingsIntoForm();

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    await saveSettings();
  });

  loadVoicesButton.addEventListener("click", async () => {
    await loadVoices();
  });

  ttsProviderSelect.addEventListener("change", () => {
    updateProviderVisibility();
    loadedVoices = [];
    hasLoadedVoices = false;
    voiceSelect.innerHTML = "";
    voiceDescription.textContent = t("options.voiceDescriptionEmpty");
  });

  uiLanguageInput.addEventListener("change", () => {
    currentUiLanguage = normalizeUiLanguage(uiLanguageInput.value);
    applyPageTranslations();
  });

  translationPresetSelect.addEventListener("change", async () => {
    const preset = TRANSLATION_PRESETS[translationPresetSelect.value];
    if (preset) {
      translationApiUrlInput.value = preset.apiUrl;
      translationModelInput.value = preset.model;

      if (translationPresetSelect.value === "ollama") {
        try {
          const resp = await fetch("http://localhost:11434/api/tags");
          if (resp.ok) {
            const data = await resp.json();
            const models = (data.models || []).map((m) => m.name || m.model).filter(Boolean);
            if (models.length > 0 && !models.includes("qwen2.5:7b")) {
              translationModelInput.value = models[0];
            }
          }
        } catch (_e) {
          // ignore if Ollama is not running locally
        }
      }
    }
  });

  translationApiUrlInput.addEventListener("blur", () => {
    const raw = translationApiUrlInput.value.trim();
    if (raw) {
      try {
        translationApiUrlInput.value = normalizeTranslationApiUrl(raw);
      } catch (_e) {
        // ignore
      }
    }
  });

  [translationApiUrlInput, translationModelInput].forEach((input) => {
    input.addEventListener("input", () => {
      const url = translationApiUrlInput.value.trim();
      const mod = translationModelInput.value.trim();
      const matched = Object.keys(TRANSLATION_PRESETS).find(
        (k) => TRANSLATION_PRESETS[k].apiUrl === url && TRANSLATION_PRESETS[k].model === mod,
      );
      translationPresetSelect.value = matched || "custom";
    });
  });

  testTranslationButton.addEventListener("click", async () => {
    await testTranslation();
  });

  translationTargetLanguageSelect.addEventListener("change", () => {
    if (translationTargetLanguageSelect.value === "custom") {
      customTargetLanguageInput.classList.remove("is-hidden");
      customTargetLanguageInput.focus();
    } else {
      customTargetLanguageInput.classList.add("is-hidden");
    }
  });

  translationEnabledInput.addEventListener("change", () => {
    updateTranslationFieldState();
  });

  voiceSelect.addEventListener("change", () => {
    const selectedVoice = loadedVoices.find((voice) => voice.voiceId === voiceSelect.value);
    if (!selectedVoice) {
      return;
    }

    if (ttsProviderSelect.value === "cartesia") {
      cartesiaVoiceIdInput.value = selectedVoice.voiceId;
    } else if (ttsProviderSelect.value === "fishaudio") {
      fishVoiceIdInput.value = selectedVoice.voiceId;
    } else {
      voiceIdInput.value = selectedVoice.voiceId;
    }
    voiceDescription.textContent = formatVoiceDescription(selectedVoice);
  });

  testButton.addEventListener("click", async () => {
    await testSpeech();
  });

  stopButton.addEventListener("click", () => {
    stopPreview();
    setStatus(t("options.statusStopped"), "success");
  });
}

function updateProviderVisibility() {
  const provider = ttsProviderSelect.value;
  inworldSettingsGroup.classList.toggle("is-hidden", provider !== "inworld");
  cartesiaSettingsGroup.classList.toggle("is-hidden", provider !== "cartesia");
  fishaudioSettingsGroup.classList.toggle("is-hidden", provider !== "fishaudio");
}

async function loadSettingsIntoForm() {
  const { settings } = await chrome.storage.local.get("settings");
  const merged = { ...DEFAULT_SETTINGS, ...(settings ?? {}) };

  currentUiLanguage = normalizeUiLanguage(merged.uiLanguage);

  uiLanguageInput.value = currentUiLanguage;
  ttsProviderSelect.value = ["cartesia", "fishaudio"].includes(merged.provider) ? merged.provider : "inworld";
  apiKeyInput.value = merged.inworldApiKey || merged.apiKey || "";
  voiceIdInput.value = merged.inworldVoiceId || merged.voiceId || "";
  modelSelect.value = merged.inworldModelId || merged.modelId || "inworld-tts-1.5-mini";
  cartesiaApiKeyInput.value = merged.cartesiaApiKey || "";
  cartesiaVoiceIdInput.value = merged.cartesiaVoiceId || "";
  cartesiaModelSelect.value = merged.cartesiaModelId || "sonic-3.6";
  cartesiaLanguageInput.value = merged.cartesiaLanguage || "";
  fishApiKeyInput.value = merged.fishApiKey || "";
  fishModelSelect.value = merged.fishModelId || "s2.1-pro-free";
  fishVoiceIdInput.value = merged.fishVoiceId || "";
  languageFilterInput.value = merged.languageFilter;
  sampleRateInput.value = merged.sampleRateHertz;
  temperatureInput.value = merged.temperature;
  normalizationSelect.value = merged.applyTextNormalization;
  audioEncodingSelect.value = merged.audioEncoding;
  enableWordHighlightInput.checked = Boolean(merged.enableWordHighlight);
  autoPlayOnSelectionInput.checked = Boolean(merged.autoPlayOnSelection);
  keepPlayerVisibleAfterPlaybackInput.checked = Boolean(merged.keepPlayerVisibleAfterPlayback);
  translationPresetSelect.value = merged.translationProviderPreset || "custom";
  translationEnabledInput.checked = Boolean(merged.translationEnabled);

  const storedTargetLang =
    merged.translationTargetLanguage || (currentUiLanguage === "zh-CN" ? "Simplified Chinese" : "English");
  const matchedPreset = mapTargetLanguageToPreset(storedTargetLang);
  if (matchedPreset) {
    translationTargetLanguageSelect.value = matchedPreset;
    customTargetLanguageInput.value = "";
    customTargetLanguageInput.classList.add("is-hidden");
  } else {
    translationTargetLanguageSelect.value = "custom";
    customTargetLanguageInput.value = storedTargetLang;
    customTargetLanguageInput.classList.remove("is-hidden");
  }

  translationApiUrlInput.value = merged.translationApiUrl || DEFAULT_TRANSLATION_API_URL;
  translationApiKeyInput.value = merged.translationApiKey || "";
  translationModelInput.value = merged.translationModel || "";

  updateProviderVisibility();
  applyPageTranslations();
  updateTranslationFieldState();
}

function collectSettingsFromForm() {
  const provider = ["cartesia", "fishaudio"].includes(ttsProviderSelect.value) ? ttsProviderSelect.value : "inworld";
  let targetLang = translationTargetLanguageSelect.value;
  if (targetLang === "custom") {
    targetLang = customTargetLanguageInput.value.trim();
  }

  return {
    provider,
    inworldApiKey: apiKeyInput.value.trim(),
    inworldVoiceId: voiceIdInput.value.trim(),
    inworldModelId: modelSelect.value,
    cartesiaApiKey: cartesiaApiKeyInput.value.trim(),
    cartesiaVoiceId: cartesiaVoiceIdInput.value.trim(),
    cartesiaModelId: cartesiaModelSelect.value,
    cartesiaLanguage: cartesiaLanguageInput.value.trim(),
    fishApiKey: fishApiKeyInput.value.trim(),
    fishModelId: fishModelSelect.value,
    fishVoiceId: fishVoiceIdInput.value.trim(),
    apiKey: apiKeyInput.value.trim(),
    voiceId: voiceIdInput.value.trim(),
    modelId: modelSelect.value,
    languageFilter: languageFilterInput.value.trim(),
    sampleRateHertz: Number(sampleRateInput.value) || DEFAULT_SETTINGS.sampleRateHertz,
    temperature: Number(temperatureInput.value) || DEFAULT_SETTINGS.temperature,
    applyTextNormalization: normalizationSelect.value,
    audioEncoding: audioEncodingSelect.value,
    enableWordHighlight: enableWordHighlightInput.checked,
    autoPlayOnSelection: autoPlayOnSelectionInput.checked,
    keepPlayerVisibleAfterPlayback: keepPlayerVisibleAfterPlaybackInput.checked,
    translationProviderPreset: translationPresetSelect.value,
    translationEnabled: translationEnabledInput.checked,
    translationTargetLanguage: targetLang,
    translationApiUrl: (() => {
      try {
        return normalizeTranslationApiUrl(translationApiUrlInput.value.trim() || DEFAULT_TRANSLATION_API_URL);
      } catch (_e) {
        return translationApiUrlInput.value.trim() || DEFAULT_TRANSLATION_API_URL;
      }
    })(),
    translationApiKey: translationApiKeyInput.value.trim(),
    translationModel: translationModelInput.value.trim(),
    uiLanguage: normalizeUiLanguage(uiLanguageInput.value),
  };
}

async function saveSettings() {
  const settings = collectSettingsFromForm();
  const validationMessage = validateSettings(settings);
  if (validationMessage) {
    setStatus(validationMessage, "error");
    return;
  }

  saveButton.disabled = true;

  try {
    await chrome.storage.local.set({ settings });
    setStatus(t("options.statusSaved"), "success");
  } finally {
    saveButton.disabled = false;
  }
}

function validateSettings(settings) {
  if (settings.provider === "cartesia") {
    if (!settings.cartesiaApiKey) {
      return t("options.validationCartesiaApiKey");
    }
    if (!settings.cartesiaVoiceId) {
      return t("options.validationCartesiaVoiceId");
    }
  } else if (settings.provider === "fishaudio") {
    if (!settings.fishApiKey) {
      return t("options.validationFishApiKey");
    }
  } else {
    if (!settings.apiKey) {
      return t("options.validationApiKey");
    }
    if (!settings.voiceId) {
      return t("options.validationVoiceId");
    }
  }

  if (settings.translationEnabled) {
    if (!settings.translationTargetLanguage) {
      return t("options.validationTranslationLanguage");
    }
    if (!settings.translationModel) {
      return t("options.validationTranslationModel");
    }
  }

  if (settings.translationApiUrl) {
    try {
      const url = new URL(settings.translationApiUrl);
      if (!["http:", "https:"].includes(url.protocol)) {
        return t("options.validationTranslationApiUrlProtocol");
      }
    } catch (_error) {
      return t("options.validationTranslationApiUrlFormat");
    }
  }

  return "";
}

async function loadVoices() {
  loadVoicesButton.disabled = true;
  setStatus(t("options.loadingVoices"));

  try {
    const currentProvider = ttsProviderSelect.value;
    const overrides = {
      provider: currentProvider,
      uiLanguage: currentUiLanguage,
    };
    if (currentProvider === "cartesia") {
      overrides.cartesiaApiKey = cartesiaApiKeyInput.value.trim();
    } else if (currentProvider === "fishaudio") {
      overrides.fishApiKey = fishApiKeyInput.value.trim();
    } else {
      overrides.apiKey = apiKeyInput.value.trim();
      overrides.inworldApiKey = apiKeyInput.value.trim();
      overrides.languageFilter = languageFilterInput.value.trim();
    }

    const response = await chrome.runtime.sendMessage({
      type: "FETCH_VOICES",
      overrides,
    });

    if (!response?.ok) {
      throw new Error(response?.error || t("options.loadVoicesFailed"));
    }

    loadedVoices = Array.isArray(response.voices) ? response.voices : [];
    hasLoadedVoices = true;
    renderVoiceOptions(loadedVoices);

    setStatus(t("options.loadedVoices", { count: loadedVoices.length }), "success");
  } catch (error) {
    setStatus(error instanceof Error ? error.message : t("options.loadVoicesFailed"), "error");
  } finally {
    loadVoicesButton.disabled = false;
  }
}

function renderVoiceOptions(voices) {
  voiceSelect.innerHTML = "";
  if (!voices.length) {
    voiceDescription.textContent = t("options.voiceDescriptionNoVoices");
    return;
  }

  voices
    .slice()
    .sort((left, right) => {
      const leftLabel = `${left.displayName || ""}${left.voiceId || ""}`;
      const rightLabel = `${right.displayName || ""}${right.voiceId || ""}`;
      return leftLabel.localeCompare(rightLabel);
    })
    .forEach((voice) => {
      const option = document.createElement("option");
      option.value = voice.voiceId;
      option.textContent = [
        voice.displayName || voice.voiceId,
        voice.langCode || t("options.voiceUnknown"),
        voice.source || "SYSTEM",
      ].join(" · ");
      voiceSelect.appendChild(option);
    });

  const currentVoiceId = ttsProviderSelect.value === "cartesia"
    ? cartesiaVoiceIdInput.value.trim()
    : voiceIdInput.value.trim();
  if (currentVoiceId) {
    voiceSelect.value = currentVoiceId;
  }

  const firstVoice =
    voices.find((voice) => voice.voiceId === voiceSelect.value) ??
    voices[0];

  if (firstVoice) {
    voiceSelect.value = firstVoice.voiceId;
    voiceDescription.textContent = formatVoiceDescription(firstVoice);
  }
}

function formatVoiceDescription(voice) {
  const parts = [
    voice.displayName || voice.voiceId,
    voice.langCode ? formatLabeledText(t("options.voiceDescriptionLanguage"), voice.langCode) : null,
    voice.source ? formatLabeledText(t("options.voiceDescriptionSource"), voice.source) : null,
    voice.description || null,
  ].filter(Boolean);
  return parts.join(" · ");
}

async function testSpeech() {
  const text = testText.value.trim();
  if (!text) {
    setStatus(t("options.testTextRequired"), "error");
    return;
  }

  const settings = collectSettingsFromForm();
  const validationMessage = validateSettings(settings);
  if (validationMessage) {
    setStatus(validationMessage, "error");
    return;
  }

  testButton.disabled = true;
  setStatus(
    settings.translationEnabled
      ? t("options.testingSpeechWithTranslation")
      : t("options.testingSpeech"),
  );

  try {
    const response = await chrome.runtime.sendMessage({
      type: "SPEAK_TEXT",
      text,
      overrides: settings,
    });

    if (!response?.ok) {
      throw new Error(response?.error || t("options.testFailed"));
    }

    await playPreview(response.result);
    setStatus(t("options.testStarted"), "success");
  } catch (error) {
    setStatus(error instanceof Error ? error.message : t("options.testFailed"), "error");
  } finally {
    testButton.disabled = false;
  }
}

async function playPreview(result) {
  stopPreview();

  previewObjectUrl = createObjectUrl(result.audioContent, result.mimeType || "audio/wav");
  previewAudio = new Audio(previewObjectUrl);
  previewAudio.addEventListener("ended", stopPreview, { once: true });
  previewAudio.addEventListener("error", () => {
    setStatus(t("options.testPlaybackFailed"), "error");
    stopPreview();
  }, { once: true });
  await previewAudio.play();
}

function stopPreview() {
  if (previewAudio) {
    previewAudio.pause();
    previewAudio.currentTime = 0;
    previewAudio.src = "";
    previewAudio = null;
  }

  if (previewObjectUrl) {
    URL.revokeObjectURL(previewObjectUrl);
    previewObjectUrl = null;
  }
}

function createObjectUrl(base64Content, mimeType) {
  const binary = atob(base64Content);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return URL.createObjectURL(new Blob([bytes], { type: mimeType }));
}

function applyPageTranslations() {
  InworldI18n.applyTranslations(document, currentUiLanguage);
  syncTestTextDefault();

  if (loadedVoices.length) {
    renderVoiceOptions(loadedVoices);
  } else {
    voiceDescription.textContent = hasLoadedVoices
      ? t("options.voiceDescriptionNoVoices")
      : t("options.voiceDescriptionEmpty");
  }
}

function syncTestTextDefault() {
  const nextDefault = t("options.testTextDefault");
  const knownDefaults = InworldI18n.SUPPORTED_UI_LANGUAGES.map((language) =>
    InworldI18n.getMessage("options.testTextDefault", {}, language),
  );

  if (
    !testText.value.trim() ||
    testText.value === lastAppliedTestTextDefault ||
    knownDefaults.includes(testText.value)
  ) {
    testText.value = nextDefault;
  }

  lastAppliedTestTextDefault = nextDefault;
}

function updateTranslationFieldState() {
  // Translation fields remain accessible at all times because they power
  // both the selection translate button and the 'translate before speaking' mode.
}

async function testTranslation() {
  const text = testText.value.trim() || t("options.testTextDefault");
  const settings = collectSettingsFromForm();

  if (!settings.translationModel) {
    setTranslationStatus(t("background.fillTranslationModel"), "error");
    return;
  }

  testTranslationButton.disabled = true;
  setTranslationStatus(t("options.testingTranslation"));

  try {
    const response = await chrome.runtime.sendMessage({
      type: "TEST_TRANSLATION",
      text,
      overrides: settings,
    });

    if (!response?.ok) {
      throw new Error(response?.error || t("options.testTranslationFailed"));
    }

    setTranslationStatus(
      t("options.testTranslationSuccess", { result: response.result.text }),
      "success",
    );
  } catch (error) {
    setTranslationStatus(
      error instanceof Error ? error.message : t("options.testTranslationFailed"),
      "error",
    );
  } finally {
    testTranslationButton.disabled = false;
  }
}

function setTranslationStatus(message, tone = "") {
  testTranslationStatus.textContent = message;
  testTranslationStatus.className = "translation-status";
  if (tone === "error") {
    testTranslationStatus.classList.add("is-error");
  }
  if (tone === "success") {
    testTranslationStatus.classList.add("is-success");
  }
}

function setStatus(message, tone = "") {
  statusMessage.textContent = message;
  statusMessage.className = "status";
  if (tone === "error") {
    statusMessage.classList.add("is-error");
  }
  if (tone === "success") {
    statusMessage.classList.add("is-success");
  }
}

function normalizeUiLanguage(language) {
  return InworldI18n.normalizeUiLanguage(language, InworldI18n.getInitialUiLanguage());
}

function t(key, params = {}) {
  return InworldI18n.getMessage(key, params, currentUiLanguage);
}

function formatLabeledText(label, value) {
  const separator = currentUiLanguage === "zh-CN" ? "：" : ": ";
  return `${label}${separator}${value}`;
}
