import { formatPrice, slugify, getYouTubeEmbedUrl, truncate, ORDER_STATUS_LABELS } from '@/utils';

describe('formatPrice', () => {
  it('formats ARS currency correctly', () => {
    const result = formatPrice(1500);
    expect(result).toContain('1.500');
  });

  it('formats zero', () => {
    const result = formatPrice(0);
    expect(result).toContain('0');
  });

  it('formats large number', () => {
    const result = formatPrice(150000);
    expect(result).toContain('150.000');
  });
});

describe('slugify', () => {
  it('converts spaces to hyphens', () => {
    expect(slugify('Mi Producto')).toBe('mi-producto');
  });

  it('removes accents', () => {
    expect(slugify('Café con Leche')).toBe('cafe-con-leche');
  });

  it('removes special characters', () => {
    expect(slugify('Producto! @#$%')).toBe('producto');
  });

  it('handles multiple consecutive spaces', () => {
    expect(slugify('hola   mundo')).toBe('hola-mundo');
  });

  it('trims leading/trailing hyphens', () => {
    expect(slugify(' test ')).toBe('test');
  });
});

describe('getYouTubeEmbedUrl', () => {
  it('converts youtu.be short URL', () => {
    expect(getYouTubeEmbedUrl('https://youtu.be/dQw4w9WgXcQ'))
      .toBe('https://www.youtube.com/embed/dQw4w9WgXcQ');
  });

  it('converts youtube.com/watch URL', () => {
    expect(getYouTubeEmbedUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ'))
      .toBe('https://www.youtube.com/embed/dQw4w9WgXcQ');
  });

  it('returns already-embedded URL as-is', () => {
    expect(getYouTubeEmbedUrl('https://www.youtube.com/embed/dQw4w9WgXcQ'))
      .toBe('https://www.youtube.com/embed/dQw4w9WgXcQ');
  });

  it('returns empty string for empty input', () => {
    expect(getYouTubeEmbedUrl('')).toBe('');
  });
});

describe('truncate', () => {
  it('returns string unchanged if under limit', () => {
    expect(truncate('Hello', 10)).toBe('Hello');
  });

  it('truncates and adds ellipsis', () => {
    const result = truncate('Hello World', 7);
    expect(result).toContain('…');
    expect(result.length).toBeLessThanOrEqual(8);
  });

  it('handles exact length', () => {
    expect(truncate('Hello', 5)).toBe('Hello');
  });
});

describe('ORDER_STATUS_LABELS', () => {
  it('has all required statuses', () => {
    const expected = ['pendiente', 'pagado', 'procesando', 'enviado', 'entregado', 'cancelado'];
    expected.forEach((status) => {
      expect(ORDER_STATUS_LABELS[status]).toBeDefined();
      expect(typeof ORDER_STATUS_LABELS[status]).toBe('string');
    });
  });
});
