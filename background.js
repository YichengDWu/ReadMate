importScripts("i18n.js");

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
  translationEnabled: false,
  translationTargetLanguage: "",
  translationApiUrl: DEFAULT_TRANSLATION_API_URL,
  translationApiKey: "",
  translationModel: "",
  uiLanguage: InworldI18n.getInitialUiLanguage(),
};

const CONTEXT_MENU_ID = "inworld-selection-tts-speak";
const MAX_TEXT_LENGTH = 2000;
const INWORLD_TTS_URL = "https://api.inworld.ai/tts/v1/voice";
const INWORLD_VOICES_URL = "https://api.inworld.ai/voices/v1/voices";

void initializeBackgroundUi();

chrome.runtime.onInstalled.addListener(async () => {
  const settings = await ensureSettings();
  await refreshExtensionUi(settings);
});

chrome.runtime.onStartup.addListener(async () => {
  const settings = await ensureSettings();
  await refreshExtensionUi(settings);
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local" || !changes.settings) {
    return;
  }

  const settings = {
    ...DEFAULT_SETTINGS,
    ...(changes.settings.newValue ?? {}),
  };

  void refreshExtensionUi(settings);
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== CONTEXT_MENU_ID || !info.selectionText || !tab?.id) {
    return;
  }

  const settings = await getSettings();
  const language = getUiLanguage(settings);

  try {
    const result = await synthesizeSpeech(info.selectionText, settings);
    await chrome.tabs.sendMessage(tab.id, {
      type: "PLAY_AUDIO_FROM_TTS",
      payload: result,
    });
  } catch (error) {
    await chrome.tabs.sendMessage(tab.id, {
      type: "INWORLD_TTS_ERROR",
      error:
        error instanceof Error
          ? error.message
          : t(language, "background.readFailedCheckConfig"),
    }).catch(() => undefined);
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  handleMessage(message)
    .then((response) => sendResponse({ ok: true, ...response }))
    .catch((error) =>
      sendResponse({
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : t(InworldI18n.getInitialUiLanguage(), "background.unknownError"),
      }),
    );

  return true;
});

async function initializeBackgroundUi() {
  const settings = await ensureSettings();
  await refreshExtensionUi(settings);
}

async function handleMessage(message) {
  switch (message?.type) {
    case "GET_SETTINGS_SUMMARY": {
      const settings = await getSettings();
      return { settings: summarizeSettings(settings) };
    }
    case "FETCH_VOICES": {
      const voices = await fetchVoices(message?.overrides ?? {});
      return { voices };
    }
    case "SPEAK_TEXT": {
      const result = await synthesizeSpeech(message?.text ?? "", message?.overrides ?? {});
      return { result };
    }
    case "OPEN_OPTIONS": {
      await chrome.runtime.openOptionsPage();
      return {};
    }
    default: {
      const settings = await getSettings();
      throw new Error(tForSettings(settings, "background.unsupportedMessageType"));
    }
  }
}

async function ensureSettings() {
  const { settings } = await chrome.storage.local.get("settings");
  if (!settings) {
    await chrome.storage.local.set({ settings: { ...DEFAULT_SETTINGS } });
    return { ...DEFAULT_SETTINGS };
  }

  const merged = { ...DEFAULT_SETTINGS, ...settings };
  if (JSON.stringify(merged) !== JSON.stringify(settings)) {
    await chrome.storage.local.set({ settings: merged });
  }
  return merged;
}

async function getSettings() {
  const { settings } = await chrome.storage.local.get("settings");
  return { ...DEFAULT_SETTINGS, ...(settings ?? {}) };
}

async function refreshExtensionUi(settings) {
  const language = getUiLanguage(settings);

  try {
    await chrome.action.setTitle({
      title: t(language, "common.actionTitle"),
    });
  } catch (_error) {
    // ignore action title update failures
  }

  await rebuildContextMenu(language);
}

function rebuildContextMenu(language) {
  return new Promise((resolve) => {
    chrome.contextMenus.removeAll(() => {
      chrome.contextMenus.create(
        {
          id: CONTEXT_MENU_ID,
          title: t(language, "background.contextMenuSpeakSelection"),
          contexts: ["selection"],
        },
        () => resolve(),
      );
    });
  });
}

function summarizeSettings(settings) {
  const ttsConfigured = Boolean(settings.apiKey?.trim() && settings.voiceId?.trim());
  const translationEnabled = Boolean(settings.translationEnabled);
  const translationReady = !translationEnabled || isTranslationConfigured(settings);

  return {
    configured: ttsConfigured && translationReady,
    ttsConfigured,
    hasApiKey: Boolean(settings.apiKey?.trim()),
    voiceId: settings.voiceId || "",
    modelId: settings.modelId,
    languageFilter: settings.languageFilter || "",
    sampleRateHertz: settings.sampleRateHertz,
    enableWordHighlight: Boolean(settings.enableWordHighlight),
    autoPlayOnSelection: Boolean(settings.autoPlayOnSelection),
    translationEnabled,
    translationReady,
    translationTargetLanguage: settings.translationTargetLanguage || "",
    translationModel: settings.translationModel || "",
    uiLanguage: getUiLanguage(settings),
  };
}

function normalizeText(text) {
  return String(text ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseLanguageFilter(rawValue) {
  return String(rawValue ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildHeaders(apiKey) {
  return {
    Authorization: `Basic ${apiKey.trim()}`,
    "Content-Type": "application/json",
  };
}

function buildTranslationHeaders(apiKey) {
  const headers = {
    "Content-Type": "application/json",
  };

  if (String(apiKey ?? "").trim()) {
    headers.Authorization = `Bearer ${apiKey.trim()}`;
  }

  return headers;
}

function buildVoiceListUrl(languageFilter) {
  const url = new URL(INWORLD_VOICES_URL);
  const languages = parseLanguageFilter(languageFilter);
  languages.forEach((language) => {
    url.searchParams.append("languages", language);
  });
  return url.toString();
}

async function fetchVoices(overrides = {}) {
  const settings = { ...(await getSettings()), ...overrides };
  const language = getUiLanguage(settings);

  if (!settings.apiKey?.trim()) {
    throw new Error(t(language, "background.fillApiKey"));
  }

  const response = await fetch(buildVoiceListUrl(settings.languageFilter), {
    method: "GET",
    headers: {
      Authorization: `Basic ${settings.apiKey.trim()}`,
    },
  });

  if (!response.ok) {
    throw new Error(await readApiError(response, t(language, "background.fetchVoicesFailed"), language));
  }

  const payload = await response.json();
  return Array.isArray(payload.voices) ? payload.voices : [];
}

async function synthesizeSpeech(text, overrides = {}) {
  const settings = { ...(await getSettings()), ...overrides };
  const language = getUiLanguage(settings);
  const originalText = String(text ?? "").trim();

  if (!originalText) {
    throw new Error(t(language, "background.noSpeakableText"));
  }

  const normalizedOriginalText = normalizeText(originalText);
  if (!normalizedOriginalText) {
    throw new Error(t(language, "background.noSpeakableText"));
  }
  if (normalizedOriginalText.length > MAX_TEXT_LENGTH) {
    throw new Error(t(language, "background.maxLengthExceeded", { max: MAX_TEXT_LENGTH }));
  }

  if (!settings.apiKey?.trim()) {
    throw new Error(t(language, "background.fillApiKeyInSettings"));
  }
  if (!settings.voiceId?.trim()) {
    throw new Error(t(language, "background.fillVoiceIdInSettings"));
  }

  const translation = await maybeTranslateText(originalText, settings);
  const speechText = normalizeText(translation.text);
  if (!speechText) {
    throw new Error(t(language, "background.translationEmpty"));
  }
  if (speechText.length > MAX_TEXT_LENGTH) {
    throw new Error(t(language, "background.translatedTextTooLong", { max: MAX_TEXT_LENGTH }));
  }

  const highlightEnabled =
    Boolean(settings.enableWordHighlight) && !translation.applied;

  const payload = {
    text: speechText,
    voiceId: settings.voiceId.trim(),
    modelId: settings.modelId || DEFAULT_SETTINGS.modelId,
    audioConfig: {
      audioEncoding: settings.audioEncoding || DEFAULT_SETTINGS.audioEncoding,
      sampleRateHertz: Number(settings.sampleRateHertz) || DEFAULT_SETTINGS.sampleRateHertz,
    },
    temperature: clampTemperature(settings.temperature),
    applyTextNormalization:
      settings.applyTextNormalization || DEFAULT_SETTINGS.applyTextNormalization,
  };

  if (highlightEnabled) {
    payload.timestampType = "WORD";
  }

  const response = await fetch(INWORLD_TTS_URL, {
    method: "POST",
    headers: buildHeaders(settings.apiKey),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await readApiError(response, t(language, "background.speechRequestFailed"), language));
  }

  const result = await response.json();
  if (!result.audioContent) {
    throw new Error(t(language, "background.noAudioContent"));
  }

  return {
    audioContent: result.audioContent,
    mimeType: inferMimeType(payload.audioConfig.audioEncoding),
    usage: result.usage ?? null,
    timestampInfo: highlightEnabled ? result.timestampInfo ?? null : null,
    sourceText: speechText,
    originalText,
    translationApplied: translation.applied,
    translationTargetLanguage: translation.targetLanguage,
    translationModel: translation.model,
    voiceId: payload.voiceId,
    modelId: payload.modelId,
    textLength: speechText.length,
  };
}

function isTranslationConfigured(settings) {
  if (
    !String(settings.translationTargetLanguage ?? "").trim() ||
    !String(settings.translationModel ?? "").trim()
  ) {
    return false;
  }

  try {
    normalizeTranslationApiUrl(settings.translationApiUrl, getUiLanguage(settings));
    return true;
  } catch (_error) {
    return false;
  }
}

function normalizeTranslationApiUrl(rawValue, language) {
  const value = String(rawValue ?? DEFAULT_TRANSLATION_API_URL).trim() || DEFAULT_TRANSLATION_API_URL;
  let parsedUrl;

  try {
    parsedUrl = new URL(value);
  } catch (_error) {
    throw new Error(t(language, "background.invalidTranslationApiUrl"));
  }

  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    throw new Error(t(language, "background.invalidTranslationApiUrlProtocol"));
  }

  return parsedUrl.toString();
}

async function maybeTranslateText(text, settings) {
  const language = getUiLanguage(settings);

  if (!settings.translationEnabled) {
    return {
      applied: false,
      text,
      targetLanguage: "",
      model: "",
    };
  }

  const targetLanguage = String(settings.translationTargetLanguage ?? "").trim();
  if (!targetLanguage) {
    throw new Error(t(language, "background.fillTranslationLanguage"));
  }

  const model = String(settings.translationModel ?? "").trim();
  if (!model) {
    throw new Error(t(language, "background.fillTranslationModel"));
  }

  const translatedText = await translateTextWithLlm(text, {
    apiKey: String(settings.translationApiKey ?? "").trim(),
    apiUrl: normalizeTranslationApiUrl(settings.translationApiUrl, language),
    model,
    targetLanguage,
    language,
  });

  return {
    applied: true,
    text: translatedText,
    targetLanguage,
    model,
  };
}

async function translateTextWithLlm(text, options) {
  const response = await fetch(options.apiUrl, {
    method: "POST",
    headers: buildTranslationHeaders(options.apiKey),
    body: JSON.stringify({
      model: options.model,
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content: [
            "You are a translation engine.",
            `Translate the user's text into ${options.targetLanguage}.`,
            "Preserve the original meaning, tone, and formatting when possible.",
            "Return only the translated text.",
            "Do not add notes, quotes, or markdown.",
          ].join(" "),
        },
        {
          role: "user",
          content: text,
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(
      await readApiError(response, t(options.language, "background.translationRequestFailed"), options.language),
    );
  }

  const payload = await response.json();
  const translatedText = extractTranslationText(payload);
  if (!translatedText) {
    throw new Error(t(options.language, "background.translationNoResult"));
  }

  return translatedText;
}

function extractTranslationText(payload) {
  const content = payload?.choices?.[0]?.message?.content;
  const fallbackText = payload?.choices?.[0]?.text;

  if (typeof content === "string") {
    return content.trim();
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") {
          return part;
        }

        if (typeof part?.text === "string") {
          return part.text;
        }

        if (typeof part?.text?.value === "string") {
          return part.text.value;
        }

        return "";
      })
      .join("\n")
      .trim();
  }

  if (typeof fallbackText === "string") {
    return fallbackText.trim();
  }

  return "";
}

function clampTemperature(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return DEFAULT_SETTINGS.temperature;
  }
  return Math.min(2, Math.max(0.1, numeric));
}

function inferMimeType(audioEncoding) {
  switch (audioEncoding) {
    case "MP3":
      return "audio/mpeg";
    case "OGG_OPUS":
      return "audio/ogg";
    case "LINEAR16":
    default:
      return "audio/wav";
  }
}

async function readApiError(response, fallbackMessage, language) {
  const text = await response.text();
  if (!text) {
    return t(language, "background.errorWithStatus", {
      message: fallbackMessage,
      status: response.status,
    });
  }

  try {
    const payload = JSON.parse(text);
    const detail =
      payload?.error?.message ||
      payload?.message ||
      payload?.details ||
      payload?.status;

    if (detail) {
      return t(language, "background.errorWithDetail", {
        message: fallbackMessage,
        detail,
      });
    }
  } catch (_error) {
    // ignore JSON parsing errors and fall back to raw text below
  }

  return t(language, "background.errorWithDetail", {
    message: fallbackMessage,
    detail: text,
  });
}

function getUiLanguage(settings) {
  return InworldI18n.normalizeUiLanguage(
    settings?.uiLanguage,
    InworldI18n.getInitialUiLanguage(),
  );
}

function t(language, key, params = {}) {
  return InworldI18n.getMessage(key, params, language);
}

function tForSettings(settings, key, params = {}) {
  return t(getUiLanguage(settings), key, params);
}
