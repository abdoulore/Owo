import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

// ZeroDev's KernelEIP1193Provider extends Node's EventEmitter; Vite externalizes
// the "events" module by default in the browser instead of polyfilling it, which
// crashes with "Class extends value undefined is not a constructor or null".
// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), nodePolyfills({ include: ['events'] })],
})
