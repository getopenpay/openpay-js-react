.PHONY: install dev start build publish

install:
	npm install
	cd example && make install

dev:
	npm run build:dev

start: dev

build:
	npm run build

publish: build
	npm whoami || npm adduser
	npm publish