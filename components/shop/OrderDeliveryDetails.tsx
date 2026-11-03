import { carrierLabel, type DeliverySnapshot } from '@/lib/delivery';
export function OrderDeliveryDetails({ delivery, admin = false }: { delivery: DeliverySnapshot; admin?: boolean }) {
  return <section className="border border-gray-200 rounded-xl p-5 space-y-2 mb-6">
    <h2 className="font-semibold">Pakkeshop · {carrierLabel(delivery.carrier)}</h2>
    <address className="not-italic text-sm"><strong>{delivery.name}</strong><br />{delivery.address}<br />{delivery.postcode} {delivery.city}</address>
    {admin && <p className="text-xs text-gray-500">Shipmondo-produkt: {delivery.productCode} · Pakkeshop-ID: {delivery.pointId}<br />Opret label i Shipmondo, når varerne er klar. Brug kundens kontaktoplysninger som modtager og denne pakkeshop som udleveringssted.</p>}
  </section>;
}
