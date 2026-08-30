/// <reference types="vite-plugin-pwa/client" />

// See https://svelte.dev/docs/kit/types#app.d.ts
declare global {
  namespace App {
    // interface Error {}
    // interface Locals {}
    // interface PageData {}
    // interface PageState {}
    // interface Platform {}
  }

  // Injected at build time by vite.config.ts's `define`, sourced from
  // package.json's "version" field — the single place to bump the app
  // version. Shows up on the Settings page. Must live inside this
  // `declare global` block (not at the top level) — this file has
  // `export {}` below, which makes it a module, and a top-level
  // `declare const` in a module file is module-scoped, not ambient.
  const __APP_VERSION__: string;
}

export {};
