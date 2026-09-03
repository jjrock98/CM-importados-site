'use client';
import { PlayCircle } from 'lucide-react';

interface Props { videos: string[]; nombre: string }

/** Convierte una URL de YouTube a su formato embed, o la deja igual si ya es directa (.mp4) o Vimeo */
function toEmbedUrl(url: string): { type: 'iframe' | 'video'; src: string } {
  const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/);
  if (ytMatch) return { type: 'iframe', src: `https://www.youtube.com/embed/${ytMatch[1]}` };

  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) return { type: 'iframe', src: `https://player.vimeo.com/video/${vimeoMatch[1]}` };

  return { type: 'video', src: url }; // .mp4 directo u otro
}

export function ProductVideos({ videos, nombre }: Props) {
  if (!videos || videos.length === 0) return null;

  return (
    <div className="mt-8">
      <h2 className="font-semibold text-lg mb-3 flex items-center gap-2">
        <PlayCircle size={18} className="text-brand-500" /> Videos del producto
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {videos.map((url, i) => {
          const { type, src } = toEmbedUrl(url);
          return (
            <div key={url} className="relative aspect-video overflow-hidden rounded-xl bg-black">
              {type === 'iframe' ? (
                <iframe
                  src={src}
                  title={`${nombre} - video ${i + 1}`}
                  className="h-full w-full"
                  loading="lazy"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <video src={src} controls preload="none" className="h-full w-full object-contain" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
