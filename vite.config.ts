import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: [
      '@agoralabs-sh/avm-web-provider',
      '@txnlab/use-wallet',
      '@txnlab/use-wallet-react',
    ],
  },
  resolve: {
    dedupe: ['@agoralabs-sh/avm-web-provider'],
  },
})
