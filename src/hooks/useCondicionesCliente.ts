'use client';
import { useEffect, useState } from 'react';

export interface CondicionesCliente {
  descuento_fijo_pct: number;
  monto_minimo_pedido: number;
}

const VACIAS: CondicionesCliente = { descuento_fijo_pct: 0, monto_minimo_pedido: 0 };
const TTL_MS = 60_000; // si el cliente inicia o cierra sesión, en 1 minuto se vuelve a consultar

let cache: { valor: CondicionesCliente; momento: number } | null = null;
let enCurso: Promise<CondicionesCliente> | null = null;

function cargar(): Promise<CondicionesCliente> {
  if (cache && Date.now() - cache.momento < TTL_MS) return Promise.resolve(cache.valor);
  if (!enCurso) {
    enCurso = fetch('/api/mi-cuenta/condiciones')
      .then((r) => r.json())
      .then(({ data }) => {
        const valor: CondicionesCliente = data
          ? {
              descuento_fijo_pct:  Number(data.descuento_fijo_pct)  || 0,
              monto_minimo_pedido: Number(data.monto_minimo_pedido) || 0,
            }
          : VACIAS;
        cache = { valor, momento: Date.now() };
        return valor;
      })
      .catch(() => VACIAS)
      .finally(() => { enCurso = null; });
  }
  return enCurso;
}

/**
 * Descuento fijo y pedido mínimo del cliente (para invitados vienen en 0).
 * Lo usan el carrito y el mini carrito para mostrar el MISMO total que el checkout.
 * `enabled=false` evita consultar (ej. mini carrito cerrado). La respuesta se
 * comparte entre componentes, así que no se repite el pedido a la API.
 */
export function useCondicionesCliente(enabled = true): CondicionesCliente {
  const [cond, setCond] = useState<CondicionesCliente>(cache?.valor ?? VACIAS);

  useEffect(() => {
    if (!enabled) return;
    let cancelado = false;
    cargar().then((c) => { if (!cancelado) setCond(c); });
    return () => { cancelado = true; };
  }, [enabled]);

  return cond;
}