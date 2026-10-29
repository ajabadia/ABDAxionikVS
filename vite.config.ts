import { defineConfig } from 'vite';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  root: path.resolve(__dirname, 'WebUI'),
  base: './',
  plugins: [
    {
      name: 'copy-wasm-assets',
      closeBundle() {
        const srcWasmDir = path.resolve(__dirname, 'WebUI', 'src', 'wasm');
        if (!fs.existsSync(srcWasmDir)) return;
        const targets = [
          path.resolve(__dirname, 'WebUI', 'dist', 'src', 'wasm'),
          path.resolve(__dirname, 'WebUI', 'dist', 'wasm'),
        ];
        for (const dst of targets) {
          fs.mkdirSync(dst, { recursive: true });
          for (const entry of fs.readdirSync(srcWasmDir)) {
            const fullSrc = path.join(srcWasmDir, entry);
            if (fs.statSync(fullSrc).isFile()) {
              fs.copyFileSync(fullSrc, path.join(dst, entry));
            }
          }
        }
      },
    },
  ],
  build: {
    outDir: path.resolve(__dirname, 'WebUI', 'dist'),
    emptyOutDir: true,
    assetsInlineLimit: 0,
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name][extname]',
      },
    },
  },
  server: {
    port: 5320,
    strictPort: true,
    fs: {
      allow: ['..', '../..'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'WebUI', 'src'),
    },
  },
});
