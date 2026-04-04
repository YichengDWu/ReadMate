# Inworld Selection TTS

English | [简体中文](./README.zh-CN.md)

A Chrome / Edge Manifest V3 extension that reads selected text aloud with Inworld TTS. Select text on any webpage, click the floating action, and the extension will synthesize and play speech directly in the page.

Disclaimer: this project was vibe coded with Codex.

## Features

- Shows a floating speak button after text selection
- Optionally translates the selected text with an OpenAI-compatible LLM before sending it to Inworld TTS
- Supports switching the extension UI between English and Simplified Chinese
- Highlights the currently spoken word during playback
- Displays a draggable mini player in the bottom-right corner
- Supports seek by dragging the progress bar
- Optionally auto-plays immediately after selection
- Supports speaking the current selection and stopping playback from the popup
- Adds a context menu action for selected text
- Includes an options page for:
  - Saving the Inworld API key
  - Configuring the Voice ID
  - Choosing `inworld-tts-1.5-mini` or `inworld-tts-1.5-max`
  - Toggling word-level highlighting
  - Filtering and loading available voices
  - Enabling translate-then-speak with target language, model, and LLM endpoint settings
  - Running local playback tests

## Project Structure

- `manifest.json`: extension manifest
- `i18n.js`: shared UI language strings and translation helpers
- `background.js`: Inworld and translation API calls
- `content.js` / `content.css`: selection detection, floating UI, and in-page audio playback
- `popup.*`: toolbar popup UI
- `options.*`: settings page

## Installation

1. Open Chrome or Edge.
2. Go to the extensions page:
   - Chrome: `chrome://extensions`
   - Edge: `edge://extensions`
3. Turn on Developer Mode.
4. Click "Load unpacked".
5. Select this directory:

```text
/Users/yichengwu/ethan/inworld-selection-tts-extension
```

## Initial Setup

1. Open the extension settings from the extension details page or toolbar popup.
2. Enter your Inworld API key.
3. Enter a Voice ID.
4. Choose a model and save.
5. If you want translate-then-speak, enable it and fill in the target language, translation model, and an OpenAI-compatible chat completions endpoint.
6. If you do not know which Voice ID to use, click "Load voices".

## API Usage

This extension currently uses the following Inworld APIs:

- TTS synthesis: `POST https://api.inworld.ai/tts/v1/voice`
- Voice list: `GET https://api.inworld.ai/voices/v1/voices`

If translate-then-speak is enabled, it also calls the configured OpenAI-compatible chat completions endpoint, for example:

- `POST https://api.openai.com/v1/chat/completions`

The Inworld request header uses:

```text
Authorization: Basic <YOUR_INWORLD_API_KEY>
```

Notes:

- Each Inworld synthesis request is limited to 2000 characters
- The default audio encoding is `LINEAR16`, which is played as WAV in the browser
- The default model is `inworld-tts-1.5-mini`
- Word highlighting requests `timestampType: WORD`
- Word highlighting is automatically disabled when translate-then-speak is enabled, because the timestamps now correspond to the translated text instead of the original page content

Word highlighting works best when:

- Inworld returns reliable word-level timestamps
- The source text is English or Spanish
- `applyTextNormalization` is set to `OFF` if timing appears misaligned

## Security Notes

This implementation is best suited for personal use:

- API keys are stored in `chrome.storage.local`
- Secrets are not written into repository files

If you plan to distribute this extension publicly, it is safer to move API access behind your own backend instead of shipping shared secrets directly to clients.
