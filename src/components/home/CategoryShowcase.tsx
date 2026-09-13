import Link from 'next/link';
import Image from 'next/image';
import { AnimateIn, StaggerGrid, StaggerItem } from '@/components/common/AnimateIn';

interface CategoryTile {
  value: string;
  label: string;
  image: string;
}

/**
 * Vidriera de categorías con foto grande (estilo "lookbook"), en vez de los
 * badges de texto que había antes. Cada tarjeta usa la foto de un producto
 * real de esa categoría (elegida en page.tsx) y linkea al catálogo
 * filtrado por esa categoría.
 *
 * Es Server Component a propósito — no necesita interactividad, así que no
 * suma JS al bundle del cliente (a diferencia de, por ejemplo, el video
 * autoplay que se evitó acá: ver el comentario largo en la auditoría sobre
 * por qué no conviene copiar el hero en video de Prestysh tal cual).
 */
export function CategoryShowcase({ items }: { items: CategoryTile[] }) {
  if (items.length === 0) return null;

  return (
    <section className="mx-auto max-w-7xl px-4 py-12">
      <AnimateIn className="mb-6">
        <span className="text-xs font-semibold uppercase tracking-wide text-accent-600 dark:text-accent-300">
          Explorá por tipo
        </span>
        <h2 className="font-display text-3xl font-bold mt-1">Categorías</h2>
      </AnimateIn>

      <StaggerGrid className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
        {items.map((cat) => (
          <StaggerItem key={cat.value}>
            <Link
              href={`/productos?categoria=${cat.value}`}
              className="group relative block overflow-hidden rounded-2xl bg-surface-2"
              style={{ aspectRatio: '3/4' }}
              aria-label={`Ver ${cat.label}`}
            >
              <Image
                src={cat.image}
                alt={cat.label}
                fill
                loading="lazy"
                className="object-cover transition-transform duration-500 group-hover:scale-105"
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 20vw"
              />
              {/* Scrim de abajo hacia arriba — asegura contraste del label
                  sin importar cuán clara sea la foto de fondo. */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
              <span className="absolute inset-x-3 bottom-3 font-display text-base font-bold text-white sm:text-lg">
                {cat.label}
              </span>
            </Link>
          </StaggerItem>
        ))}
      </StaggerGrid>
    </section>
  );
}