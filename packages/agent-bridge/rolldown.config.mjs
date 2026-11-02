import { fileURLToPath } from 'node:url'
export default {
  input: 'packages/agent-bridge/main.ts',
  platform: 'node',
  external: ['@anthropic-ai/claude-agent-sdk'],
  plugins: [{ name: 'native-platform', resolveId(id) { if (id === 'electron') return fileURLToPath(new URL('./native-platform.ts', import.meta.url)) } }],
  output: { file: '.cache/agent-bridge.cjs', format: 'cjs' }
}
