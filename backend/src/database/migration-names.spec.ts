import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

const migrationsDir = join(__dirname, 'migrations');
const files = readdirSync(migrationsDir).filter((f) => f.endsWith('.ts'));
const source = (f: string) => readFileSync(join(migrationsDir, f), 'utf8');

/**
 * A migration whose name is built at runtime (e.g. `name + String(Date.now())`)
 * never matches the `migrations` ledger, so TypeORM re-runs it on every deploy.
 * That is what took production down on 2026-10-21 — see ADR-013.
 */
describe('migration names', () => {
  it('finds the migrations directory', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it('gives every migration a constant name', () => {
    const dynamic = files.filter((f) => /name\s*=\s*[^;]*Date\.now\(\)/.test(source(f)));
    expect(dynamic).toEqual([]);
  });

  it('gives every migration a unique name', () => {
    const names = files.map((f) => /name\s*=\s*['"]([^'"]+)['"]/.exec(source(f))?.[1]);
    expect(names.every(Boolean)).toBe(true);
    expect(new Set(names).size).toBe(names.length);
  });
});
