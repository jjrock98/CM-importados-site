'use client';
import { useEffect } from 'react';

/**
 * Facebook agrega `#_=_` al final de la URL de redirect después de un
 * login OAuth exitoso — es un capricho viejo y conocido de su lado, no
 * depende de nada que hagamos acá. No rompe nada, pero queda una URL
 * fea tipo `mc-importados.shop/#_=_` en la barra de direcciones.
 *
 * Esto lo limpia apenas carga la página, sin afectar el resto de la URL
 * (querystring, ruta) ni disparar una navegación — solo reemplaza la
 * entrada actual del historial.
 */
export function FacebookHashCleanup() {
  useEffect(() => {
    if (window.location.hash === '#_=_') {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  }, []);

  return null;
}