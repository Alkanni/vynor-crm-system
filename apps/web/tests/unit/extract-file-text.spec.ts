import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { extractFileText } from '../../src/lib/ai-agents/extract-file-text';

// The modern pdf.js build (the one the app bundles) targets current browsers and calls the ES2025
// Uint8Array.prototype.toHex, which Node 24 does not have yet; pdfjs-dist 5.7 did the same. Supply
// it for this file only, so the production build itself is exercised.
const addsToHex = !('toHex' in Uint8Array.prototype);
beforeAll(() => {
  if (!addsToHex) return;
  Object.defineProperty(Uint8Array.prototype, 'toHex', {
    configurable: true,
    value(this: Uint8Array): string {
      return Array.from(this, (byte) => byte.toString(16).padStart(2, '0')).join('');
    },
  });
});
afterAll(() => {
  if (addsToHex) Reflect.deleteProperty(Uint8Array.prototype, 'toHex');
});

/**
 * Knowledge file extraction runs pdfjs-dist on untrusted uploads (VYN-02-01: pdfjs-dist >= 6.2.108
 * for GHSA-hq66-cqwq-w95j). The fixtures are built here, so no binary PDF is checked in: plain
 * Helvetica text pages, or a page without a content stream (what a scanned PDF looks like to text
 * extraction).
 */
function buildPdf(pages: string[][]): Uint8Array {
  const objects: string[] = [];
  const pageIds = pages.map((_, i) => 4 + i * 2);
  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[2] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pages.length} >>`;
  objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';
  pages.forEach((lines, i) => {
    const pageId = pageIds[i]!;
    const contentId = pageId + 1;
    const text = lines
      .map((line, n) => `${n === 0 ? '72 720 Td' : '0 -24 Td'} (${line}) Tj`)
      .join(' ');
    const stream = lines.length > 0 ? `BT /F1 18 Tf ${text} ET` : '';
    objects[pageId] =
      '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] ' +
      `/Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>`;
    objects[contentId] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  });

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];
  for (let id = 1; id < objects.length; id += 1) {
    offsets[id] = pdf.length;
    pdf += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objects.length; id += 1) {
    pdf += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(pdf);
}

function pdfFile(pages: string[][], name = 'knowledge.pdf'): File {
  return new File([buildPdf(pages)], name, { type: 'application/pdf' });
}

describe('extractFileText (knowledge files)', () => {
  it('extracts the text of every page of a PDF, in order', async () => {
    const result = await extractFileText(
      pdfFile([
        ['VYNOR knowledge fixture', 'Opening hours 09:00 to 17:00'],
        ['Second page about refunds'],
      ]),
    );

    expect(result.truncated).toBe(false);
    expect(result.text).toContain('VYNOR knowledge fixture');
    expect(result.text).toContain('Opening hours 09:00 to 17:00');
    expect(result.text).toContain('Second page about refunds');
    expect(result.text.indexOf('VYNOR knowledge fixture')).toBeLessThan(
      result.text.indexOf('Second page about refunds'),
    );
  });

  it('detects a PDF by its extension when the browser sends no MIME type', async () => {
    const file = new File([buildPdf([['Uploaded without a type']])], 'notes.PDF', { type: '' });

    await expect(extractFileText(file)).resolves.toMatchObject({
      text: 'Uploaded without a type',
    });
  });

  it('rejects a PDF without extractable text, as a scanned document would be', async () => {
    await expect(extractFileText(pdfFile([[]], 'scan.pdf'))).rejects.toThrow(
      'No text found in scan.pdf',
    );
  });

  it('rejects a file that is not a valid PDF', async () => {
    const file = new File([new TextEncoder().encode('not a pdf')], 'broken.pdf', {
      type: 'application/pdf',
    });

    await expect(extractFileText(file)).rejects.toThrow();
  });
});
