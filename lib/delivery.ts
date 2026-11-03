export const CARRIERS = {
  gls: { label: 'GLS PakkeShop', productCode: 'GLSDK_SD' },
  dao: { label: 'daoSHOP', productCode: 'DAO_STS' },
} as const;
export type Carrier = keyof typeof CARRIERS;
export type DeliverySelection = { carrier: Carrier; postcode: string; pointId: string };
export type ServicePoint = {
  id: string; name: string; address: string; zipcode: string; city: string;
  country: string; carrierCode: string; openingHours: string[];
};
export type DeliverySnapshot = {
  carrier: string; productCode: string; pointId: string; name: string;
  address: string; postcode: string; city: string; country: string;
};
export function carrierLabel(carrier: string) {
  return carrier === 'gls' ? CARRIERS.gls.label : carrier === 'dao' ? CARRIERS.dao.label : carrier;
}
export function parseDeliverySelection(value: unknown): DeliverySelection | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  if ((v.carrier !== 'gls' && v.carrier !== 'dao') || typeof v.postcode !== 'string' || !/^\d{4}$/.test(v.postcode) || typeof v.pointId !== 'string' || !/^[\w-]{1,80}$/.test(v.pointId)) return null;
  return { carrier: v.carrier, postcode: v.postcode, pointId: v.pointId };
}
