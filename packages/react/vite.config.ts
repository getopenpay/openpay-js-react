import { defineConfig } from 'vite';
import { resolve } from 'path';
import react from '@vitejs/plugin-react';
import dts from 'vite-plugin-dts';

// https://vitejs.dev/config/
export default defineConfig({
  esbuild: {
    // TODO: Uncomment this when we're stable
    // drop: process.env.NODE_ENV === 'development' ? [] : ['console', 'debugger'],
    sourcemap: 'inline',
  },
  build: {
    emptyOutDir: false,
    copyPublicDir: false,
    lib: {
      entry: resolve(__dirname, './index.ts'),
      formats: ['es'],
    },
    rollupOptions: {
      external: ['react', 'react-dom', 'react/jsx-runtime', 'zod', 'chalk', 'penpal', 'uuid'],
      output: {
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
        },
        assetFileNames: 'assets/[name][extname]',
        entryFileNames: '[name].js',
      },
    },
  },
  plugins: [
    react(),
    dts({
      rollupTypes: true,
      bundledPackages: ['@getopenpay/utils'],
      include: ['**/*', '../utils/**/*'], // Needs this to invalidate when utils change
      tsconfigPath: resolve(__dirname, 'tsconfig.build.json'),
    }),
  ],
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version),
    __RELEASE_VERSION__: JSON.stringify(process.env.RELEASE_VERSION ?? 'local_build'),
  },
  cacheDir: './.vite',
});
