import { defineConfig } from 'vite';
import { resolve } from 'path';
import dts from 'vite-plugin-dts';

// https://vitejs.dev/config/
export default defineConfig({
  optimizeDeps: {
    include: ['react', 'react-dom', 'react/jsx-runtime', 'penpal', 'use-async-effect', 'uuid', 'zod'],
  },
  esbuild: {
    sourcemap: 'inline',
  },
  build: {
    copyPublicDir: false,
    lib: {
      formats: ['es'],
      entry: resolve(__dirname, './index.ts'),
      fileName: `index`,
    },
    rollupOptions: {
      external: ['react', 'react-dom', 'react/jsx-runtime'],
      output: {
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
        },
      },
    },
  },
  plugins: [
    dts({
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
  cacheDir: './.vite',
});
