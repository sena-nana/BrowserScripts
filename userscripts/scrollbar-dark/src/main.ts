import { createLogger, injectStyle, installDebugBridge } from '@browserscripts/vm-kit';
import styleText from './style.css';

const scriptId = 'scrollbar-dark';
const log = createLogger(scriptId, { debug: __DEV__ });

function run(): void {
  injectStyle(styleText, `vm-${scriptId}-style`);
  document.documentElement.classList.add('vm-scrollbar-dark');
  log.debug('style ready', location.href);
}

run();

if (__DEV__) {
  installDebugBridge(scriptId, {
    rerun: run,
    state: () => ({
      active: document.documentElement.classList.contains('vm-scrollbar-dark'),
      url: location.href
    }),
    stop: () => document.documentElement.classList.remove('vm-scrollbar-dark')
  });
}
