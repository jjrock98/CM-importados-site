import { create } from 'zustand';

/**
 * Estado del panel de carrito (drawer) que se abre en mobile/tablet al
 * agregar un producto o al tocar el ícono del carrito del Navbar.
 *
 * A propósito NO usa `persist` como useCart.ts — es puramente estado de
 * UI de la sesión actual (si el panel está abierto o cerrado), no algo
 * que tenga sentido recordar entre visitas.
 */
interface CartDrawerStore {
  isOpen: boolean;
  open:  () => void;
  close: () => void;
}

export const useCartDrawerStore = create<CartDrawerStore>((set) => ({
  isOpen: false,
  open:  () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
}));