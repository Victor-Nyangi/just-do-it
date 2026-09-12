import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // The dev and preview ports are pinned, and `strictPort` makes Vite refuse to
  // start rather than quietly move to the next free one. The quiet move is the
  // problem: the API's ALLOWED_ORIGINS lists these exact origins, so a server
  // that drifted from 5173 to 5174 fails every request with an opaque CORS
  // error and a rejected Clerk token — two symptoms that say nothing about the
  // port. "Port 5173 is already in use" is a far better failure.
  server: { port: 5173, strictPort: true },
  preview: { port: 4173, strictPort: true },
});
