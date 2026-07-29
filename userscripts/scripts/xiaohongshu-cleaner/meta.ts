import { defineUserscriptMeta } from '@browserscripts/build-kit';

export default defineUserscriptMeta({
  id: 'xiaohongshu-cleaner',
  name: 'Xiaohongshu Cleaner',
  namespace: 'https://github.com/wangjunxue/BrowserScripts',
  version: '0.1.0',
  description: 'Reduce Xiaohongshu login popups, app prompts, ads, and copy restrictions.',
  match: ['https://www.xiaohongshu.com/*'],
  grant: ['GM_addStyle', 'GM_setClipboard'],
  runAt: 'document-start',
  injectInto: 'auto',
  noframes: true
});
