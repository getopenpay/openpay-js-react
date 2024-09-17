.PHONY: install dev start build publish

install:
	npm install

dev:
	npm run build:dev

start: dev

build:
	npm run build

publish: build
	npm whoami || npm adduser
	npm publish

precommit:
	npm run lint:fix
	cd ./example && npm run lint:fix
