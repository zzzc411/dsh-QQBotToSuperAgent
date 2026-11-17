import { defineConfig } from 'tsdown'

// Host entries: `index` for programmatic imports, `qq-watch` the Cordis plugin
// referenced from cordis.patch.yml as `dsh-qq-superagent/qq-watch`.
// Client entry: `client` is the browser bundle loaded by DSH's module loader.
export default defineConfig([
  {
    entry: { index: 'src/index.ts', 'qq-watch': 'src/qq-watch.ts' },
    outDir: 'lib',
    format: 'esm',
    fixedExtension: false,
    platform: 'node',
    target: 'es2024',
    dts: true,
    clean: true,
    deps: { neverBundle: [/^@deepseek-ai\//, /^@tencent-connect\//, 'zod', 'qrcode'] },
  },
  {
    entry: { client: 'src/client/index.tsx' },
    outDir: 'lib',
    format: 'cjs',
    platform: 'browser',
    dts: false,
    clean: false,
    deps: { neverBundle: ['react', 'react/jsx-runtime', 'react-dom'] },
    outputOptions: {
      entryFileNames: 'client.js',
      banner: 'window.__ModuleLoader__.load({ id: "dsh-qq-superagent", factory: (require) => {',
      footer: 'return module.exports; } });',
      intro: 'var module = { exports: {} }; var exports = module.exports;',
    },
  },
])
