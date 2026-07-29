import {
  createLogger,
  ensureElement,
  injectStyle,
  onUrlChange,
  installDebugBridge
} from '@browserscripts/vm-kit';
import { findWorkCodes } from './voice-parser.ts';
import styleText from './style.css';

const scriptId = 'dlsite-voice-links';
const log = createLogger(scriptId, { debug: __DEV__ });

function run(): void {
  injectStyle(styleText, `vm-${scriptId}-style`);
  renderWorkActions();
  linkifyVisibleCodes();
  log.debug('route ready', location.href);
}

function renderWorkActions(): void {
  if (!location.hostname.endsWith('dlsite.com')) {
    return;
  }

  const code = findWorkCodes(location.href)[0] ?? findWorkCodes(document.title)[0];

  if (!code?.asmrUrl || document.getElementById('vm-dlsite-voice-links-actions')) {
    return;
  }

  const host =
    document.querySelector<HTMLElement>('#work_name, h1')?.parentElement ?? document.body;
  const panel = ensureElement('div', {
    id: 'vm-dlsite-voice-links-actions',
    className: 'vm-dlsite-voice-links-actions',
    parent: host
  });
  const link = document.createElement('a');
  link.href = code.asmrUrl;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = 'ASMR';
  panel.replaceChildren(link);
}

function linkifyVisibleCodes(): void {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;

      if (!parent || parent.closest('a, script, style, textarea, input, .vm-dlsite-voice-link')) {
        return NodeFilter.FILTER_REJECT;
      }

      return findWorkCodes(node.nodeValue ?? '').length
        ? NodeFilter.FILTER_ACCEPT
        : NodeFilter.FILTER_REJECT;
    }
  });
  const textNodes: Text[] = [];

  while (textNodes.length < 80) {
    const node = walker.nextNode();

    if (!node) {
      break;
    }

    textNodes.push(node as Text);
  }

  for (const node of textNodes) {
    const text = node.nodeValue ?? '';
    const codes = findWorkCodes(text);

    if (!codes.length) {
      continue;
    }

    const fragment = document.createDocumentFragment();
    let cursor = 0;

    for (const item of codes) {
      const index = text.toUpperCase().indexOf(item.code, cursor);

      if (index < 0) {
        continue;
      }

      fragment.append(document.createTextNode(text.slice(cursor, index)));
      const link = document.createElement('a');
      link.className = 'vm-dlsite-voice-link';
      link.href = item.dlsiteUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = item.code;
      fragment.append(link);
      cursor = index + item.code.length;
    }

    fragment.append(document.createTextNode(text.slice(cursor)));
    node.replaceWith(fragment);
  }
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
