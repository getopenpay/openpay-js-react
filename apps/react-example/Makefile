.PHONY: dev preview build install install-dev install-alpha install-latest dev-stg dev-prod

install:
	npm install

install-dev:
	python ../install_helper.py dev @getopenpay/openpay-js-react

install-alpha:
	python ../install_helper.py alpha @getopenpay/openpay-js-react

install-latest:
	python ../install_helper.py latest @getopenpay/openpay-js-react

dev-stg:
	npm run dev-stg

dev-prod:
	npm run dev-prod

preview:
	npm run preview

build:
	npm run build
