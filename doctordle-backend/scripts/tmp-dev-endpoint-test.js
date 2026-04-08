require('dotenv').config();

const port = process.env.PORT || 3000;
const key = process.env.INTERNAL_API_KEY;

if (!key) {
  throw new Error('INTERNAL_API_KEY missing in .env');
}

const base = `http://127.0.0.1:${port}/api`;
const headers = { 'x-internal-key': key };

async function run() {
  const resetRes = await fetch(`${base}/dev/reset-today`, {
    method: 'POST',
    headers,
  });
  const resetBody = await resetRes.text();

  const rebuildRes = await fetch(`${base}/dev/rebuild-today`, {
    method: 'POST',
    headers,
  });
  const rebuildBody = await rebuildRes.text();

  console.log(`RESET_STATUS=${resetRes.status}`);
  console.log(`RESET_BODY=${resetBody}`);
  console.log(`REBUILD_STATUS=${rebuildRes.status}`);
  console.log(`REBUILD_BODY=${rebuildBody}`);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
