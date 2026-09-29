import type { AiAgentKnowledge, KnowledgeProduct, KnowledgeQna } from '@vynor/contracts';

const ENTITIES: Record<string, string> = {
  '&nbsp;': ' ',
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
};

/** Plain text of the knowledge editor's HTML, keeping line breaks. Works without a DOM. */
export function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(div|p|li|h[1-6])>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&(nbsp|amp|lt|gt|quot|#39);/g, (entity) => ENTITIES[entity] ?? entity)
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function formatRupiah(value: number): string {
  return `Rp${new Intl.NumberFormat('id-ID').format(value)}`;
}

export function productText(product: KnowledgeProduct): string {
  return `${product.name} ${product.description}`;
}

function qnaCharacters(pair: KnowledgeQna): number {
  return pair.question.trim().length + pair.answer.trim().length;
}

export interface KnowledgeSummary {
  files: number;
  textCharacters: number;
  links: number;
  qna: number;
  products: number;
  totalCharacters: number;
}

export function summarizeKnowledge(knowledge: AiAgentKnowledge): KnowledgeSummary {
  const textCharacters = knowledge.texts.reduce(
    (sum, doc) => sum + htmlToText(doc.content).length,
    0,
  );
  const fileCharacters = knowledge.files.reduce((sum, file) => sum + file.content.length, 0);
  const linkCharacters = knowledge.links.reduce((sum, link) => sum + link.characters, 0);
  const qnaTotal = knowledge.qna.reduce((sum, pair) => sum + qnaCharacters(pair), 0);
  const productCharacters = knowledge.products.reduce(
    (sum, product) => sum + productText(product).length,
    0,
  );

  return {
    files: knowledge.files.length,
    textCharacters,
    links: knowledge.links.length,
    qna: knowledge.qna.length,
    products: knowledge.products.length,
    totalCharacters:
      textCharacters + fileCharacters + linkCharacters + qnaTotal + productCharacters,
  };
}
