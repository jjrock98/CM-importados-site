import { render, screen } from '@testing-library/react';
import { BrandWordmark, splitBrandName } from '@/components/common/BrandWordmark';

describe('splitBrandName', () => {
  it('separa la sigla del resto cuando la primera palabra es corta', () => {
    expect(splitBrandName('L&L importados')).toEqual({ mark: 'L&L', rest: 'importados' });
    expect(splitBrandName('MC Importados')).toEqual({ mark: 'MC', rest: 'Importados' });
  });
  it('con nombres largos o de una sola palabra, no separa', () => {
    expect(splitBrandName('Claros Importados')).toEqual({ mark: 'Claros Importados', rest: '' });
    expect(splitBrandName('Importados')).toEqual({ mark: 'Importados', rest: '' });
  });
  it('limpia espacios de más', () => {
    expect(splitBrandName('  L&L   importados  ')).toEqual({ mark: 'L&L', rest: 'importados' });
  });
});

describe('<BrandWordmark />', () => {
  it('muestra la sigla y el resto del nombre', () => {
    render(<BrandWordmark name="L&L importados" />);
    expect(screen.getByText('L&L')).toBeInTheDocument();
    expect(screen.getByText('importados')).toBeInTheDocument();
  });
  it('con un nombre sin separar, lo muestra completo', () => {
    render(<BrandWordmark name="Claros Importados" />);
    expect(screen.getByText('Claros Importados')).toBeInTheDocument();
  });
});