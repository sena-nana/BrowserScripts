import {
  createLogger,
  injectStyle,
  observeDocument,
  onUrlChange,
  installDebugBridge
} from '@browserscripts/vm-kit';
import styleText from './style.css';

const scriptId = 'baidu-cleaner';
const log = createLogger(scriptId, { debug: __DEV__ });
let cleanupObserverStarted = false;
let cleanupTimer: number | undefined;

function run(): void {
  injectStyle(styleText, `vm-${scriptId}-style`);
  cleanSearchResults();
  startDynamicCleanup();
  log.debug('route ready', location.href);
}

function cleanSearchResults(): void {
  document
    .querySelectorAll<HTMLElement>('#content_left > div, #content_right > div')
    .forEach((item) => {
      const text = item.textContent ?? '';

      if (/广告|商业推广|推广链接|Sponsored/i.test(text)) {
        item.hidden = true;
      }
    });
}

function startDynamicCleanup(): void {
  if (cleanupObserverStarted) {
    return;
  }

  cleanupObserverStarted = true;
  observeDocument(() => {
    window.clearTimeout(cleanupTimer);
    cleanupTimer = window.setTimeout(cleanSearchResults, 100);
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
