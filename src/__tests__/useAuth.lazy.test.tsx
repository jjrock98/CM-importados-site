/**
 * @jest-environment jsdom
 */
import { renderHook, waitFor } from '@testing-library/react';

let mockPathname = '/';
jest.mock('next/navigation', () => ({ usePathname: () => mockPathname }));

const mockGetSupabase = jest.fn();
jest.mock('@/lib/supabase/lazy', () => ({
  ...jest.requireActual('@/lib/supabase/lazy'),
  getSupabase: () => mockGetSupabase(),
  warmSupabaseOnInteraction: jest.fn(),
}));

import { useAuth } from '@/hooks/useAuth';

function fakeClient(user: unknown, profile: unknown) {
  const unsubscribe = jest.fn();
  return {
    unsubscribe,
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user } }),
      onAuthStateChange: jest.fn().mockReturnValue({ data: { subscription: { unsubscribe } } }),
      signOut: jest.fn().mockResolvedValue({}),
    },
    from: jest.fn().mockReturnValue({
      select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: profile }) }) }),
    }),
  };
}

const clearCookies = () => {
  document.cookie.split(';').forEach((c) => {
    const name = c.split('=')[0].trim();
    if (name) document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
  });
};

describe('useAuth (Supabase cargado de forma perezosa)', () => {
  beforeEach(() => { mockGetSupabase.mockReset(); clearCookies(); mockPathname = '/'; });

  it('visitante anónimo: no carga Supabase y termina de cargar enseguida', async () => {
    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.user).toBeNull();
    expect(mockGetSupabase).not.toHaveBeenCalled();
  });

  it('con cookie de sesión: carga Supabase, valida con getUser() y trae el perfil', async () => {
    document.cookie = 'sb-proyecto-auth-token=abc; path=/';
    const client = fakeClient({ id: 'u1', email: 'a@b.com' }, { rol: 'admin' });
    mockGetSupabase.mockResolvedValue(client);
    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.user).toMatchObject({ id: 'u1' });
    expect(result.current.isAdmin).toBe(true);
    expect(client.auth.onAuthStateChange).toHaveBeenCalledTimes(1);
  });

  it('cookie con sesión partida (.0) también cuenta como logueado', async () => {
    document.cookie = 'sb-proyecto-auth-token.0=abc; path=/';
    mockGetSupabase.mockResolvedValue(fakeClient({ id: 'u1' }, { rol: 'cliente' }));
    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.user).not.toBeNull());
  });

  it('login sin recargar: al navegar aparece la cookie y el Navbar se entera', async () => {
    const { result, rerender } = renderHook(() => useAuth({ revalidateOnNavigate: true }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.user).toBeNull();

    document.cookie = 'sb-proyecto-auth-token=abc; path=/';
    mockGetSupabase.mockResolvedValue(fakeClient({ id: 'u2' }, { rol: 'cliente' }));
    mockPathname = '/mis-pedidos';
    rerender();
    await waitFor(() => expect(result.current.user).toMatchObject({ id: 'u2' }));
  });

  it('logout del servidor: sin cookie al navegar, el Navbar limpia la sesión', async () => {
    document.cookie = 'sb-proyecto-auth-token=abc; path=/';
    mockGetSupabase.mockResolvedValue(fakeClient({ id: 'u1' }, { rol: 'cliente' }));
    const { result, rerender } = renderHook(() => useAuth({ revalidateOnNavigate: true }));
    await waitFor(() => expect(result.current.user).not.toBeNull());

    clearCookies();
    mockPathname = '/productos';
    rerender();
    await waitFor(() => expect(result.current.user).toBeNull());
  });

  it('al desmontar se cancela la suscripción', async () => {
    document.cookie = 'sb-proyecto-auth-token=abc; path=/';
    const client = fakeClient({ id: 'u1' }, { rol: 'cliente' });
    mockGetSupabase.mockResolvedValue(client);
    const { result, unmount } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.loading).toBe(false));
    unmount();
    expect(client.unsubscribe).toHaveBeenCalled();
  });
});