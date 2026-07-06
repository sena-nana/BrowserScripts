import { defineUserscriptMeta } from '@browserscripts/build-kit';

export default defineUserscriptMeta({
  id: 'csdn-reader-cleaner',
  name: 'CSDN Reader Cleaner',
  namespace: 'https://github.com/wangjunxue/BrowserScripts',
  version: '0.1.0',
  description: 'Clean CSDN article pages, restore copy behavior, and reduce login distractions.',
  match: ['https://*.csdn.net/*'],
  grant: ['GM_addStyle', 'GM_setClipboard'],
  runAt: 'document-start',
  injectInto: 'auto',
  noframes: true
});
