import {
  copyWithNotice,
  createButton,
  createLogger,
  ensureFloatingPanel,
  injectStyle,
  onUrlChange,
  installDebugBridge
} from '@browserscripts/vm-kit';
import styleText from './style.css';

const scriptId = 'pan-download-helper';
const log = createLogger(scriptId, { debug: __DEV__ });

function run(): void {
  injectStyle(styleText, `vm-${scriptId}-style`);
  renderHelper();
  log.debug('route ready', location.href);
}

function renderHelper(): void {
  if (document.getElementById('vm-pan-download-helper')) {
    return;
  }

  const panel = ensureFloatingPanel({
    id: 'vm-pan-download-helper',
    className: 'vm-pan-download-helper'
  });
  const copyLink = createButton({ label: '复制页面下载链接', onClick: copyVisibleDownloadLink });
  const copyCurl = createButton({ label: '复制 cURL 命令', onClick: () => copyCommand('curl') });
  const copyAria = createButton({ label: '复制 aria2 命令', onClick: () => copyCommand('aria2') });
  panel.replaceChildren(copyLink, copyCurl, copyAria);
}

interface VisibleDownloadLink {
  filename: string;
  url: string;
}

function findVisibleDownloadLinks(): VisibleDownloadLink[] {
  const anchors = [...document.querySelectorAll<HTMLAnchorElement>('a[href]')];
  return anchors
    .filter((anchor) => {
      const href = anchor.href;
      const text = anchor.textContent ?? '';
      return /^https?:\/\//.test(href) && /下载|download|保存|dlink/i.test(`${text} ${href}`);
    })
    .map((anchor, index) => ({
      filename: deriveFilename(anchor, index),
      url: anchor.href
    }));
}

function deriveFilename(anchor: HTMLAnchorElement, index: number): string {
  return (
    anchor.download ||
    anchor.getAttribute('title')?.trim() ||
    anchor.textContent?.trim().replace(/\s+/g, ' ') ||
    `download-${index + 1}.bin`
  );
}

function copyVisibleDownloadLink(): void {
  const links = findVisibleDownloadLinks();

  if (!links.length) {
    window.alert('当前页面没有找到明确的下载链接');
    return;
  }

  copyWithNotice(links.map((link) => link.url).join('\n'), '已复制下载链接');
}

function copyCommand(kind: 'curl' | 'aria2'): void {
  const links = findVisibleDownloadLinks();

  if (!links.length) {
    window.alert('当前页面没有找到明确的下载链接');
    return;
  }

  copyWithNotice(links.map((link) => buildCommand(kind, link)).join('\n'), '已复制命令');
}

function buildCommand(kind: 'curl' | 'aria2', link: VisibleDownloadLink): string {
  return kind === 'curl'
    ? `curl -L -C - ${quote(link.url)} -o ${quote(link.filename)}`
    : `aria2c -o ${quote(link.filename)} ${quote(link.url)}`;
}

function quote(value: string): string {
  return `"${value.replaceAll('"', '\\"')}"`;
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
