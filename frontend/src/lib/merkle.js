// Client-side hashing for public verification (Option B).
// Byte-exact mirror of backend build_merkle_root() (backend/server.py):
//   - chunks of CHUNK_SIZE bytes -> sha256 per chunk -> binary Merkle tree
//   - lone node at any level is PROMOTED up unchanged (one deterministic rule)
// All hashing runs via WebCrypto (crypto.subtle) so the document file itself
// never leaves the device. Requires a secure context (https / localhost).

export const CHUNK_SIZE = 4096;

// sha256 of an empty buffer; the canonical root for a zero-byte file
// (matches backend sha256_hex(b'') -> build_merkle_root([])).
export const EMPTY_ROOT =
  "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

export async function sha256Hex(data) {
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

function hexToBytes(hex) {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return out;
}

export async function buildMerkleRoot(leaves) {
  if (leaves.length === 0) return EMPTY_ROOT;
  let level = leaves.slice();
  while (level.length > 1) {
    const nxt = [];
    for (let i = 0; i < level.length; i += 2) {
      if (i + 1 < level.length) {
        const combined = new Uint8Array(64);
        combined.set(hexToBytes(level[i]), 0);
        combined.set(hexToBytes(level[i + 1]), 32);
        nxt.push(await sha256Hex(combined));
      } else {
        nxt.push(level[i]); // promote lone node unchanged
      }
    }
    level = nxt;
  }
  return level[0];
}

/**
 * Compute the four fields the verify API compares against a registered record.
 * @param {File} file - the local PDF (read via arrayBuffer; never uploaded)
 * @param {(done: number, total: number) => void} [onProgress]
 * @returns {Promise<{docHash: string, fullFileHash: string, chunkCount: number, fileSize: number}>}
 */
export async function computeDocumentHashes(file, onProgress) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const leaves = [];
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    leaves.push(await sha256Hex(bytes.subarray(i, Math.min(i + CHUNK_SIZE, bytes.length))));
    if (onProgress) onProgress(Math.min(i + CHUNK_SIZE, bytes.length), bytes.length);
  }
  const fullFileHash = await sha256Hex(bytes);
  const docHash = await buildMerkleRoot(leaves);
  return { docHash, fullFileHash, chunkCount: leaves.length, fileSize: bytes.length };
}
