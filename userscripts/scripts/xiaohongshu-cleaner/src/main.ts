import {
  bindSelectedTextCopy,
  createLogger,
  injectStyle,
  onUrlChange,
  installDebugBridge
} from '@browserscripts/vm-kit';
import styleText from './style.css';

const scriptId = 'xiaohongshu-cleaner';
const log = createLogger(scriptId, { debug: __DEV__ });
let copyBound = false;
let appWakeupBlockerBound = false;

function run(): void {
  injectStyle(styleText, `vm-${scriptId}-style`);
  restoreCopy();
  dismissBlockingOverlays();
  normalizeLinks();
  bindAppWakeupBlocker();
  log.debug('route ready', location.href);
}

function restoreCopy(): void {
  if (copyBound) {
    return;
  }

  copyBound = true;
  bindSelectedTextCopy();
}

function dismissBlockingOverlays(): void {
  document
    .querySelectorAll<HTMLElement>(
      '.login-container, .login-modal, .mask, .download-app, .launch-app-container, .red-captcha'
    )
    .forEach((node) => {
      if (/登录|打开|下载|验证|扫码/.test(node.textContent ?? '')) {
        node.hidden = true;
      }
    });
}

function normalizeLinks(): void {
  document.querySelectorAll<HTMLAnchorElement>('a[href]').forEach((link) => {
    const href = link.getAttribute('href') ?? '';

    if (href.startsWith('xhsdiscover://') || href.startsWith('xhs://')) {
      link.removeAttribute('href');
      return;
    }

    const url = new URL(link.href, location.origin);
    const redirect = url.searchParams.get('redirect') ?? url.searchParams.get('target');

    if (redirect?.startsWith('https://www.xiaohongshu.com/')) {
      link.href = redirect;
    }
  });
}

function bindAppWakeupBlocker(): void {
  if (appWakeupBlockerBound) {
    return;
  }

  appWakeupBlockerBound = true;
  document.addEventListener(
    'click',
    (event) => {
      const link = (event.target as Element | null)?.closest?.(
        'a[href]'
      ) as HTMLAnchorElement | null;
      const href = link?.getAttribute('href') ?? '';

      if (href.startsWith('xhsdiscover://') || href.startsWith('xhs://')) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    },
    true
  );
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
