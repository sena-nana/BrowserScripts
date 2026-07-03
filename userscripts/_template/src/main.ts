import { createLogger, injectStyle, onUrlChange } from '@browserscripts/vm-kit';
import { installDebugBridge } from './debug.ts';
import styleText from './style.css';

const scriptId = 'template-userscript';
const log = createLogger(scriptId, { debug: __DEV__ });

function run(): void {
  injectStyle(styleText, `vm-${scriptId}-style`);
  log.debug('route ready', location.href);
}

const stopUrlWatcher = onUrlChange(() => run());

if (__DEV__) {
  installDebugBridge({
    rerun: run,
    state: () => ({
      url: location.href
    }),
    stop: stopUrlWatcher
  });
}
