(function () {
  "use strict";

  pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL("lib/pdfjs/pdf.worker.min.js");

  let currentPdfDoc = null;
  let currentPageNumber = 1;
  let totalPages = 0;
  let currentScale = 1.0;
  let isRendering = false;
  let currentPageText = "";

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

  function goToPage(pageNum) {
    if (!currentPdfDoc || pageNum < 1 || pageNum > totalPages) return;
    renderPage(pageNum);
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

  async function handleReadCurrentPage() {
    if (!currentPageText) {
      alert(t("pdf.noTextOnPage", "当前页面没有检测到可朗读的文本。"));
      return;
    }

    try {
      showStatus(t("content.loadingSpeechLabel", "正在合成语音..."));
      const response = await chrome.runtime.sendMessage({
        type: "SPEAK_TEXT",
        text: currentPageText.slice(0, 2000),
      });

      hideStatus();
      if (!response?.ok) {
        throw new Error(response?.error || "Speech synthesis failed");
      }

      // If content.js playAudioPayload is available in window
      if (typeof window.playAudioPayload === "function") {
        await window.playAudioPayload(response.result);
      } else {
        const audio = new Audio("data:audio/wav;base64," + response.result.audioContent);
        audio.play();
      }
    } catch (err) {
      hideStatus();
      alert(err.message);
    }
  }

  function showStatus(msg) {
    statusMessage.textContent = msg;
    viewerStatus.classList.remove("viewer-status-hidden");
  }

  function hideStatus() {
    viewerStatus.classList.add("viewer-status-hidden");
  }

  function t(key, fallback = "") {
    if (window.InworldI18n && typeof window.InworldI18n.t === "function") {
      const val = window.InworldI18n.t(key);
      if (val && val !== key) return val;
    }
    return fallback || key;
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
