# Scripts

## Project structure

- `apps` contains the example apps.
  - `react-example` is a Next.js app using `@getopenpay/openpay-js-react` package.
  - `vanilla-example` is a Vite app using `@getopenpay/openpay-js` package.
- `packages` contains the packages.
  - `config` contains shared tsconfig and eslint config for the projects.
  - `utils` contains shared utils for the projects.
  - `vanilla` is the `@getopenpay/openpay-js` package.
  - `react` is the `@getopenpay/openpay-js-react` package.

### packages/config

The eslint and tsconfig are shared between the projects to reduce redundency and to keep consistent linting and types across the projects. Any new rules to apply across the project should be added to the `config` package.

- `base-eslintrc.json` is the base eslint config for the projects.
- `base-tsconfig.json` is the base tsconfig for the projects.
- `build-tsconfig.json` is the tsconfig for the build process of the packages.

### packages/utils

This is where we put shared utils for the packages. It is not bundeled into the package dist instead it expose the index.ts directly.
If a new file is added to utils, it should be added to the `index.ts` exports.

### packages/vanilla

The `@getopenpay/openpay-js` package. It is bundled to the dist folder to be publishable.

- vite library configuration is used to generate `umd` and `esm` bundles of the package. (umd is to be used able to use directly in the browser without bundler and esm is to be used in the bundler environment)
- vite dts plugin + `tsconfig.build.json` is used to generate the types.

### packages/react

The `@getopenpay/openpay-js-react` package.

- vite library configuration is used to generate `esm` bundle of the package. (since react is mostly used in bundler environment, we only generate `esm` bundle)
- vite dts plugin + `tsconfig.build.json` is used to generate the types.

## Local Development

For an ideal development, should run `make install` and `make dev` in the root directory.
It will watch for changes in all dependencies and apps.

The example apps will default the base url to local CDE (http://localhost:8001) and will use the local version of the packages.

## Development with staging or production CDE

In some cases, if we don't need to use local CDE or want to test with staging or production CDE:

`make dev-packages` and
`cd apps/react-example && make dev-stg`

or

`make dev-packages` and
`cd apps/vanilla-example && make dev-prod`

Since we rely on the `baseUrl` prop to set CDE url, we can test with any package version with any environment.

## Testing with released versions of the packages

If we want to test with released versions of the packages:
`cd apps/react-example && make install-alpha` or `cd apps/react-example && make install-latest`

And can run `dev` command or `dev-stg` or `dev-prod` in the example apps.

## Console warnings and errors

If you opened the example apps in a browser duing `make dev` is running, you might see `pre-tramsform` errors in the terminal.
This is when the app is trying to refresh due to a change in the packages dist folder, but package build is not finished yet and the dist folder is not ready.
Can safely ignore these warnings, and the app will refresh when the build is finished.
