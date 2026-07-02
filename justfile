set dotenv-load

db_name := "agent-news"
db_container := db_name + "-postgres"
db_port := "5554"
db_password := env("DB_PASSWORD", "postgres")

# Create and start a new PostgreSQL container
db-create:
    docker run -d \
        --name {{db_container}} \
        -e POSTGRES_USER=postgres \
        -e POSTGRES_PASSWORD={{db_password}} \
        -e POSTGRES_DB={{db_name}} \
        -p {{db_port}}:5432 \
        postgres
    @echo "Database container '{{db_container}}' created on port {{db_port}}"

# Start an existing PostgreSQL container
db-start:
    docker start {{db_container}}
    @echo "Database container '{{db_container}}' started"

# Run Prisma migrations and generate client
migrate:
    bun prisma migrate dev
    bun prisma generate

# Stop the PostgreSQL container
db-stop:
    docker stop {{db_container}}
    @echo "Database container '{{db_container}}' stopped"

# Remove the PostgreSQL container
db-rm: db-stop
    docker rm {{db_container}}
    @echo "Database container '{{db_container}}' removed"
