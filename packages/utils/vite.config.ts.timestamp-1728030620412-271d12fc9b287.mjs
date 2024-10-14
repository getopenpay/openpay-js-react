// vite.config.ts
import { defineConfig } from "file:///Users/zeyarpaing/Work/openpay/openpay-js-react/node_modules/vite/dist/node/index.js";
import { resolve } from "path";
import dts from "file:///Users/zeyarpaing/Work/openpay/openpay-js-react/node_modules/vite-plugin-dts/dist/index.mjs";
var __vite_injected_original_dirname = "/Users/zeyarpaing/Work/openpay/openpay-js-react/packages/utils";
var vite_config_default = defineConfig({
  build: {
    copyPublicDir: false,
    lib: {
      formats: ["es"],
      entry: resolve(__vite_injected_original_dirname, "./index.ts"),
      fileName: () => "index.js"
    },
    rollupOptions: {
      external: ["penpal", "use-async-effect", "uuid", "zod"],
      output: {
        assetFileNames: "assets/[name][extname]"
      }
    }
  },
  plugins: [
    dts({
      rollupTypes: true,
      tsconfigPath: resolve(__vite_injected_original_dirname, "tsconfig.json")
    })
  ]
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvVXNlcnMvemV5YXJwYWluZy9Xb3JrL29wZW5wYXkvb3BlbnBheS1qcy1yZWFjdC9wYWNrYWdlcy91dGlsc1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiL1VzZXJzL3pleWFycGFpbmcvV29yay9vcGVucGF5L29wZW5wYXktanMtcmVhY3QvcGFja2FnZXMvdXRpbHMvdml0ZS5jb25maWcudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL1VzZXJzL3pleWFycGFpbmcvV29yay9vcGVucGF5L29wZW5wYXktanMtcmVhY3QvcGFja2FnZXMvdXRpbHMvdml0ZS5jb25maWcudHNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tICd2aXRlJztcbmltcG9ydCB7IHJlc29sdmUgfSBmcm9tICdwYXRoJztcbmltcG9ydCBkdHMgZnJvbSAndml0ZS1wbHVnaW4tZHRzJztcblxuLy8gaHR0cHM6Ly92aXRlanMuZGV2L2NvbmZpZy9cbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZyh7XG4gIGJ1aWxkOiB7XG4gICAgY29weVB1YmxpY0RpcjogZmFsc2UsXG4gICAgbGliOiB7XG4gICAgICBmb3JtYXRzOiBbJ2VzJ10sXG4gICAgICBlbnRyeTogcmVzb2x2ZShfX2Rpcm5hbWUsICcuL2luZGV4LnRzJyksXG4gICAgICBmaWxlTmFtZTogKCkgPT4gJ2luZGV4LmpzJyxcbiAgICB9LFxuICAgIHJvbGx1cE9wdGlvbnM6IHtcbiAgICAgIGV4dGVybmFsOiBbJ3BlbnBhbCcsICd1c2UtYXN5bmMtZWZmZWN0JywgJ3V1aWQnLCAnem9kJ10sXG4gICAgICBvdXRwdXQ6IHtcbiAgICAgICAgYXNzZXRGaWxlTmFtZXM6ICdhc3NldHMvW25hbWVdW2V4dG5hbWVdJyxcbiAgICAgIH0sXG4gICAgfSxcbiAgfSxcbiAgcGx1Z2luczogW1xuICAgIGR0cyh7XG4gICAgICByb2xsdXBUeXBlczogdHJ1ZSxcbiAgICAgIHRzY29uZmlnUGF0aDogcmVzb2x2ZShfX2Rpcm5hbWUsICd0c2NvbmZpZy5qc29uJyksXG4gICAgfSksXG4gIF0sXG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICI7QUFBNFcsU0FBUyxvQkFBb0I7QUFDelksU0FBUyxlQUFlO0FBQ3hCLE9BQU8sU0FBUztBQUZoQixJQUFNLG1DQUFtQztBQUt6QyxJQUFPLHNCQUFRLGFBQWE7QUFBQSxFQUMxQixPQUFPO0FBQUEsSUFDTCxlQUFlO0FBQUEsSUFDZixLQUFLO0FBQUEsTUFDSCxTQUFTLENBQUMsSUFBSTtBQUFBLE1BQ2QsT0FBTyxRQUFRLGtDQUFXLFlBQVk7QUFBQSxNQUN0QyxVQUFVLE1BQU07QUFBQSxJQUNsQjtBQUFBLElBQ0EsZUFBZTtBQUFBLE1BQ2IsVUFBVSxDQUFDLFVBQVUsb0JBQW9CLFFBQVEsS0FBSztBQUFBLE1BQ3RELFFBQVE7QUFBQSxRQUNOLGdCQUFnQjtBQUFBLE1BQ2xCO0FBQUEsSUFDRjtBQUFBLEVBQ0Y7QUFBQSxFQUNBLFNBQVM7QUFBQSxJQUNQLElBQUk7QUFBQSxNQUNGLGFBQWE7QUFBQSxNQUNiLGNBQWMsUUFBUSxrQ0FBVyxlQUFlO0FBQUEsSUFDbEQsQ0FBQztBQUFBLEVBQ0g7QUFDRixDQUFDOyIsCiAgIm5hbWVzIjogW10KfQo=
