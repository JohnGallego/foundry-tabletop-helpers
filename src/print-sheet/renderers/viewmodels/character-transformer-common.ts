export function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function stripHtml(html: string, maxLength?: number): string {
  let stripped = html.replace(/&(?:amp;)?Reference\[([^\s\]]+)[^\]]*\]/gi, "$1");
  stripped = stripped.replace(/<[^>]*>/g, "").trim();
  return maxLength ? stripped.slice(0, maxLength) : stripped;
}

export function signStr(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`;
}

const ADV_SYMBOL = '<span class="fth-adv-symbol">▲<span>A</span></span>';
const DIS_SYMBOL = '<span class="fth-dis-symbol">▼<span>D</span></span>';

export function replaceAdvDisText(text: string): string {
  return text
    .replace(/\badvantage\b/gi, ADV_SYMBOL)
    .replace(/\bdisadvantage\b/gi, DIS_SYMBOL);
}
