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
      name: 'OpenPay',
      entry: resolve(__dirname, './index.ts'),
      fileName: (format) => `index.${format}.js`,
    },
    rollupOptions: {
      external: ['@stripe/stripe-js', 'uuid', 'zod', 'penpal'],
      output: {
        assetFileNames: 'assets/[name][extname]',
      },
    },
  },
  plugins: [
    dts({
      rollupTypes: true,
      bundledPackages: ['@getopenpay/utils'],
      tsconfigPath: resolve(__dirname, 'tsconfig.build.json'),
    }),
  ],
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version),
  },
});
