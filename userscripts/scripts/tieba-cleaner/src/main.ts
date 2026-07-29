import {
  createButton,
  createLogger,
  injectStyle,
  onUrlChange,
  installDebugBridge
} from '@browserscripts/vm-kit';
import styleText from './style.css';

const scriptId = 'tieba-cleaner';
const log = createLogger(scriptId, { debug: __DEV__ });

function run(): void {
  injectStyle(styleText, `vm-${scriptId}-style`);
  document.documentElement.classList.toggle('vm-tieba-thread', location.pathname.startsWith('/p/'));
  renderReverseButton();
  log.debug('route ready', location.href);
}

function renderReverseButton(): void {
  if (!location.pathname.startsWith('/p/') || document.getElementById('vm-tieba-reverse-posts')) {
    return;
  }

  const button = createButton({
    label: '倒序',
    onClick: reverseVisiblePosts
  });
  button.id = 'vm-tieba-reverse-posts';
  button.classList.add('vm-kit-floating-button');
  document.body.append(button);
}

function reverseVisiblePosts(): void {
  const list = document.querySelector<HTMLElement>('#j_p_postlist, .p_postlist');

  if (!list) {
    window.alert('未找到帖子列表');
    return;
  }

  const posts = [...list.querySelectorAll<HTMLElement>('.l_post, .j_l_post')];

  for (const post of posts.reverse()) {
    list.append(post);
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
