let currentAudio = null;
let currentObjectUrl = null;

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.target !== "offscreen") {
    return false;
  }

  if (message.type === "PLAY_OFFSCREEN_AUDIO") {
    playAudio(message.payload)
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message.type === "STOP_OFFSCREEN_AUDIO") {
    stopAudio();
    sendResponse({ ok: true });
    return false;
  }

  return false;
});

async function playAudio(payload) {
  stopAudio();

  if (!payload?.audioContent) {
    throw new Error("No audio content provided to offscreen player.");
  }

  const blob = base64ToBlob(payload.audioContent, payload.mimeType || "audio/wav");
  currentObjectUrl = URL.createObjectURL(blob);
  currentAudio = new Audio(currentObjectUrl);

  currentAudio.addEventListener("ended", () => {
    stopAudio();
    chrome.runtime.sendMessage({
      type: "OFFSCREEN_AUDIO_ENDED",
    }).catch(() => undefined);
  });

  currentAudio.addEventListener("error", () => {
    const errorMsg = currentAudio?.error?.message || "Audio playback error in offscreen document";
    stopAudio();
    chrome.runtime.sendMessage({
      type: "OFFSCREEN_AUDIO_ERROR",
      error: errorMsg,
    }).catch(() => undefined);
  });

  await currentAudio.play();
}

function stopAudio() {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.removeAttribute("src");
    currentAudio.load();
    currentAudio = null;
  }

  if (currentObjectUrl) {
    URL.revokeObjectURL(currentObjectUrl);
    currentObjectUrl = null;
  }
}

function base64ToBlob(base64, mimeType = "audio/wav") {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType });
}
