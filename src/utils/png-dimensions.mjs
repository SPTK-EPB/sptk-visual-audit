/**
 * Read width and height from a PNG file by parsing its 8-byte signature + IHDR chunk.
 *
 * PNG layout: 8-byte signature, then a 25-byte IHDR chunk where bytes 16-19 are
 * width (big-endian u32) and bytes 20-23 are height. We only need the first 24
 * bytes, so this does not load the entire image into memory.
 *
 * @param {string} filepath
 * @returns {Promise<{ width: number, height: number }>}
 * @throws If the file is missing, too short, or not a PNG.
 */
import { open } from 'node:fs/promises';

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export async function readPngDimensions(filepath) {
  const handle = await open(filepath, 'r');
  try {
    const buf = Buffer.alloc(24);
    const { bytesRead } = await handle.read(buf, 0, 24, 0);
    if (bytesRead < 24) {
      throw new Error(`${filepath}: too short to be a PNG (${bytesRead} bytes)`);
    }
    if (!buf.subarray(0, 8).equals(PNG_SIGNATURE)) {
      throw new Error(`${filepath}: not a PNG (bad signature)`);
    }
    const width = buf.readUInt32BE(16);
    const height = buf.readUInt32BE(20);
    return { width, height };
  } finally {
    await handle.close();
  }
}
