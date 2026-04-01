.DEFAULT_GOAL := up
ENV_FILE := backend/.env

env-init:
	@touch $(ENV_FILE)

env-update-host: env-init
	@HOST=$$(hostname -s); \
	if grep -q '^MACHINE_HOST=' $(ENV_FILE); then \
		sed -i -E "s/^MACHINE_HOST=.*/MACHINE_HOST=$$HOST/" $(ENV_FILE); \
	else \
		printf "\nMACHINE_HOST=%s\n" "$$HOST" >> $(ENV_FILE); \
	fi; \

env-update-redirect: env-init
	@HOST=$$(hostname -s); \
	LINE=OAUTH_REDIRECT_URI="https://$$HOST:8443/api/oauth/42/callback"; \
	if grep -q '^OAUTH_REDIRECT_URI=' $(ENV_FILE); then \
		sed -i -E "s|^OAUTH_REDIRECT_URI=.*|$${LINE}|" $(ENV_FILE); \
	else \
		printf "%s\n" "$$LINE" >> $(ENV_FILE); \
	fi; \

update-env: env-update-host env-update-redirect

up: update-env
	docker compose up -d
down:
	docker compose down
ups:
	sudo docker compose up -d
downs:
	sudo docker compose down

clean: down
	rm -rf ./backend/database.db
	rm -rf ./frontend/dist/supervisord.log

reclean: down
	rm -rf ./backend/database.db
	rm -rf ./frontend/supervisord.log
	make up

fclean: down
	rm -rf ./backend/database.db
	rm -rf ./backend/node_modules
	rm -rf ./frontend/node_modules
	rm -rf ./frontend/build
	docker system prune -a --volumes -f