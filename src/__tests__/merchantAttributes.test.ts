import { deducirPublico, colorParaGoogle, categoriaGoogle, textoVariantes } from '@/lib/merchantAttributes';

describe('deducirPublico', () => {
  it('mujer / dama → FEMALE adulto', () => {
    expect(deducirPublico('Pantalón tipo Cargo Mujer i-run')).toEqual({ gender: 'FEMALE', ageGroup: 'ADULT' });
    expect(deducirPublico('Zuecos con semiplataforma adulto zuecos de dama')).toEqual({ gender: 'FEMALE', ageGroup: 'ADULT' });
  });
  it('hombre → MALE adulto', () => {
    expect(deducirPublico('Ojotas Slide Adidas Hombre Faja')).toEqual({ gender: 'MALE', ageGroup: 'ADULT' });
  });
  it('niños (plural) → KIDS y UNISEX; acepta "Niños" con ñ y en mayúsculas', () => {
    expect(deducirPublico('Ojotas Slide Nike Niños Faja')).toEqual({ gender: 'UNISEX', ageGroup: 'KIDS' });
    expect(deducirPublico('Ojotas Slide Nike NIÑOS Faja')).toEqual({ gender: 'UNISEX', ageGroup: 'KIDS' });
  });
  it('niño (singular) → KIDS y MALE', () => {
    expect(deducirPublico('Zapatillas niño')).toEqual({ gender: 'MALE', ageGroup: 'KIDS' });
  });
  it('niña → KIDS y FEMALE', () => {
    expect(deducirPublico('Zapatillas niña')).toEqual({ gender: 'FEMALE', ageGroup: 'KIDS' });
  });
  it('sin pistas → UNISEX adulto', () => {
    expect(deducirPublico('Ojotas sport')).toEqual({ gender: 'UNISEX', ageGroup: 'ADULT' });
  });
  it('mujer y hombre a la vez → UNISEX', () => {
    expect(deducirPublico('Remera para hombre y mujer').gender).toBe('UNISEX');
  });
  it('no confunde palabras que contienen "mujer" u "hombre" dentro de otra', () => {
    expect(deducirPublico('Camperón hombreras').gender).toBe('UNISEX');
  });
});

describe('colorParaGoogle', () => {
  it('sin colores no devuelve nada', () => {
    expect(colorParaGoogle([])).toBeUndefined();
    expect(colorParaGoogle(null)).toBeUndefined();
  });
  it('1 a 3 colores se unen con "/"', () => {
    expect(colorParaGoogle(['Negro'])).toBe('Negro');
    expect(colorParaGoogle(['Negro', 'Blanco', 'Crema'])).toBe('Negro/Blanco/Crema');
  });
  it('más de 3 colores → Multicolor', () => {
    expect(colorParaGoogle(['a', 'b', 'c', 'd'])).toBe('Multicolor');
  });
});

describe('categoriaGoogle / textoVariantes', () => {
  it('mapea las categorías de la tienda y deja "otro" sin categoría', () => {
    expect(categoriaGoogle('calzado')).toBe('187');
    expect(categoriaGoogle('otro')).toBeUndefined();
    expect(categoriaGoogle(null)).toBeUndefined();
  });
  it('arma el texto de talles y colores', () => {
    expect(textoVariantes(['30', '31'], ['Negro'])).toBe('Talles: 30, 31. Colores: Negro.');
    expect(textoVariantes([], [])).toBe('');
  });
});