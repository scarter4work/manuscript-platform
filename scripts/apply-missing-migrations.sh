#!/bin/bash
# Apply missing migrations to production database
# Missing: migration_002 through migration_019

set -e  # Exit on error

# Database connection details
DB_HOST="${DATABASE_HOST:-dpg-d45bhn6uk2gs73cdp7vg-a.oregon-postgres.render.com}"
DB_USER="${DATABASE_USER:-manuscript_platform_user}"
DB_NAME="${DATABASE_NAME:-manuscript_platform}"
DB_PASSWORD="${DATABASE_PASSWORD}"

# Check if password is provided
if [ -z "$DB_PASSWORD" ]; then
  echo "Error: DATABASE_PASSWORD environment variable not set"
  echo "Usage: DATABASE_PASSWORD='your_password' ./scripts/apply-missing-migrations.sh"
  exit 1
fi

echo "🔍 Checking current migration status..."

# List of missing migrations in order
MIGRATIONS=(
  "migration_002_dmca_fields.sql"
  "migration_003_payment_tables.sql"
  "migration_004_cost_tracking.sql"
  "migration_004_rate_limiting.sql"
  "migration_005_add_full_name.sql"
  "migration_006_password_reset_tokens.sql"
  "migration_007_team_collaboration.sql"
  "migration_008_email_system.sql"
  "migration_009_audiobook_tables.sql"
  "migration_010_review_system.sql"
  "migration_011_publishing_system.sql"
  "migration_012_public_api.sql"
  "migration_013_kdp_export.sql"
  "migration_019_series_management.sql"
  "migration_020_doc_monitoring.sql"
  "migration_021_multi_platform_exports.sql"
  "migration_022_progress_tracking.sql"
)

echo "📦 Found ${#MIGRATIONS[@]} migrations to apply"
echo ""

# Apply each migration
for migration_file in "${MIGRATIONS[@]}"; do
  migration_name="${migration_file%.sql}"

  echo "⏳ Applying: $migration_name"

  # Check if already applied
  ALREADY_APPLIED=$(PGPASSWORD="$DB_PASSWORD" psql \
    -h "$DB_HOST" \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    -t -c "SELECT COUNT(*) FROM schema_migrations WHERE migration_name = '$migration_name'")

  if [ "$ALREADY_APPLIED" -gt 0 ]; then
    echo "   ⏭️  Skipped (already applied)"
    continue
  fi

  # Apply the migration
  if PGPASSWORD="$DB_PASSWORD" psql \
    -h "$DB_HOST" \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    -f "sql/$migration_file" > /dev/null 2>&1; then

    # Record in schema_migrations
    PGPASSWORD="$DB_PASSWORD" psql \
      -h "$DB_HOST" \
      -U "$DB_USER" \
      -d "$DB_NAME" \
      -c "INSERT INTO schema_migrations (migration_name, applied_at) VALUES ('$migration_name', NOW())" > /dev/null

    echo "   ✅ Applied successfully"
  else
    echo "   ❌ Failed to apply $migration_name"
    echo "   Check sql/$migration_file for errors"
    exit 1
  fi
done

echo ""
echo "🎉 All migrations applied successfully!"
echo ""
echo "📊 Current migration status:"
PGPASSWORD="$DB_PASSWORD" psql \
  -h "$DB_HOST" \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  -c "SELECT COUNT(*) as total_migrations FROM schema_migrations"
