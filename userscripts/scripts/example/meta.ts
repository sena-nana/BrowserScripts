import { defineUserscriptMeta } from '@browserscripts/build-kit';

export default defineUserscriptMeta({
  id: 'example',
  name: 'BrowserScripts Example',
  namespace: 'https://github.com/wangjunxue/BrowserScripts',
  version: '0.1.0',
  description: 'Minimal example userscript for the BrowserScripts scaffold.',
  match: 'https://example.com/*',
  grant: [],
  runAt: 'document-end',
  injectInto: 'auto',
  noframes: true
});
