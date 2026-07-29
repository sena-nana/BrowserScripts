import { defineUserscriptMeta } from '@browserscripts/build-kit';

export default defineUserscriptMeta({
  id: 'tieba-cleaner',
  name: 'Tieba Cleaner',
  namespace: 'https://github.com/wangjunxue/BrowserScripts',
  version: '0.1.0',
  description: 'Simplify Tieba reading pages and reduce ads, sidebars, and login prompts.',
  match: [
    'https://tieba.baidu.com/*',
    'https://dq.tieba.com/*',
    'https://jump.bdimg.com/*',
    'https://jump2.bdimg.com/*'
  ],
  excludeMatch: ['https://tieba.baidu.com/f/fdir*'],
  grant: ['GM_addStyle'],
  runAt: 'document-start',
  injectInto: 'auto',
  noframes: true
});
