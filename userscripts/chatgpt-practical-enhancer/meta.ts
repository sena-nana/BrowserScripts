import { defineUserscriptMeta } from '@browserscripts/build-kit';

export default defineUserscriptMeta({
  id: 'chatgpt-practical-enhancer',
  name: 'ChatGPT 实用增强',
  namespace: 'https://github.com/wangjunxue/BrowserScripts',
  version: '35.1.0-clean',
  description:
    '保持会话、阻止跟踪、敏感内容脱敏、宽屏阅读、精简首页、自动继续生成、复用我的消息、长对话单轮显示、侧边栏摘要。',
  match: ['https://chatgpt.com/*', 'https://chat.openai.com/*'],
  grant: ['GM_addStyle', 'GM_setValue', 'GM_getValue', 'GM_xmlhttpRequest', 'unsafeWindow'],
  runAt: 'document-start',
  injectInto: 'page',
  connect: ['chatgpt.com', 'chat.openai.com'],
  noframes: true
});
