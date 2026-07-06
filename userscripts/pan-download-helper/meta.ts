import { defineUserscriptMeta } from '@browserscripts/build-kit';

export default defineUserscriptMeta({
  id: 'pan-download-helper',
  name: 'Pan Download Helper',
  namespace: 'https://github.com/wangjunxue/BrowserScripts',
  version: '0.1.0',
  description:
    'User-triggered cloud-drive command and link copy helpers without token or cookie scraping.',
  match: [
    'https://pan.baidu.com/*',
    'https://yun.baidu.com/*',
    'https://www.aliyundrive.com/*',
    'https://www.alipan.com/*',
    'https://cloud.189.cn/*',
    'https://pan.xunlei.com/*',
    'https://pan.quark.cn/*',
    'https://yun.139.com/*',
    'https://caiyun.139.com/*'
  ],
  grant: ['GM_addStyle', 'GM_setClipboard'],
  runAt: 'document-end',
  injectInto: 'auto',
  noframes: true
});
