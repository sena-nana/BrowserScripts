import {
  createLogger,
  ensureFloatingPanel,
  gmRequest,
  injectStyle,
  onUrlChange,
  installDebugBridge
} from '@browserscripts/vm-kit';
import styleText from './style.css';

const scriptId = 'bilibili-live-toolkit';
const log = createLogger(scriptId, { debug: __DEV__ });
const autoSeekKey = `${scriptId}:auto-seek`;
let seekTimer: number | undefined;

interface LiveRoomInfoResponse {
  data?: {
    room_info?: {
      area_name?: string;
      live_start_time?: number;
      online?: number;
      title?: string;
    };
    anchor_info?: {
      base_info?: {
        uname?: string;
      };
    };
    watched_show?: {
      num?: number;
      text_small?: string;
    };
  };
}

function run(): void {
  injectStyle(styleText, `vm-${scriptId}-style`);
  renderPanel();
  syncAutoSeek();
  log.debug('route ready', location.href);
}

function getRoomId(): string | null {
  const match = location.pathname.match(/^\/(?:blanc\/)?(\d+)/);
  return match?.[1] ?? null;
}

function renderPanel(): void {
  const roomId = getRoomId();

  if (!roomId) {
    return;
  }

  const panel = ensureFloatingPanel({
    id: 'vm-bilibili-live-toolkit',
    className: 'vm-bilibili-live-toolkit'
  });
  const title = document.createElement('div');
  title.className = 'vm-bilibili-live-toolkit-title';
  title.textContent = `直播间 ${roomId}`;
  const info = document.createElement('div');
  info.className = 'vm-bilibili-live-toolkit-info';
  info.textContent = '加载中';
  const seekToggle = document.createElement('button');
  seekToggle.type = 'button';
  seekToggle.textContent = isAutoSeekEnabled() ? '追帧开' : '追帧关';
  seekToggle.addEventListener('click', () => {
    GM_setValue(autoSeekKey, !isAutoSeekEnabled());
    syncAutoSeek();
    seekToggle.textContent = isAutoSeekEnabled() ? '追帧开' : '追帧关';
  });
  panel.replaceChildren(title, info, seekToggle);
  loadRoomInfo(roomId, info);
}

async function loadRoomInfo(roomId: string, target: HTMLElement): Promise<void> {
  try {
    const response = await gmRequest<LiveRoomInfoResponse>({
      method: 'GET',
      url: `https://api.live.bilibili.com/xlive/web-room/v1/index/getInfoByRoom?room_id=${encodeURIComponent(roomId)}`,
      responseType: 'json'
    });
    const data = response.response?.data;
    const room = data?.room_info;
    const anchor = data?.anchor_info?.base_info;
    const title = [anchor?.uname, room?.title].filter(Boolean).join(' - ');
    const stats = [
      room?.area_name,
      formatCount(room?.online ?? data?.watched_show?.num),
      data?.watched_show?.text_small
    ].filter(Boolean);
    target.textContent = [title || '已连接', stats.join(' / ')].filter(Boolean).join('\n');
  } catch {
    target.textContent = '信息加载失败';
  }
}

function formatCount(value: number | undefined): string | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return undefined;
  }

  if (value >= 10000) {
    return `${(value / 10000).toFixed(1)}万`;
  }

  return `${value}`;
}

function isAutoSeekEnabled(): boolean {
  return Boolean(GM_getValue(autoSeekKey, false));
}

function syncAutoSeek(): void {
  if (seekTimer !== undefined) {
    window.clearInterval(seekTimer);
    seekTimer = undefined;
  }

  if (!isAutoSeekEnabled()) {
    return;
  }

  seekTimer = window.setInterval(catchUpVideo, 3000);
  catchUpVideo();
}

function catchUpVideo(): void {
  const video = document.querySelector<HTMLVideoElement>('video');

  if (!video || video.buffered.length === 0) {
    return;
  }

  const liveEdge = video.buffered.end(video.buffered.length - 1);

  if (Number.isFinite(liveEdge) && liveEdge - video.currentTime > 8) {
    video.currentTime = Math.max(video.currentTime, liveEdge - 2);
  }
}

const stopUrlWatcher = onUrlChange(() => run());

if (__DEV__) {
  installDebugBridge(scriptId, {
    rerun: run,
    state: () => ({
      autoSeek: isAutoSeekEnabled(),
      roomId: getRoomId(),
      url: location.href
    }),
    stop: () => {
      stopUrlWatcher();
      if (seekTimer !== undefined) {
        window.clearInterval(seekTimer);
      }
    }
  });
}
