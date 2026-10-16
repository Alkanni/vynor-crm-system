import { describe, expect, it } from 'vitest';
import { mediaLabel, summarizeMessageContent } from '../src/index.js';

describe('message content summaries (issue #40)', () => {
  it('labels known media kinds and falls back to "Attachment"', () => {
    expect(mediaLabel('image')).toBe('Photo');
    expect(mediaLabel('voice')).toBe('Voice message');
    expect(mediaLabel('hologram')).toBe('Attachment');
  });

  it('summarizes media without a caption by its label and filename', () => {
    expect(
      summarizeMessageContent({
        type: 'MEDIA',
        mediaType: 'document',
        mimeType: 'application/pdf',
        filename: 'invoice.pdf',
      }),
    ).toBe('Document: invoice.pdf');
    expect(
      summarizeMessageContent({ type: 'MEDIA', mediaType: 'sticker', mimeType: 'image/webp' }),
    ).toBe('Sticker');
  });
});
