import { defineConfig } from 'vite';
import { resolve } from 'path';
import dts from 'vite-plugin-dts';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  return {
    esbuild: {
      drop: mode === 'development' ? [] : ['console', 'debugger'],
    },
    optimizeDeps: {
      include: ['penpal', 'uuid', 'zod'],
    },
    build: {
      emptyOutDir: false,
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
        include: ['**/*', '../utils/**/*'], // Needs this to invalidate when utils change
        rollupTypes: true,
        tsconfigPath: resolve(__dirname, 'tsconfig.build.json'),
      }),
      {
        name: 'css-inline',
        transform(code, id) {
          if (id.endsWith('.css?inline')) {
            return {
              code: `export default ${JSON.stringify(code)}`,
              map: null,
            };
          }
        },
      }, // To inline CSS into the bundle
    ],
    define: {
      __APP_VERSION__: JSON.stringify(process.env.npm_package_version),
      __RELEASE_VERSION__: JSON.stringify(process.env.RELEASE_VERSION ?? 'local_build'),
    },
    cacheDir: './.vite',
  };
});
