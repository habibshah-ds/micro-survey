# Colors
GREEN=\033[0;32m
YELLOW=\033[1;33m
RED=\033[0;31m
NC=\033[0m

docker-up: ## Start all services with Docker
	@echo "$(GREEN)🐳 Starting Docker services...$(NC)"
	docker compose up -d
	@echo "$(YELLOW)⏳ Waiting for services to be healthy...$(NC)"
	@docker compose ps
	@sleep 8
	@echo "$(GREEN)✅ Services started!$(NC)"
	@$(MAKE) migrate

docker-down: ## Stop all Docker services
	@echo "$(YELLOW)🛑 Stopping Docker services...$(NC)"
	docker compose down
	@echo "$(GREEN)✅ Services stopped!$(NC)"

docker-build: ## Build Docker images
	@echo "$(GREEN)🔨 Building Docker images...$(NC)"
	docker compose build
	@echo "$(GREEN)✅ Build complete!$(NC)"

docker-restart: ## Restart Docker services
	@echo "$(YELLOW)🔁 Restarting Docker services...$(NC)"
	docker compose down
	docker compose up -d
	@echo "$(GREEN)✅ Restart complete!$(NC)"
