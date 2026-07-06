import {
  bindSelectedTextCopy,
  createLogger,
  injectStyle,
  onUrlChange,
  installDebugBridge
} from '@browserscripts/vm-kit';
import styleText from './style.css';

const scriptId = 'csdn-reader-cleaner';
const log = createLogger(scriptId, { debug: __DEV__ });
let copyBound = false;

function run(): void {
  injectStyle(styleText, `vm-${scriptId}-style`);
  restoreCopy();
  unwrapArticle();
  normalizeRedirectLinks();
  log.debug('route ready', location.href);
}

function restoreCopy(): void {
  document.body?.classList.add('vm-csdn-copy-ready');

  if (copyBound) {
    return;
  }

  copyBound = true;
  bindSelectedTextCopy();
}

function unwrapArticle(): void {
  document
    .querySelectorAll<HTMLElement>('#article_content, .blog-content-box, .htmledit_views')
    .forEach((article) => {
      article.style.maxHeight = 'none';
      article.style.height = 'auto';
      article.style.overflow = 'visible';
      article.classList.remove('hide-article-box');
    });
}

function normalizeRedirectLinks(): void {
  document
    .querySelectorAll<HTMLAnchorElement>('a[href*="link.csdn.net/?target="]')
    .forEach((link) => {
      const target = new URL(link.href).searchParams.get('target');

      if (!target) {
        return;
      }

      link.href = decodeURIComponent(target);
      link.rel = 'noopener noreferrer';
    });
}

const stopUrlWatcher = onUrlChange(() => run());

if (__DEV__) {
  installDebugBridge(scriptId, {
    rerun: run,
    state: () => ({
      url: location.href
    }),
    stop: stopUrlWatcher
  });
}
