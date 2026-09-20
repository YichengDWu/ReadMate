(function () {
  "use strict";

  pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL("lib/pdfjs/pdf.worker.min.js");

  let currentPdfDoc = null;
  let currentPageNumber = 1;
  let totalPages = 0;
  let currentScale = 1.0;
  let isRendering = false;
  let currentPageText = "";

  // Continuous reading state
  let isContinuousReading = false;
  let activeContinuousAudio = null;
  let continuousSessionId = 0;

  // DOM Elements
  const dropzone = document.getElementById("dropzone");
  const pagesWrapper = document.getElementById("pdf-pages-wrapper");
  const viewerStatus = document.getElementById("viewer-status");
  const statusMessage = document.getElementById("statusMessage");

  const fileInput = document.getElementById("fileInput");
  const openFileBtn = document.getElementById("openFileBtn");
  const dropzoneSelectBtn = document.getElementById("dropzoneSelectBtn");
  const pdfUrlInput = document.getElementById("pdfUrlInput");
  const openUrlBtn = document.getElementById("openUrlBtn");

  const prevPageBtn = document.getElementById("prevPageBtn");
  const nextPageBtn = document.getElementById("nextPageBtn");
  const pageNumberInput = document.getElementById("pageNumberInput");
  const pageCountSpan = document.getElementById("pageCountSpan");

  const zoomOutBtn = document.getElementById("zoomOutBtn");
  const zoomInBtn = document.getElementById("zoomInBtn");
  const fitWidthBtn = document.getElementById("fitWidthBtn");
  const zoomPercentSpan = document.getElementById("zoomPercentSpan");

  const readPageBtn = document.getElementById("readPageBtn");
  const readContinuousBtn = document.getElementById("readContinuousBtn");
  const readContinuousLabel = document.getElementById("readContinuousLabel");
  const continuousReadingStatus = document.getElementById("continuousReadingStatus");
  const continuousProgressText = document.getElementById("continuousProgressText");
  const openSettingsBtn = document.getElementById("openSettingsBtn");

  document.addEventListener("DOMContentLoaded", initialize);

  function initialize() {
    applyTranslations();
    bindEvents();
    checkUrlParam();
  }

  function bindEvents() {
    openFileBtn.addEventListener("click", () => fileInput.click());
    dropzoneSelectBtn.addEventListener("click", () => fileInput.click());

    fileInput.addEventListener("change", handleFileInput);
    openUrlBtn.addEventListener("click", handleUrlInput);
    pdfUrlInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") handleUrlInput();
    });

    prevPageBtn.addEventListener("click", () => goToPage(currentPageNumber - 1));
    nextPageBtn.addEventListener("click", () => goToPage(currentPageNumber + 1));
    pageNumberInput.addEventListener("change", () => {
      const page = parseInt(pageNumberInput.value, 10);
      if (!isNaN(page) && page >= 1 && page <= totalPages) {
        goToPage(page);
      } else {
        pageNumberInput.value = currentPageNumber;
      }
    });

    zoomOutBtn.addEventListener("click", () => changeZoom(-0.15));
    zoomInBtn.addEventListener("click", () => changeZoom(0.15));
    fitWidthBtn.addEventListener("click", fitToWidth);

    readPageBtn.addEventListener("click", handleReadCurrentPage);
    readContinuousBtn.addEventListener("click", toggleContinuousReading);
    openSettingsBtn.addEventListener("click", () => {
      chrome.runtime.openOptionsPage?.() || chrome.runtime.sendMessage({ type: "OPEN_OPTIONS" });
    });

    // Drag and drop
    window.addEventListener("dragover", (e) => e.preventDefault());
    window.addEventListener("drop", handleDrop);

    // Keyboard navigation
    window.addEventListener("keydown", (e) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === "ArrowLeft" || e.key === "PageUp") {
        goToPage(currentPageNumber - 1);
      } else if (e.key === "ArrowRight" || e.key === "PageDown") {
        goToPage(currentPageNumber + 1);
      } else if (e.key === "+" || e.key === "=") {
        changeZoom(0.15);
      } else if (e.key === "-") {
        changeZoom(-0.15);
      }
    });
  }

  function handleFileInput(e) {
    const file = e.target.files?.[0];
    if (file) {
      loadLocalFile(file);
    }
  }

  function handleDrop(e) {
    e.preventDefault();
    const file = e.dataTransfer?.files?.[0];
    if (file && (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"))) {
      loadLocalFile(file);
    }
  }

  function handleUrlInput() {
    const url = pdfUrlInput.value.trim();
    if (url) {
      loadPdfByUrl(url);
    }
  }

  function checkUrlParam() {
    const params = new URLSearchParams(window.location.search);
    const fileUrl = params.get("file");
    if (fileUrl) {
      loadPdfByUrl(fileUrl);
    }
  }

  async function loadLocalFile(file) {
    showStatus(t("pdf.loadingFile", "正在读取 PDF 文件..."));
    try {
      const arrayBuffer = await file.arrayBuffer();
      await loadPdfDocument({ data: arrayBuffer });
    } catch (err) {
      alert(t("pdf.openFailed", "打开 PDF 失败: ") + err.message);
      hideStatus();
    }
  }

  async function loadPdfByUrl(url) {
    showStatus(t("pdf.loadingFile", "正在加载网络 PDF..."));
    try {
      await loadPdfDocument({ url });
    } catch (err) {
      alert(t("pdf.openFailed", "加载网络 PDF 失败: ") + err.message);
      hideStatus();
    }
  }

  async function loadPdfDocument(source) {
    try {
      const loadingTask = pdfjsLib.getDocument(source);
      currentPdfDoc = await loadingTask.promise;
      totalPages = currentPdfDoc.numPages;

      currentPageNumber = 1;
      pageCountSpan.textContent = totalPages;
      pageNumberInput.max = totalPages;
      pageNumberInput.disabled = false;
      readPageBtn.disabled = false;
      readContinuousBtn.disabled = false;
      zoomInBtn.disabled = false;
      zoomOutBtn.disabled = false;

      dropzone.classList.remove("dropzone-visible");
      hideStatus();

      await renderPage(currentPageNumber);
    } catch (err) {
      hideStatus();
      throw err;
    }
  }

  async function renderPage(pageNum) {
    if (!currentPdfDoc || isRendering) return;
    isRendering = true;

    try {
      currentPageNumber = pageNum;
      pageNumberInput.value = pageNum;
      prevPageBtn.disabled = pageNum <= 1;
      nextPageBtn.disabled = pageNum >= totalPages;

      const page = await currentPdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale: currentScale });

      // Clear wrapper
      pagesWrapper.innerHTML = "";

      // Page Card Container
      const pageCard = document.createElement("div");
      pageCard.className = "pdf-page-card";
      pageCard.style.width = `${Math.floor(viewport.width)}px`;
      pageCard.style.height = `${Math.floor(viewport.height)}px`;

      // Canvas
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      const outputScale = window.devicePixelRatio || 1;

      canvas.width = Math.floor(viewport.width * outputScale);
      canvas.height = Math.floor(viewport.height * outputScale);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;

      const transform = outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : null;

      const renderContext = {
        canvasContext: ctx,
        transform,
        viewport,
      };

      pageCard.appendChild(canvas);

      // Text Layer
      const textLayerDiv = document.createElement("div");
      textLayerDiv.className = "textLayer";
      textLayerDiv.style.width = `${Math.floor(viewport.width)}px`;
      textLayerDiv.style.height = `${Math.floor(viewport.height)}px`;
      textLayerDiv.style.setProperty("--scale-factor", viewport.scale);

      pageCard.appendChild(textLayerDiv);
      pagesWrapper.appendChild(pageCard);

      // Render Canvas
      await page.render(renderContext).promise;

      // Render Text Layer
      const textContent = await page.getTextContent();
      currentPageText = textContent.items.map((item) => item.str).join(" ").trim();

      const textTask = pdfjsLib.renderTextLayer({
        textContentSource: textContent,
        container: textLayerDiv,
        viewport,
      });
      await textTask.promise;
    } catch (err) {
      console.error("Page render error:", err);
    } finally {
      isRendering = false;
    }
  }

  function goToPage(pageNum, fromContinuous = false) {
    if (!currentPdfDoc || pageNum < 1 || pageNum > totalPages) return;
    if (!fromContinuous && isContinuousReading) {
      stopContinuousReading();
    }
    return renderPage(pageNum);
  }

  function changeZoom(delta) {
    const newScale = Math.min(3.0, Math.max(0.4, currentScale + delta));
    if (Math.abs(newScale - currentScale) < 0.01) return;
    currentScale = Math.round(newScale * 100) / 100;
    zoomPercentSpan.textContent = `${Math.round(currentScale * 100)}%`;
    renderPage(currentPageNumber);
  }

  async function fitToWidth() {
    if (!currentPdfDoc) return;
    const page = await currentPdfDoc.getPage(currentPageNumber);
    const unscaledViewport = page.getViewport({ scale: 1.0 });
    const containerWidth = document.getElementById("viewer-container").clientWidth - 48;
    if (containerWidth > 0 && unscaledViewport.width > 0) {
      currentScale = Math.round((containerWidth / unscaledViewport.width) * 100) / 100;
      zoomPercentSpan.textContent = `${Math.round(currentScale * 100)}%`;
      renderPage(currentPageNumber);
    }
  }

  function toggleContinuousReading() {
    if (isContinuousReading) {
      stopContinuousReading();
    } else {
      startContinuousReading();
    }
  }

  function startContinuousReading() {
    if (!currentPdfDoc || totalPages < 1) return;

    isContinuousReading = true;
    continuousSessionId++;
    const sessionId = continuousSessionId;

    readContinuousBtn.classList.add("is-reading");
    readContinuousLabel.textContent = t("pdf.stopContinuousRead", "停止朗读");
    continuousReadingStatus.classList.remove("is-hidden");

    runContinuousReadingLoop(currentPageNumber, sessionId);
  }

  function stopContinuousReading() {
    isContinuousReading = false;
    continuousSessionId++;

    if (activeContinuousAudio) {
      try {
        activeContinuousAudio.pause();
        activeContinuousAudio.removeAttribute("src");
        activeContinuousAudio.load();
      } catch (_e) {}
      activeContinuousAudio = null;
    }

    readContinuousBtn.classList.remove("is-reading");
    readContinuousLabel.textContent = t("pdf.continuousRead", "连续朗读");
    continuousReadingStatus.classList.add("is-hidden");
    hideStatus();
  }

  function updateContinuousProgress(pageNum) {
    continuousProgressText.textContent = t(
      "pdf.readingPageProgress",
      `正在朗读第 ${pageNum} / ${totalPages} 页`,
      { current: pageNum, total: totalPages }
    );
  }

  async function runContinuousReadingLoop(startPage, sessionId) {
    let pageNum = startPage;
    let consecutiveEmptyPages = 0;

    while (isContinuousReading && sessionId === continuousSessionId && pageNum <= totalPages) {
      updateContinuousProgress(pageNum);

      // Render page if not already showing
      if (currentPageNumber !== pageNum) {
        await renderPage(pageNum);
        document.getElementById("viewer-container").scrollTo({ top: 0, behavior: "smooth" });
      }

      const text = currentPageText ? currentPageText.trim() : "";
      if (!text) {
        consecutiveEmptyPages++;
        if (consecutiveEmptyPages >= 3) {
          showStatus(t("pdf.noTextOnPage", "连续多页无文本，已停止朗读。"));
          setTimeout(hideStatus, 2000);
          break;
        }

        showStatus(t("pdf.skippingBlankPage", `第 ${pageNum} 页无文本，自动跳过...`, { page: pageNum }));
        await new Promise((r) => setTimeout(r, 800));
        hideStatus();
        pageNum++;
        continue;
      }

      consecutiveEmptyPages = 0;
      const chunks = splitTextIntoChunks(text, 1500);

      let pageOk = true;
      for (let i = 0; i < chunks.length; i++) {
        if (!isContinuousReading || sessionId !== continuousSessionId) {
          pageOk = false;
          break;
        }

        try {
          showStatus(t("content.loadingSpeechLabel", "正在合成语音..."));
          const finished = await playTextChunk(chunks[i], sessionId);
          hideStatus();
          if (!finished) {
            pageOk = false;
            break;
          }
        } catch (err) {
          hideStatus();
          console.error("Continuous reading error on page " + pageNum + ":", err);
          alert(err.message);
          pageOk = false;
          break;
        }
      }

      if (!pageOk || !isContinuousReading || sessionId !== continuousSessionId) {
        break;
      }

      // Turn to next page automatically!
      if (pageNum < totalPages) {
        pageNum++;
        // Small pause between pages for pleasant reading cadence
        await new Promise((r) => setTimeout(r, 400));
      } else {
        // Last page completed
        showStatus(t("pdf.readingCompleted", "全书已朗读完成。"));
        setTimeout(hideStatus, 3000);
        break;
      }
    }

    if (sessionId === continuousSessionId) {
      stopContinuousReading();
    }
  }

  function splitTextIntoChunks(text, maxChars = 1500) {
    const trimmed = text.trim();
    if (trimmed.length <= maxChars) {
      return [trimmed];
    }

    const chunks = [];
    const sentences = trimmed.split(/(?<=[.!?;\n。！？；\r])\s*/);
    let currentChunk = "";

    for (const sentence of sentences) {
      if (!sentence) continue;
      if ((currentChunk + " " + sentence).length <= maxChars) {
        currentChunk = currentChunk ? currentChunk + " " + sentence : sentence;
      } else {
        if (currentChunk) {
          chunks.push(currentChunk);
        }
        if (sentence.length > maxChars) {
          for (let i = 0; i < sentence.length; i += maxChars) {
            chunks.push(sentence.slice(i, i + maxChars));
          }
          currentChunk = "";
        } else {
          currentChunk = sentence;
        }
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk);
    }

    return chunks.length ? chunks : [trimmed.slice(0, maxChars)];
  }

  function playTextChunk(chunkText, sessionId) {
    return new Promise(async (resolve, reject) => {
      if (!isContinuousReading || sessionId !== continuousSessionId) {
        resolve(false);
        return;
      }

      try {
        const response = await chrome.runtime.sendMessage({
          type: "SPEAK_TEXT",
          text: chunkText,
        });

        if (!isContinuousReading || sessionId !== continuousSessionId) {
          resolve(false);
          return;
        }

        if (!response?.ok) {
          throw new Error(response?.error || "Speech synthesis failed");
        }

        const audioContent = response.result?.audioContent;
        const mimeType = response.result?.mimeType || "audio/wav";
        if (!audioContent) {
          throw new Error("No audio content received");
        }

        const audio = new Audio(`data:${mimeType};base64,${audioContent}`);
        activeContinuousAudio = audio;

        audio.addEventListener("ended", () => {
          activeContinuousAudio = null;
          resolve(true);
        });

        audio.addEventListener("error", () => {
          activeContinuousAudio = null;
          reject(new Error("Audio playback failed"));
        });

        await audio.play();
      } catch (e) {
        activeContinuousAudio = null;
        reject(e);
      }
    });
  }

  async function handleReadCurrentPage() {
    stopContinuousReading();

    if (!currentPageText) {
      alert(t("pdf.noTextOnPage", "当前页面没有检测到可朗读的文本。"));
      return;
    }

    const chunks = splitTextIntoChunks(currentPageText, 1500);
    continuousSessionId++;
    const sessionId = continuousSessionId;
    isContinuousReading = true;

    readPageBtn.disabled = true;
    readContinuousBtn.disabled = true;

    try {
      for (const chunk of chunks) {
        if (sessionId !== continuousSessionId) break;
        showStatus(t("content.loadingSpeechLabel", "正在合成语音..."));
        const finished = await playTextChunk(chunk, sessionId);
        hideStatus();
        if (!finished) break;
      }
    } catch (err) {
      hideStatus();
      alert(err.message);
    } finally {
      readPageBtn.disabled = false;
      readContinuousBtn.disabled = false;
      isContinuousReading = false;
    }
  }

  function showStatus(msg) {
    statusMessage.textContent = msg;
    viewerStatus.classList.remove("viewer-status-hidden");
  }

  function hideStatus() {
    viewerStatus.classList.add("viewer-status-hidden");
  }

  function t(key, fallback = "", params = {}) {
    if (window.InworldI18n && typeof window.InworldI18n.getMessage === "function") {
      const lang = window.InworldI18n.getInitialUiLanguage();
      const val = window.InworldI18n.getMessage(key, params, lang);
      if (val && val !== key) return val;
    }
    let res = fallback || key;
    for (const [k, v] of Object.entries(params)) {
      res = res.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
    }
    return res;
  }

  function applyTranslations() {
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      const text = t(key);
      if (text && text !== key) el.textContent = text;
    });
    document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
      const key = el.getAttribute("data-i18n-placeholder");
      const text = t(key);
      if (text && text !== key) el.setAttribute("placeholder", text);
    });
  }
})();
