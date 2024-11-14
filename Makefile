.PHONY: install dev start build publish

install:
	npm install

dev: install
	npm run dev

start: dev

build: install
	npm run build

publish: build
	npm whoami || npm adduser
	npm publish

precommit:
	npm run lint:fix
	cd ./example && npm run lint:fix

test-vanilla:
	cd ./apps/vanilla-example && make dev
 