export interface PanMatch {
  provider: string;
  label: string;
  url: string;
  code?: string;
}

interface ProviderPattern {
  provider: string;
  label: string;
  pattern: RegExp;
}

const providers: ProviderPattern[] = [
  {
    provider: 'baidu',
    label: 'Baidu Netdisk',
    pattern: /https?:\/\/(?:pan|yun)\.baidu\.com\/(?:s\/[\w~-]+|share\/[^\s"'<>]+)/i
  },
  {
    provider: 'aliyun',
    label: 'Aliyun Drive',
    pattern: /https?:\/\/(?:www\.)?(?:aliyundrive|alipan)\.com\/s\/[A-Za-z0-9]+/i
  },
  {
    provider: 'weiyun',
    label: 'Tencent Weiyun',
    pattern: /https?:\/\/share\.weiyun\.com\/[A-Za-z0-9]+/i
  },
  {
    provider: 'lanzou',
    label: 'Lanzou',
    pattern: /https?:\/\/(?:[\w-]+\.)?lanzou[a-z]?\.com\/[^\s"'<>]+/i
  },
  {
    provider: 'tianyi',
    label: 'Cloud 189',
    pattern: /https?:\/\/cloud\.189\.cn\/(?:t\/|web\/share\?code=)?[A-Za-z0-9]+/i
  },
  {
    provider: 'caiyun',
    label: 'China Mobile Cloud',
    pattern:
      /https?:\/\/(?:caiyun|yun)\.139\.com\/(?:m\/i|w\/i\/|web\/|front\/#\/detail)[^\s"'<>]*/i
  },
  {
    provider: 'xunlei',
    label: 'Xunlei Cloud',
    pattern: /https?:\/\/pan\.xunlei\.com\/s\/[\w-]{10,}/i
  },
  {
    provider: 'quark',
    label: 'Quark Cloud',
    pattern: /https?:\/\/pan\.quark\.cn\/s\/[A-Za-z0-9-]+/i
  },
  {
    provider: 'pan123',
    label: '123 Pan',
    pattern: /https?:\/\/(?:www\.)?123pan\.com\/s\/[A-Za-z0-9-]+/i
  },
  {
    provider: 'pan360',
    label: '360 Cloud',
    pattern: /https?:\/\/(?:yunpan|cloud)\.360\.cn\/[^\s"'<>]+/i
  },
  {
    provider: '115',
    label: '115 Cloud',
    pattern: /https?:\/\/(?:115\.com|anxia\.com)\/s\/[A-Za-z0-9]+/i
  },
  {
    provider: 'cowtransfer',
    label: 'CowTransfer',
    pattern: /https?:\/\/(?:cowtransfer\.com|c-t\.work)\/s\/[A-Za-z0-9]+/i
  },
  {
    provider: 'ctfile',
    label: 'CTFile',
    pattern: /https?:\/\/(?:www\.)?(?:ctfile|474b)\.com\/[^\s"'<>]+/i
  },
  {
    provider: 'flowus',
    label: 'FlowUs',
    pattern: /https?:\/\/flowus\.cn\/[^\s"'<>]+\/share\/[a-f0-9-]{36}/i
  },
  {
    provider: 'chrome-web-store',
    label: 'Chrome Web Store',
    pattern: /https?:\/\/chromewebstore\.google\.com\/detail\/[^\s"'<>]+/i
  },
  {
    provider: 'edge-addons',
    label: 'Edge Add-ons',
    pattern: /https?:\/\/microsoftedge\.microsoft\.com\/addons\/detail\/[^\s"'<>]+/i
  },
  {
    provider: 'firefox-addons',
    label: 'Firefox Add-ons',
    pattern: /https?:\/\/addons\.mozilla\.org\/[^\s"'<>]+/i
  }
];

export function parseExtractionCode(text: string): string | undefined {
  return (
    text.match(/(?:[?#&](?:p|pwd)=)([A-Za-z0-9]{3,8})/i)?.[1] ??
    text.match(/(?:提取|访问|取件|密)\s*(?:码|碼)?\s*[:：= ]\s*([A-Za-z0-9]{3,8})/i)?.[1] ??
    text.match(/(?:key|password|pwd)\s*[:：=]\s*([A-Za-z0-9]{3,8})/i)?.[1]
  );
}

export function findPanLinks(text: string): PanMatch[] {
  const matches: PanMatch[] = [];
  const seen = new Set<string>();
  const code = parseExtractionCode(text);

  for (const provider of providers) {
    for (const match of text.matchAll(new RegExp(provider.pattern.source, 'gi'))) {
      const url = normalizeUrl(match[0]);

      if (seen.has(url)) {
        continue;
      }

      seen.add(url);
      const item: PanMatch = {
        provider: provider.provider,
        label: provider.label,
        url
      };

      if (code) {
        item.code = code;
      }

      matches.push(item);
    }
  }

  return matches;
}

export function appendExtractionCode(match: PanMatch): string {
  if (!match.code) {
    return match.url;
  }

  const separator = match.url.includes('?') ? '&' : '?';
  return `${match.url}${separator}pwd=${encodeURIComponent(match.code)}#${encodeURIComponent(match.code)}`;
}

function normalizeUrl(url: string): string {
  return url.replace(/[),.，。]+$/u, '');
}
