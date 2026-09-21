const MAX_SELECTION_LENGTH = 2000;
const HIGHLIGHT_NAME = "inworld-current-word";
const LOOKAHEAD_WINDOW = 4;
const AUTO_PLAY_DELAY_MS = 260;
const CONTENT_DEFAULT_SETTINGS = {
  autoPlayOnSelection: false,
  keepPlayerVisibleAfterPlayback: false,
  translationEnabled: false,
  translationTargetLanguage: "",
  uiLanguage: InworldI18n.getInitialUiLanguage(),
};
const supportsCustomHighlights =
  typeof CSS !== "undefined" &&
  Boolean(CSS.highlights) &&
  typeof Highlight !== "undefined";

let currentSelectionText = "";
let currentSelectionRect = null;
let currentSelectionSnapshot = null;
let audioElement = null;
let currentObjectUrl = null;
let toastTimer = null;
let autoPlayTimer = 0;
let highlightFrameId = 0;
let playerFrameId = 0;
let alignedWordTokens = [];
let activeWordIndex = -1;
let isBusy = false;
let isPlaying = false;
let isPaused = false;
let hasCompletedPlayback = false;
let isDraggingPlayer = false;
let isDraggingTranslationCard = false;
let isSeeking = false;
let extensionContextLost = false;
let currentPlaybackMeta = null;
let playerDragOffsetX = 0;
let playerDragOffsetY = 0;
let translationCardDragOffsetX = 0;
let translationCardDragOffsetY = 0;
let lastAutoPlaySelectionKey = "";
let contentSettings = { ...CONTENT_DEFAULT_SETTINGS };

const SPEAKER_ICON_SVG =
  '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' +
  '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor"></polygon>' +
  '<path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>' +
  '<path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>' +
  "</svg>";

const LOADING_ICON_SVG =
  '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="inworld-spin">' +
  '<path d="M21 12a9 9 0 1 1-6.219-8.56"></path>' +
  "</svg>";

const STOP_ICON_SVG =
  '<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">' +
  '<rect x="5" y="5" width="14" height="14" rx="2"></rect>' +
  "</svg>";

const REFRESH_ICON_SVG =
  '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' +
  '<polyline points="23 4 23 10 17 10"></polyline>' +
  '<path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>' +
  "</svg>";

const TRANSLATE_ICON_SVG =
  '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' +
  '<path d="m5 8 6 6"></path>' +
  '<path d="m4 14 6-6 2-3"></path>' +
  '<path d="M2 5h12"></path>' +
  '<path d="M7 2h1"></path>' +
  '<path d="m22 22-5-10-5 10"></path>' +
  '<path d="M14 18h6"></path>' +
  "</svg>";

const COPY_ICON_SVG =
  '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' +
  '<rect width="14" height="14" x="8" y="8" rx="2" ry="2"></rect>' +
  '<path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"></path>' +
  "</svg>";

const CHECK_ICON_SVG =
  '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">' +
  '<polyline points="20 6 9 17 4 12"></polyline>' +
  "</svg>";

const CLOSE_ICON_SVG =
  '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' +
  '<line x1="18" y1="6" x2="6" y2="18"></line>' +
  '<line x1="6" y1="6" x2="18" y2="18"></line>' +
  "</svg>";

let currentTranslationData = null;
let isTranslating = false;
let activeTranslationPort = null;

const bubble = document.createElement("div");
bubble.id = "inworld-tts-bubble";

const actionButton = document.createElement("button");
actionButton.id = "inworld-tts-button";
actionButton.type = "button";
actionButton.innerHTML = SPEAKER_ICON_SVG;
actionButton.title = t("content.speakAction");
actionButton.setAttribute("aria-label", t("content.speakAction"));

const translateButton = document.createElement("button");
translateButton.id = "readmate-translate-button";
translateButton.type = "button";
translateButton.innerHTML = TRANSLATE_ICON_SVG;
translateButton.title = t("content.translateAction");
translateButton.setAttribute("aria-label", t("content.translateAction"));

const meta = document.createElement("div");
meta.id = "inworld-tts-meta";

const metaTitle = document.createElement("strong");
metaTitle.textContent = t("common.brandShort");
meta.appendChild(metaTitle);

const metaBody = document.createElement("span");
metaBody.textContent = t("content.defaultMeta");
meta.appendChild(metaBody);

bubble.append(actionButton, translateButton, meta);
document.documentElement.appendChild(bubble);

bubble.addEventListener("mousedown", (event) => {
  event.preventDefault();
});

const translationCard = document.createElement("div");
translationCard.id = "readmate-translation-card";

const translationCardDragHandle = document.createElement("div");
translationCardDragHandle.className = "readmate-trans-drag-handle";
translationCardDragHandle.setAttribute("role", "toolbar");
translationCardDragHandle.setAttribute("aria-label", "Drag translation panel");

const translationCardDragBar = document.createElement("div");
translationCardDragBar.className = "readmate-trans-drag-bar";
translationCardDragHandle.appendChild(translationCardDragBar);

const translationCardHead = document.createElement("div");
translationCardHead.className = "readmate-trans-head";

const translationCardTitleRow = document.createElement("div");
translationCardTitleRow.className = "readmate-trans-title-row";

const translationCardBadge = document.createElement("span");
translationCardBadge.className = "readmate-trans-badge";
translationCardBadge.textContent = t("content.translationCardTitle");

const translationCardLang = document.createElement("span");
translationCardLang.className = "readmate-trans-lang";

translationCardTitleRow.append(translationCardBadge, translationCardLang);

const translationCardActions = document.createElement("div");
translationCardActions.className = "readmate-trans-actions";

const translationCopyButton = document.createElement("button");
translationCopyButton.type = "button";
translationCopyButton.className = "readmate-trans-action-btn";
translationCopyButton.id = "readmate-trans-copy-btn";
translationCopyButton.title = t("content.translationCopy");
translationCopyButton.setAttribute("aria-label", t("content.translationCopy"));
translationCopyButton.innerHTML = COPY_ICON_SVG;

const translationCloseButton = document.createElement("button");
translationCloseButton.type = "button";
translationCloseButton.className = "readmate-trans-action-btn";
translationCloseButton.id = "readmate-trans-close-btn";
translationCloseButton.title = t("content.translationClose");
translationCloseButton.setAttribute("aria-label", t("content.translationClose"));
translationCloseButton.innerHTML = CLOSE_ICON_SVG;

translationCardActions.append(translationCopyButton, translationCloseButton);
translationCardHead.append(translationCardTitleRow, translationCardActions);

const translationCardBody = document.createElement("div");
translationCardBody.className = "readmate-trans-body";
translationCardBody.id = "readmate-trans-body";

const translationCardFooter = document.createElement("div");
translationCardFooter.className = "readmate-trans-footer";
translationCardFooter.id = "readmate-trans-footer";

const translationSpeakButton = document.createElement("button");
translationSpeakButton.type = "button";
translationSpeakButton.className = "readmate-trans-speak-btn";
translationSpeakButton.id = "readmate-trans-speak-btn";
translationSpeakButton.innerHTML = SPEAKER_ICON_SVG + `<span>${t("content.translationSpeak")}</span>`;

const translationModelBadge = document.createElement("span");
translationModelBadge.className = "readmate-trans-model";
translationModelBadge.id = "readmate-trans-model";

translationCardFooter.append(translationSpeakButton, translationModelBadge);
translationCard.append(
  translationCardDragHandle,
  translationCardHead,
  translationCardBody,
  translationCardFooter,
);
document.documentElement.appendChild(translationCard);

translationCardDragHandle.addEventListener("pointerdown", (event) => {
  startTranslationCardDrag(event);
});

translationCardHead.addEventListener("pointerdown", (event) => {
  startTranslationCardDrag(event);
});

translationCard.addEventListener("mousedown", (event) => {
  event.stopPropagation();
});

const toast = document.createElement("div");
toast.id = "inworld-tts-toast";
document.documentElement.appendChild(toast);

const miniPlayer = document.createElement("section");
miniPlayer.id = "inworld-tts-player";

const miniPlayerHead = document.createElement("div");
miniPlayerHead.id = "inworld-tts-player-head";

const miniPlayerHeading = document.createElement("div");
const miniPlayerTitle = document.createElement("div");
miniPlayerTitle.id = "inworld-tts-player-title";
miniPlayerTitle.textContent = t("common.miniPlayerTitle");

const miniPlayerStatus = document.createElement("div");
miniPlayerStatus.id = "inworld-tts-player-status";
miniPlayerStatus.textContent = t("content.playerStatusWaiting");
miniPlayerHeading.append(miniPlayerTitle, miniPlayerStatus);

const miniPlayerChip = document.createElement("div");
miniPlayerChip.id = "inworld-tts-player-chip";
miniPlayerChip.textContent = t("content.playerChipReady");

miniPlayerHead.append(miniPlayerHeading, miniPlayerChip);

const miniPlayerText = document.createElement("div");
miniPlayerText.id = "inworld-tts-player-text";
miniPlayerText.textContent = t("content.defaultPlayerText");

const miniPlayerProgress = document.createElement("div");
miniPlayerProgress.id = "inworld-tts-player-progress";

const miniPlayerProgressFill = document.createElement("div");
miniPlayerProgressFill.id = "inworld-tts-player-progress-fill";
miniPlayerProgress.appendChild(miniPlayerProgressFill);

const miniPlayerTimes = document.createElement("div");
miniPlayerTimes.id = "inworld-tts-player-times";

const miniPlayerElapsed = document.createElement("span");
miniPlayerElapsed.textContent = "00:00";

const miniPlayerDuration = document.createElement("span");
miniPlayerDuration.textContent = "--:--";
miniPlayerTimes.append(miniPlayerElapsed, miniPlayerDuration);

const miniPlayerControls = document.createElement("div");
miniPlayerControls.id = "inworld-tts-player-controls";

const miniPlayerPlayPauseButton = document.createElement("button");
miniPlayerPlayPauseButton.id = "inworld-tts-player-playpause";
miniPlayerPlayPauseButton.className = "inworld-tts-player-control";
miniPlayerPlayPauseButton.type = "button";
miniPlayerPlayPauseButton.textContent = t("content.pause");

const miniPlayerStopButton = document.createElement("button");
miniPlayerStopButton.id = "inworld-tts-player-stop";
miniPlayerStopButton.className = "inworld-tts-player-control";
miniPlayerStopButton.type = "button";
miniPlayerStopButton.textContent = t("content.stop");

miniPlayerControls.append(miniPlayerPlayPauseButton, miniPlayerStopButton);
miniPlayer.append(
  miniPlayerHead,
  miniPlayerText,
  miniPlayerProgress,
  miniPlayerTimes,
  miniPlayerControls,
);
document.documentElement.appendChild(miniPlayer);

miniPlayer.addEventListener("mousedown", (event) => {
  event.preventDefault();
});

miniPlayerHead.addEventListener("pointerdown", (event) => {
  startMiniPlayerDrag(event);
});

miniPlayerProgress.addEventListener("pointerdown", (event) => {
  startSeek(event);
});

window.addEventListener("pointermove", (event) => {
  if (isDraggingPlayer) {
    updateMiniPlayerDrag(event);
    return;
  }

  if (isDraggingTranslationCard) {
    updateTranslationCardDrag(event);
    return;
  }

  if (isSeeking) {
    updateSeek(event);
  }
}, true);

window.addEventListener("pointerup", (event) => {
  finishPointerInteraction(event);
}, true);

window.addEventListener("pointercancel", (event) => {
  finishPointerInteraction(event);
}, true);

actionButton.addEventListener("click", (event) => {
  event.preventDefault();
  event.stopPropagation();

  if (!hasExtensionContext()) {
    handleExtensionContextLoss();
    return;
  }

  if (isPlaying) {
    stopPlayback();
    return;
  }

  speakCurrentSelection().catch((error) => {
    if (!isExtensionContextInvalidatedError(error)) {
      console.warn("ReadMate speak error:", error);
    }
  });
});

translateButton.addEventListener("click", async (event) => {
  event.preventDefault();
  event.stopPropagation();

  if (!hasExtensionContext()) {
    handleExtensionContextLoss();
    return;
  }

  if (isTranslating) {
    return;
  }

  await triggerSelectionTranslation();
});

translationCloseButton.addEventListener("click", (event) => {
  event.preventDefault();
  event.stopPropagation();
  hideTranslationCard();
});

let copyFeedbackTimer = null;
translationCopyButton.addEventListener("click", async (event) => {
  event.preventDefault();
  event.stopPropagation();
  if (!currentTranslationData?.translatedText) {
    return;
  }

  try {
    await navigator.clipboard.writeText(currentTranslationData.translatedText);
    translationCopyButton.innerHTML = CHECK_ICON_SVG;
    translationCopyButton.title = t("content.translationCopied");
    window.clearTimeout(copyFeedbackTimer);
    copyFeedbackTimer = window.setTimeout(() => {
      translationCopyButton.innerHTML = COPY_ICON_SVG;
      translationCopyButton.title = t("content.translationCopy");
    }, 1500);
  } catch (_err) {
    showToast(t("content.operationFailed") || "复制失败");
  }
});

translationSpeakButton.addEventListener("click", async (event) => {
  event.preventDefault();
  event.stopPropagation();
  if (!currentTranslationData?.translatedText) {
    return;
  }
  await speakCustomText(currentTranslationData.translatedText);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    hideTranslationCard();
  }
});

document.addEventListener("mouseup", handleSelectionGesture, true);
document.addEventListener("keyup", handleSelectionGesture, true);
document.addEventListener("scroll", () => {
  if (!isPlaying && !isTranslating) {
    hideBubble();
  }
}, true);
document.addEventListener("mousedown", (event) => {
  if (
    bubble.contains(event.target) ||
    miniPlayer.contains(event.target) ||
    translationCard.contains(event.target)
  ) {
    return;
  }
  hideTranslationCard();
  if (!isPlaying && !isTranslating) {
    queueSelectionRefresh();
  }
});

miniPlayerPlayPauseButton.addEventListener("click", () => {
  if (isBusy || !audioElement) {
    return;
  }

  if (hasCompletedPlayback) {
    void replayPlayback();
    return;
  }

  if (isPaused) {
    void resumePlayback();
    return;
  }

  pausePlayback();
});

miniPlayerStopButton.addEventListener("click", () => {
  if (isBusy && !audioElement) {
    return;
  }
  stopPlayback();
});

void loadContentSettings();

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local" || !changes.settings) {
    return;
  }

  contentSettings = {
    ...CONTENT_DEFAULT_SETTINGS,
    ...(changes.settings.newValue ?? {}),
    uiLanguage: normalizeUiLanguage(changes.settings.newValue?.uiLanguage),
  };
  refreshLocalizedUi();
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "PLAY_AUDIO_FROM_TTS") {
    playAudioPayload(message.payload)
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "INWORLD_TTS_ERROR") {
    showToast(message.error || t("background.readFailedCheckConfig"));
    sendResponse({ ok: true });
    return false;
  }

  if (message?.type === "TRIGGER_PLAY_SELECTION") {
    speakCurrentSelection()
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "STOP_PLAYBACK") {
    stopPlayback();
    sendResponse({ ok: true });
    return false;
  }

  return false;
});

function queueSelectionRefresh(shouldConsiderAutoPlay = false) {
  window.requestAnimationFrame(() => {
    updateSelectionState();
    if (shouldConsiderAutoPlay) {
      scheduleAutoPlayForSelection();
    }
  });
}

function updateSelectionState() {
  const snapshot = readSelection();
  const { text, rect } = snapshot;

  if (!text) {
    currentSelectionText = "";
    currentSelectionRect = null;
    currentSelectionSnapshot = null;
    lastAutoPlaySelectionKey = "";
    cancelPendingAutoPlay();
    if (!extensionContextLost) {
      updateButtonState({
        label: getSpeakActionLabel(),
        detail: t("content.defaultMeta"),
        disabled: false,
      });
    }
    if (!isPlaying && !isTranslating) {
      hideBubble();
    }
    return;
  }

  currentSelectionText = text;
  currentSelectionRect = rect;
  currentSelectionSnapshot = snapshot;

  if (isPlaying) {
    hideBubble();
    return;
  }

  if (text.length > MAX_SELECTION_LENGTH) {
    updateButtonState({
      label: t("content.overLimitLabel"),
      detail: t("content.overLimitDetail", { count: text.length }),
      disabled: true,
    });
  } else {
    updateButtonState({
      label: isPlaying ? t("content.stop") : getSpeakActionLabel(),
      detail: buildSelectionActionDetail(text.length),
      disabled: isBusy,
    });
  }

  showBubble(rect);
}

function readSelection() {
  const active = document.activeElement;
  if (isTextInput(active)) {
    const selectionStart = active.selectionStart ?? 0;
    const selectionEnd = active.selectionEnd ?? 0;
    if (selectionEnd > selectionStart) {
      const rawText = active.value.slice(selectionStart, selectionEnd);
      const text = rawText.trim();
      if (!text) {
        return { text: "", rect: null };
      }

      return {
        text,
        rawText,
        rect: active.getBoundingClientRect(),
        sourceType: "input",
        inputElement: active,
        selectionStart,
        selectionEnd,
        trimStartOffset: rawText.indexOf(text),
      };
    }
  }

  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return { text: "", rect: null };
  }

  const rawText = selection.toString();
  const text = rawText.trim();
  if (!text) {
    return { text: "", rect: null };
  }

  const range = selection.getRangeAt(0);
  const clientRects = Array.from(range.getClientRects()).filter(
    (r) => r.width > 0 && r.height > 0,
  );
  const lastRect = clientRects.length > 0 ? clientRects[clientRects.length - 1] : null;
  const rect = lastRect || range.getBoundingClientRect();
  if (rect.width || rect.height) {
    return {
      text,
      rawText,
      rect,
      sourceType: "range",
      range: range.cloneRange(),
      trimStartOffset: rawText.indexOf(text),
    };
  }

  const fallbackRect = selection.anchorNode?.parentElement?.getBoundingClientRect() ?? null;
  return {
    text,
    rawText,
    rect: fallbackRect,
    sourceType: "range",
    range: range.cloneRange(),
    trimStartOffset: rawText.indexOf(text),
  };
}

function isTextInput(element) {
  if (!element) {
    return false;
  }

  if (element instanceof HTMLTextAreaElement) {
    return true;
  }

  if (!(element instanceof HTMLInputElement)) {
    return false;
  }

  return /^(email|number|password|search|tel|text|url)$/i.test(element.type);
}

async function speakCurrentSelection() {
  if (isBusy) {
    return;
  }

  if (!hasExtensionContext()) {
    handleExtensionContextLoss();
    return;
  }

  const latestSelection = readSelection();
  if (latestSelection.text) {
    currentSelectionText = latestSelection.text;
    currentSelectionRect = latestSelection.rect;
    currentSelectionSnapshot = latestSelection;
  }

  if (!currentSelectionText) {
    showToast(t("content.noSelection"));
    return;
  }

  if (currentSelectionText.length > MAX_SELECTION_LENGTH) {
    showToast(t("content.overLimitDetail", { count: currentSelectionText.length }));
    return;
  }

  isBusy = true;
  cancelPendingAutoPlay();
  setMiniPlayerLoadingState(currentSelectionText, {
    translationEnabled: isTranslationEnabled(),
    translationTargetLanguage: contentSettings.translationTargetLanguage,
  });
  updateButtonState({
    label: isTranslationEnabled()
      ? t("content.loadingTranslationLabel")
      : t("content.loadingSpeechLabel"),
    detail: getLoadingActionDetail(),
    disabled: true,
  });

  try {
    const response = await safeRuntimeSendMessage({
      type: "SPEAK_TEXT",
      text: currentSelectionText,
    });

    if (!response?.ok) {
      throw new Error(response?.error || t("background.readFailedCheckConfig"));
    }

    await playAudioPayload(response.result);
  } catch (error) {
    if (isExtensionContextInvalidatedError(error)) {
      handleExtensionContextLoss();
      return;
    }
    const message =
      error instanceof Error ? error.message : t("background.readFailedCheckConfig");
    hideMiniPlayer();
    updateButtonState({
      label: t("content.retry"),
      detail: message,
      disabled: false,
    });
    showToast(message);
    throw error;
  } finally {
    isBusy = false;
    updateMiniPlayer();
    if (!isPlaying && currentSelectionText) {
      updateButtonState({
        label: getSpeakActionLabel(),
        detail: buildSelectionActionDetail(currentSelectionText.length),
        disabled: false,
      });
    }
  }
}

async function playAudioPayload(payload) {
  if (!payload?.audioContent) {
    throw new Error(t("background.noAudioContent"));
  }

  stopPlayback({ refreshSelection: false, preservePlayer: true });

  currentObjectUrl = createObjectUrl(payload.audioContent, payload.mimeType || "audio/wav");
  audioElement = new Audio(currentObjectUrl);
  isPaused = false;
  currentPlaybackMeta = {
    text: payload.sourceText || currentSelectionText || "",
    originalText: payload.originalText || currentSelectionText || "",
    voiceId: payload.voiceId || "",
    modelId: payload.modelId || "",
    translationApplied: Boolean(payload.translationApplied),
    translationTargetLanguage: payload.translationTargetLanguage || "",
    pendingTranslation: false,
    timestampInfo: payload.timestampInfo ?? null,
  };
  hasCompletedPlayback = false;

  audioElement.addEventListener("ended", () => {
    if (shouldKeepPlayerVisibleAfterPlayback()) {
      completePlaybackState();
      stopWordHighlightSync({ restoreInputSelection: true });
      updateSelectionState();
      hideBubble();
      updateMiniPlayer();
      return;
    }

    resetPlaybackState();
    stopWordHighlightSync({ restoreInputSelection: true });
    updateSelectionState();
  });

  audioElement.addEventListener("error", () => {
    const message = t("content.audioPlaybackFailed");
    resetPlaybackState();
    stopWordHighlightSync({ restoreInputSelection: true });
    updateSelectionState();
    showToast(message);
  });

  await audioElement.play();
  isPlaying = true;
  startWordHighlightSync(payload.timestampInfo);
  showMiniPlayer();
  hideBubble();
  updateMiniPlayer();
  startMiniPlayerSync();
  updateButtonState({
    label: t("content.stop"),
    detail: buildPlaybackDetail(payload),
    disabled: false,
  });
}

function stopPlayback(options = {}) {
  const { refreshSelection = true, preservePlayer = false } = options;

  if (audioElement) {
    audioElement.pause();
    audioElement.currentTime = 0;
  }

  resetPlaybackState({ preservePlayer });
  stopWordHighlightSync({ restoreInputSelection: true });
  if (refreshSelection) {
    updateSelectionState();
  }
}

function resetPlaybackState(options = {}) {
  const { preservePlayer = false } = options;
  isPlaying = false;
  isPaused = false;
  hasCompletedPlayback = false;
  stopMiniPlayerSync();
  if (audioElement) {
    audioElement.src = "";
    audioElement = null;
  }

  if (currentObjectUrl) {
    URL.revokeObjectURL(currentObjectUrl);
    currentObjectUrl = null;
  }

  if (!preservePlayer) {
    currentPlaybackMeta = null;
    hideMiniPlayer();
  }
}

function startWordHighlightSync(timestampInfo) {
  stopWordHighlightSync({ restoreInputSelection: false });

  const snapshot = currentSelectionSnapshot;
  const wordAlignment = timestampInfo?.wordAlignment;
  if (!snapshot || !wordAlignment) {
    return;
  }

  const preparedTokens = buildAlignedWordTokens(snapshot, wordAlignment);
  if (!preparedTokens.length) {
    return;
  }

  alignedWordTokens = preparedTokens;
  activeWordIndex = -1;
  syncWordHighlight();
}

function stopWordHighlightSync(options = {}) {
  const { restoreInputSelection = false } = options;

  if (highlightFrameId) {
    window.cancelAnimationFrame(highlightFrameId);
    highlightFrameId = 0;
  }

  activeWordIndex = -1;
  alignedWordTokens = [];
  clearRenderedHighlight();

  if (restoreInputSelection) {
    restoreInputSelectionRange();
  }
}

function syncWordHighlight() {
  if (!audioElement || !isPlaying || !alignedWordTokens.length) {
    return;
  }

  const time = audioElement.currentTime;
  const nextIndex = findActiveWordIndex(time);
  if (nextIndex !== activeWordIndex) {
    activeWordIndex = nextIndex;
    renderActiveWordHighlight();
  }

  highlightFrameId = window.requestAnimationFrame(syncWordHighlight);
}

function startMiniPlayerSync() {
  stopMiniPlayerSync();
  syncMiniPlayer();
}

function stopMiniPlayerSync() {
  if (playerFrameId) {
    window.cancelAnimationFrame(playerFrameId);
    playerFrameId = 0;
  }
}

function syncMiniPlayer() {
  updateMiniPlayerProgress();

  if (audioElement && isPlaying && !isPaused) {
    playerFrameId = window.requestAnimationFrame(syncMiniPlayer);
  }
}

function findActiveWordIndex(currentTime) {
  for (let index = 0; index < alignedWordTokens.length; index += 1) {
    const token = alignedWordTokens[index];
    if (currentTime >= token.startTime && currentTime <= token.endTime + 0.03) {
      return index;
    }
  }

  return -1;
}

function renderActiveWordHighlight() {
  clearRenderedHighlight();

  if (activeWordIndex < 0) {
    return;
  }

  const token = alignedWordTokens[activeWordIndex];
  if (!token) {
    return;
  }

  if (token.sourceType === "range") {
    if (!supportsCustomHighlights || !token.range) {
      return;
    }
    CSS.highlights.set(HIGHLIGHT_NAME, new Highlight(token.range));
    return;
  }

  if (token.sourceType === "input" && token.inputElement) {
    try {
      token.inputElement.focus({ preventScroll: true });
    } catch (_error) {
      token.inputElement.focus();
    }

    try {
      token.inputElement.setSelectionRange(token.absoluteStart, token.absoluteEnd);
    } catch (_error) {
      // ignore selection updates on unsupported inputs
    }
  }
}

function clearRenderedHighlight() {
  if (supportsCustomHighlights) {
    CSS.highlights.delete(HIGHLIGHT_NAME);
  }
}

function restoreInputSelectionRange() {
  if (currentSelectionSnapshot?.sourceType !== "input" || !currentSelectionSnapshot.inputElement) {
    return;
  }

  try {
    currentSelectionSnapshot.inputElement.setSelectionRange(
      currentSelectionSnapshot.selectionStart,
      currentSelectionSnapshot.selectionEnd,
    );
  } catch (_error) {
    // ignore restoration errors on unsupported inputs
  }
}

function buildAlignedWordTokens(snapshot, wordAlignment) {
  const timedWords = Array.isArray(wordAlignment.words) ? wordAlignment.words : [];
  const startTimes = Array.isArray(wordAlignment.wordStartTimeSeconds)
    ? wordAlignment.wordStartTimeSeconds
    : [];
  const endTimes = Array.isArray(wordAlignment.wordEndTimeSeconds)
    ? wordAlignment.wordEndTimeSeconds
    : [];
  const limit = Math.min(timedWords.length, startTimes.length, endTimes.length);
  if (!limit) {
    return [];
  }

  const sourceTokens = tokenizeSelectionText(snapshot.text);
  if (!sourceTokens.length) {
    return [];
  }

  const pairs = alignTokensToWords(sourceTokens, timedWords.slice(0, limit));
  if (!pairs.length) {
    return [];
  }

  if (snapshot.sourceType === "input") {
    return pairs
      .map(({ sourceIndex, timedIndex }) => {
        const token = sourceTokens[sourceIndex];
        if (!token) {
          return null;
        }

        return {
          sourceType: "input",
          inputElement: snapshot.inputElement,
          absoluteStart:
            snapshot.selectionStart + (snapshot.trimStartOffset || 0) + token.start,
          absoluteEnd:
            snapshot.selectionStart + (snapshot.trimStartOffset || 0) + token.end,
          startTime: Number(startTimes[timedIndex]) || 0,
          endTime: Number(endTimes[timedIndex]) || Number(startTimes[timedIndex]) || 0,
        };
      })
      .filter(Boolean);
  }

  const tokenRanges = buildRangesForTokens(
    snapshot.range,
    sourceTokens,
    snapshot.trimStartOffset || 0,
  );
  return pairs
    .map(({ sourceIndex, timedIndex }) => {
      const tokenRange = tokenRanges[sourceIndex];
      if (!tokenRange) {
        return null;
      }

      return {
        sourceType: "range",
        range: tokenRange,
        startTime: Number(startTimes[timedIndex]) || 0,
        endTime: Number(endTimes[timedIndex]) || Number(startTimes[timedIndex]) || 0,
      };
    })
    .filter(Boolean);
}

function tokenizeSelectionText(text) {
  const tokens = [];
  const pattern = /\S+/gu;
  let match = pattern.exec(text);

  while (match) {
    tokens.push({
      text: match[0],
      start: match.index,
      end: match.index + match[0].length,
      normalized: normalizeToken(match[0]),
    });
    match = pattern.exec(text);
  }

  return tokens;
}

function normalizeToken(token) {
  return String(token ?? "")
    .toLowerCase()
    .normalize("NFKC")
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
}

function alignTokensToWords(sourceTokens, timedWords) {
  const pairs = [];
  let sourceIndex = 0;

  for (let timedIndex = 0; timedIndex < timedWords.length && sourceIndex < sourceTokens.length; timedIndex += 1) {
    const timedNormalized = normalizeToken(timedWords[timedIndex]);
    let matchedIndex = sourceIndex;

    if (timedNormalized) {
      for (
        let candidateIndex = sourceIndex;
        candidateIndex < Math.min(sourceTokens.length, sourceIndex + LOOKAHEAD_WINDOW);
        candidateIndex += 1
      ) {
        if (sourceTokens[candidateIndex].normalized === timedNormalized) {
          matchedIndex = candidateIndex;
          break;
        }
      }
    }

    pairs.push({ sourceIndex: matchedIndex, timedIndex });
    sourceIndex = matchedIndex + 1;
  }

  return pairs;
}

function buildRangesForTokens(range, sourceTokens, baseOffset = 0) {
  if (!range) {
    return [];
  }

  const segments = collectRangeSegments(range.cloneRange());
  if (!segments.length) {
    return [];
  }

  return sourceTokens.map((token) => {
    const startBoundary = locateBoundary(segments, baseOffset + token.start);
    const endBoundary = locateBoundary(segments, baseOffset + token.end);
    if (!startBoundary || !endBoundary) {
      return null;
    }

    const tokenRange = document.createRange();
    tokenRange.setStart(startBoundary.node, startBoundary.offset);
    tokenRange.setEnd(endBoundary.node, endBoundary.offset);
    return tokenRange;
  });
}

function collectRangeSegments(range) {
  if (!range || range.collapsed) {
    return [];
  }

  if (range.commonAncestorContainer.nodeType === Node.TEXT_NODE) {
    const textNode = range.commonAncestorContainer;
    const startOffset = textNode === range.startContainer ? range.startOffset : 0;
    const endOffset = textNode === range.endContainer ? range.endOffset : textNode.nodeValue.length;
    if (startOffset === endOffset) {
      return [];
    }

    return [
      {
        node: textNode,
        startOffsetInNode: startOffset,
        endOffsetInNode: endOffset,
        selectionStart: 0,
        selectionEnd: endOffset - startOffset,
      },
    ];
  }

  const segments = [];
  let cursor = 0;
  const walker = document.createTreeWalker(
    range.commonAncestorContainer,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        if (!node.nodeValue) {
          return NodeFilter.FILTER_REJECT;
        }

        try {
          return range.intersectsNode(node)
            ? NodeFilter.FILTER_ACCEPT
            : NodeFilter.FILTER_REJECT;
        } catch (_error) {
          return NodeFilter.FILTER_REJECT;
        }
      },
    },
  );

  let textNode = walker.nextNode();
  while (textNode) {
    const nodeText = textNode.nodeValue ?? "";
    let startOffsetInNode = textNode === range.startContainer ? range.startOffset : 0;
    let endOffsetInNode = textNode === range.endContainer ? range.endOffset : nodeText.length;

    if (startOffsetInNode !== endOffsetInNode) {
      const length = endOffsetInNode - startOffsetInNode;
      segments.push({
        node: textNode,
        startOffsetInNode,
        endOffsetInNode,
        selectionStart: cursor,
        selectionEnd: cursor + length,
      });
      cursor += length;
    }

    textNode = walker.nextNode();
  }

  return segments;
}

function locateBoundary(segments, offset) {
  if (!segments.length) {
    return null;
  }

  if (offset <= 0) {
    return {
      node: segments[0].node,
      offset: segments[0].startOffsetInNode,
    };
  }

  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    if (offset < segment.selectionEnd) {
      return {
        node: segment.node,
        offset: segment.startOffsetInNode + (offset - segment.selectionStart),
      };
    }

    if (offset === segment.selectionEnd) {
      return {
        node: segment.node,
        offset: segment.endOffsetInNode,
      };
    }
  }

  const lastSegment = segments[segments.length - 1];
  return {
    node: lastSegment.node,
    offset: lastSegment.endOffsetInNode,
  };
}

function createObjectUrl(base64Content, mimeType) {
  const binary = atob(base64Content);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  const blob = new Blob([bytes], { type: mimeType });
  return URL.createObjectURL(blob);
}

function setMiniPlayerLoadingState(text, options = {}) {
  const translationTargetLanguage = String(options.translationTargetLanguage ?? "").trim();
  const pendingTranslation =
    Boolean(options.translationEnabled) && Boolean(translationTargetLanguage);

  currentPlaybackMeta = {
    text,
    originalText: text,
    voiceId: "",
    modelId: "",
    translationApplied: false,
    translationTargetLanguage,
    pendingTranslation,
    timestampInfo: null,
  };
  isPaused = false;
  hasCompletedPlayback = false;
  showMiniPlayer();
  hideBubble();
  miniPlayerTitle.textContent = t("common.miniPlayerTitle");
  miniPlayerStatus.textContent = pendingTranslation
    ? t("content.playerStatusLoadingTranslated", { language: translationTargetLanguage })
    : t("content.playerStatusLoading");
  miniPlayerChip.textContent = t("content.playerChipLoading");
  miniPlayerText.textContent = buildMiniPlayerText(currentPlaybackMeta);
  miniPlayerProgressFill.style.width = "0%";
  miniPlayerElapsed.textContent = "00:00";
  miniPlayerDuration.textContent = "--:--";
  miniPlayerPlayPauseButton.textContent = t("content.pause");
  miniPlayerPlayPauseButton.disabled = true;
  miniPlayerStopButton.textContent = t("content.stop");
  miniPlayerStopButton.disabled = true;
}

function updateMiniPlayer() {
  if (!currentPlaybackMeta) {
    return;
  }

  const isTranslatedPlayback =
    Boolean(currentPlaybackMeta.translationApplied) &&
    Boolean(currentPlaybackMeta.translationTargetLanguage);
  const titleParts = [currentPlaybackMeta.voiceId, currentPlaybackMeta.modelId].filter(Boolean);
  miniPlayerTitle.textContent = titleParts.length
    ? titleParts.join(" · ")
    : t("common.miniPlayerTitle");
  miniPlayerStatus.textContent = isBusy
    ? currentPlaybackMeta.pendingTranslation
      ? t("content.playerStatusLoadingTranslated", {
          language: currentPlaybackMeta.translationTargetLanguage,
        })
      : t("content.playerStatusLoading")
    : hasCompletedPlayback
      ? isTranslatedPlayback
        ? t("content.playerStatusFinishedTranslated", {
            language: currentPlaybackMeta.translationTargetLanguage,
          })
        : t("content.playerStatusFinished")
    : isPaused
      ? isTranslatedPlayback
        ? t("content.playerStatusPausedTranslated", {
            language: currentPlaybackMeta.translationTargetLanguage,
          })
        : t("content.playerStatusPaused")
      : isPlaying
        ? isTranslatedPlayback
          ? t("content.playerStatusPlayingTranslated", {
              language: currentPlaybackMeta.translationTargetLanguage,
            })
          : t("content.playerStatusPlaying")
        : t("content.playerStatusWaiting");
  miniPlayerChip.textContent = isBusy
    ? t("content.playerChipLoading")
    : hasCompletedPlayback
      ? t("content.playerChipFinished")
    : isPaused
      ? t("content.playerChipPaused")
      : isPlaying
        ? t("content.playerChipPlaying")
        : t("content.playerChipReady");
  miniPlayerText.textContent = buildMiniPlayerText(currentPlaybackMeta);
  miniPlayerPlayPauseButton.textContent = hasCompletedPlayback
    ? t("content.replay")
    : isPaused
      ? t("content.resume")
      : t("content.pause");
  miniPlayerPlayPauseButton.disabled = isBusy || !audioElement;
  miniPlayerStopButton.textContent = t("content.stop");
  miniPlayerStopButton.disabled = isBusy && !audioElement;
  updateMiniPlayerProgress();
}

function updateMiniPlayerProgress() {
  if (!audioElement) {
    miniPlayerProgressFill.style.width = "0%";
    return;
  }

  const currentTime = Number.isFinite(audioElement.currentTime) ? audioElement.currentTime : 0;
  const duration = Number.isFinite(audioElement.duration) ? audioElement.duration : 0;
  const progress = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  miniPlayerProgressFill.style.width = `${progress}%`;
  miniPlayerElapsed.textContent = formatTime(currentTime);
  miniPlayerDuration.textContent = duration > 0 ? formatTime(duration) : "--:--";
}

function startMiniPlayerDrag(event) {
  if (event.button !== 0) {
    return;
  }

  const rect = miniPlayer.getBoundingClientRect();
  pinMiniPlayer(rect.left, rect.top);
  isDraggingPlayer = true;
  playerDragOffsetX = event.clientX - rect.left;
  playerDragOffsetY = event.clientY - rect.top;
  miniPlayer.classList.add("is-dragging");
  event.preventDefault();
}

function updateMiniPlayerDrag(event) {
  const rect = miniPlayer.getBoundingClientRect();
  const left = clamp(
    event.clientX - playerDragOffsetX,
    12,
    window.innerWidth - rect.width - 12,
  );
  const top = clamp(
    event.clientY - playerDragOffsetY,
    12,
    window.innerHeight - rect.height - 12,
  );

  pinMiniPlayer(left, top);
}

function startTranslationCardDrag(event) {
  if (event.button !== 0) {
    return;
  }

  if (event.target.closest("button") || event.target.closest(".readmate-trans-actions")) {
    return;
  }

  const rect = translationCard.getBoundingClientRect();
  isDraggingTranslationCard = true;
  translationCardDragOffsetX = event.clientX - rect.left;
  translationCardDragOffsetY = event.clientY - rect.top;
  translationCard.classList.add("is-dragging");
  event.preventDefault();
}

function updateTranslationCardDrag(event) {
  const rect = translationCard.getBoundingClientRect();
  const left = clamp(
    event.clientX - translationCardDragOffsetX,
    12,
    window.innerWidth - rect.width - 12,
  );
  const top = clamp(
    event.clientY - translationCardDragOffsetY,
    12,
    window.innerHeight - rect.height - 12,
  );

  translationCard.style.left = `${left}px`;
  translationCard.style.top = `${top}px`;
}

function startSeek(event) {
  if (event.button !== 0 || !audioElement || !Number.isFinite(audioElement.duration)) {
    return;
  }

  isSeeking = true;
  updateSeek(event);
  event.preventDefault();
}

function updateSeek(event) {
  if (!audioElement || !Number.isFinite(audioElement.duration) || audioElement.duration <= 0) {
    return;
  }

  const rect = miniPlayerProgress.getBoundingClientRect();
  const ratio = clamp((event.clientX - rect.left) / rect.width, 0, 1);
  audioElement.currentTime = audioElement.duration * ratio;
  updateMiniPlayerProgress();
}

function finishPointerInteraction(_event) {
  if (isDraggingPlayer) {
    isDraggingPlayer = false;
    miniPlayer.classList.remove("is-dragging");
  }

  if (isDraggingTranslationCard) {
    isDraggingTranslationCard = false;
    translationCard.classList.remove("is-dragging");
  }

  if (isSeeking) {
    isSeeking = false;
    updateMiniPlayer();
  }
}

function pausePlayback() {
  if (!audioElement || isPaused) {
    return;
  }

  audioElement.pause();
  isPaused = true;
  hasCompletedPlayback = false;
  stopMiniPlayerSync();
  updateMiniPlayer();
}

async function resumePlayback() {
  if (!audioElement || !isPaused) {
    return;
  }

  try {
    await audioElement.play();
    isPaused = false;
    hasCompletedPlayback = false;
    updateMiniPlayer();
    startMiniPlayerSync();
  } catch (_error) {
    showToast(t("content.resumePlaybackFailed"));
  }
}

function completePlaybackState() {
  isPlaying = false;
  isPaused = false;
  hasCompletedPlayback = true;
  stopMiniPlayerSync();
}

async function replayPlayback() {
  if (!audioElement || !hasCompletedPlayback) {
    return;
  }

  try {
    audioElement.currentTime = 0;
    await audioElement.play();
    isPlaying = true;
    isPaused = false;
    hasCompletedPlayback = false;
    startWordHighlightSync(currentPlaybackMeta?.timestampInfo);
    hideBubble();
    updateButtonState({
      label: t("content.stop"),
      detail: buildPlaybackDetail(currentPlaybackMeta ?? {}),
      disabled: false,
    });
    updateMiniPlayer();
    startMiniPlayerSync();
  } catch (_error) {
    showToast(t("content.replayPlaybackFailed"));
  }
}

function showMiniPlayer() {
  miniPlayer.classList.add("inworld-visible");
}

function hideMiniPlayer() {
  stopMiniPlayerSync();
  miniPlayer.classList.remove("inworld-visible");
}

function summarizeText(text) {
  const normalized = String(text ?? "").replace(/\s+/g, " ").trim();
  if (!normalized) {
    return t("content.defaultPlayerText");
  }

  return normalized.length > 96 ? `${normalized.slice(0, 96)}...` : normalized;
}

function buildMiniPlayerText(meta) {
  if (!meta) {
    return summarizeText("");
  }

  if (meta.translationApplied) {
    return [
      formatLabeledText(t("content.playerTranslatedLabel"), summarizeText(meta.text)),
      formatLabeledText(t("content.playerOriginalLabel"), summarizeText(meta.originalText)),
    ].join("\n");
  }

  if (meta.pendingTranslation && meta.translationTargetLanguage) {
    return [
      formatLabeledText(t("content.playerOriginalLabel"), summarizeText(meta.text)),
      formatLabeledText(t("content.playerTargetLanguageLabel"), meta.translationTargetLanguage),
    ].join("\n");
  }

  return summarizeText(meta.text);
}

function formatTime(totalSeconds) {
  const safeSeconds = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function pinMiniPlayer(left, top) {
  miniPlayer.style.left = `${left}px`;
  miniPlayer.style.top = `${top}px`;
  miniPlayer.style.right = "auto";
  miniPlayer.style.bottom = "auto";
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function isTranslationEnabled() {
  return Boolean(
    contentSettings.translationEnabled &&
    String(contentSettings.translationTargetLanguage ?? "").trim(),
  );
}

function shouldKeepPlayerVisibleAfterPlayback() {
  return Boolean(contentSettings.keepPlayerVisibleAfterPlayback);
}

function getSpeakActionLabel() {
  return isTranslationEnabled() ? t("content.translateAndSpeakAction") : t("content.speakAction");
}

function buildSelectionActionDetail(textLength) {
  if (isTranslationEnabled()) {
    return t("content.selectionTranslateDetail", {
      count: textLength,
      language: contentSettings.translationTargetLanguage.trim(),
    });
  }

  return t("content.selectionDetail", { count: textLength });
}

function getLoadingActionDetail() {
  if (isTranslationEnabled()) {
    return t("content.loadingTranslationDetail", {
      language: contentSettings.translationTargetLanguage.trim(),
    });
  }

  return t("content.loadingSpeechDetail");
}

function buildPlaybackDetail(payload) {
  const voice = payload.voiceId || t("content.voiceFallback");

  if (payload.translationApplied && payload.translationTargetLanguage) {
    return t("content.playbackTranslated", {
      voice,
      language: payload.translationTargetLanguage,
    });
  }

  return t("content.playbackNormal", {
    voice,
    suffix: alignedWordTokens.length ? t("content.highlightSuffix") : "",
  });
}

function updateButtonState({ label, detail, disabled, icon }) {
  actionButton.disabled = Boolean(disabled);
  actionButton.title = detail ? `${label} - ${detail}` : (label || "");
  actionButton.setAttribute("aria-label", label || t("content.speakAction"));

  if (icon === "loading" || isBusy) {
    actionButton.innerHTML = LOADING_ICON_SVG;
    actionButton.style.cursor = "wait";
  } else if (icon === "stop" || isPlaying) {
    actionButton.innerHTML = STOP_ICON_SVG;
    actionButton.style.cursor = "pointer";
  } else if (icon === "refresh" || extensionContextLost) {
    actionButton.innerHTML = REFRESH_ICON_SVG;
    actionButton.style.cursor = "not-allowed";
  } else {
    actionButton.innerHTML = SPEAKER_ICON_SVG;
    actionButton.style.cursor = disabled ? "not-allowed" : "pointer";
  }

  metaBody.textContent = detail || "";
}

function showBubble(rect) {
  if (!rect) {
    hideBubble();
    return;
  }

  const bubbleWidth = 68;
  const bubbleHeight = 30;
  const gap = 6;
  let left = window.scrollX + rect.right - 14;
  left = Math.min(
    window.scrollX + window.innerWidth - bubbleWidth - 12,
    Math.max(window.scrollX + 12, left),
  );

  let top = window.scrollY + rect.bottom + gap;
  if (top + bubbleHeight + 12 > window.scrollY + window.innerHeight && rect.top - bubbleHeight - gap > 0) {
    top = Math.max(window.scrollY + 12, window.scrollY + rect.top - bubbleHeight - gap);
  }

  bubble.style.left = `${left}px`;
  bubble.style.top = `${top}px`;
  bubble.classList.add("inworld-visible");
}

function hideBubble() {
  bubble.classList.remove("inworld-visible");
}

function formatTargetLanguageLabel(targetLanguage) {
  if (!targetLanguage) return "";
  const isZh = normalizeUiLanguage(contentSettings.uiLanguage) === "zh-CN";
  const zhMap = {
    "Simplified Chinese": "简体中文",
    "Traditional Chinese": "繁體中文",
    "English": "英语",
    "Japanese": "日本語",
    "Korean": "한국어",
    "French": "法语",
    "Spanish": "西班牙语",
    "German": "德语",
    "Russian": "俄语",
    "Italian": "意大利语",
    "Portuguese": "葡萄牙语",
    "Arabic": "阿拉伯语",
  };
  const enMap = {
    "Simplified Chinese": "Chinese",
    "Traditional Chinese": "Traditional Chinese",
    "English": "English",
    "Japanese": "Japanese",
    "Korean": "Korean",
    "French": "French",
    "Spanish": "Spanish",
    "German": "German",
    "Russian": "Russian",
    "Italian": "Italian",
    "Portuguese": "Portuguese",
    "Arabic": "Arabic",
  };
  const map = isZh ? zhMap : enMap;
  return map[targetLanguage] || targetLanguage;
}

function disconnectActiveTranslationStream() {
  if (activeTranslationPort) {
    try {
      activeTranslationPort.disconnect();
    } catch (_e) {}
    activeTranslationPort = null;
  }
  isTranslating = false;
  translateButton.disabled = false;
}

function startTranslationStreamingCard(rect) {
  currentTranslationData = null;
  translationCardBadge.textContent = t("content.translationCardTitle");
  translationCardLang.textContent = "";
  translationCardBody.textContent = "";
  translationCardBody.className = "readmate-trans-body is-streaming";
  translationModelBadge.textContent = "";
  translationCardFooter.innerHTML = "";
  translationCardFooter.style.display = "none";

  positionTranslationCard(rect);
  translationCard.classList.add("readmate-visible");
}

function appendTranslationStreamChunk(chunk) {
  translationCardBody.textContent += chunk;
  translationCardBody.scrollTop = translationCardBody.scrollHeight;
}

function finalizeTranslationCard({ originalText, fullText, targetLanguage, model }) {
  currentTranslationData = { originalText, translatedText: fullText, targetLanguage, model };
  translationCardBody.classList.remove("is-streaming");
  if (targetLanguage) {
    translationCardLang.textContent = formatTargetLanguageLabel(targetLanguage);
  }
  translationModelBadge.textContent = model ? `Model: ${model}` : "";

  translationCardFooter.innerHTML = "";
  translationCardFooter.style.display = "flex";
  translationCardFooter.append(translationSpeakButton, translationModelBadge);
}

function showTranslationCard({ originalText, translatedText, targetLanguage, model, rect }) {
  disconnectActiveTranslationStream();
  currentTranslationData = { originalText, translatedText, targetLanguage, model };

  translationCardBadge.textContent = t("content.translationCardTitle");
  translationCardLang.textContent = formatTargetLanguageLabel(targetLanguage);
  translationCardBody.textContent = translatedText;
  translationCardBody.className = "readmate-trans-body";
  translationModelBadge.textContent = model ? `Model: ${model}` : "";

  translationCardFooter.innerHTML = "";
  translationCardFooter.style.display = "flex";
  translationCardFooter.append(translationSpeakButton, translationModelBadge);

  positionTranslationCard(rect);
  translationCard.classList.add("readmate-visible");
}

function showTranslationErrorCard(errorMessage, rect) {
  disconnectActiveTranslationStream();
  currentTranslationData = null;
  translationCardBody.classList.remove("is-streaming");

  const isConfigMissing =
    errorMessage.includes("设置") ||
    errorMessage.includes("settings") ||
    errorMessage.includes("模型") ||
    errorMessage.includes("model");

  translationCardBadge.textContent = t("content.translationFailed");
  translationCardLang.textContent = "";
  translationCardBody.className = "readmate-trans-body readmate-trans-error";
  translationCardBody.textContent = isConfigMissing
    ? t("content.translationConfigMissing")
    : errorMessage;

  translationCardFooter.innerHTML = "";
  translationCardFooter.style.display = "flex";

  if (isConfigMissing) {
    const openSettingsBtn = document.createElement("button");
    openSettingsBtn.type = "button";
    openSettingsBtn.className = "readmate-trans-settings-btn";
    openSettingsBtn.textContent = t("content.translationOpenSettings");
    openSettingsBtn.addEventListener("click", () => {
      void safeRuntimeSendMessage({ type: "OPEN_OPTIONS" });
      hideTranslationCard();
    });
    translationCardFooter.appendChild(openSettingsBtn);
  } else {
    const retryBtn = document.createElement("button");
    retryBtn.type = "button";
    retryBtn.className = "readmate-trans-settings-btn";
    retryBtn.textContent = t("content.translationRetry");
    retryBtn.addEventListener("click", () => {
      hideTranslationCard();
      void triggerSelectionTranslation();
    });
    translationCardFooter.appendChild(retryBtn);
  }

  positionTranslationCard(rect);
  translationCard.classList.add("readmate-visible");
}

function positionTranslationCard(rect) {
  if (!rect) {
    rect = currentSelectionRect;
  }
  const cardWidth = 360;
  const cardHeight = 280;
  const gap = 6;

  // Align with the exact location where the speaker/translate bubble appears
  let anchorX = rect ? rect.right - 14 : 20;
  let anchorY = rect ? rect.bottom + gap : 20;

  let left = Math.min(
    window.innerWidth - cardWidth - 16,
    Math.max(16, anchorX),
  );

  let top = anchorY;
  if (top + cardHeight > window.innerHeight && rect && rect.top - cardHeight - gap > 0) {
    top = Math.max(12, rect.top - cardHeight - gap);
  } else {
    top = Math.min(window.innerHeight - cardHeight - 16, Math.max(12, top));
  }

  translationCard.style.left = `${left}px`;
  translationCard.style.top = `${top}px`;
}

function hideTranslationCard() {
  disconnectActiveTranslationStream();
  translationCard.classList.remove("readmate-visible");
  translationCardBody.classList.remove("is-streaming");
}

async function triggerSelectionTranslation() {
  disconnectActiveTranslationStream();

  const latestSelection = readSelection();
  if (latestSelection.text) {
    currentSelectionText = latestSelection.text;
    currentSelectionRect = latestSelection.rect;
    currentSelectionSnapshot = latestSelection;
  }

  if (!currentSelectionText) {
    showToast(t("content.noSelection"));
    return;
  }

  const textToTranslate = currentSelectionText;
  const targetRect = currentSelectionRect;

  // Immediately hide selection bubble and open translation card with streaming indicator!
  hideBubble();
  startTranslationStreamingCard(targetRect);

  isTranslating = true;
  translateButton.disabled = true;

  try {
    const port = chrome.runtime.connect({ name: "readmate-translate-stream" });
    activeTranslationPort = port;

    port.onDisconnect.addListener(() => {
      if (activeTranslationPort === port) {
        activeTranslationPort = null;
      }
      isTranslating = false;
      translateButton.disabled = false;
    });

    port.onMessage.addListener((msg) => {
      if (msg.type === "STREAM_START") {
        if (msg.targetLanguage) {
          translationCardLang.textContent = formatTargetLanguageLabel(msg.targetLanguage);
        }
      } else if (msg.type === "STREAM_CHUNK") {
        appendTranslationStreamChunk(msg.chunk);
      } else if (msg.type === "STREAM_DONE") {
        finalizeTranslationCard({
          originalText: textToTranslate,
          fullText: msg.fullText,
          targetLanguage: msg.targetLanguage,
          model: msg.model,
        });
        disconnectActiveTranslationStream();
      } else if (msg.type === "STREAM_ERROR") {
        disconnectActiveTranslationStream();
        showTranslationErrorCard(msg.error || t("content.translationFailed"), targetRect);
      }
    });

    port.postMessage({
      type: "START_TRANSLATE_STREAM",
      text: textToTranslate,
    });
  } catch (error) {
    disconnectActiveTranslationStream();
    if (isExtensionContextInvalidatedError(error)) {
      handleExtensionContextLoss();
      return;
    }
    showTranslationErrorCard(error?.message || t("content.translationFailed"), targetRect);
  }
}

async function speakCustomText(text, overrides = {}) {
  if (isBusy) {
    return;
  }

  if (!hasExtensionContext()) {
    handleExtensionContextLoss();
    return;
  }

  const cleanText = String(text ?? "").trim();
  if (!cleanText) {
    return;
  }

  isBusy = true;
  cancelPendingAutoPlay();
  setMiniPlayerLoadingState(cleanText, {
    translationEnabled: false,
    translationTargetLanguage: "",
  });

  try {
    const response = await safeRuntimeSendMessage({
      type: "SPEAK_TEXT",
      text: cleanText,
      overrides: {
        translationEnabled: false,
        ...overrides,
      },
    });

    if (!response?.ok) {
      throw new Error(response?.error || t("background.readFailedCheckConfig"));
    }

    await playAudioPayload(response.result);
  } catch (error) {
    if (isExtensionContextInvalidatedError(error)) {
      handleExtensionContextLoss();
      return;
    }
    const message = error instanceof Error ? error.message : t("background.readFailedCheckConfig");
    hideMiniPlayer();
    showToast(message);
  } finally {
    isBusy = false;
    updateMiniPlayer();
  }
}

async function loadContentSettings() {
  try {
    const { settings } = await chrome.storage.local.get("settings");
    contentSettings = {
      ...CONTENT_DEFAULT_SETTINGS,
      ...(settings ?? {}),
      uiLanguage: normalizeUiLanguage(settings?.uiLanguage),
    };
  } catch (_error) {
    contentSettings = { ...CONTENT_DEFAULT_SETTINGS };
  }

  refreshLocalizedUi();
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("inworld-visible");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    toast.classList.remove("inworld-visible");
  }, 3200);
}

function hasExtensionContext() {
  try {
    return Boolean(chrome?.runtime?.id);
  } catch (_error) {
    return false;
  }
}

async function safeRuntimeSendMessage(message) {
  if (!hasExtensionContext()) {
    throw new Error("Extension context invalidated.");
  }

  try {
    return await chrome.runtime.sendMessage(message);
  } catch (error) {
    if (isExtensionContextInvalidatedError(error)) {
      handleExtensionContextLoss();
      throw new Error(t("content.extensionReloadedToast"));
    }
    throw error;
  }
}

function isExtensionContextInvalidatedError(error) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return message.includes("Extension context invalidated");
}

function handleExtensionContextLoss() {
  if (extensionContextLost) {
    return;
  }

  extensionContextLost = true;
  isBusy = false;
  stopPlayback({ refreshSelection: false });
  hideBubble();
  hideTranslationCard();
  hideMiniPlayer();
  document.removeEventListener("mouseup", handleSelectionGesture, true);
  document.removeEventListener("keyup", handleSelectionGesture, true);
  actionButton.disabled = true;
  actionButton.title = t("content.pageRefreshAction");
  actionButton.setAttribute("aria-label", t("content.pageRefreshAction"));
  actionButton.innerHTML = REFRESH_ICON_SVG;
  translateButton.disabled = true;
  translateButton.title = t("content.pageRefreshAction");
  translateButton.setAttribute("aria-label", t("content.pageRefreshAction"));
  metaBody.textContent = t("content.extensionReloadedReadyMessage");
  showToast(t("content.extensionReloadedToast"));
}

function handleSelectionGesture(event) {
  if (!hasExtensionContext()) {
    handleExtensionContextLoss();
    return;
  }

  if (
    event?.target &&
    (bubble.contains(event.target) ||
      miniPlayer.contains(event.target) ||
      translationCard.contains(event.target))
  ) {
    return;
  }

  queueSelectionRefresh(true);
}

function scheduleAutoPlayForSelection() {
  if (!contentSettings.autoPlayOnSelection) {
    return;
  }

  if (!currentSelectionText || currentSelectionText.length > MAX_SELECTION_LENGTH) {
    return;
  }

  if (extensionContextLost || isBusy || isDraggingPlayer || isDraggingTranslationCard || isSeeking) {
    return;
  }

  const selectionKey = buildSelectionKey(currentSelectionText);
  if (!selectionKey || selectionKey === lastAutoPlaySelectionKey) {
    return;
  }

  cancelPendingAutoPlay();
  autoPlayTimer = window.setTimeout(async () => {
    if (!contentSettings.autoPlayOnSelection || isBusy || extensionContextLost) {
      return;
    }

    const latestSelection = readSelection();
    if (!latestSelection.text || buildSelectionKey(latestSelection.text) !== selectionKey) {
      return;
    }

    lastAutoPlaySelectionKey = selectionKey;
    currentSelectionText = latestSelection.text;
    currentSelectionRect = latestSelection.rect;
    currentSelectionSnapshot = latestSelection;

    try {
      await speakCurrentSelection();
    } catch (_error) {
      // speakCurrentSelection already surfaces user-facing feedback
    }
  }, AUTO_PLAY_DELAY_MS);
}

function cancelPendingAutoPlay() {
  if (!autoPlayTimer) {
    return;
  }

  window.clearTimeout(autoPlayTimer);
  autoPlayTimer = 0;
}

function buildSelectionKey(text) {
  return String(text ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function refreshLocalizedUi() {
  metaTitle.textContent = t("common.brandShort");

  if (extensionContextLost) {
    actionButton.disabled = true;
    actionButton.title = t("content.pageRefreshAction");
    actionButton.setAttribute("aria-label", t("content.pageRefreshAction"));
    actionButton.innerHTML = REFRESH_ICON_SVG;
    metaBody.textContent = t("content.extensionReloadedReadyMessage");
    return;
  }

  if (currentPlaybackMeta || isBusy || isPlaying || isPaused) {
    updateMiniPlayer();
  } else {
    miniPlayerTitle.textContent = t("common.miniPlayerTitle");
    miniPlayerStatus.textContent = t("content.playerStatusWaiting");
    miniPlayerChip.textContent = t("content.playerChipReady");
    miniPlayerText.textContent = t("content.defaultPlayerText");
    miniPlayerPlayPauseButton.textContent = t("content.pause");
    miniPlayerStopButton.textContent = t("content.stop");
  }

  if (!isPlaying && !isBusy && !currentSelectionText) {
    updateButtonState({
      label: getSpeakActionLabel(),
      detail: t("content.defaultMeta"),
      disabled: false,
    });
  }

  translateButton.title = t("content.translateAction");
  translateButton.setAttribute("aria-label", t("content.translateAction"));
  translationCardBadge.textContent = t("content.translationCardTitle");
  translationCopyButton.title = t("content.translationCopy");
  translationCopyButton.setAttribute("aria-label", t("content.translationCopy"));
  translationCloseButton.title = t("content.translationClose");
  translationCloseButton.setAttribute("aria-label", t("content.translationClose"));
  const speakTextSpan = translationSpeakButton.querySelector("span");
  if (speakTextSpan) {
    speakTextSpan.textContent = t("content.translationSpeak");
  }

  if (!isPlaying && !isBusy && currentSelectionText) {
    updateSelectionState();
  }
}

function normalizeUiLanguage(language) {
  return InworldI18n.normalizeUiLanguage(language, InworldI18n.getInitialUiLanguage());
}

function t(key, params = {}) {
  return InworldI18n.getMessage(key, params, normalizeUiLanguage(contentSettings.uiLanguage));
}

function formatLabeledText(label, value) {
  const separator = normalizeUiLanguage(contentSettings.uiLanguage) === "zh-CN" ? "：" : ": ";
  return `${label}${separator}${value}`;
}
