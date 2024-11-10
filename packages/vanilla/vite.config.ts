import { defineConfig } from 'vite';
import { resolve } from 'path';
import dts from 'vite-plugin-dts';

// https://vitejs.dev/config/
export default defineConfig({
  esbuild: {
    drop: process.env.NODE_ENV === 'development' ? [] : ['console', 'debugger'],
  },
  optimizeDeps: {
    include: ['@getopenpay/utils', 'penpal', 'uuid', 'zod'],
  },
  build: {
    copyPublicDir: false,
    lib: {
      name: 'OpenPay',
      entry: resolve(__dirname, './index.ts'),
      fileName: (format) => `index.${format}.js`,
    },
    rollupOptions: {
      external: ['@stripe/stripe-js'],
      output: {
        assetFileNames: 'assets/[name][extname]',
      },
    },
  },
  plugins: [
    dts({
      rollupTypes: true,
      tsconfigPath: resolve(__dirname, 'tsconfig.build.json'),
    }),
  ],
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version),
    __RELEASE_VERSION__: JSON.stringify(process.env.RELEASE_VERSION ?? 'local_build'),
  },
  cacheDir: './.vite',
});
