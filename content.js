const MAX_SELECTION_LENGTH = 2000;
const HIGHLIGHT_NAME = "inworld-current-word";
const LOOKAHEAD_WINDOW = 4;
const AUTO_PLAY_DELAY_MS = 260;
const CONTENT_DEFAULT_SETTINGS = {
  autoPlayOnSelection: false,
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
let isDraggingPlayer = false;
let isSeeking = false;
let extensionContextLost = false;
let currentPlaybackMeta = null;
let playerDragOffsetX = 0;
let playerDragOffsetY = 0;
let lastAutoPlaySelectionKey = "";
let contentSettings = { ...CONTENT_DEFAULT_SETTINGS };

const bubble = document.createElement("div");
bubble.id = "inworld-tts-bubble";

const actionButton = document.createElement("button");
actionButton.id = "inworld-tts-button";
actionButton.type = "button";
actionButton.textContent = t("content.speakAction");

const meta = document.createElement("div");
meta.id = "inworld-tts-meta";

const metaTitle = document.createElement("strong");
metaTitle.textContent = t("common.brandShort");
meta.appendChild(metaTitle);

const metaBody = document.createElement("span");
metaBody.textContent = t("content.defaultMeta");
meta.appendChild(metaBody);

bubble.append(actionButton, meta);
document.documentElement.appendChild(bubble);

bubble.addEventListener("mousedown", (event) => {
  event.preventDefault();
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

actionButton.addEventListener("click", () => {
  if (isBusy) {
    return;
  }

  if (!hasExtensionContext()) {
    handleExtensionContextLoss();
    return;
  }

  if (isPlaying) {
    stopPlayback();
    return;
  }

  void speakCurrentSelection();
});

document.addEventListener("mouseup", handleSelectionGesture, true);
document.addEventListener("keyup", handleSelectionGesture, true);
document.addEventListener("scroll", () => {
  if (!isPlaying) {
    hideBubble();
  }
}, true);
document.addEventListener("mousedown", (event) => {
  if (bubble.contains(event.target) || miniPlayer.contains(event.target)) {
    return;
  }
  if (!isPlaying) {
    queueSelectionRefresh();
  }
});

miniPlayerPlayPauseButton.addEventListener("click", () => {
  if (isBusy || !audioElement) {
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
    if (!isPlaying) {
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
  const rect = range.getBoundingClientRect();
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
    throw new Error(t("content.extensionReloadedToast"));
  }

  const latestSelection = readSelection();
  if (latestSelection.text) {
    currentSelectionText = latestSelection.text;
    currentSelectionRect = latestSelection.rect;
    currentSelectionSnapshot = latestSelection;
  }

  if (!currentSelectionText) {
    showToast(t("content.noSelection"));
    throw new Error(t("content.noSelection"));
  }

  if (currentSelectionText.length > MAX_SELECTION_LENGTH) {
    showToast(t("content.overLimitDetail", { count: currentSelectionText.length }));
    throw new Error(t("content.selectionTooLong"));
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
    const message =
      error instanceof Error ? error.message : t("background.readFailedCheckConfig");
    hideMiniPlayer();
    updateButtonState({
      label: t("content.retry"),
      detail: message,
      disabled: false,
    });
    showToast(message);
    throw new Error(message);
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
  };

  audioElement.addEventListener("ended", () => {
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
  };
  isPaused = false;
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
    : isPaused
      ? t("content.playerChipPaused")
      : isPlaying
        ? t("content.playerChipPlaying")
        : t("content.playerChipReady");
  miniPlayerText.textContent = buildMiniPlayerText(currentPlaybackMeta);
  miniPlayerPlayPauseButton.textContent = isPaused ? t("content.resume") : t("content.pause");
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
    updateMiniPlayer();
    startMiniPlayerSync();
  } catch (_error) {
    showToast(t("content.resumePlaybackFailed"));
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

function updateButtonState({ label, detail, disabled }) {
  actionButton.textContent = label;
  actionButton.disabled = Boolean(disabled);
  metaBody.textContent = detail;
}

function showBubble(rect) {
  if (!rect) {
    hideBubble();
    return;
  }

  const bubbleWidth = 220;
  const gap = 10;
  const left = Math.min(
    window.scrollX + window.innerWidth - bubbleWidth - 12,
    Math.max(window.scrollX + 12, window.scrollX + rect.right - bubbleWidth / 2),
  );
  const top = Math.max(window.scrollY + 12, window.scrollY + rect.bottom + gap);

  bubble.style.left = `${left}px`;
  bubble.style.top = `${top}px`;
  bubble.classList.add("inworld-visible");
}

function hideBubble() {
  bubble.classList.remove("inworld-visible");
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
  hideMiniPlayer();
  actionButton.disabled = true;
  actionButton.textContent = t("content.pageRefreshAction");
  metaBody.textContent = t("content.extensionReloadedReadyMessage");
  showToast(t("content.extensionReloadedToast"));
}

function handleSelectionGesture(event) {
  if (
    event?.target &&
    (bubble.contains(event.target) || miniPlayer.contains(event.target))
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

  if (extensionContextLost || isBusy || isDraggingPlayer || isSeeking) {
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
    actionButton.textContent = t("content.pageRefreshAction");
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
