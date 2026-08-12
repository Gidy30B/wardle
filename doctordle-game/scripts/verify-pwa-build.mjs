import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const distRoot = new URL('../dist/', import.meta.url)
const distRootPath = fileURLToPath(distRoot)
const workerPath = new URL('firebase-messaging-sw.js', distRoot)
const workerSource = await readFile(workerPath, 'utf8')
const distFiles = await readdir(distRoot)

assert(
  distFiles.includes('firebase-messaging-sw.js'),
  'expected dist/firebase-messaging-sw.js to be emitted',
)
assert(!distFiles.includes('sw.js'), 'must not emit a second /sw.js worker')
assert(
  !distFiles.includes('registerSW.js'),
  'must not emit generated /registerSW.js registration helper',
)
assert(
  !workerSource.includes('self.__WB_MANIFEST'),
  'Workbox precache injection point was left unresolved',
)

const precacheEntries = extractPrecacheEntries(workerSource)
const precacheUrls = new Set(precacheEntries.map((entry) => entry.url))

for (const url of [
  'index.html',
  'offline.html',
  'manifest.webmanifest',
  'wardle-icon-192.png',
  'wardle-icon-512.png',
]) {
  assert(precacheUrls.has(url), `expected ${url} in generated precache`)
}

assert(
  [...precacheUrls].some((url) => /^assets\/index-.*\.js$/.test(url)),
  'expected main application JS asset in generated precache',
)
assert(
  [...precacheUrls].some((url) => /^assets\/index-.*\.css$/.test(url)),
  'expected CSS asset in generated precache',
)
assert(
  [...precacheUrls].some((url) => /^assets\/react-.*\.js$/.test(url)),
  'expected React/vendor asset in generated precache',
)
assert(
  [...precacheUrls].some((url) => /^assets\/clerk-.*\.js$/.test(url)),
  'expected Clerk vendor asset in generated precache',
)
assert(
  [...precacheUrls].some((url) => /^assets\/web-.*\.js$/.test(url)),
  'expected web/lazy chunk assets in generated precache',
)
assert(
  [...precacheUrls].every((url) => !url.startsWith('api/')),
  'must not precache API URLs',
)

assert(
  workerSource.includes("pathname===`/api`") &&
    workerSource.includes('pathname.startsWith(`/api/`)'),
  'expected explicit /api exclusion in generated worker',
)
assert(
  workerSource.includes('origin===self.location.origin'),
  'expected same-origin check in generated worker',
)
assert(
  workerSource.includes('addEventListener(`push`'),
  'expected custom push listener in generated worker',
)
assert(
  workerSource.includes('addEventListener(`notificationclick`'),
  'expected custom notificationclick listener in generated worker',
)
assert(
  workerSource.includes('type===`SKIP_WAITING`') &&
    !workerSource.includes('.then(()=>self.skipWaiting())'),
  'expected waiting lifecycle with only message-triggered skipWaiting',
)

for (const requiredFile of [
  'offline.html',
  'manifest.webmanifest',
  'wardle-icon-192.png',
  'wardle-icon-512.png',
]) {
  await readFile(join(distRootPath, requiredFile))
}

function extractPrecacheEntries(source) {
  const match = source.match(/\[\{"revision":[\s\S]*?\}\](?=\),)/)
  assert(match, 'could not locate generated Workbox precache entry array')

  const entries = JSON.parse(match[0])
  assert(Array.isArray(entries), 'generated precache entries must be an array')
  assert(entries.length > 0, 'generated precache entries must not be empty')

  return entries
}
