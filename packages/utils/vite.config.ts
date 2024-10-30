import { defineConfig } from 'vite';
import { resolve } from 'path';
import dts from 'vite-plugin-dts';

// https://vitejs.dev/config/
export default defineConfig({
  build: {
    copyPublicDir: false,
    lib: {
      formats: ['es'],
      entry: resolve(__dirname, './index.ts'),
      fileName: () => 'index.js',
    },
    rollupOptions: {
      external: ['penpal', 'use-async-effect', 'uuid', 'zod'],
      output: {
        assetFileNames: 'assets/[name][extname]',
      },
    },
  },
  plugins: [
    dts({
      rollupTypes: true,
      tsconfigPath: resolve(__dirname, 'tsconfig.json'),
    }),
  ],
});
