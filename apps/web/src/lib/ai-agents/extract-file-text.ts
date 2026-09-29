import { AI_AGENT_LIMITS } from '@vynor/contracts';

export const MAX_KNOWLEDGE_FILE_BYTES = 10 * 1024 * 1024;
export const KNOWLEDGE_FILE_ACCEPT = '.pdf,.txt,.md,application/pdf,text/plain,text/markdown';

export interface ExtractedFile {
  text: string;
  truncated: boolean;
}

function isPdf(file: File): boolean {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
}

function isText(file: File): boolean {
  return file.type.startsWith('text/') || /\.(txt|md)$/i.test(file.name);
}

async function pdfText(file: File): Promise<string> {
  const pdfjs = await import('pdfjs-dist');
  // Importing the worker bundle registers `globalThis.pdfjsWorker`, which makes
  // pdf.js parse on the main thread instead of loading a separate worker URL.
  await import('pdfjs-dist/build/pdf.worker.min.mjs');

  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  try {
    const pages: string[] = [];
    for (let n = 1; n <= doc.numPages; n += 1) {
      const page = await doc.getPage(n);
      const content = await page.getTextContent();
      let text = '';
      for (const item of content.items) {
        if ('str' in item) text += item.str + (item.hasEOL ? '\n' : '');
      }
      pages.push(text);
    }
    return pages.join('\n\n');
  } finally {
    await doc.destroy();
  }
}

/** Reads the text a knowledge file contributes. Scanned PDFs yield no text. */
export async function extractFileText(file: File): Promise<ExtractedFile> {
  if (file.size > MAX_KNOWLEDGE_FILE_BYTES) {
    throw new Error(`${file.name} is larger than 10 MB.`);
  }
  let raw: string;
  if (isPdf(file)) raw = await pdfText(file);
  else if (isText(file)) raw = await file.text();
  else throw new Error(`${file.name} is not a supported file. Use .pdf or .txt.`);

  const text = raw
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (!text) {
    throw new Error(`No text found in ${file.name}. Make sure you can highlight the text in it.`);
  }
  const max = AI_AGENT_LIMITS.fileContentMax;
  return { text: text.slice(0, max), truncated: text.length > max };
}
