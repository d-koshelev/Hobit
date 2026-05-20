type FrontendTestFn = () => void | Promise<void>;

declare function afterEach(fn: FrontendTestFn): void;
declare function beforeEach(fn: FrontendTestFn): void;
declare function describe(name: string, fn: FrontendTestFn): void;
declare function it(name: string, fn: FrontendTestFn): void;

declare function expect<T>(actual: T): {
  toBe(expected: T): void;
  toBeNull(): void;
  toEqual(expected: unknown): void;
  toHaveLength(expected: number): void;
};
