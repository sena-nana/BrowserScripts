import { defineUserscriptMeta } from '@browserscripts/build-kit';

export default defineUserscriptMeta({
  id: 'font-rendering-tuner',
  name: 'Font Rendering Tuner',
  namespace: 'https://github.com/wangjunxue/BrowserScripts',
  version: '0.1.0',
  description:
    'Adjust browser font rendering with local menu settings and explicit site exclusions.',
  match: ['http://*/*', 'https://*/*'],
  excludeMatch: [
    'https://*.bilibili.com/*',
    'https://www.zhihu.com/*',
    'https://zhuanlan.zhihu.com/*'
  ],
  grant: ['GM_addStyle', 'GM_getValue', 'GM_setValue', 'GM_registerMenuCommand'],
  runAt: 'document-start',
  injectInto: 'auto',
  noframes: true
});
