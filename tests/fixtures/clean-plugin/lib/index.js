// A benign plugin — must not trip the malware scanner.
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

export function readOwnConfig(): string {
  const root = dirname(fileURLToPath(import.meta.url))
  return readFileSync(join(root, 'config.json'), 'utf8')
}
