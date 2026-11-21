/// <reference types="node" />

declare module 'node:util';
declare module 'node:fs/promises';
declare module 'node:path';
declare module 'node:os';
declare module 'node:child_process';
declare module 'node:fs';

declare namespace NodeJS {
  interface Process {
    env: Record<string, string | undefined>;
    cwd(): string;
  }
}
