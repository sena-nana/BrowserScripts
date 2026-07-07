# ChatGPT 实用增强

ChatGPT / chat.openai.com 的实用增强脚本。功能包括可选保持会话、阻止常见跟踪请求、发送前敏感内容脱敏、宽屏阅读、精简首页、自动继续生成、复用自己的消息、长对话单轮显示，以及在侧边栏显示会话时间和摘要。

## Install

```bash
yarn build chatgpt-practical-enhancer
```

Install `dist/chatgpt-practical-enhancer.user.js` in Violentmonkey.

## Scope

- Runs on `https://chatgpt.com/*` and `https://chat.openai.com/*`.
- Uses `GM_getValue` / `GM_setValue` for local feature settings and sensitive-content rules.
- Uses `GM_xmlhttpRequest` only for the current site session endpoint after keep-alive is enabled.
- Uses page injection and `unsafeWindow` so request interception and conversation-summary capture can hook page network APIs.

## Manual Verification

1. Build the script and install `dist/chatgpt-practical-enhancer.user.js` in Violentmonkey.
2. Open `https://chatgpt.com/` and confirm the `增强` entry appears in the sidebar or lower-left floating position.
3. Open the panel and confirm keep-alive shows as disabled by default.
4. Enable keep-alive, set an interval, refresh, and confirm the enabled state and interval persist.
5. Disable keep-alive and confirm `/api/auth/session` polling stops while the saved interval remains.
6. Toggle each option; confirm the switch state persists after refresh.
7. Add a sensitive-content rule, type matching text in the prompt, and confirm it is removed with a toast.
8. In a conversation, enable message reuse and confirm a `复用` button fills the prompt with your previous message.
9. Enable side-bar summary, open a conversation, and confirm visited conversations can show time or summary metadata in the sidebar.
10. Open a long conversation, enable single-turn display, and confirm only one question/answer turn is visible with a short-line navigator on the right side.
11. Click different right-side lines and confirm each line switches to the matching conversation turn and scrolls to the correct message.
12. Send a new message while single-turn display is enabled and confirm the view follows the latest turn.
13. Disable single-turn display and confirm all conversation messages are visible again and the right-side navigator is removed.
