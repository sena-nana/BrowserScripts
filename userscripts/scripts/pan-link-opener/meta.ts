import { defineUserscriptMeta } from '@browserscripts/build-kit';

export default defineUserscriptMeta({
  id: 'pan-link-opener',
  name: 'Pan Link Opener',
  namespace: 'https://github.com/wangjunxue/BrowserScripts',
  version: '0.1.0',
  description:
    'Recognize cloud-drive links and extraction codes, then open or fill them after user action.',
  match: ['http://*/*', 'https://*/*'],
  excludeMatch: ['https://accounts.google.com/*', 'https://login.microsoftonline.com/*'],
  grant: ['GM_openInTab'],
  runAt: 'document-end',
  injectInto: 'auto',
  noframes: true
});
