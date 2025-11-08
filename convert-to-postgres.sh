#!/bin/bash
# Convert SQLite migrations to PostgreSQL

# Combine all migrations
cat migrations/migration_*.sql > combined-schema.sql

# Convert SQLite-specific syntax to PostgreSQL
sed -i 's/INTEGER PRIMARY KEY AUTOINCREMENT/SERIAL PRIMARY KEY/g' combined-schema.sql
sed -i 's/AUTOINCREMENT//g' combined-schema.sql
sed -i 's/DATETIME/TIMESTAMP/g' combined-schema.sql
sed -i 's/IF NOT EXISTS/IF NOT EXISTS/g' combined-schema.sql

# Create PostgreSQL version
cp combined-schema.sql postgres-schema.sql

echo "Created postgres-schema.sql"
ls -lh postgres-schema.sql
