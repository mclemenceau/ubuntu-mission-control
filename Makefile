DEV_PORT  ?= 3000

.PHONY: help install dev test build serve start clean

help:
	@echo "Usage:"
	@echo "  make install  — install npm dependencies (run once)"
	@echo "  make dev      — start Vite dev server with hot reload (port $(DEV_PORT))"
	@echo "  make test     — run unit tests"
	@echo "  make build    — build optimised production bundle into dist/"
	@echo "  make start    — alias for 'make dev'"
	@echo "  make clean    — remove dist/"

# ── Primary workflow ──────────────────────────────────────────

install:
	npm install

dev:
	npm run dev

test:
	npm run test

build:
	npm run build

serve:
	npm run build:serve && npm run preview

start: dev

clean:
	@rm -rf dist/
	@echo "Cleaned dist/"
