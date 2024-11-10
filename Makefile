.PHONY: install dev start build publish

install:
	npm install

dev:
	npm run dev

start: dev

build:
	npm run lint
	npm run build

publish: build
	npm whoami || npm adduser
	npm publish

precommit:
	npm run lint:fix
