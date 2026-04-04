const DEFAULT_TRANSLATION_API_URL = "https://api.openai.com/v1/chat/completions";

const DEFAULT_SETTINGS = {
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
  translationEnabled: false,
  translationTargetLanguage: "",
  translationApiUrl: DEFAULT_TRANSLATION_API_URL,
  translationApiKey: "",
  translationModel: "",
  uiLanguage: InworldI18n.getInitialUiLanguage(),
};

const form = document.getElementById("settings-form");
const uiLanguageInput = document.getElementById("uiLanguage");
const apiKeyInput = document.getElementById("apiKey");
const voiceIdInput = document.getElementById("voiceId");
const modelSelect = document.getElementById("modelId");
const languageFilterInput = document.getElementById("languageFilter");
const sampleRateInput = document.getElementById("sampleRateHertz");
const temperatureInput = document.getElementById("temperature");
const normalizationSelect = document.getElementById("applyTextNormalization");
const audioEncodingSelect = document.getElementById("audioEncoding");
const enableWordHighlightInput = document.getElementById("enableWordHighlight");
const autoPlayOnSelectionInput = document.getElementById("autoPlayOnSelection");
const keepPlayerVisibleAfterPlaybackInput = document.getElementById("keepPlayerVisibleAfterPlayback");
const translationEnabledInput = document.getElementById("translationEnabled");
const translationTargetLanguageInput = document.getElementById("translationTargetLanguage");
const translationApiUrlInput = document.getElementById("translationApiUrl");
const translationApiKeyInput = document.getElementById("translationApiKey");
const translationModelInput = document.getElementById("translationModel");
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

  uiLanguageInput.addEventListener("change", () => {
    currentUiLanguage = normalizeUiLanguage(uiLanguageInput.value);
    applyPageTranslations();
  });

  translationEnabledInput.addEventListener("change", () => {
    updateTranslationFieldState();
  });

  voiceSelect.addEventListener("change", () => {
    const selectedVoice = loadedVoices.find((voice) => voice.voiceId === voiceSelect.value);
    if (!selectedVoice) {
      return;
    }

    voiceIdInput.value = selectedVoice.voiceId;
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

async function loadSettingsIntoForm() {
  const { settings } = await chrome.storage.local.get("settings");
  const merged = { ...DEFAULT_SETTINGS, ...(settings ?? {}) };

  currentUiLanguage = normalizeUiLanguage(merged.uiLanguage);

  uiLanguageInput.value = currentUiLanguage;
  apiKeyInput.value = merged.apiKey;
  voiceIdInput.value = merged.voiceId;
  modelSelect.value = merged.modelId;
  languageFilterInput.value = merged.languageFilter;
  sampleRateInput.value = merged.sampleRateHertz;
  temperatureInput.value = merged.temperature;
  normalizationSelect.value = merged.applyTextNormalization;
  audioEncodingSelect.value = merged.audioEncoding;
  enableWordHighlightInput.checked = Boolean(merged.enableWordHighlight);
  autoPlayOnSelectionInput.checked = Boolean(merged.autoPlayOnSelection);
  keepPlayerVisibleAfterPlaybackInput.checked = Boolean(merged.keepPlayerVisibleAfterPlayback);
  translationEnabledInput.checked = Boolean(merged.translationEnabled);
  translationTargetLanguageInput.value = merged.translationTargetLanguage;
  translationApiUrlInput.value = merged.translationApiUrl || DEFAULT_TRANSLATION_API_URL;
  translationApiKeyInput.value = merged.translationApiKey;
  translationModelInput.value = merged.translationModel;
  applyPageTranslations();
  updateTranslationFieldState();
}

function collectSettingsFromForm() {
  return {
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
    translationEnabled: translationEnabledInput.checked,
    translationTargetLanguage: translationTargetLanguageInput.value.trim(),
    translationApiUrl: translationApiUrlInput.value.trim() || DEFAULT_TRANSLATION_API_URL,
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
  if (!settings.apiKey) {
    return t("options.validationApiKey");
  }

  if (!settings.voiceId) {
    return t("options.validationVoiceId");
  }

  if (!settings.translationEnabled) {
    return "";
  }

  if (!settings.translationTargetLanguage) {
    return t("options.validationTranslationLanguage");
  }

  if (!settings.translationModel) {
    return t("options.validationTranslationModel");
  }

  try {
    const url = new URL(settings.translationApiUrl);
    if (!["http:", "https:"].includes(url.protocol)) {
      return t("options.validationTranslationApiUrlProtocol");
    }
  } catch (_error) {
    return t("options.validationTranslationApiUrlFormat");
  }

  return "";
}

async function loadVoices() {
  loadVoicesButton.disabled = true;
  setStatus(t("options.loadingVoices"));

  try {
    const response = await chrome.runtime.sendMessage({
      type: "FETCH_VOICES",
      overrides: {
        apiKey: apiKeyInput.value.trim(),
        languageFilter: languageFilterInput.value.trim(),
        uiLanguage: currentUiLanguage,
      },
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

  const currentVoiceId = voiceIdInput.value.trim();
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
  const disabled = !translationEnabledInput.checked;

  [
    translationTargetLanguageInput,
    translationApiUrlInput,
    translationApiKeyInput,
    translationModelInput,
  ].forEach((input) => {
    input.disabled = disabled;
    input.closest(".field")?.classList.toggle("is-disabled", disabled);
  });
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
