importScripts("i18n.js");

const DEFAULT_TRANSLATION_API_URL = "https://api.openai.com/v1/chat/completions";

const INWORLD_TTS_URL = "https://api.inworld.ai/tts/v1/voice";
const INWORLD_VOICES_URL = "https://api.inworld.ai/voices/v1/voices";
const CARTESIA_TTS_BYTES_URL = "https://api.cartesia.ai/tts/bytes";
const CARTESIA_TTS_SSE_URL = "https://api.cartesia.ai/tts/sse";
const CARTESIA_VOICES_URL = "https://api.cartesia.ai/voices";
const CARTESIA_API_VERSION = "2026-08-14";
const FISH_AUDIO_TTS_URL = "https://api.fish.audio/v1/tts";
const FISH_AUDIO_MODELS_URL = "https://api.fish.audio/model";

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

const CONTEXT_MENU_ID = "readmate-selection-tts-speak";
const CONTEXT_MENU_PDF_ID = "readmate-open-pdf-viewer";
const OFFSCREEN_DOCUMENT_PATH = "offscreen.html";
const MAX_TEXT_LENGTH = 2000;

async function ensureOffscreenDocument() {
  if (chrome.offscreen?.hasDocument) {
    const hasDoc = await chrome.offscreen.hasDocument();
    if (hasDoc) {
      return;
    }
  } else if (chrome.runtime?.getContexts) {
    const contexts = await chrome.runtime.getContexts({
      contextTypes: ["OFFSCREEN_DOCUMENT"],
      documentUrls: [chrome.runtime.getURL(OFFSCREEN_DOCUMENT_PATH)],
    });
    if (contexts.length > 0) {
      return;
    }
  }

  await chrome.offscreen.createDocument({
    url: OFFSCREEN_DOCUMENT_PATH,
    reasons: [chrome.offscreen.Reason.AUDIO_PLAYBACK],
    justification: "Play speech synthesis audio when content script cannot be injected, such as in Chrome's native PDF viewer.",
  });
}

async function playViaOffscreen(payload) {
  await ensureOffscreenDocument();
  return chrome.runtime.sendMessage({
    type: "PLAY_OFFSCREEN_AUDIO",
    target: "offscreen",
    payload,
  });
}

async function stopViaOffscreen() {
  try {
    if (chrome.offscreen?.hasDocument) {
      const hasDoc = await chrome.offscreen.hasDocument();
      if (!hasDoc) return;
    }
    await chrome.runtime.sendMessage({
      type: "STOP_OFFSCREEN_AUDIO",
      target: "offscreen",
    });
  } catch (_e) {
    // ignore
  }
}

chrome.runtime.onInstalled.addListener(async () => {
  const settings = await ensureSettings();
  await refreshExtensionUi(settings, true);
});

chrome.runtime.onStartup.addListener(async () => {
  const settings = await ensureSettings();
  await refreshExtensionUi(settings);
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local" || !changes.settings) {
    return;
  }

  const oldLang = changes.settings.oldValue?.uiLanguage;
  const newLang = changes.settings.newValue?.uiLanguage;

  if (oldLang !== newLang) {
    const settings = {
      ...DEFAULT_SETTINGS,
      ...(changes.settings.newValue ?? {}),
    };
    void refreshExtensionUi(settings);
  }
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === CONTEXT_MENU_PDF_ID && info.linkUrl) {
    const viewerUrl = chrome.runtime.getURL("pdf-viewer.html") + "?file=" + encodeURIComponent(info.linkUrl);
    chrome.tabs.create({ url: viewerUrl });
    return;
  }

  if (info.menuItemId !== CONTEXT_MENU_ID || !info.selectionText || !tab?.id) {
    return;
  }

  const settings = await getSettings();
  const language = getUiLanguage(settings);

  try {
    const result = await synthesizeSpeech(info.selectionText, settings);
    try {
      await chrome.tabs.sendMessage(tab.id, {
        type: "PLAY_AUDIO_FROM_TTS",
        payload: result,
      });
    } catch (tabError) {
      // Content script unavailable (native PDF viewer or restricted page) -> offscreen audio!
      console.log("Tab audio routing failed, falling back to offscreen playback:", tabError);
      await playViaOffscreen(result);
    }
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : t(language, "background.readFailedCheckConfig");

    try {
      await chrome.tabs.sendMessage(tab.id, {
        type: "INWORLD_TTS_ERROR",
        error: message,
      });
    } catch (_e) {
      console.error("ReadMate speech error:", message);
    }
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
    case "TRANSLATE_TEXT": {
      const result = await translateText(message?.text ?? "", message?.overrides ?? {});
      return { result };
    }
    case "TEST_TRANSLATION": {
      const result = await translateText(message?.text ?? "Hello, world!", message?.overrides ?? {});
      return { result };
    }
    case "OPEN_OPTIONS": {
      await chrome.runtime.openOptionsPage();
      return {};
    }
    case "OPEN_PDF_VIEWER": {
      const viewerUrl = chrome.runtime.getURL("pdf-viewer.html") +
        (message?.fileUrl ? "?file=" + encodeURIComponent(message.fileUrl) : "");
      const tab = await chrome.tabs.create({ url: viewerUrl });
      return { tabId: tab.id };
    }
    case "STOP_PLAYBACK": {
      await stopViaOffscreen();
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
  if (!merged.inworldApiKey && merged.apiKey) {
    merged.inworldApiKey = merged.apiKey;
  }
  if (!merged.inworldVoiceId && merged.voiceId) {
    merged.inworldVoiceId = merged.voiceId;
  }
  if (!merged.inworldModelId && merged.modelId) {
    merged.inworldModelId = merged.modelId;
  }
  merged.apiKey = merged.inworldApiKey || merged.apiKey;
  merged.voiceId = merged.inworldVoiceId || merged.voiceId;
  merged.modelId = merged.inworldModelId || merged.modelId;

  if (JSON.stringify(merged) !== JSON.stringify(settings)) {
    await chrome.storage.local.set({ settings: merged });
  }
  return merged;
}

async function getSettings() {
  const { settings } = await chrome.storage.local.get("settings");
  return { ...DEFAULT_SETTINGS, ...(settings ?? {}) };
}

let currentContextMenuLanguage = null;
let isRebuildingContextMenu = false;

async function refreshExtensionUi(settings, force = false) {
  const language = getUiLanguage(settings);

  try {
    await chrome.action.setTitle({
      title: t(language, "common.actionTitle"),
    });
  } catch (_error) {
    // ignore action title update failures
  }

  await rebuildContextMenu(language, force);
}

function rebuildContextMenu(language, force = false) {
  if (!force && currentContextMenuLanguage === language) {
    return Promise.resolve();
  }

  if (isRebuildingContextMenu) {
    return Promise.resolve();
  }
  isRebuildingContextMenu = true;

  return new Promise((resolve) => {
    chrome.contextMenus.removeAll(() => {
      void chrome.runtime.lastError;

      chrome.contextMenus.create(
        {
          id: CONTEXT_MENU_ID,
          title: t(language, "background.contextMenuSpeakSelection"),
          contexts: ["selection"],
        },
        () => {
          void chrome.runtime.lastError;
        },
      );

      chrome.contextMenus.create(
        {
          id: CONTEXT_MENU_PDF_ID,
          title: t(language, "background.contextMenuOpenInPdfViewer"),
          contexts: ["link"],
          targetUrlPatterns: ["*://*/*.pdf*", "*://*/*.PDF*"],
        },
        () => {
          void chrome.runtime.lastError;
          currentContextMenuLanguage = language;
          isRebuildingContextMenu = false;
          resolve();
        },
      );
    });
  });
}

function summarizeSettings(settings) {
  const provider = settings.provider === "cartesia" ? "cartesia" : (settings.provider === "fishaudio" ? "fishaudio" : "inworld");
  let apiKey = "";
  let voiceId = "";
  let modelId = "";

  if (provider === "cartesia") {
    apiKey = String(settings.cartesiaApiKey ?? "").trim();
    voiceId = String(settings.cartesiaVoiceId ?? "").trim();
    modelId = String(settings.cartesiaModelId || "sonic-3.6").trim();
  } else if (provider === "fishaudio") {
    apiKey = String(settings.fishApiKey ?? "").trim();
    voiceId = String(settings.fishVoiceId ?? "").trim();
    modelId = String(settings.fishModelId || "s2.1-pro-free").trim();
  } else {
    apiKey = String(settings.inworldApiKey || settings.apiKey || "").trim();
    voiceId = String(settings.inworldVoiceId || settings.voiceId || "").trim();
    modelId = String(settings.inworldModelId || settings.modelId || "inworld-tts-1.5-mini").trim();
  }

  const ttsConfigured = provider === "fishaudio" ? Boolean(apiKey) : Boolean(apiKey && voiceId);
  const translationEnabled = Boolean(settings.translationEnabled);
  const translationReady = !translationEnabled || isTranslationConfigured(settings);

  return {
    provider,
    configured: ttsConfigured && translationReady,
    ttsConfigured,
    hasApiKey: Boolean(apiKey),
    voiceId,
    modelId,
    languageFilter: settings.languageFilter || "",
    sampleRateHertz: settings.sampleRateHertz,
    enableWordHighlight: Boolean(settings.enableWordHighlight),
    autoPlayOnSelection: Boolean(settings.autoPlayOnSelection),
    keepPlayerVisibleAfterPlayback: Boolean(settings.keepPlayerVisibleAfterPlayback),
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
  if (settings.provider === "cartesia") {
    return fetchCartesiaVoices(settings);
  }
  if (settings.provider === "fishaudio") {
    return fetchFishAudioVoices(settings);
  }
  return fetchInworldVoices(settings);
}

async function fetchFishAudioVoices(settings) {
  const language = getUiLanguage(settings);
  const apiKey = (settings.fishApiKey || "").trim();

  if (!apiKey) {
    throw new Error(t(language, "background.fillFishApiKey"));
  }

  const response = await fetch(`${FISH_AUDIO_MODELS_URL}?page_size=30`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    throw new Error(await readApiError(response, t(language, "background.fetchVoicesFailed"), language));
  }

  const payload = await response.json();
  const rawList = Array.isArray(payload?.items) ? payload.items : (Array.isArray(payload) ? payload : []);
  return rawList.map((v) => ({
    voiceId: v._id || v.id,
    displayName: v.title || v.name || v._id,
    langCode: Array.isArray(v.languages) ? v.languages.join(", ") : (v.language || "multilingual"),
    source: "Fish Audio",
    description: v.description || (Array.isArray(v.tags) ? v.tags.join(", ") : ""),
  }));
}

async function fetchInworldVoices(settings) {
  const language = getUiLanguage(settings);
  const apiKey = (settings.inworldApiKey || settings.apiKey || "").trim();

  if (!apiKey) {
    throw new Error(t(language, "background.fillApiKey"));
  }

  const response = await fetch(buildVoiceListUrl(settings.languageFilter), {
    method: "GET",
    headers: {
      Authorization: `Basic ${apiKey}`,
    },
  });

  if (!response.ok) {
    throw new Error(await readApiError(response, t(language, "background.fetchVoicesFailed"), language));
  }

  const payload = await response.json();
  return Array.isArray(payload.voices) ? payload.voices : [];
}

async function fetchCartesiaVoices(settings) {
  const language = getUiLanguage(settings);
  const apiKey = (settings.cartesiaApiKey || "").trim();

  if (!apiKey) {
    throw new Error(t(language, "background.fillCartesiaApiKey"));
  }

  const response = await fetch(`${CARTESIA_VOICES_URL}?limit=100`, {
    method: "GET",
    headers: {
      "X-API-Key": apiKey,
      "Cartesia-Version": CARTESIA_API_VERSION,
    },
  });

  if (!response.ok) {
    throw new Error(await readApiError(response, t(language, "background.fetchVoicesFailed"), language));
  }

  const payload = await response.json();
  const rawList = Array.isArray(payload) ? payload : Array.isArray(payload?.data) ? payload.data : [];
  return rawList.map((v) => ({
    voiceId: v.id,
    displayName: v.name || v.id,
    langCode: v.language || (Array.isArray(v.accents) && v.accents[0]?.locale) || "multilingual",
    source: "Cartesia",
    description: v.description || v.tagline || "",
  }));
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

  if (settings.provider === "cartesia") {
    return synthesizeCartesiaSpeech(speechText, originalText, translation, highlightEnabled, settings);
  }

  if (settings.provider === "fishaudio") {
    return synthesizeFishAudioSpeech(speechText, originalText, translation, settings);
  }

  return synthesizeInworldSpeech(speechText, originalText, translation, highlightEnabled, settings);
}

async function synthesizeFishAudioSpeech(speechText, originalText, translation, settings) {
  const language = getUiLanguage(settings);
  const apiKey = (settings.fishApiKey || "").trim();
  const modelId = (settings.fishModelId || "s2.1-pro-free").trim();
  const voiceId = (settings.fishVoiceId || "").trim();

  if (!apiKey) {
    throw new Error(t(language, "background.fillFishApiKeyInSettings"));
  }

  const payload = {
    text: speechText,
    format: "mp3",
  };

  if (voiceId) {
    payload.reference_id = voiceId;
  }

  const headers = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    model: modelId,
  };

  const response = await fetch(FISH_AUDIO_TTS_URL, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await readApiError(response, t(language, "background.speechRequestFailed"), language));
  }

  const arrayBuffer = await response.arrayBuffer();
  const base64Audio = uint8ArrayToBase64(new Uint8Array(arrayBuffer));

  return {
    audioContent: base64Audio,
    mimeType: "audio/mpeg",
    usage: null,
    timestampInfo: null,
    sourceText: speechText,
    originalText,
    translationApplied: translation.applied,
    translationTargetLanguage: translation.targetLanguage,
    translationModel: translation.model,
    voiceId: voiceId || "default",
    modelId,
    textLength: speechText.length,
  };
}

async function synthesizeInworldSpeech(speechText, originalText, translation, highlightEnabled, settings) {
  const language = getUiLanguage(settings);
  const apiKey = (settings.inworldApiKey || settings.apiKey || "").trim();
  const voiceId = (settings.inworldVoiceId || settings.voiceId || "").trim();

  if (!apiKey) {
    throw new Error(t(language, "background.fillApiKeyInSettings"));
  }
  if (!voiceId) {
    throw new Error(t(language, "background.fillVoiceIdInSettings"));
  }

  const payload = {
    text: speechText,
    voiceId,
    modelId: settings.inworldModelId || settings.modelId || DEFAULT_SETTINGS.modelId,
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
    headers: buildHeaders(apiKey),
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
    voiceId,
    modelId: payload.modelId,
    textLength: speechText.length,
  };
}

async function synthesizeCartesiaSpeech(speechText, originalText, translation, highlightEnabled, settings) {
  const language = getUiLanguage(settings);
  const apiKey = (settings.cartesiaApiKey || "").trim();
  const voiceId = (settings.cartesiaVoiceId || "").trim();

  if (!apiKey) {
    throw new Error(t(language, "background.fillCartesiaApiKeyInSettings"));
  }
  if (!voiceId) {
    throw new Error(t(language, "background.fillCartesiaVoiceIdInSettings"));
  }

  if (highlightEnabled) {
    try {
      return await synthesizeCartesiaSse(speechText, originalText, translation, settings);
    } catch (sseError) {
      console.warn("Cartesia SSE failed, falling back to bytes:", sseError);
    }
  }

  return synthesizeCartesiaBytes(speechText, originalText, translation, settings);
}

async function synthesizeCartesiaBytes(speechText, originalText, translation, settings) {
  const language = getUiLanguage(settings);
  const apiKey = (settings.cartesiaApiKey || "").trim();
  const voiceId = (settings.cartesiaVoiceId || "").trim();
  const modelId = (settings.cartesiaModelId || "sonic-3.6").trim();

  const payload = {
    model_id: modelId,
    transcript: speechText,
    voice: {
      mode: "id",
      id: voiceId,
    },
    output_format: {
      container: "wav",
      encoding: "pcm_s16le",
      sample_rate: 44100,
    },
  };

  if (settings.cartesiaLanguage?.trim()) {
    payload.language = settings.cartesiaLanguage.trim();
  }

  const response = await fetch(CARTESIA_TTS_BYTES_URL, {
    method: "POST",
    headers: {
      "X-API-Key": apiKey,
      "Cartesia-Version": CARTESIA_API_VERSION,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await readApiError(response, t(language, "background.speechRequestFailed"), language));
  }

  const arrayBuffer = await response.arrayBuffer();
  const base64Audio = uint8ArrayToBase64(new Uint8Array(arrayBuffer));

  return {
    audioContent: base64Audio,
    mimeType: "audio/wav",
    usage: null,
    timestampInfo: null,
    sourceText: speechText,
    originalText,
    translationApplied: translation.applied,
    translationTargetLanguage: translation.targetLanguage,
    translationModel: translation.model,
    voiceId,
    modelId,
    textLength: speechText.length,
  };
}

async function synthesizeCartesiaSse(speechText, originalText, translation, settings) {
  const language = getUiLanguage(settings);
  const apiKey = (settings.cartesiaApiKey || "").trim();
  const voiceId = (settings.cartesiaVoiceId || "").trim();
  const modelId = (settings.cartesiaModelId || "sonic-3.6").trim();

  const payload = {
    model_id: modelId,
    transcript: speechText,
    voice: {
      mode: "id",
      id: voiceId,
    },
    output_format: {
      container: "raw",
      encoding: "pcm_s16le",
      sample_rate: 44100,
    },
    add_timestamps: true,
  };

  if (settings.cartesiaLanguage?.trim()) {
    payload.language = settings.cartesiaLanguage.trim();
  }

  const response = await fetch(CARTESIA_TTS_SSE_URL, {
    method: "POST",
    headers: {
      "X-API-Key": apiKey,
      "Cartesia-Version": CARTESIA_API_VERSION,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await readApiError(response, t(language, "background.speechRequestFailed"), language));
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const pcmChunks = [];
  const words = [];
  const starts = [];
  const ends = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop();

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const dataStr = trimmed.slice(5).trim();
      if (!dataStr || dataStr === "[DONE]") continue;

      try {
        const event = JSON.parse(dataStr);
        const rawAudioBase64 = event.data || event.audio;
        if (typeof rawAudioBase64 === "string" && rawAudioBase64) {
          const binary = atob(rawAudioBase64);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
          }
          pcmChunks.push(bytes);
        }
        const wt = event.word_timestamps || event.timestamps;
        if (wt && Array.isArray(wt.words)) {
          for (let i = 0; i < wt.words.length; i++) {
            words.push(wt.words[i]);
            starts.push(Number(wt.start ? wt.start[i] : (starts[starts.length - 1] || 0)));
            ends.push(Number(wt.end ? wt.end[i] : starts[starts.length - 1] || 0));
          }
        }
      } catch (_e) {
        // ignore malformed SSE frames
      }
    }
  }

  const totalPcmLength = pcmChunks.reduce((acc, chunk) => acc + chunk.length, 0);
  if (totalPcmLength === 0) {
    throw new Error(t(language, "background.noAudioContent"));
  }

  const combinedPcm = new Uint8Array(totalPcmLength);
  let offset = 0;
  for (const chunk of pcmChunks) {
    combinedPcm.set(chunk, offset);
    offset += chunk.length;
  }

  const wavBytes = pcmToWav(combinedPcm, 44100, 1);
  const base64Audio = uint8ArrayToBase64(wavBytes);

  const timestampInfo = words.length > 0 ? {
    wordAlignment: {
      words,
      wordStartTimeSeconds: starts,
      wordEndTimeSeconds: ends,
    },
  } : null;

  return {
    audioContent: base64Audio,
    mimeType: "audio/wav",
    usage: null,
    timestampInfo,
    sourceText: speechText,
    originalText,
    translationApplied: translation.applied,
    translationTargetLanguage: translation.targetLanguage,
    translationModel: translation.model,
    voiceId,
    modelId,
    textLength: speechText.length,
  };
}

function pcmToWav(pcmBytes, sampleRate = 44100, numChannels = 1) {
  const dataSize = pcmBytes.length;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  writeAscii(view, 0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(view, 8, "WAVE");
  writeAscii(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * 2, true);
  view.setUint16(32, numChannels * 2, true);
  view.setUint16(34, 16, true);
  writeAscii(view, 36, "data");
  view.setUint32(40, dataSize, true);

  const out = new Uint8Array(buffer);
  out.set(pcmBytes, 44);
  return out;
}

function writeAscii(view, offset, string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

function uint8ArrayToBase64(bytes) {
  let binary = "";
  const len = bytes.byteLength;
  const chunkSize = 0x8000;
  for (let i = 0; i < len; i += chunkSize) {
    binary += String.fromCharCode.apply(
      null,
      bytes.subarray(i, Math.min(i + chunkSize, len)),
    );
  }
  return btoa(binary);
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

async function translateText(rawText, overrides = {}) {
  const baseSettings = await getSettings();
  const settings = { ...baseSettings, ...overrides };
  const language = getUiLanguage(settings);
  const text = String(rawText ?? "").trim();
  if (!text) {
    throw new Error(t(language, "background.noSpeakableText"));
  }

  const model = String(settings.translationModel ?? "").trim();
  if (!model) {
    throw new Error(t(language, "background.fillTranslationConfigInSettings"));
  }

  const targetLanguage =
    String(settings.translationTargetLanguage ?? "").trim() ||
    (language === "zh-CN" ? "中文" : "English");

  const apiUrl = normalizeTranslationApiUrl(settings.translationApiUrl, language);
  const translatedText = await translateTextWithLlm(text, {
    apiKey: String(settings.translationApiKey ?? "").trim(),
    apiUrl,
    model,
    targetLanguage,
    language,
  });

  return {
    text: translatedText,
    originalText: text,
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
