'use client';
import { useEffect, useRef, useState } from 'react';
import { shippingPrice } from '@/lib/shipping-price';
import { formatPrice } from '@/lib/utils';
import { CARRIERS, type Carrier, type DeliverySelection, type ServicePoint } from '@/lib/delivery';

export function ServicePointPicker({ onChange }: { onChange: (selection: DeliverySelection | null) => void }) {
  const [carrier, setCarrier] = useState<Carrier>('gls');
  const [postcode, setPostcode] = useState('');
  const [points, setPoints] = useState<ServicePoint[]>([]);
  const [selected, setSelected] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const generation = useRef(0);
  useEffect(() => () => {
    generation.current++;
    onChange(null);
  }, [onChange]);
  function reset() {
    generation.current++;
    setPoints([]); setSelected(''); setError(''); setLoading(false); onChange(null);
  }
  async function search() {
    reset();
    if (!/^\d{4}$/.test(postcode)) { setError('Indtast et dansk postnummer på fire cifre.'); return; }
    const current = generation.current;
    setLoading(true);
    try {
      const res = await fetch(`/api/shipping/service-points?carrier=${carrier}&postcode=${postcode}`);
      const data = await res.json();
      if (generation.current !== current) return;
      if (!res.ok) throw new Error(data.error || 'Kunne ikke hente pakkeshops.');
      setPoints(data.points);
      if (!data.points.length) setError('Ingen pakkeshops fundet. Prøv et andet postnummer eller en anden transportør.');
    } catch (e) {
      if (generation.current === current) setError(e instanceof Error ? e.message : 'Kunne ikke hente pakkeshops. Prøv igen.');
    } finally { if (generation.current === current) setLoading(false); }
  }
  return <div className="mt-4 rounded-xl border border-gray-200 bg-white p-4 space-y-4">
    <h3 className="font-semibold">Vælg din pakkeshop</h3>
    <div className="flex gap-4 flex-wrap">{Object.entries(CARRIERS).map(([code, config]) => <label key={code} className="flex items-center gap-2"><input className="accent-secondary" type="radio" name="carrier" checked={carrier === code} onChange={() => { reset(); setCarrier(code as Carrier); }} />{config.label} · {formatPrice(shippingPrice("SHIPPING"))}</label>)}</div>
    <div className="flex gap-2 items-end">
      <label className="flex-1 text-sm">Postnummer<input className="block border rounded-lg p-2 w-full mt-1" inputMode="numeric" autoComplete="postal-code" maxLength={4} value={postcode} onChange={e => { reset(); setPostcode(e.target.value.replace(/\D/g, '')); }} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void search(); } }} /></label>
      <button type="button" className="rounded-lg bg-primary text-secondary font-semibold p-2 disabled:opacity-50" disabled={loading} onClick={search}>{loading ? 'Søger…' : 'Find pakkeshops'}</button>
    </div>
    <div aria-live="polite">{error && <p role="alert" className="text-sm text-red-700">{error}</p>}</div>
    <div className="space-y-2 max-h-80 overflow-y-auto">{points.map(point => <label key={point.id} className={`flex gap-3 p-3 border rounded-lg cursor-pointer ${selected === point.id ? 'border-secondary bg-yellow-50' : 'border-gray-200'}`}>
      <input className="accent-secondary" type="radio" name="servicePoint" checked={selected === point.id} onChange={() => { setSelected(point.id); onChange({ carrier, postcode, pointId: point.id }); }} />
      <span className="text-sm"><strong>{point.name}</strong><br />{point.address}<br />{point.zipcode} {point.city}</span>
    </label>)}</div>
    {!selected && <p className="text-xs text-gray-500">Vælg en pakkeshop for at fortsætte til betaling.</p>}
  </div>;
}
