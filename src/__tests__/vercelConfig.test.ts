/**
 * @jest-environment node
 *
 * Guarda la configuración de tareas programadas de vercel.json.
 */
import fs from 'fs';
import path from 'path';

const raiz = path.resolve(__dirname, '..', '..');
const config = JSON.parse(fs.readFileSync(path.join(raiz, 'vercel.json'), 'utf8'));
const schedules = config.schedules as Record<string, { schedule: string; path: string; requestMethod?: string }>;

describe('vercel.json: tareas programadas (Vercel Schedules)', () => {
  it('no deja "crons" junto a "schedules" (si no, cada ruta correría dos veces)', () => {
    expect(config.crons).toBeUndefined();
    expect(Object.keys(schedules).length).toBeGreaterThan(0);
  });

  it.each(Object.entries(schedules))('%s: GET, expresión cron de 5 campos y nombre válido', (nombre, s) => {
    // Schedules usa POST por defecto; las rutas del sitio son GET.
    expect(s.requestMethod).toBe('GET');
    expect(s.schedule.trim().split(/\s+/)).toHaveLength(5);
    expect(nombre).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it.each(Object.entries(schedules))('%s: la ruta existe, es GET y valida CRON_SECRET', (_nombre, s) => {
    const archivo = path.join(raiz, 'src', 'app', s.path, 'route.ts');
    expect(fs.existsSync(archivo)).toBe(true);
    const codigo = fs.readFileSync(archivo, 'utf8');
    expect(codigo).toMatch(/export\s+(async\s+)?function\s+GET/);
    // Vercel manda "Authorization: Bearer <CRON_SECRET>": la ruta tiene que comprobarlo.
    expect(codigo).toContain('CRON_SECRET');
  });
});