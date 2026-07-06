import { createLogger, injectStyle, installDebugBridge } from '@browserscripts/vm-kit';
import styleText from './style.css';

const scriptId = 'font-rendering-tuner';
const log = createLogger(scriptId, { debug: __DEV__ });
const enabledKey = `${scriptId}:enabled`;
const fontKey = `${scriptId}:font`;
const scaleKey = `${scriptId}:scale`;

function getEnabled(): boolean {
  return GM_getValue(enabledKey, true) === true;
}

function getFont(): string {
  return String(GM_getValue(fontKey, 'Microsoft YaHei, system-ui, sans-serif'));
}

function getScale(): number {
  return Math.min(1.12, Math.max(0.92, Number(GM_getValue(scaleKey, 1)) || 1));
}

function run(): void {
  injectStyle(styleText, `vm-${scriptId}-style`);
  document.documentElement.classList.toggle('vm-font-rendering-tuner-active', getEnabled());
  document.documentElement.style.setProperty('--vm-font-rendering-family', getFont());
  document.documentElement.style.setProperty('--vm-font-rendering-scale', String(getScale()));
  log.debug('style ready', location.href);
}

function registerMenu(): void {
  GM_registerMenuCommand(`${getEnabled() ? 'Disable' : 'Enable'} font rendering`, () => {
    GM_setValue(enabledKey, !getEnabled());
    run();
  });
  GM_registerMenuCommand('Use Microsoft YaHei', () => {
    GM_setValue(fontKey, 'Microsoft YaHei, system-ui, sans-serif');
    run();
  });
  GM_registerMenuCommand('Use system font', () => {
    GM_setValue(fontKey, 'system-ui, sans-serif');
    run();
  });
  GM_registerMenuCommand('Set custom font', () => {
    const next = window.prompt('Font family', getFont());

    if (!next?.trim()) {
      return;
    }

    GM_setValue(fontKey, next.trim());
    run();
  });
  GM_registerMenuCommand('Set font scale', () => {
    const next = window.prompt('Scale between 0.92 and 1.12', String(getScale()));
    const value = Number(next);

    if (!Number.isFinite(value)) {
      return;
    }

    GM_setValue(scaleKey, Math.min(1.12, Math.max(0.92, value)));
    run();
  });
  GM_registerMenuCommand('Reset font scale', () => {
    GM_setValue(scaleKey, 1);
    run();
  });
}

run();
registerMenu();

if (__DEV__) {
  installDebugBridge(scriptId, {
    rerun: run,
    state: () => ({
      enabled: getEnabled(),
      font: getFont(),
      scale: getScale(),
      url: location.href
    }),
    stop: () => document.documentElement.classList.remove('vm-font-rendering-tuner-active')
  });
}
