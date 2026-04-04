# Privacy & Permissions

English | [简体中文](#隐私与权限说明)

## Privacy & Permissions

This extension is designed for personal use and does not include analytics, telemetry, or any backend controlled by this repository.

### What data is used

- Selected text on the current page
- Your configured Inworld API key
- Optional LLM API key and translation settings
- Playback settings stored in extension local storage

### Where data is stored

- Settings are stored locally in `chrome.storage.local`
- API keys are not written into repository files
- This project does not upload settings to any server it controls

### What data is sent out

- Selected text is sent to `https://api.inworld.ai/*` when speech synthesis is requested
- Selected text may also be sent to your configured OpenAI-compatible translation endpoint when translate-then-speak is enabled
- Voice list requests are sent to `https://api.inworld.ai/*`

### Why `<all_urls>` is requested

The extension injects a content script so it can detect text selections, show the floating action button, display the mini player, and highlight spoken words on regular webpages.

The repository code does not collect browsing history, does not scrape page content in the background, and only acts on the current page when the content script is loaded there.

### Distribution note

If you plan to publish this extension broadly, consider moving API calls behind your own backend instead of exposing shared API keys directly in the client.

---

## 隐私与权限说明

这个扩展主要面向个人使用，不包含分析、埋点，也没有由本仓库维护的后端服务。

### 会使用哪些数据

- 当前页面中你选中的文本
- 你配置的 Inworld API Key
- 可选的 LLM API Key 和翻译设置
- 保存在扩展本地存储中的播放设置

### 数据存储在哪里

- 设置保存在 `chrome.storage.local`
- API Key 不会写入仓库文件
- 本项目不会把你的设置上传到它自己控制的服务器

### 哪些数据会被发送出去

- 发起语音合成时，选中文本会被发送到 `https://api.inworld.ai/*`
- 如果开启“先翻译再朗读”，选中文本还会被发送到你配置的 OpenAI 兼容翻译接口
- 拉取声音列表时会请求 `https://api.inworld.ai/*`

### 为什么需要 `<all_urls>`

扩展需要把内容脚本注入网页，才能检测划词、显示悬浮按钮、显示迷你播放器，以及在朗读时做逐词高亮。

本仓库中的代码不会在后台收集浏览历史，也不会静默抓取页面内容；只有内容脚本被注入到当前页面后，才会在该页面上响应交互。

### 分发建议

如果你准备公开分发这个扩展，建议把 API 调用改成你自己的服务端代理，而不是把共享密钥直接暴露在客户端。
