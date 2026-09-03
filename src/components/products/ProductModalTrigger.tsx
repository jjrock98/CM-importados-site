'use client';
import { useState } from 'react';
import { ShoppingCart } from 'lucide-react';
import { ProductModal as BaseModal } from './ProductModal';
import type { Product } from '@/types';

interface Props {
  product:      Product;
  triggerLabel?: string;
}

export function ProductModalTrigger({ product, triggerLabel }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        disabled={product.stock_unidades === 0}
        className="btn-primary w-full gap-2 py-3 text-base disabled:opacity-50"
      >
        <ShoppingCart size={18} />
        {product.stock_unidades === 0 ? 'Sin stock disponible' : (triggerLabel ?? 'Agregar al carrito')}
      </button>

      {open && <BaseModal product={product} onClose={() => setOpen(false)} />}
    </>
  );
}
