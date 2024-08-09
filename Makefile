.PHONY: install dev start build publish

install:
	npm install
	cd example && make install
	npx playwright install --with-deps chromium

dev:
	npm run build:dev

start: dev

build:
	npm run build

publish: build
	npm whoami || npm adduser
	npm publish

run-example:
	ngrok start --all --config ngrok.yml

integration-test: start-ngrok 
	sleep 2 && \
    BASE_URL=$$(curl http://localhost:4040/api/tunnels | jq -r ".tunnels[0].public_url") && \
	export BASE_URL=$$BASE_URL && \
	npm run test && \
	make stop-ngrok


start-ngrok:
	nohup ngrok start --all --config ngrok.yml > /dev/null &
	
stop-ngrok:
	@echo "Stopping ngrok..."
	@pkill ngrok || true
	@echo "Ngrok stopped."
