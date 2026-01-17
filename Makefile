PROJECT ?= test
COMPOSE = docker compose -p $(PROJECT)

prod:
	$(COMPOSE) up -d --build

dev:
	$(COMPOSE) -f compose.yaml -f compose.dev.yaml up --build

analyze:
	$(COMPOSE) -f compose.analyze.yaml up --build