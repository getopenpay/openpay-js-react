.PHONY: dev preview build install install-dev install-alpha install-latest dev-stg dev-prod

install:
	npm install

install-dev:
	python ../install_helper.py dev @getopenpay/openpay-js

install-alpha:
	python ../install_helper.py alpha @getopenpay/openpay-js

install-latest:
	python ../install_helper.py latest @getopenpay/openpay-js

dev-stg:
	npm run dev-stg

dev-prod:
	npm run dev-prod

preview:
	npm run preview

build:
	npm run build

reset-test-installs:
	python ./reset_test_installs.py
