import { defineConfig } from 'vite';
import { resolve } from 'path';
import dts from 'vite-plugin-dts';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const isUmdBuild = mode === 'build-umd';
  return {
    esbuild: {
      // TODO: Uncomment this when we're stable
      // drop: mode === 'development' ? [] : ['console', 'debugger'],
      sourcemap: isUmdBuild ? false : 'inline',
    },
    optimizeDeps: {
      include: ['penpal', 'uuid', 'zod'],
    },
    build: {
      emptyOutDir: mode === 'production',
      copyPublicDir: false,
      lib: {
        formats: isUmdBuild ? ['umd'] : ['es'],
        name: 'OpenPay',
        entry: resolve(__dirname, './index.ts'),
        fileName: (format) => `index.${format}.js`,
      },
      rollupOptions: {
        external: ['react', 'react-dom', ...(isUmdBuild ? [] : ['zod', 'penpal', 'uuid', 'chalk'])],
        output: {
          assetFileNames: 'assets/[name][extname]',
        },
      },
    },
    plugins: [
      dts({
        include: ['**/*', '../utils/**/*'], // Needs this to invalidate when utils change
        rollupTypes: true,
        bundledPackages: ['@getopenpay/utils'],
        tsconfigPath: resolve(__dirname, 'tsconfig.build.json'),
      }),
    ],
    define: {
      __APP_VERSION__: JSON.stringify(process.env.npm_package_version),
      __RELEASE_VERSION__: JSON.stringify(process.env.RELEASE_VERSION ?? 'local_build'),
    },
    cacheDir: './.vite',
  };
});
