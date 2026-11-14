import { describe, expect, it } from 'vitest';
import { MAX_PDF_BYTES, readValidatedPdf } from '../../supabase/functions/telegram-poll/pdf';

describe('Telegram PDF validation', () => {
  it('accepts a bounded PDF with a signature and EOF marker', async () => {
    const pdf = '%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF';
    expect(new TextDecoder().decode(await readValidatedPdf(new Response(pdf)))).toBe(pdf);
  });
  it('rejects HTML mislabeled as PDF', async () => {
    await expect(readValidatedPdf(new Response('<html>Error</html>', {
      headers: { 'content-type': 'application/pdf' },
    }))).rejects.toThrow('Invalid PDF');
  });
  it('rejects a truncated PDF', async () => {
    await expect(readValidatedPdf(new Response('%PDF-1.7\ntruncated'))).rejects.toThrow('Invalid PDF');
  });
  it('rejects an oversized content length before reading', async () => {
    await expect(readValidatedPdf(new Response('%PDF-1.7\n%%EOF', {
      headers: { 'content-length': String(MAX_PDF_BYTES + 1) },
    }))).rejects.toThrow('20 MB');
  });
  it('rejects oversized streams even without a content length', async () => {
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array(MAX_PDF_BYTES));
        controller.enqueue(new Uint8Array(1));
        controller.close();
      },
    });
    await expect(readValidatedPdf(new Response(stream))).rejects.toThrow('20 MB');
  });
  it('rejects failed downloads', async () => {
    await expect(readValidatedPdf(new Response('error', { status: 502 }))).rejects.toThrow('download failed');
  });
});