import { CARRIERS, type Carrier, type DeliverySelection, type DeliverySnapshot, type ServicePoint } from '@/lib/delivery';

export class ShippingUnavailable extends Error {}
// Public location results only; bounded cache reduces account quota use.
const cache = new Map<string, { expires: number; points: ServicePoint[] }>();
export async function servicePoints(carrier: Carrier, postcode: string, fresh = false): Promise<ServicePoint[]> {
  if (!Object.hasOwn(CARRIERS, carrier) || !/^\d{4}$/.test(postcode)) throw new Error('Invalid service point query');
  const key = process.env.SHIPMONDO_DELIVERY_CHECKOUT_KEY;
  if (!key) throw new ShippingUnavailable('Shipping not configured');
  const cacheKey = `${carrier}:${postcode}`;
  const saved = cache.get(cacheKey);
  if (!fresh && saved && saved.expires > Date.now()) return saved.points;
  try {
    const url = new URL('https://app.shipmondo.com/api/public/v3/service_point/service_points');
    for (const [name, value] of Object.entries({ frontend_key: key, product_code: CARRIERS[carrier].productCode, country_code: 'DK', zipcode: postcode })) url.searchParams.set(name, value);
    const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error('Shipmondo request failed');
    const data: unknown = await res.json();
    if (!Array.isArray(data)) throw new Error('Invalid Shipmondo response');
    const points: ServicePoint[] = data.flatMap((p) => {
      if (!p || p.pickup_allowed !== true || p.country !== 'DK' || p.carrier_code !== carrier || !['id', 'name', 'address', 'zipcode', 'city'].every(k => typeof p[k] === 'string' && p[k].length > 0)) return [];
      return [{ id: p.id, name: p.name, address: p.address, zipcode: p.zipcode, city: p.city, country: p.country, carrierCode: p.carrier_code, openingHours: Array.isArray(p.opening_hours) ? p.opening_hours.filter((h: unknown) => typeof h === 'string') : [] }];
    });
    if (cache.size >= 200) cache.delete(cache.keys().next().value!);
    cache.set(cacheKey, { expires: Date.now() + 5 * 60_000, points });
    return points;
  } catch {
    // Never propagate a request URL containing the credential to logs or clients.
    throw new ShippingUnavailable('Service points temporarily unavailable');
  }
}
export async function validateDelivery(selection: DeliverySelection): Promise<DeliverySnapshot | null> {
  const points = await servicePoints(selection.carrier, selection.postcode, true);
  const point = points.find(p => p.id === selection.pointId);
  if (!point) return null;
  return { carrier: selection.carrier, productCode: CARRIERS[selection.carrier].productCode, pointId: point.id, name: point.name, address: point.address, postcode: point.zipcode, city: point.city, country: point.country };
}
