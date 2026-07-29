import { defineUserscriptMeta } from '@browserscripts/build-kit';

export default defineUserscriptMeta({
  id: 'bilibili-space-manager',
  name: 'Bilibili Space Manager',
  namespace: 'https://github.com/wangjunxue/BrowserScripts',
  version: '0.1.0',
  description: 'Read-only Bilibili space follow and dynamic management helpers.',
  match: ['https://space.bilibili.com/*'],
  grant: ['GM_addStyle', 'GM_xmlhttpRequest', 'GM_setClipboard'],
  connect: ['api.bilibili.com'],
  runAt: 'document-end',
  injectInto: 'auto',
  noframes: true
});
