import {
  createLink,
  createLogger,
  ensureElement,
  injectStyle,
  onUrlChange,
  installDebugBridge
} from '@browserscripts/vm-kit';
import styleText from './style.css';

const scriptId = 'google-play-download-links';
const log = createLogger(scriptId, { debug: __DEV__ });

function run(): void {
  injectStyle(styleText, `vm-${scriptId}-style`);
  renderMirrorLinks();
  log.debug('route ready', location.href);
}

function renderMirrorLinks(): void {
  const packageName = new URL(location.href).searchParams.get('id');

  if (!packageName) {
    return;
  }

  const target = document.querySelector<HTMLElement>('main h1')?.closest('div') ?? document.body;
  const panel = ensureElement('div', {
    id: 'vm-google-play-download-links',
    className: 'vm-google-play-download-links',
    parent: target
  });

  if (panel.dataset.packageName === packageName) {
    return;
  }

  panel.dataset.packageName = packageName;
  const mirrors: Array<[string, string]> = [
    [
      'APKMirror',
      `https://www.apkmirror.com/?post_type=app_release&searchtype=apk&s=${packageName}`
    ],
    ['APKPure', `https://apkpure.com/search?q=${packageName}`],
    ['APKCombo', `https://apkcombo.com/search/${packageName}`],
    ['APKPremier', `https://apkpremier.com/?s=${packageName}`]
  ];

  panel.replaceChildren(...mirrors.map(([label, href]) => createLink({ label, href })));
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
