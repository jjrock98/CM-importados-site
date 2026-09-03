'use client';
import { useEffect } from 'react';

export function TawkTo() {
  const propertyId = process.env.NEXT_PUBLIC_TAWKTO_PROPERTY_ID;
  const widgetId   = process.env.NEXT_PUBLIC_TAWKTO_WIDGET_ID ?? 'default';

  useEffect(() => {
    if (!propertyId) return;
    const s1 = document.createElement('script');
    s1.async = true;
    s1.src = `https://embed.tawk.to/${propertyId}/${widgetId}`;
    s1.charset = 'UTF-8';
    s1.setAttribute('crossorigin', '*');
    document.head.appendChild(s1);
    return () => { document.head.removeChild(s1); };
  }, [propertyId, widgetId]);

  return null;
}
