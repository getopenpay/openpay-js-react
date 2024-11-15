.PHONY: install dev build preview publish precommit

install:
	npm install

# This will run all the packages and run the example apps in watch mode
# will rebuild on dependency changes
dev: 
	npm run dev

# This will run only the packages in watch mode
# Can be useful for development with staging or production CDE in example apps
dev-packages:
	npm run dev-packages

# This will lint and build all packages and example apps
build:
	npm run lint
	npm run build

# This will build only the packages and not the example apps
build-packages:
	npm run build-packages

# Preview example apps using build outputs
# Note: this requires the build step to have been run first
preview:
	npm run preview

# This will fix auto-fixable eslint linting errors 
precommit:
	npm run lint:fix

# Usage: make bump-version VERSION=patch|minor|major|1.2.3 [COMMIT=false]
bump-version:
	cd packages/vanilla && npm version $(VERSION) 
	cd packages/react && npm version $(VERSION)
