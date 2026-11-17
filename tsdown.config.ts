import { defineConfig } from 'tsdown'

// `index` is the package entry for programmatic imports (types + helpers).
// `qq-watch` is the Cordis plugin that registers the QQ Source and runs the bot,
// referenced from cordis.patch.yml as `dsh-qq-superagent/qq-watch`.
export default defineConfig({
  entry: { index: 'src/index.ts', 'qq-watch': 'src/qq-watch.ts' },
  outDir: 'lib',
  format: 'esm',
  fixedExtension: false,
  platform: 'node',
  target: 'es2024',
  dts: true,
  clean: true,
  deps: { neverBundle: [/^@deepseek-ai\//, /^@tencent-connect\//, 'zod'] },
})
