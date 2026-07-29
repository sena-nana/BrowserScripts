import { defineUserscriptMeta } from '@browserscripts/build-kit';

export default defineUserscriptMeta({
  id: 'dlsite-voice-links',
  name: 'DLsite Voice Links',
  namespace: 'https://github.com/wangjunxue/BrowserScripts',
  version: '0.1.0',
  description: 'Link RJ/VJ codes and add explicit DLsite to ASMR navigation on related sites.',
  match: [
    'https://www.dlsite.com/*',
    'https://ci-en.dlsite.com/*',
    'https://media.ci-en.jp/*',
    'https://asmr.one/*'
  ],
  grant: ['GM_addStyle'],
  runAt: 'document-end',
  injectInto: 'auto',
  noframes: true
});
