import { keccak256, toUtf8Bytes } from "ethers";

/**
 * Produces a deterministic, test-only signing key at runtime.
 * The source contains no private-key-shaped literal and this helper must never
 * be used by production payment code.
 */
export function makeTestPrivateKey(label: string): string {
  return keccak256(toUtf8Bytes(`metermind-test-only-wallet:${label}`));
}
