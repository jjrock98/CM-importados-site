import { NextResponse } from 'next/server';
// Stripe no está disponible en Argentina — se usa Mercado Pago
export async function POST() {
  return NextResponse.json(
    { error: 'Stripe no está disponible. Utilizá Mercado Pago como método de pago.' },
    { status: 404 }
  );
}
