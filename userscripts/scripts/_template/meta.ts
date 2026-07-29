import { defineUserscriptMeta } from '@browserscripts/build-kit';

export default defineUserscriptMeta({
  id: 'template-userscript',
  name: 'Template Userscript',
  namespace: 'https://github.com/wangjunxue/BrowserScripts',
  version: '0.1.0',
  description: 'Starter userscript template.',
  match: 'https://example.com/*',
  grant: [],
  runAt: 'document-end',
  injectInto: 'auto',
  noframes: true
});
