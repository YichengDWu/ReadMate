(function (global) {
  const SUPPORTED_UI_LANGUAGES = ["zh-CN", "en"];
  const FALLBACK_UI_LANGUAGE = "en";

  const UI_MESSAGES = {
    "zh-CN": {
      "common.brand": "ReadMate",
      "common.brandShort": "ReadMate",
      "common.miniPlayerTitle": "ReadMate 伴读播放器",
      "common.actionTitle": "ReadMate 划词朗读",
      "common.uiLanguageChinese": "简体中文",
      "common.uiLanguageEnglish": "English",

      "background.contextMenuSpeakSelection": "朗读所选文本",
      "background.contextMenuOpenInPdfViewer": "在 ReadMate 中打开此 PDF",
      "background.readFailedCheckConfig": "朗读失败，请检查配置。",
      "background.unknownError": "未知错误",
      "background.unsupportedMessageType": "不支持的消息类型。",
      "background.fillApiKey": "请先填写 Inworld API Key。",
      "background.fillApiKeyInSettings": "请先在设置页填写 Inworld API Key。",
      "background.fillCartesiaApiKey": "请先填写 Cartesia API Key。",
      "background.fillCartesiaApiKeyInSettings": "请先在设置页填写 Cartesia API Key。",
      "background.fillVoiceId": "请先填写 Voice ID。",
      "background.fillVoiceIdInSettings": "请先在设置页填写 Voice ID。",
      "background.fillCartesiaVoiceId": "请先填写 Cartesia Voice ID。",
      "background.fillCartesiaVoiceIdInSettings": "请先在设置页填写 Cartesia Voice ID。",
      "background.fetchVoicesFailed": "获取声音列表失败",
      "background.noSpeakableText": "没有检测到可朗读的文本。",
      "background.maxLengthExceeded": "Inworld 单次最多支持 {max} 个字符。",
      "background.translationEmpty": "翻译结果为空，无法继续朗读。",
      "background.translatedTextTooLong": "翻译后的文本超过 {max} 个字符，无法直接发送给 Inworld。",
      "background.invalidTranslationApiUrl": "翻译 API URL 格式不正确。",
      "background.invalidTranslationApiUrlProtocol": "翻译 API URL 只支持 http 或 https。",
      "background.fillTranslationLanguage": "已开启翻译，请先填写目标语言。",
      "background.fillTranslationModel": "已开启翻译，请先填写翻译模型。",
      "background.translationRequestFailed": "翻译请求失败",
      "background.translationNoResult": "LLM 没有返回可用的译文。",
      "background.speechRequestFailed": "朗读请求失败",
      "background.noAudioContent": "TTS 服务没有返回可播放的音频内容。",
      "background.errorWithStatus": "{message}（HTTP {status}）",
      "background.errorWithDetail": "{message}：{detail}",

      "popup.pageTitle": "ReadMate 划词朗读",
      "popup.heading": "划词朗读",
      "popup.loadingSummary": "正在读取配置…",
      "popup.speakButton": "朗读当前选中文本",
      "popup.stopButton": "停止播放",
      "popup.settingsButton": "打开设置",
      "popup.summaryReadFailed": "读取配置失败。",
      "popup.summaryNeedConfig": "还没有完成配置，请先填写 API Key 和 Voice ID。",
      "popup.summaryNeedTranslationConfig": "TTS 已配置，但译后朗读的目标语言或翻译模型还没有填完整。",
      "popup.summaryConfigured": "当前使用 {provider} ({modelId}) · Voice: {voiceId}",
      "popup.summaryConfiguredWithTranslation": "当前使用 {provider} ({modelId}) · Voice: {voiceId} · 先翻译为 {targetLanguage}",
      "popup.processing": "正在处理…",
      "popup.stopRequested": "已请求停止当前播放。",
      "popup.currentTabNotFound": "无法定位当前标签页。",
      "popup.operationFailed": "操作失败。",
      "popup.requestSent": "请求已发送。",
      "popup.refreshPageAfterReload": "当前页面里的旧脚本已失效，刷新该网页后再试。",
      "popup.unsupportedPage": "当前页面可能不支持注入扩展脚本，请切换到普通网页再试。",

      "options.pageTitle": "ReadMate 设置",
      "options.heroTitle": "划词朗读扩展设置",
      "options.heroLede": "选择文本后即可朗读。支持 Inworld 与 Cartesia 多提供商，配置 API Key、Voice ID、模型和测试参数。",
      "options.connectionHeading": "连接设置",
      "options.connectionNote": "API Key 仅保存在当前浏览器扩展的本地存储中，不会写进项目文件。",
      "options.uiLanguageLabel": "界面语言",
      "options.providerLabel": "TTS 提供商",
      "options.providerInworld": "Inworld AI",
      "options.providerCartesia": "Cartesia AI (Sonic 3.6)",
      "options.apiKeyLabel": "Inworld API Key",
      "options.apiKeyPlaceholder": "输入你的 Inworld API Key",
      "options.voiceIdLabel": "Inworld Voice ID",
      "options.voiceIdPlaceholder": "例如 Alex 或你的自定义 voiceId",
      "options.cartesiaApiKeyLabel": "Cartesia API Key",
      "options.cartesiaApiKeyPlaceholder": "输入你的 Cartesia API Key",
      "options.cartesiaVoiceIdLabel": "Cartesia Voice ID",
      "options.cartesiaVoiceIdPlaceholder": "例如 db6b0ed5-d5d3-463d-ae85-518a07d3c2b4",
      "options.cartesiaModelLabel": "Cartesia 模型",
      "options.cartesiaLanguageLabel": "语言/区域代码（可选）",
      "options.cartesiaLanguagePlaceholder": "例如 en, zh, ja 或留空自适应",
      "options.modelLabel": "模型",
      "options.languageFilterLabel": "语言过滤",
      "options.languageFilterPlaceholder": "可选，逗号分隔，例如 zh,en",
      "options.sampleRateLabel": "采样率",
      "options.temperatureLabel": "Temperature",
      "options.textNormalizationLabel": "文本规范化",
      "options.audioEncodingLabel": "音频编码",
      "options.wordHighlightTitle": "朗读时逐词高亮",
      "options.wordHighlightDescription": "会向 TTS 提供商请求词级时间轴并在网页中同步高亮。为了更准确，建议英文或西语文本。",
      "options.autoPlayTitle": "划完词后自动播放",
      "options.autoPlayDescription": "选区完成后会自动发起朗读，不再需要额外点击按钮。默认关闭，避免误触发。",
      "options.keepPlayerVisibleTitle": "朗读结束后保留悬浮播放器",
      "options.keepPlayerVisibleDescription": "开启后，悬浮播放器在播放完成后不会自动消失，你可以直接点击“重播”再次播放刚才的音频。",
      "options.translationTitle": "先翻译再朗读",
      "options.translationDescription": "启用后会先把选中文本发送到一个 OpenAI 兼容的 LLM 接口翻译成目标语言，再交给 TTS 服务。由于朗读内容已经变成译文，逐词高亮会自动跳过。",
      "options.translationTargetLanguageLabel": "目标语言",
      "options.translationTargetLanguagePlaceholder": "例如 Japanese、English、简体中文",
      "options.translationModelLabel": "翻译模型",
      "options.translationModelPlaceholder": "例如 gpt-4.1-mini 或你的兼容模型名",
      "options.translationApiUrlLabel": "LLM API URL",
      "options.translationApiUrlPlaceholder": "https://api.openai.com/v1/chat/completions",
      "options.translationApiKeyLabel": "LLM API Key",
      "options.translationApiKeyPlaceholder": "可选；如果你的 LLM 服务需要鉴权就填写",
      "options.saveButton": "保存设置",
      "options.loadVoicesButton": "拉取声音列表",
      "options.statusStopped": "已停止播放。",
      "options.statusSaved": "设置已保存。",
      "options.validationApiKey": "请先填写 Inworld API Key。",
      "options.validationVoiceId": "请先填写 Voice ID。",
      "options.validationCartesiaApiKey": "请先填写 Cartesia API Key。",
      "options.validationCartesiaVoiceId": "请先填写 Cartesia Voice ID。",
      "options.validationTranslationLanguage": "已开启翻译，请先填写目标语言。",
      "options.validationTranslationModel": "已开启翻译，请先填写翻译模型。",
      "options.validationTranslationApiUrlProtocol": "翻译 API URL 只支持 http 或 https。",
      "options.validationTranslationApiUrlFormat": "翻译 API URL 格式不正确。",
      "options.loadingVoices": "正在拉取声音列表…",
      "options.loadedVoices": "已加载 {count} 个声音。",
      "options.loadVoicesFailed": "声音列表拉取失败。",
      "options.voiceBrowserHeading": "声音浏览",
      "options.voiceBrowserDescription": "拉取当前提供商可用的声音，并快速回填到 Voice ID。",
      "options.availableVoicesLabel": "可用声音",
      "options.voiceDescriptionEmpty": "还没有加载声音列表。",
      "options.voiceDescriptionNoVoices": "当前过滤条件下没有返回声音。",
      "options.voiceDescriptionLanguage": "语言",
      "options.voiceDescriptionSource": "来源",
      "options.voiceUnknown": "unknown",
      "options.testHeading": "测试朗读",
      "options.testDescription": "不需要切回网页，直接在这里验证 API Key、Voice ID 和模型配置。",
      "options.testTextLabel": "测试文本",
      "options.testTextDefault": "你好，这是一段 ReadMate 划词朗读扩展的测试音频。",
      "options.testButton": "测试朗读",
      "options.stopButton": "停止播放",
      "options.testTextRequired": "请输入测试文本。",
      "options.testingSpeech": "正在合成测试音频…",
      "options.testingSpeechWithTranslation": "正在翻译并合成测试音频…",
      "options.testStarted": "测试音频已开始播放。",
      "options.testFailed": "测试朗读失败。",
      "options.testPlaybackFailed": "测试音频播放失败。",
      "options.securityHeading": "安全说明",
      "options.securityNote": "这份实现适合个人自用：API Key 保存在扩展本地存储中，再由后台脚本调用 Inworld。如果你准备把扩展分发给别人，建议改成你自己的服务端代理，不要把共享密钥直接交给客户端。",

      "content.defaultMeta": "选中文本后点击朗读",
      "content.defaultPlayerText": "开始朗读后，这里会显示当前文本摘要。",
      "content.noSelection": "没有检测到可朗读的文本。",
      "content.selectionTooLong": "选中文本过长。",
      "content.overLimitLabel": "超出 2000 字",
      "content.overLimitDetail": "当前 {count} 字，超过单次上限。",
      "content.speakAction": "朗读",
      "content.translateAndSpeakAction": "翻译并朗读",
      "content.loadingSpeechLabel": "合成中…",
      "content.loadingTranslationLabel": "翻译中…",
      "content.retry": "重试",
      "content.stop": "停止",
      "content.pause": "暂停",
      "content.resume": "继续",
      "content.replay": "重播",
      "content.loadingSpeechDetail": "正在请求语音合成",
      "content.loadingTranslationDetail": "正在翻译为 {language} 并请求语音",
      "content.selectionDetail": "{count} 字，点击合成语音并朗读",
      "content.selectionTranslateDetail": "{count} 字，点击先翻译为 {language} 再合成语音",
      "content.voiceFallback": "当前声音",
      "content.playbackTranslated": "{voice} 正在朗读 {language} 译文",
      "content.playbackNormal": "{voice} 正在朗读{suffix}",
      "content.highlightSuffix": "，逐词高亮已启用",
      "content.audioPlaybackFailed": "音频播放失败，请重试。",
      "content.resumePlaybackFailed": "恢复播放失败，请重试。",
      "content.replayPlaybackFailed": "重播失败，请重试。",
      "content.playerStatusWaiting": "等待朗读",
      "content.playerStatusLoading": "正在请求语音合成",
      "content.playerStatusLoadingTranslated": "正在翻译为 {language} 并请求语音",
      "content.playerStatusFinished": "朗读完成，可以重新播放",
      "content.playerStatusFinishedTranslated": "{language} 译文已播放完成，可以重新播放",
      "content.playerStatusPaused": "已暂停，可以继续播放",
      "content.playerStatusPausedTranslated": "已暂停，当前是 {language} 译文",
      "content.playerStatusPlaying": "正在朗读当前文本",
      "content.playerStatusPlayingTranslated": "正在朗读 {language} 译文",
      "content.playerChipReady": "就绪",
      "content.playerChipLoading": "合成中",
      "content.playerChipFinished": "已结束",
      "content.playerChipPaused": "已暂停",
      "content.playerChipPlaying": "播放中",
      "content.playerTranslatedLabel": "译文",
      "content.playerOriginalLabel": "原文",
      "content.playerTargetLanguageLabel": "目标语言",
      "content.pageRefreshAction": "请刷新页面",
      "content.extensionReloadedReadyMessage": "扩展已重载，刷新当前网页后才能继续使用。",
      "content.extensionReloadedToast": "扩展刚刚重载，请刷新当前页面后再试。",

      "popup.pdfReaderButton": "打开 PDF 阅读器",

      "pdf.openFile": "打开文件",
      "pdf.openLocalFile": "打开本地 PDF 文件",
      "pdf.fitWidth": "自适应",
      "pdf.readCurrentPage": "朗读当前页",
      "pdf.readPage": "朗读整页",
      "pdf.dropzoneTitle": "拖拽 PDF 文件到此处打开",
      "pdf.dropzoneDesc": "或者点击下方按钮选择本地文件，或输入网络 PDF 链接",
      "pdf.selectFile": "选择本地 PDF",
      "pdf.urlPlaceholder": "https://example.com/document.pdf",
      "pdf.openUrl": "打开",
      "pdf.loadingFile": "正在加载 PDF 文件...",
      "pdf.openFailed": "打开 PDF 失败：",
      "pdf.noTextOnPage": "当前页面没有检测到可朗读的文本。",

      "manifest.popupTitle": "ReadMate 划词朗读",
    },

    en: {
      "common.brand": "ReadMate",
      "common.brandShort": "ReadMate",
      "common.miniPlayerTitle": "ReadMate Mini Player",
      "common.actionTitle": "ReadMate Selection TTS",
      "common.uiLanguageChinese": "Simplified Chinese",
      "common.uiLanguageEnglish": "English",

      "background.contextMenuSpeakSelection": "Read selected text",
      "background.contextMenuOpenInPdfViewer": "Open PDF with ReadMate",
      "background.readFailedCheckConfig": "Speech failed. Please check your settings.",
      "background.unknownError": "Unknown error",
      "background.unsupportedMessageType": "Unsupported message type.",
      "background.fillApiKey": "Please enter the Inworld API key first.",
      "background.fillApiKeyInSettings": "Please enter the Inworld API key in settings first.",
      "background.fillCartesiaApiKey": "Please enter the Cartesia API key first.",
      "background.fillCartesiaApiKeyInSettings": "Please enter the Cartesia API key in settings first.",
      "background.fillVoiceId": "Please enter a Voice ID first.",
      "background.fillVoiceIdInSettings": "Please enter a Voice ID in settings first.",
      "background.fillCartesiaVoiceId": "Please enter a Cartesia Voice ID first.",
      "background.fillCartesiaVoiceIdInSettings": "Please enter a Cartesia Voice ID in settings first.",
      "background.fetchVoicesFailed": "Failed to fetch voices",
      "background.noSpeakableText": "No readable text was detected.",
      "background.maxLengthExceeded": "Supports up to {max} characters per request.",
      "background.translationEmpty": "The translation result is empty and cannot be spoken.",
      "background.translatedTextTooLong": "The translated text exceeds {max} characters and cannot be sent directly.",
      "background.invalidTranslationApiUrl": "The translation API URL is invalid.",
      "background.invalidTranslationApiUrlProtocol": "The translation API URL must use http or https.",
      "background.fillTranslationLanguage": "Translation is enabled. Please enter the target language first.",
      "background.fillTranslationModel": "Translation is enabled. Please enter the translation model first.",
      "background.translationRequestFailed": "Translation request failed",
      "background.translationNoResult": "The LLM did not return usable translated text.",
      "background.speechRequestFailed": "Speech synthesis request failed",
      "background.noAudioContent": "The TTS service did not return playable audio content.",
      "background.errorWithStatus": "{message} (HTTP {status})",
      "background.errorWithDetail": "{message}: {detail}",

      "popup.pageTitle": "ReadMate Selection TTS",
      "popup.heading": "Selection TTS",
      "popup.loadingSummary": "Loading settings...",
      "popup.speakButton": "Speak current selection",
      "popup.stopButton": "Stop playback",
      "popup.settingsButton": "Open settings",
      "popup.summaryReadFailed": "Failed to read settings.",
      "popup.summaryNeedConfig": "Setup is incomplete. Please enter the API key and Voice ID first.",
      "popup.summaryNeedTranslationConfig": "TTS is configured, but the target language or translation model is still missing.",
      "popup.summaryConfigured": "Using {provider} ({modelId}) · Voice: {voiceId}",
      "popup.summaryConfiguredWithTranslation": "Using {provider} ({modelId}) · Voice: {voiceId} · translate to {targetLanguage} first",
      "popup.processing": "Processing...",
      "popup.stopRequested": "Stop request sent.",
      "popup.currentTabNotFound": "Could not find the current tab.",
      "popup.operationFailed": "Operation failed.",
      "popup.requestSent": "Request sent.",
      "popup.refreshPageAfterReload": "The content script on this page is outdated. Refresh the page and try again.",
      "popup.unsupportedPage": "This page may not support injected extension scripts. Try again on a regular webpage.",

      "options.pageTitle": "ReadMate Settings",
      "options.heroTitle": "Selection TTS Settings",
      "options.heroLede": "Configure TTS settings for Inworld or Cartesia, including API keys, Voice ID, model, and test playback.",
      "options.connectionHeading": "Connection Settings",
      "options.connectionNote": "API keys are stored only in this browser extension's local storage and are never written into project files.",
      "options.uiLanguageLabel": "UI language",
      "options.providerLabel": "TTS Provider",
      "options.providerInworld": "Inworld AI",
      "options.providerCartesia": "Cartesia AI (Sonic 3.6)",
      "options.apiKeyLabel": "Inworld API Key",
      "options.apiKeyPlaceholder": "Enter your Inworld API key",
      "options.voiceIdLabel": "Inworld Voice ID",
      "options.voiceIdPlaceholder": "For example: Alex or your custom voiceId",
      "options.cartesiaApiKeyLabel": "Cartesia API Key",
      "options.cartesiaApiKeyPlaceholder": "Enter your Cartesia API key",
      "options.cartesiaVoiceIdLabel": "Cartesia Voice ID",
      "options.cartesiaVoiceIdPlaceholder": "For example: db6b0ed5-d5d3-463d-ae85-518a07d3c2b4",
      "options.cartesiaModelLabel": "Cartesia Model",
      "options.cartesiaLanguageLabel": "Language/Locale hint (Optional)",
      "options.cartesiaLanguagePlaceholder": "For example: en, zh, ja, or leave empty",
      "options.modelLabel": "Model",
      "options.languageFilterLabel": "Language filter",
      "options.languageFilterPlaceholder": "Optional, comma-separated, for example: zh,en",
      "options.sampleRateLabel": "Sample rate",
      "options.temperatureLabel": "Temperature",
      "options.textNormalizationLabel": "Text normalization",
      "options.audioEncodingLabel": "Audio encoding",
      "options.wordHighlightTitle": "Word-level highlighting during playback",
      "options.wordHighlightDescription": "Requests word-level timestamps from the TTS provider and highlights the current word on the page. For best results, use English or Spanish text.",
      "options.autoPlayTitle": "Auto-play after selection",
      "options.autoPlayDescription": "Starts reading automatically as soon as a selection is completed. Disabled by default to avoid accidental playback.",
      "options.keepPlayerVisibleTitle": "Keep the floating player after playback",
      "options.keepPlayerVisibleDescription": "When enabled, the floating player stays on screen after playback finishes so you can replay the same audio without selecting the text again.",
      "options.translationTitle": "Translate before speaking",
      "options.translationDescription": "When enabled, the selected text is first translated with an OpenAI-compatible LLM endpoint and then sent to the TTS provider. Word highlighting is skipped automatically because playback follows the translated text.",
      "options.translationTargetLanguageLabel": "Target language",
      "options.translationTargetLanguagePlaceholder": "For example: Japanese, English, Simplified Chinese",
      "options.translationModelLabel": "Translation model",
      "options.translationModelPlaceholder": "For example: gpt-4.1-mini or your compatible model name",
      "options.translationApiUrlLabel": "LLM API URL",
      "options.translationApiUrlPlaceholder": "https://api.openai.com/v1/chat/completions",
      "options.translationApiKeyLabel": "LLM API Key",
      "options.translationApiKeyPlaceholder": "Optional. Fill this in if your LLM service requires authentication.",
      "options.saveButton": "Save settings",
      "options.loadVoicesButton": "Load voices",
      "options.statusStopped": "Playback stopped.",
      "options.statusSaved": "Settings saved.",
      "options.validationApiKey": "Please enter the Inworld API key first.",
      "options.validationVoiceId": "Please enter a Voice ID first.",
      "options.validationCartesiaApiKey": "Please enter the Cartesia API key first.",
      "options.validationCartesiaVoiceId": "Please enter a Cartesia Voice ID first.",
      "options.validationTranslationLanguage": "Translation is enabled. Please enter the target language first.",
      "options.validationTranslationModel": "Translation is enabled. Please enter the translation model first.",
      "options.validationTranslationApiUrlProtocol": "The translation API URL must use http or https.",
      "options.validationTranslationApiUrlFormat": "The translation API URL is invalid.",
      "options.loadingVoices": "Loading voices...",
      "options.loadedVoices": "Loaded {count} voices.",
      "options.loadVoicesFailed": "Failed to load voices.",
      "options.voiceBrowserHeading": "Voice Browser",
      "options.voiceBrowserDescription": "Fetch available voices for the current provider and quickly fill the selected Voice ID back into the form.",
      "options.availableVoicesLabel": "Available voices",
      "options.voiceDescriptionEmpty": "No voices have been loaded yet.",
      "options.voiceDescriptionNoVoices": "No voices were returned for the current filter.",
      "options.voiceDescriptionLanguage": "Language",
      "options.voiceDescriptionSource": "Source",
      "options.voiceUnknown": "unknown",
      "options.testHeading": "Test Playback",
      "options.testDescription": "Validate your API key, Voice ID, and model settings here without leaving the settings page.",
      "options.testTextLabel": "Test text",
      "options.testTextDefault": "Hello, this is a test clip from ReadMate.",
      "options.testButton": "Test speech",
      "options.stopButton": "Stop playback",
      "options.testTextRequired": "Please enter some test text.",
      "options.testingSpeech": "Synthesizing test audio...",
      "options.testingSpeechWithTranslation": "Translating and synthesizing test audio...",
      "options.testStarted": "Test audio playback started.",
      "options.testFailed": "Test playback failed.",
      "options.testPlaybackFailed": "The test audio could not be played.",
      "options.securityHeading": "Security Notes",
      "options.securityNote": "This implementation is intended for personal use: the API key is stored in extension-local storage and used directly by the background script. If you plan to distribute the extension, it is safer to route API calls through your own backend instead of shipping shared secrets to clients.",

      "content.defaultMeta": "Select text, then click to speak",
      "content.defaultPlayerText": "The current text summary will appear here after playback starts.",
      "content.noSelection": "No readable text was detected.",
      "content.selectionTooLong": "The selected text is too long.",
      "content.overLimitLabel": "Over 2000 chars",
      "content.overLimitDetail": "Current selection: {count} characters, which exceeds the single-request limit.",
      "content.speakAction": "Speak",
      "content.translateAndSpeakAction": "Translate & Speak",
      "content.loadingSpeechLabel": "Synthesizing...",
      "content.loadingTranslationLabel": "Translating...",
      "content.retry": "Retry",
      "content.stop": "Stop",
      "content.pause": "Pause",
      "content.resume": "Resume",
      "content.replay": "Replay",
      "content.loadingSpeechDetail": "Requesting speech synthesis",
      "content.loadingTranslationDetail": "Translating to {language} and requesting speech",
      "content.selectionDetail": "{count} characters. Click to synthesize speech.",
      "content.selectionTranslateDetail": "{count} characters. Click to translate to {language} and synthesize speech.",
      "content.voiceFallback": "Current voice",
      "content.playbackTranslated": "{voice} is reading the {language} translation",
      "content.playbackNormal": "{voice} is reading aloud{suffix}",
      "content.highlightSuffix": ", with word highlighting enabled",
      "content.audioPlaybackFailed": "Audio playback failed. Please try again.",
      "content.resumePlaybackFailed": "Failed to resume playback. Please try again.",
      "content.replayPlaybackFailed": "Failed to replay playback. Please try again.",
      "content.playerStatusWaiting": "Waiting to speak",
      "content.playerStatusLoading": "Requesting speech synthesis",
      "content.playerStatusLoadingTranslated": "Translating to {language} and requesting speech",
      "content.playerStatusFinished": "Playback finished. Replay is available.",
      "content.playerStatusFinishedTranslated": "The {language} translation finished playing. Replay is available.",
      "content.playerStatusPaused": "Paused. You can resume playback.",
      "content.playerStatusPausedTranslated": "Paused on the {language} translation",
      "content.playerStatusPlaying": "Reading the current text",
      "content.playerStatusPlayingTranslated": "Reading the {language} translation",
      "content.playerChipReady": "Ready",
      "content.playerChipLoading": "Loading",
      "content.playerChipFinished": "Finished",
      "content.playerChipPaused": "Paused",
      "content.playerChipPlaying": "Playing",
      "content.playerTranslatedLabel": "Translated",
      "content.playerOriginalLabel": "Original",
      "content.playerTargetLanguageLabel": "Target language",
      "content.pageRefreshAction": "Refresh page",
      "content.extensionReloadedReadyMessage": "The extension has reloaded. Refresh this page before using it again.",
      "content.extensionReloadedToast": "The extension was just reloaded. Refresh this page and try again.",

      "popup.pdfReaderButton": "Open PDF Reader",

      "pdf.openFile": "Open File",
      "pdf.openLocalFile": "Open local PDF file",
      "pdf.fitWidth": "Fit Width",
      "pdf.readCurrentPage": "Read Current Page",
      "pdf.readPage": "Read Page",
      "pdf.dropzoneTitle": "Drag & drop a PDF file here to open",
      "pdf.dropzoneDesc": "Or click the button below to select a local file, or enter an online PDF link",
      "pdf.selectFile": "Select local PDF",
      "pdf.urlPlaceholder": "https://example.com/document.pdf",
      "pdf.openUrl": "Open",
      "pdf.loadingFile": "Loading PDF file...",
      "pdf.openFailed": "Failed to open PDF: ",
      "pdf.noTextOnPage": "No readable text was detected on this page.",

      "manifest.popupTitle": "ReadMate Selection TTS",
    },
  };

  function normalizeUiLanguage(language, fallback = FALLBACK_UI_LANGUAGE) {
    const value = String(language ?? "").toLowerCase();

    if (value.startsWith("zh")) {
      return "zh-CN";
    }

    if (value.startsWith("en")) {
      return "en";
    }

    return SUPPORTED_UI_LANGUAGES.includes(fallback) ? fallback : FALLBACK_UI_LANGUAGE;
  }

  function getInitialUiLanguage() {
    const detected =
      global.chrome?.i18n?.getUILanguage?.() ||
      global.navigator?.language ||
      global.navigator?.languages?.[0] ||
      FALLBACK_UI_LANGUAGE;

    return normalizeUiLanguage(detected, FALLBACK_UI_LANGUAGE);
  }

  function formatTemplate(template, params = {}) {
    return String(template ?? "").replace(/\{(\w+)\}/g, (_match, key) => {
      if (Object.prototype.hasOwnProperty.call(params, key)) {
        return String(params[key]);
      }

      return "";
    });
  }

  function getMessage(key, params = {}, language = null) {
    const resolvedLanguage = normalizeUiLanguage(language || getInitialUiLanguage());
    const template =
      UI_MESSAGES[resolvedLanguage]?.[key] ??
      UI_MESSAGES[FALLBACK_UI_LANGUAGE]?.[key] ??
      key;

    return formatTemplate(template, params);
  }

  function resolveTargets(root, selector) {
    const targets = [];

    if (typeof root?.matches === "function" && root.matches(selector)) {
      targets.push(root);
    }

    if (typeof root?.querySelectorAll === "function") {
      targets.push(...root.querySelectorAll(selector));
    }

    return targets;
  }

  function applyTranslations(root, language) {
    const resolvedLanguage = normalizeUiLanguage(language || getInitialUiLanguage());

    resolveTargets(root, "[data-i18n]").forEach((element) => {
      element.textContent = getMessage(element.dataset.i18n, {}, resolvedLanguage);
    });

    resolveTargets(root, "[data-i18n-placeholder]").forEach((element) => {
      element.placeholder = getMessage(element.dataset.i18nPlaceholder, {}, resolvedLanguage);
    });

    resolveTargets(root, "[data-i18n-title]").forEach((element) => {
      element.title = getMessage(element.dataset.i18nTitle, {}, resolvedLanguage);
    });

    resolveTargets(root, "[data-i18n-value]").forEach((element) => {
      element.value = getMessage(element.dataset.i18nValue, {}, resolvedLanguage);
    });

    if (root?.documentElement) {
      root.documentElement.lang = resolvedLanguage;
    }

    return resolvedLanguage;
  }

  global.InworldI18n = {
    SUPPORTED_UI_LANGUAGES,
    FALLBACK_UI_LANGUAGE,
    UI_MESSAGES,
    normalizeUiLanguage,
    getInitialUiLanguage,
    getMessage,
    applyTranslations,
  };
})(globalThis);
