import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export function getManifestPath(): string {
  return join(__dirname, '..', 'data', 'manifest.json');
}

export function readManifestFile(): string {
  return readFileSync(getManifestPath(), 'utf-8');
}
