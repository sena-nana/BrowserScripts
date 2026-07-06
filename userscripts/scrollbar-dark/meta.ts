import { defineUserscriptMeta } from '@browserscripts/build-kit';

export default defineUserscriptMeta({
  id: 'scrollbar-dark',
  name: 'Scrollbar Dark',
  namespace: 'https://github.com/wangjunxue/BrowserScripts',
  version: '0.1.0',
  description: 'Apply a narrow dark scrollbar style globally with known site exclusions.',
  match: ['http://*/*', 'https://*/*'],
  excludeMatch: [
    'https://*.bilibili.com/*',
    'https://www.zhihu.com/*',
    'https://zhuanlan.zhihu.com/*',
    'https://www.baidu.com/*'
  ],
  grant: [],
  runAt: 'document-start',
  injectInto: 'auto',
  noframes: true
});
