import {
  copyWithNotice,
  createButton,
  createLink,
  createLogger,
  ensureFloatingPanel,
  gmRequest,
  injectStyle,
  onUrlChange,
  installDebugBridge
} from '@browserscripts/vm-kit';
import styleText from './style.css';

const scriptId = 'bilibili-space-manager';
const log = createLogger(scriptId, { debug: __DEV__ });

interface RelationStatResponse {
  data?: {
    following?: number;
    follower?: number;
  };
}

function run(): void {
  injectStyle(styleText, `vm-${scriptId}-style`);
  renderPanel();
  log.debug('route ready', location.href);
}

function getSpaceUid(): string | null {
  return location.pathname.match(/^\/(\d+)/)?.[1] ?? null;
}

function renderPanel(): void {
  const uid = getSpaceUid();

  if (!uid) {
    return;
  }

  const panel = ensureFloatingPanel({
    id: 'vm-bilibili-space-manager',
    className: 'vm-bilibili-space-manager'
  });
  const title = document.createElement('div');
  title.className = 'vm-bilibili-space-manager-title';
  title.textContent = `UID ${uid}`;
  const summary = document.createElement('div');
  summary.className = 'vm-bilibili-space-manager-summary';
  summary.textContent = '加载关注概览';
  const actions = document.createElement('div');
  actions.className = 'vm-bilibili-space-manager-actions';
  actions.replaceChildren(
    createButton({ label: '复制 UID', onClick: () => copyWithNotice(uid) }),
    createButton({ label: '复制当前页条目', onClick: copyVisibleCards }),
    createLink({ label: '动态', href: `https://space.bilibili.com/${uid}/dynamic` }),
    createLink({ label: '收藏', href: `https://space.bilibili.com/${uid}/favlist` })
  );
  panel.replaceChildren(title, summary, actions);
  loadRelationSummary(uid, summary);
}

async function loadRelationSummary(uid: string, target: HTMLElement): Promise<void> {
  try {
    const response = await gmRequest<RelationStatResponse>({
      method: 'GET',
      url: `https://api.bilibili.com/x/relation/stat?vmid=${encodeURIComponent(uid)}`,
      responseType: 'json'
    });
    const data = response.response?.data;
    target.textContent =
      data && typeof data.following === 'number'
        ? `关注 ${data.following} / 粉丝 ${data.follower}`
        : '概览不可用';
  } catch {
    target.textContent = '概览加载失败';
  }
}

function copyVisibleCards(): void {
  const items = [
    ...document.querySelectorAll<HTMLElement>(
      '.bili-video-card, .fav-video-list li, .bili-dyn-list__item'
    )
  ]
    .map((node) => {
      const title =
        node
          .querySelector<HTMLElement>(
            '.bili-video-card__info--tit, .title, .bili-dyn-title, .bili-dyn-content__orig__desc'
          )
          ?.textContent?.trim() ?? node.textContent?.trim();
      const link = node.querySelector<HTMLAnchorElement>(
        'a[href*="/video/"], a[href*="/opus/"], a[href*="/dynamic/"]'
      );
      const href = link ? new URL(link.href, location.origin).href : '';
      const bv = href.match(/\/video\/(BV[\w]+)/)?.[1] ?? href.match(/[?&]bvid=(BV[\w]+)/)?.[1];
      return [title, bv, href].filter(Boolean).join(' | ');
    })
    .filter((text): text is string => Boolean(text));

  if (!items.length) {
    window.alert('当前页面没有可复制条目');
    return;
  }

  copyWithNotice(items.slice(0, 80).join('\n'));
}
const stopUrlWatcher = onUrlChange(() => run());

if (__DEV__) {
  installDebugBridge(scriptId, {
    rerun: run,
    state: () => ({
      uid: getSpaceUid(),
      url: location.href
    }),
    stop: stopUrlWatcher
  });
}
