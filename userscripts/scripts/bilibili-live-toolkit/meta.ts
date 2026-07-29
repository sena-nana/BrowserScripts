import { defineUserscriptMeta } from '@browserscripts/build-kit';

export default defineUserscriptMeta({
  id: 'bilibili-live-toolkit',
  name: 'Bilibili Live Toolkit',
  namespace: 'https://github.com/wangjunxue/BrowserScripts',
  version: '0.1.0',
  description: 'Bilibili live room cleanup, room info, and opt-in playback catch-up helpers.',
  match: ['https://live.bilibili.com/*'],
  grant: ['GM_addStyle', 'GM_getValue', 'GM_setValue', 'GM_xmlhttpRequest'],
  connect: ['api.live.bilibili.com'],
  runAt: 'document-end',
  injectInto: 'auto',
  noframes: true
});
