// Read-only check. Never books shipments or prints credentials/request URLs.
// node --env-file=.env.shipmondo.local scripts/check-shipmondo.mjs
const key = process.env.SHIPMONDO_DELIVERY_CHECKOUT_KEY;
if (!key) {
  console.error('Missing SHIPMONDO_DELIVERY_CHECKOUT_KEY');
  process.exit(1);
}

async function get(path, params = {}) {
  const url = new URL(`https://app.shipmondo.com/api/public/v3/${path}`);
  for (const [name, value] of Object.entries({ ...params, frontend_key: key })) {
    url.searchParams.set(name, value);
  }
  const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`Shipmondo HTTP ${response.status}`);
  const data = await response.json();
  if (!Array.isArray(data)) throw new Error('Unexpected Shipmondo response');
  return data;
}

try {
  const carriers = await get('shipping_modules/carriers');
  for (const [carrier, product] of [['gls', 'GLSDK_SD'], ['dao', 'DAO_STS']]) {
    if (!carriers.some((entry) => entry.code === carrier)) {
      throw new Error(`Carrier unavailable: ${carrier}`);
    }
    const products = await get('shipping_modules/products', { carrier_code: carrier });
    if (!products.some((entry) => entry.product_code === product && entry.service_point_product && entry.receiver_countries?.includes('DK'))) {
      throw new Error(`Danish service point product unavailable: ${product}`);
    }
    const points = await get('service_point/service_points', {
      product_code: product, country_code: 'DK', zipcode: '6623',
    });
    if (!points.some((point) => point.id && point.pickup_allowed && point.country === 'DK')) {
      throw new Error(`No usable service points: ${carrier}`);
    }
    console.log(`${carrier}: ${product} OK, ${points.length} service points returned for 6623`);
  }
  if (process.argv.includes('--database')) {
    if (!process.env.DATABASE_URL) throw new Error('Missing database configuration');
    const { Pool } = await import('pg');
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 10000 });
    try {
      // Empty SELECT still verifies every required column without reading customer data.
      await pool.query('SELECT "orderId", "carrier", "productCode", "pointId", "name", "address", "postcode", "city", "country" FROM "OrderDelivery" LIMIT 0');
      console.log('OrderDelivery database schema OK');
    } finally { await pool.end(); }
  }
} catch {
  console.error('Shipmondo check failed. Check connection, key and account products. No credentials logged.');
  process.exitCode = 1;
}
