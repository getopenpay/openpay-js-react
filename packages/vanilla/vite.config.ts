import { defineConfig } from 'vite';
import { resolve } from 'path';
import dts from 'vite-plugin-dts';

// https://vitejs.dev/config/
export default defineConfig({
  esbuild: {
    drop: process.env.NODE_ENV === 'development' ? [] : ['console', 'debugger'],
  },
  build: {
    copyPublicDir: false,
    lib: {
      name: 'openpay.js',
      entry: resolve(__dirname, './index.ts'),
      formats: ['es', 'cjs'],
    },
    rollupOptions: {
      // external: ['@getopenpay/utils'],
      output: {
        assetFileNames: 'assets/[name][extname]',
        entryFileNames: '[name].js',
      },
    },
  },
  plugins: [
    dts({
      rollupTypes: true,
      tsconfigPath: resolve(__dirname, 'tsconfig.build.json'),
    }),
  ],
});
