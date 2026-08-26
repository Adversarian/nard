import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { devEvaluator } from './dev-evaluator'

export default defineConfig({
  plugins: [react(), tailwindcss(), devEvaluator()],
  server: { port: 5173, strictPort: true },
})
