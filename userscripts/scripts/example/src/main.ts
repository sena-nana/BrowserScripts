import {
  createLogger,
  ensureElement,
  injectStyle,
  onUrlChange,
  installDebugBridge
} from '@browserscripts/vm-kit';
import styleText from './style.css';

const scriptId = 'example';
const markerId = 'vm-example-badge';
const log = createLogger(scriptId, { debug: __DEV__ });

function renderBadge(): void {
  injectStyle(styleText, 'vm-example-style');

  if (!document.body) {
    log.warn('document.body is not ready');
    return;
  }

  const badge = ensureElement('div', {
    id: markerId,
    className: 'vm-example-badge',
    textContent: 'VM Example active',
    parent: document.body
  });

  badge.setAttribute('role', 'status');
  badge.setAttribute('aria-live', 'polite');
  log.debug('badge rendered', location.href);
}

const stopUrlWatcher = onUrlChange(() => renderBadge());

if (__DEV__) {
  installDebugBridge(scriptId, {
    rerun: renderBadge,
    state: () => ({
      markerExists: Boolean(document.getElementById(markerId)),
      url: location.href
    }),
    stop: stopUrlWatcher
  });
}
