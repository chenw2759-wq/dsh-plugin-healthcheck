import tsconfigPaths from 'vite-tsconfig-paths'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [tsconfigPaths({ projects: ['./tsconfig.json'] })],
  test: {
    include: ['tests/**/*.spec.{ts,tsx}'],
    pool: 'forks',
    environment: 'node',
    server: {
      deps: {
        inline: [/@deepseek-ai\//],
      },
    },
  },
})
