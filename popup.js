const summary = document.getElementById("summary");
const message = document.getElementById("message");
const speakButton = document.getElementById("speakButton");
const pdfReaderButton = document.getElementById("pdfReaderButton");
const stopButton = document.getElementById("stopButton");
const settingsButton = document.getElementById("settingsButton");

let currentUiLanguage = InworldI18n.getInitialUiLanguage();

void initialize();

async function initialize() {
  applyPopupTranslations();
  await refreshSummary();

  speakButton.addEventListener("click", async () => {
    await sendMessageToActiveTab("TRIGGER_PLAY_SELECTION");
  });

  pdfReaderButton.addEventListener("click", async () => {
    await chrome.runtime.sendMessage({ type: "OPEN_PDF_VIEWER" });
    window.close();
  });

  stopButton.addEventListener("click", async () => {
    await sendMessageToActiveTab("STOP_PLAYBACK", "success", t("popup.stopRequested"));
  });

  settingsButton.addEventListener("click", async () => {
    await chrome.runtime.sendMessage({ type: "OPEN_OPTIONS" });
    window.close();
  });
}

async function refreshSummary() {
  const response = await chrome.runtime.sendMessage({ type: "GET_SETTINGS_SUMMARY" });
  if (!response?.ok) {
    applyPopupTranslations();
    summary.textContent = t("popup.summaryReadFailed");
    return;
  }

  currentUiLanguage = normalizeUiLanguage(response.settings.uiLanguage);
  applyPopupTranslations();

  const settings = response.settings;
  if (!settings.ttsConfigured) {
    summary.textContent = t("popup.summaryNeedConfig");
    return;
  }

  if (settings.translationEnabled && !settings.translationReady) {
    summary.textContent = t("popup.summaryNeedTranslationConfig");
    return;
  }

  const providerName =
    settings.provider === "cartesia"
      ? "Cartesia"
      : settings.provider === "fishaudio"
        ? "Fish Audio"
        : "Inworld";
  summary.textContent = settings.translationEnabled
    ? t("popup.summaryConfiguredWithTranslation", {
        provider: providerName,
        modelId: settings.modelId,
        voiceId: settings.voiceId,
        targetLanguage: settings.translationTargetLanguage,
      })
    : t("popup.summaryConfigured", {
        provider: providerName,
        modelId: settings.modelId,
        voiceId: settings.voiceId,
      });
}

async function sendMessageToActiveTab(type, tone = "", successText = "") {
  setMessage(t("popup.processing"));

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
      throw new Error(t("popup.currentTabNotFound"));
    }

    const response = await chrome.tabs.sendMessage(tab.id, { type });
    if (!response?.ok) {
      throw new Error(response?.error || t("popup.operationFailed"));
    }

    setMessage(successText || t("popup.requestSent"), tone || "success");
  } catch (error) {
    const messageText = error instanceof Error ? error.message : "";
    if (
      messageText.includes("Extension context invalidated") ||
      messageText.includes("Could not establish connection") ||
      messageText.includes("Receiving end does not exist")
    ) {
      setMessage(t("popup.refreshPageAfterReload"), "error");
      return;
    }

    setMessage(
      error instanceof Error ? error.message : t("popup.unsupportedPage"),
      "error",
    );
  }
}

function applyPopupTranslations() {
  InworldI18n.applyTranslations(document, currentUiLanguage);
}

function setMessage(text, tone = "") {
  message.textContent = text;
  message.className = "message";
  if (tone === "error") {
    message.classList.add("is-error");
  }
  if (tone === "success") {
    message.classList.add("is-success");
  }
}

function normalizeUiLanguage(language) {
  return InworldI18n.normalizeUiLanguage(language, InworldI18n.getInitialUiLanguage());
}

function t(key, params = {}) {
  return InworldI18n.getMessage(key, params, currentUiLanguage);
}
