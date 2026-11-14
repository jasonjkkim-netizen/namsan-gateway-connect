// Match the existing research upload limit, including streamed responses.
export const MAX_PDF_BYTES = 20 * 1024 * 1024;

export async function readValidatedPdf(response: Response): Promise<Uint8Array> {
  if (!response.ok) throw new Error('PDF download failed');
  const declaredSize = Number(response.headers.get('content-length'));
  if (declaredSize > MAX_PDF_BYTES) {
    await response.body?.cancel();
    throw new Error('PDF exceeds the 20 MB limit');
  }
  if (!response.body) throw new Error('Empty PDF');
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_PDF_BYTES) {
        await reader.cancel();
        throw new Error('PDF exceeds the 20 MB limit');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  const header = new TextDecoder().decode(bytes.subarray(0, 8));
  const tail = new TextDecoder().decode(bytes.subarray(Math.max(0, size - 1024)));
  if (!/^%PDF-\d\.\d/.test(header) || !tail.includes('%%EOF')) {
    throw new Error('Invalid PDF content');
  }
  return bytes;
}