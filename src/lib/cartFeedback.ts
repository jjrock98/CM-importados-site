import toast from 'react-hot-toast';
import { isMobileOrTabletViewport } from './viewport';
import { useCartDrawerStore } from '@/hooks/useCartDrawer';

/**
 * Feedback estándar tras un agregado exitoso al carrito.
 *
 * - Mobile/tablet (< 768px): abre el panel del carrito (reemplaza el
 *   toast — mostrar los dos juntos sería redundante).
 * - Desktop: mantiene el toast de siempre, sin cambios.
 *
 * Se llama en el mismo punto donde antes se llamaba a
 * `toast.success(mensaje)` tras un `addItem` exitoso — mismo mensaje,
 * misma ubicación en el código, solo cambia a dónde va el feedback.
 */
export function notifyAddedToCart(message: string): void {
  if (isMobileOrTabletViewport()) {
    useCartDrawerStore.getState().open();
  } else {
    toast.success(message);
  }
}