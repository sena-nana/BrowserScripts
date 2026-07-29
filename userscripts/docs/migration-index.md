# Violentmonkey Reference Migration Index

Source folder: `C:/Users/wangjunxue/Downloads/violentmonkey_2026-07-06_20.01.12/`

The `violentmonkey` file is treated as an exported manager backup and source index, not as userscript source.

| Reference script                                               | Migrated userscript                              | Migration note                                                                                          |
| -------------------------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| `ChatGPT 实用增强.user.js`                                     | `chatgpt-practical-enhancer`                     | Existing repository version retained and reviewed as the canonical migration.                           |
| `Bilibili Live Tasks Helper.user.js`                           | `bilibili-live-toolkit`                          | Rebuilt passive live-room cleanup and info helpers; task automation is not mirrored.                    |
| `Bilibili直播自动追帧.user.js`                                 | `bilibili-live-toolkit`                          | Rebuilt as an opt-in video catch-up toggle.                                                             |
| `bilibili直播间显示更多信息.user.js`                           | `bilibili-live-toolkit`                          | Rebuilt lightweight room summary through Bilibili live API.                                             |
| `Bilibili Evolved 强化辅助 (非 Bilibili Evolved 本体).user.js` | `bilibili-site-toolkit`, `bilibili-live-toolkit` | Split into layout cleanup and live-room helpers; remote dependency removed.                             |
| `Bilibili Evolved (Preview).user.js`                           | `bilibili-site-toolkit`                          | Only lightweight layout/readability intent is migrated; full third-party project is not vendored.       |
| `[Bilibili] 关注管理器.user.js`                                | `bilibili-space-manager`                         | Rebuilt read-only overview and copy helpers; bulk follow/unfollow actions are not mirrored.             |
| `动态管理.user.js`                                             | `bilibili-space-manager`                         | Rebuilt navigation and copy helpers; delete/unfollow API operations are not mirrored.                   |
| `哔哩哔哩(B站-Bilibili)收藏夹Fix.user.js`                      | `bilibili-space-manager`                         | Rebuilt visible favorite item copying; external Biliplus lookup is not mirrored.                        |
| `「CSDNGreener」...user.js`                                    | `csdn-reader-cleaner`                            | Rebuilt article cleanup and copy restoration without remote libraries.                                  |
| `百度系网站去广告.user.js`                                     | `baidu-cleaner`                                  | Rebuilt CSS and DOM cleanup without jQuery.                                                             |
| `贴吧页面精简.user.js`                                         | `tieba-cleaner`                                  | Rebuilt reading-page simplification without jQuery.                                                     |
| `小红书优化.user.js`                                           | `xiaohongshu-cleaner`                            | Rebuilt login/app prompt cleanup and copy restoration without remote libraries.                         |
| `DLsite跳转到ASMR网站.user.js`                                 | `dlsite-voice-links`                             | Rebuilt RJ/VJ parsing and explicit ASMR navigation.                                                     |
| `VoiceLinks.user.js`                                           | `dlsite-voice-links`                             | Rebuilt core work-code linkification only; large popup/cache system is not mirrored.                    |
| `网盘智能识别助手.user.js`                                     | `pan-link-opener`                                | Rebuilt cloud-link/code parsing and user-confirmed opening/filling.                                     |
| `网盘直链下载助手.user.js`                                     | `pan-download-helper`                            | Rebuilt visible-link copy and command generation; cookie/token/direct-link bypass code is not mirrored. |
| `Direct download from Google Play.user.js`                     | `google-play-download-links`                     | Rebuilt as public mirror search links only; CAPTCHA and restricted download flows are not mirrored.     |
| `字体渲染（自用脚本）.user.js`                                 | `font-rendering-tuner`                           | Rebuilt local menu-based font tuning with explicit exclusions.                                          |
| `细滚动条(dark).user.js`                                       | `scrollbar-dark`                                 | Rebuilt global low-risk scrollbar styling with exclusions.                                              |
