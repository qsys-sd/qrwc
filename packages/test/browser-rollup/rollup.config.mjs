import { nodeResolve } from '@rollup/plugin-node-resolve'

// rollup.config.mjs
export default {
  input: 'src/index.ts',
  output: {
    file: 'dist/index.js',
    format: 'cjs'
  },
  plugins: [nodeResolve()]
}
