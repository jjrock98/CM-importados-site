'use client';
import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/utils';

const FAQS = [
  { q: '¿Cómo funcionan los packs?', a: 'Vendemos en packs cerrados por docena (12 unidades). Aunque, algunos productos se venden por media docena (6 unidades). Al seleccionar un producto podés elegir el tipo de pack y la cantidad de la misma.' },
  { q: '¿Se realizan envíos?', a: 'El envio se acordara mediante los canales de comunicación o en persona. Lo hacemos por Via Cargo, Andreani y Correo Argentino. El costo varía según la zona de entrega y la empresa de transporte elegida.' },
  { q: '¿Cuáles son los métodos de pago?', a: 'Aceptamos Mercado Pago (débito, crédito y efectivo) y transferencia bancaria. Para transferencia podés subir el comprobante desde tu cuenta. Siempre recuerda que hay un descuento con el pago en efectivo fisico y transferencia.' },
  { q: '¿El pago con Mercado Pago es seguro?', a: 'Sí. Al confirmar tu pedido se abre una ventana segura de Mercado Pago donde completás el pago. Nosotros nunca vemos los datos de tu tarjeta.' },
  { q: '¿Cuánto tarda en llegar mi pedido?', a: 'Los tiempos de entrega dependen de tu zona. Generalmente entre 3 y 7 días hábiles. Lo confirmamos al procesar tu pedido.' },
  { q: '¿Puedo cambiar o cancelar mi pedido?', a: 'Podés cancelar tu pedido mientras esté en estado "Pendiente" desde la sección Mis Pedidos, siempre que el pago no haya sido procesado. Una vez confirmado el pago ya no es posible cancelarlo. Contactanos a la brevedad si necesitás ayuda.' },
  { q: '¿Hacen envíos a todo el país?', a: 'Sí, enviamos a todo el territorio nacional. El costo varía según la zona de entrega y la empresa de transporte elegida.' },
  { q: '¿Cómo sé el estado de mi pedido?', a: 'En "Mis Pedidos" podés ver el estado actualizado en tiempo real. También te avisamos por email ante cada cambio.' },
  { q: '¿Qué hago si mi pago no fue confirmado?', a: 'Para pagos por transferencia, asegurate de subir el comprobante desde Mis Pedidos. Para Mercado Pago, si el monto fue debitado pero el pedido no se actualizó, contactanos.' },
  { q: '¿Que metodo de pago es preferible?', a: 'En preferencia trabajamos con transferencia bancaria y el pago en efectivo en el local. Siempre hay un descuento al cliente por estos medios.' },
];

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-border last:border-0">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between gap-4 py-5 text-left"
        aria-expanded={open}
      >
        <span className="font-medium text-sm md:text-base">{q}</span>
        <ChevronDown size={18} className={cn('shrink-0 text-muted transition-transform duration-200', open && 'rotate-180')} />
      </button>
      {open && (
        <p className="pb-5 text-sm text-muted leading-relaxed animate-fade-in">{a}</p>
      )}
    </div>
  );
}

export function FaqAccordion() {
  return (
    <div className="card px-6">
      {FAQS.map((item) => <FaqItem key={item.q} {...item} />)}
    </div>
  );
}
