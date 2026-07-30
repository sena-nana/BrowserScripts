const messages = {
  en: {
    addBookmark: "Add bookmark",
    addBookmarkItem: "Add bookmark or folder",
    addFolder: "Add folder",
    bookmarkTree: "Bookmark tree",
    bookmarks: "Bookmarks",
    background: "Background",
    backdropBlur: "Background blur",
    backgroundInvalid: "Choose a supported image smaller than 12 MB.",
    cancel: "Cancel",
    chooseBackground: "Choose background",
    collapseBookmarks: "Collapse bookmarks",
    compact: "Compact",
    confirmDeleteBookmark: "Delete this bookmark?",
    confirmDeleteFolder: "Delete this folder and all bookmarks inside it?",
    create: "Create",
    custom: "Custom",
    customEngineName: "Search engine name",
    customSearchUrl: "Search URL containing {query}",
    delete: "Delete",
    deleteBookmark: "Delete bookmark",
    deleteFolder: "Delete folder",
    dark: "Dark",
    edit: "Edit",
    editBookmark: "Edit bookmark",
    editFolder: "Edit folder",
    filterBookmarks: "Filter bookmarks",
    folder: "Folder",
    history: "History",
    historySuggestions: "Show history suggestions",
    light: "Light",
    loading: "Loading…",
    menu: "Menu",
    move: "Move",
    moveTo: "Move to…",
    name: "Name",
    newBookmark: "New bookmark",
    newFolder: "New folder",
    noBookmarks: "No bookmarks found",
    online: "Web",
    onlineSuggestions: "Show online query suggestions",
    panelTransparency: "Panel transparency",
    openBookmarks: "Open bookmarks",
    openInNewTab: "Open in new tab",
    removeBackground: "Remove background",
    relaxed: "Relaxed",
    save: "Save",
    search: "Search",
    searchAppearance: "Appearance",
    searchEngine: "Search engine",
    searchPlaceholder: "Search {engine} or enter an address",
    settings: "Settings",
    sidebarWidth: "Sidebar width",
    sidebarDensity: "Sidebar density",
    standard: "Standard",
    system: "System",
    theme: "Theme",
    titleRequired: "Enter a name.",
    unableToSave: "Could not save the change.",
    url: "URL",
    urlInvalid: "Enter a valid HTTP or HTTPS address.",
  },
  zh_CN: {
    addBookmark: "添加书签",
    addBookmarkItem: "添加书签或文件夹",
    addFolder: "添加文件夹",
    bookmarkTree: "书签树",
    bookmarks: "书签",
    background: "背景",
    backdropBlur: "背景模糊",
    backgroundInvalid: "请选择小于 12 MB 的受支持图片。",
    cancel: "取消",
    chooseBackground: "选择背景",
    collapseBookmarks: "收起书签栏",
    compact: "紧凑",
    confirmDeleteBookmark: "确定删除这个书签吗？",
    confirmDeleteFolder: "确定删除此文件夹及其中的全部书签吗？",
    create: "创建",
    custom: "自定义",
    customEngineName: "搜索引擎名称",
    customSearchUrl: "包含 {query} 的搜索地址",
    delete: "删除",
    deleteBookmark: "删除书签",
    deleteFolder: "删除文件夹",
    dark: "深色",
    edit: "编辑",
    editBookmark: "编辑书签",
    editFolder: "编辑文件夹",
    filterBookmarks: "筛选书签",
    folder: "文件夹",
    history: "历史记录",
    historySuggestions: "显示历史记录建议",
    light: "浅色",
    loading: "正在加载…",
    menu: "菜单",
    move: "移动",
    moveTo: "移动到…",
    name: "名称",
    newBookmark: "新建书签",
    newFolder: "新建文件夹",
    noBookmarks: "未找到书签",
    online: "网页",
    onlineSuggestions: "显示在线查询建议",
    panelTransparency: "面板透明度",
    openBookmarks: "打开书签栏",
    openInNewTab: "在新标签页打开",
    removeBackground: "移除背景",
    relaxed: "宽松",
    save: "保存",
    search: "搜索",
    searchAppearance: "外观",
    searchEngine: "搜索引擎",
    searchPlaceholder: "使用 {engine} 搜索或输入网址",
    settings: "设置",
    sidebarWidth: "书签栏宽度",
    sidebarDensity: "侧边栏密度",
    standard: "标准",
    system: "跟随系统",
    theme: "主题",
    titleRequired: "请输入名称。",
    unableToSave: "无法保存更改。",
    url: "网址",
    urlInvalid: "请输入有效的 HTTP 或 HTTPS 地址。",
  },
} as const;

type Locale = keyof typeof messages;
export type MessageKey = keyof (typeof messages)["en"];

function resolveLocale(): Locale {
  const locale = chrome.i18n.getUILanguage().replace("-", "_");
  return locale.toLowerCase().startsWith("zh") ? "zh_CN" : "en";
}

const locale = resolveLocale();

export function t(
  key: MessageKey,
  replacements: Record<string, string> = {},
): string {
  let value: string = messages[locale][key] ?? messages.en[key];
  for (const [name, replacement] of Object.entries(replacements)) {
    value = value.replaceAll(`{${name}}`, replacement);
  }
  return value;
}

export function localizeDocument(root: ParentNode = document): void {
  document.documentElement.lang = locale === "zh_CN" ? "zh-CN" : "en";
  for (const element of root.querySelectorAll<HTMLElement>("[data-i18n]")) {
    const key = element.dataset.i18n as MessageKey;
    element.textContent = t(key);
  }
  for (const element of root.querySelectorAll<HTMLElement>(
    "[data-i18n-aria]",
  )) {
    const key = element.dataset.i18nAria as MessageKey;
    element.setAttribute("aria-label", t(key));
  }
  for (const element of root.querySelectorAll<HTMLInputElement>(
    "[data-i18n-placeholder]",
  )) {
    const key = element.dataset.i18nPlaceholder as MessageKey;
    element.placeholder = t(key);
  }
}
