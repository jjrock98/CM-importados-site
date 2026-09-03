import { NextResponse } from 'next/server';
// Stripe webhook deshabilitado — no se usa en Argentina
export async function POST() {
  return NextResponse.json({ received: true });
}
