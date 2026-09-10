/**
 * Categorías de producto. Lista fija (constraint en DB) para que el filtro
 * público sea consistente — el admin elige una de estas al cargar/editar
 * un producto. "otro" es el valor por defecto para productos viejos que no
 * encajan en ninguna categoría todavía.
 *
 * Para agregar una categoría nueva: sumarla acá Y en el CHECK constraint de
 * sql/fixes/fix-categoria-productos.sql (correr el ALTER TABLE de ese
 * archivo en Supabase de nuevo con el valor agregado).
 */
export const CATEGORIAS = [
  { value: 'calzado',    label: 'Calzado'    },
  { value: 'pantalones', label: 'Pantalones' },
  { value: 'bermudas',   label: 'Bermudas'   },
  { value: 'remeras',    label: 'Remeras'    },
  { value: 'otro',       label: 'Otro'       },
] as const;

export type Categoria = typeof CATEGORIAS[number]['value'];

export function categoriaLabel(value: string): string {
  return CATEGORIAS.find((c) => c.value === value)?.label ?? value;
}