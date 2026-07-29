import { createLogger, injectStyle, onUrlChange, installDebugBridge } from '@browserscripts/vm-kit';
import styleText from './style.css';

const scriptId = 'bilibili-site-toolkit';
const log = createLogger(scriptId, { debug: __DEV__ });

function run(): void {
  injectStyle(styleText, `vm-${scriptId}-style`);
  document.documentElement.classList.toggle(
    'vm-bilibili-space',
    location.hostname === 'space.bilibili.com'
  );
  document.documentElement.classList.toggle(
    'vm-bilibili-dynamic',
    location.hostname === 't.bilibili.com'
  );
  document.documentElement.classList.toggle(
    'vm-bilibili-video',
    location.pathname.startsWith('/video/')
  );
  revealTags();
  log.debug('route ready', location.href);
}

function revealTags(): void {
  document
    .querySelectorAll<HTMLElement>('.tag-panel .tag, .video-tag-container .tag')
    .forEach((tag) => {
      tag.style.display = '';
      tag.style.maxWidth = 'none';
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
