.PHONY: install dev build preview publish precommit

install:
	npm install

# This will run all the packages and run the example apps in watch mode
# will rebuild on dependency changes
dev: 
	npm run dev

# This will lint and build all packages and example apps
build:
	npm run lint
	npm run build

# Preview example apps using build outputs
# Note: this requires the build step to have been run first
preview:
	npm run preview

# This will fix auto-fixable eslint linting errors 
precommit:
	npm run lint:fix

publish: build
	npm whoami || npm adduser
	npm publish
