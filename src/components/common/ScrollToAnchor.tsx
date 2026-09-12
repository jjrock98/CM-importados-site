'use client';
import { useEffect } from 'react';

/**
 * Hace scroll hasta el elemento con ese id, una vez montado el componente.
 *
 * Por qué existe esto y no alcanza con un link `href="#catalogo"`: un
 * fragmento de URL (`#catalogo`) NUNCA viaja al servidor — el navegador lo
 * recorta antes de mandar el pedido — así que depende 100% de que sea el
 * propio navegador el que, al recibir la página, decida hacer scroll hasta
 * ese id. La mayoría de los navegadores lo hacen bien, pero los navegadores
 * embebidos de apps como WhatsApp o Instagram (los que abren el link cuando
 * tocás un Estado o una Story) son conocidos por perder el fragmento al
 * abrir el link, dejando a la persona en el tope de la página sin importar
 * qué decía el link original.
 *
 * La solución: para links que se van a compartir afuera del sitio, usar un
 * query param (`?scroll=catalogo`) en vez de (o además de) el fragmento.
 * A diferencia del fragmento, el query param SÍ llega al servidor sin
 * problema — así que no depende de que el navegador que abre el link se
 * porte bien; el scroll lo hacemos nosotros acá, en JS, una vez que la
 * página ya cargó.
 */
export function ScrollToAnchor({ targetId }: { targetId?: string }) {
  useEffect(() => {
    if (!targetId) return;
    // Pequeño delay: da tiempo a que las animaciones de entrada (AnimateIn)
    // terminen de acomodar el layout antes de calcular la posición final.
    const t = setTimeout(() => {
      document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 120);
    return () => clearTimeout(t);
  }, [targetId]);

  return null;
}