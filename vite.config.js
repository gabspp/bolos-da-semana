import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    // Adiciona o host específico permitido
    allowedHosts: ['5174-it253cynyvz3vtbhgfz2w-0dcbb442.manusvm.computer']
  }
})
