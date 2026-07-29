import {
  confirmAction,
  createButton,
  createLogger,
  onUrlChange,
  installDebugBridge
} from '@browserscripts/vm-kit';
import { appendExtractionCode, findPanLinks, parseExtractionCode } from './pan-parser.ts';

const scriptId = 'pan-link-opener';
const log = createLogger(scriptId, { debug: __DEV__ });

function run(): void {
  fillKnownExtractionCode();
  renderSelectedLinkBar();
  log.debug('route ready', location.href);
}

function fillKnownExtractionCode(): void {
  const code = parseExtractionCode(
    `${location.search} ${decodeURIComponent(location.hash.slice(1))}`
  );

  if (!code) {
    return;
  }

  const input = document.querySelector<HTMLInputElement>(
    '#accessCode, .share-access-code, input[type="password"], input[name="pwd"], input[placeholder*="提取"], input[placeholder*="访问"]'
  );

  if (!input || input.value) {
    return;
  }

  input.value = code;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

function renderSelectedLinkBar(): void {
  if (document.getElementById('vm-pan-link-opener')) {
    return;
  }

  const bar = createButton({
    label: '打开选中网盘链接',
    onClick: openSelectedPanLink
  });
  bar.id = 'vm-pan-link-opener';
  bar.classList.add('vm-kit-floating-button');
  bar.hidden = !findPanLinks(window.getSelection()?.toString() ?? '').length;
  document.body.append(bar);
  document.addEventListener('selectionchange', syncSelectedLinkButton);
}

function syncSelectedLinkButton(): void {
  const bar = document.getElementById('vm-pan-link-opener') as HTMLButtonElement | null;

  if (!bar) {
    return;
  }

  bar.hidden = !findPanLinks(window.getSelection()?.toString() ?? '').length;
}

function openSelectedPanLink(): void {
  const selectedText = window.getSelection()?.toString() ?? '';
  const match = findPanLinks(selectedText)[0];

  if (!match) {
    window.alert('未识别到网盘链接');
    return;
  }

  confirmAction(`打开 ${match.label} 链接？`, () => {
    GM_openInTab(appendExtractionCode(match), { active: true });
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
