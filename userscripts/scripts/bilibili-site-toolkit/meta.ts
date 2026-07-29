import { defineUserscriptMeta } from '@browserscripts/build-kit';

export default defineUserscriptMeta({
  id: 'bilibili-site-toolkit',
  name: 'Bilibili Site Toolkit',
  namespace: 'https://github.com/wangjunxue/BrowserScripts',
  version: '0.1.0',
  description: 'Lightweight Bilibili layout cleanup and page readability helpers.',
  match: ['https://www.bilibili.com/*', 'https://t.bilibili.com/*', 'https://space.bilibili.com/*'],
  grant: ['GM_addStyle'],
  runAt: 'document-start',
  injectInto: 'auto',
  noframes: true
});
