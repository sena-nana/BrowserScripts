import { defineUserscriptMeta } from '@browserscripts/build-kit';

export default defineUserscriptMeta({
  id: 'google-play-download-links',
  name: 'Google Play Download Links',
  namespace: 'https://github.com/wangjunxue/BrowserScripts',
  version: '0.1.0',
  description: 'Add user-triggered public mirror search links on Google Play app pages.',
  match: ['https://play.google.com/store/apps/details*'],
  grant: ['GM_addStyle'],
  runAt: 'document-end',
  injectInto: 'auto',
  noframes: true
});
