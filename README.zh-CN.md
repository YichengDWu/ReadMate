# Inworld Selection TTS

[English](./README.md) | 简体中文

一个从零实现的 Chrome / Edge Manifest V3 扩展：在网页里划词后，点击悬浮按钮即可调用 Inworld TTS 朗读。

免责声明：本项目是使用 Codex vibe code 出来的。

## 功能

- 划词后显示悬浮“朗读”按钮
- 可选先调用一个 OpenAI 兼容 LLM 把选中文本翻译为指定语言，再交给 Inworld TTS
- 支持把扩展界面在简体中文和 English 之间切换
- 朗读时逐词高亮当前播放位置
- 播放时显示右下角迷你播放器悬浮窗
- 迷你播放器支持拖动位置和拖动进度条快进
- 可选开启“划完词后自动播放”
- 扩展弹窗支持“朗读当前选中文本”和“停止播放”
- 右键菜单支持“用 Inworld 朗读所选文本”
- 设置页支持：
  - 保存 Inworld API Key
  - 配置 Voice ID
  - 选择 `inworld-tts-1.5-mini` 或 `inworld-tts-1.5-max`
  - 开关逐词高亮
  - 可选语言过滤并拉取可用声音列表
  - 可选开启“先翻译再朗读”，并指定目标语言、翻译模型、LLM 接口地址
  - 本地测试朗读

## 目录结构

- `manifest.json`：扩展入口
- `i18n.js`：共享界面文案和语言切换辅助逻辑
- `background.js`：调用 Inworld API
- `content.js` / `content.css`：划词检测、悬浮 UI、页面内音频播放
- `popup.*`：工具栏弹窗
- `options.*`：配置页

## 安装方式

1. 打开 Chrome 或 Edge。
2. 进入扩展管理页：
   - Chrome: `chrome://extensions`
   - Edge: `edge://extensions`
3. 打开“开发者模式”。
4. 选择“加载已解压的扩展程序”。
5. 选中当前目录：

```text
/Users/yichengwu/ethan/inworld-selection-tts-extension
```

## 首次配置

1. 打开扩展详情页或工具栏弹窗，进入“设置”。
2. 填写你的 Inworld API Key。
3. 填写 Voice ID。
4. 选择模型并保存。
5. 如果你想先翻译再朗读，可以开启“先翻译再朗读”，填写目标语言、翻译模型，以及一个 OpenAI 兼容的聊天补全接口。
6. 如果你不知道可用 Voice ID，可以点“拉取声音列表”。

## Inworld API 说明

本扩展当前使用 Inworld 官方文档中的两个接口：

- TTS 合成：`POST https://api.inworld.ai/tts/v1/voice`
- 声音列表：`GET https://api.inworld.ai/voices/v1/voices`

如果开启“先翻译再朗读”，还会额外请求你配置的 OpenAI 兼容聊天补全接口，例如：

- `POST https://api.openai.com/v1/chat/completions`

请求头使用：

```text
Authorization: Basic <YOUR_INWORLD_API_KEY>
```

注意：

- 单次合成文本上限为 2000 字符
- 默认音频编码为 `LINEAR16`，浏览器侧按 WAV 播放
- 当前默认模型为 `inworld-tts-1.5-mini`
- 开启逐词高亮时，会额外请求 `timestampType: WORD`
- 开启“先翻译再朗读”后，逐词高亮会自动关闭，因为词级时间轴已经对应译文而不是网页原文

逐词高亮说明：

- 依赖 Inworld 返回的词级时间轴
- 对英语和西语更可靠，其他语言可能有偏差
- 如果高亮和发音不同步，可尝试把“文本规范化”切换为 `OFF`

## 安全边界

这份实现适合个人自用：

- API Key 存在扩展的 `chrome.storage.local`
- 密钥不会写入仓库文件

如果你要把扩展公开分发给其他人，建议改成服务端代理模式，不要把共享 API Key 直接交给客户端。
