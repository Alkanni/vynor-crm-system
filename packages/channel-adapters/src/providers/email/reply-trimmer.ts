/**
 * Removes the quoted history that mail clients append below a reply, so the inbox shows only
 * what the customer just wrote. Conservative: when unsure, the text is kept.
 */

const REPLY_HEADER_PATTERNS = [
  // Gmail / Apple Mail (English): "On Tue, 1 Oct 2026 at 10:00, Budi <budi@x.com> wrote:"
  /^On\b.{0,200}\bwrote:\s*$/i,
  // Gmail (Indonesian): "Pada tanggal Sel, 1 Okt 2026 pukul 10.00 Budi <budi@x.com> menulis:"
  /^Pada\b.{0,200}\bmenulis:\s*$/i,
  // Outlook
  /^-{2,}\s*Original Message\s*-{2,}\s*$/i,
  /^-{2,}\s*Pesan Asli\s*-{2,}\s*$/i,
  /^_{10,}\s*$/,
  /^From:\s.+$/i,
  /^Dari:\s.+$/i,
];

export function stripQuotedReply(text: string): string {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  let cut = lines.length;

  for (let i = 0; i < lines.length; i++) {
    const line = (lines[i] ?? '').trim();
    if (REPLY_HEADER_PATTERNS.some((pattern) => pattern.test(line))) {
      // "From:" only counts as a reply header when followed by other header lines (Outlook).
      if (/^(From|Dari):/i.test(line)) {
        const next = (lines[i + 1] ?? '').trim();
        if (!/^(Sent|Date|To|Terkirim|Tanggal|Kepada):/i.test(next)) continue;
      }
      cut = i;
      break;
    }
  }

  let kept = lines.slice(0, cut);
  // Drop a trailing block of ">" quoted lines.
  while (kept.length > 0 && /^\s*(>|$)/.test(kept[kept.length - 1] ?? '')) {
    kept = kept.slice(0, -1);
  }
  return kept.join('\n').trim();
}
