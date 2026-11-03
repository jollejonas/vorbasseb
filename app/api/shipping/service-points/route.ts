import { NextRequest, NextResponse } from 'next/server';
import { servicePoints } from '@/lib/shipmondo';
export async function GET(req: NextRequest) {
  const carrier = req.nextUrl.searchParams.get('carrier');
  const postcode = req.nextUrl.searchParams.get('postcode') ?? '';
  if ((carrier !== 'gls' && carrier !== 'dao') || !/^\d{4}$/.test(postcode)) {
    return NextResponse.json({ error: 'Vælg transportør og indtast et dansk postnummer på fire cifre.' }, { status: 400 });
  }
  try {
    return NextResponse.json({ points: await servicePoints(carrier, postcode) });
  } catch {
    return NextResponse.json({ error: 'Pakkeshops kan ikke hentes lige nu. Prøv igen, eller vælg afhentning ved klubben.' }, { status: 503 });
  }
}
