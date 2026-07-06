import { defineUserscriptMeta } from '@browserscripts/build-kit';

export default defineUserscriptMeta({
  id: 'baidu-cleaner',
  name: 'Baidu Cleaner',
  namespace: 'https://github.com/wangjunxue/BrowserScripts',
  version: '0.1.0',
  description: 'Clean common Baidu search, Baike, Zhidao, Wenku, and Tieba distractions.',
  match: ['https://*.baidu.com/*'],
  grant: ['GM_addStyle'],
  runAt: 'document-start',
  injectInto: 'auto',
  noframes: true
});
