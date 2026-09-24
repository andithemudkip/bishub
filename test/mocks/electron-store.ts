// In-memory stand-in for electron-store, swapped in by the alias in
// vitest.config.ts. Stores sharing a `name` share data, like the real on-disk
// file would, and values round-trip through JSON so a test catches the same
// shared-reference bugs the real serializer would hide.

type Data = Record<string, unknown>;

const files = new Map<string, Data>();

function clone<T>(value: T): T {
  return value === undefined ? value : JSON.parse(JSON.stringify(value));
}

/**
 * Drop every store's contents. Called before each test by test/setup.ts.
 * Instances that outlive the reset (module singletons) fall back to their
 * defaults, as on a fresh install. Tests that need a singleton rebuilt from
 * scratch should use vi.resetModules().
 */
export function resetStores(): void {
  files.clear();
}

/** Seed a store's file before the module under test constructs it. */
export function seedStore(name: string, data: Data): void {
  files.set(name, clone(data));
}

/** Read back what a store has persisted, keyed by its `name`. */
export function readStore(name: string): Data | undefined {
  return clone(files.get(name));
}

interface Options<T> {
  name?: string;
  defaults?: Partial<T>;
}

export default class Store<T extends Data = Data> {
  private readonly name: string;
  private readonly defaults: Data;

  constructor(options: Options<T> = {}) {
    this.name = options.name ?? "config";
    this.defaults = clone(options.defaults ?? {});
    files.set(this.name, { ...clone(this.defaults), ...files.get(this.name) });
  }

  private get data(): Data {
    let data = files.get(this.name);
    if (!data) {
      data = clone(this.defaults);
      files.set(this.name, data);
    }
    return data;
  }

  get<K extends keyof T>(key: K, defaultValue?: T[K]): T[K] {
    const value = this.data[key as string];
    return clone(value === undefined ? defaultValue : value) as T[K];
  }

  set<K extends keyof T>(key: K, value: T[K]): void {
    this.data[key as string] = clone(value);
  }

  has(key: keyof T): boolean {
    return key in this.data;
  }

  delete(key: keyof T): void {
    delete this.data[key as string];
  }

  clear(): void {
    files.set(this.name, {});
  }

  get store(): T {
    return clone(this.data) as T;
  }
}
