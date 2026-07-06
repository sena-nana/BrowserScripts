export interface WorkCode {
  code: string;
  dlsiteUrl: string;
  asmrUrl?: string;
}

const workCodePattern = /\b(?:R[JE]|VJ|BJ)\d{6,8}\b/gi;

export function findWorkCodes(text: string): WorkCode[] {
  const seen = new Set<string>();
  const codes: WorkCode[] = [];

  for (const match of text.matchAll(workCodePattern)) {
    const code = match[0].toUpperCase();

    if (seen.has(code)) {
      continue;
    }

    seen.add(code);
    const item: WorkCode = {
      code,
      dlsiteUrl: toDlsiteUrl(code)
    };

    if (code.startsWith('RJ')) {
      item.asmrUrl = `https://asmr.one/work/${code}`;
    }

    codes.push(item);
  }

  return codes;
}

export function toDlsiteUrl(code: string): string {
  return `https://www.dlsite.com/maniax/work/=/product_id/${code.toUpperCase()}.html`;
}
