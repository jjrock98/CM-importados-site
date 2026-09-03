'use client';
import { Printer } from 'lucide-react';

interface Props { orderNumber: string }

/**
 * Botón de impresión del pedido.
 * Usa window.print() — los estilos @media print en globals.css
 * ocultan toda la navegación y muestran solo el contenido relevante.
 */
export function PrintButton({ orderNumber }: Props) {
  const handlePrint = () => {
    // Título de la pestaña durante la impresión
    const prevTitle = document.title;
    document.title = `Pedido #${orderNumber} — ${process.env.NEXT_PUBLIC_TIENDA_NOMBRE ?? 'Mi Tienda'}`;
    window.print();
    document.title = prevTitle;
  };

  return (
    <button
      onClick={handlePrint}
      className="btn-ghost gap-2 text-sm no-print"
      aria-label="Imprimir pedido"
    >
      <Printer size={15} />
      Imprimir
    </button>
  );
}
