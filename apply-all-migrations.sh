#!/bin/bash
# Apply all migrations using psql directly

export PGPASSWORD='Bjoran32!'
PSQL="/c/Program Files/PostgreSQL/17/bin/psql"
DB_CONFIG="-U postgres -h 127.0.0.1 -d manuscript_platform_test"

echo "Applying migrations..."

# Apply migrations in order
for file in \
  sql/migration_002_dmca_fields.sql \
  sql/migration_003_payment_tables.sql \
  sql/migration_004_cost_tracking.sql \
  sql/migration_005_add_full_name.sql \
  sql/migration_006_password_reset_tokens.sql \
  sql/migration_007_team_collaboration.sql \
  sql/migration_008_email_system.sql \
  sql/migration_009_audiobook_tables.sql \
  sql/migration_010_review_system.sql \
  sql/migration_011_publishing_system.sql \
  sql/migration_012_public_api.sql \
  sql/migration_013_kdp_export.sql \
  sql/migration_019_series_management.sql \
  sql/migration_020_doc_monitoring.sql \
  sql/migration_021_multi_platform_exports.sql \
  sql/migration_022_progress_tracking.sql \
  migrations/migration_020_author_bios.sql \
  migrations/migration_021_cover_design_briefs.sql \
  migrations/migration_022_enhanced_metadata.sql \
  migrations/migration_022_seed_data.sql \
  migrations/migration_023_supporting_documents.sql \
  migrations/migration_024_submission_packages.sql \
  migrations/migration_025_submission_responses.sql \
  migrations/migration_026_human_editor.sql \
  migrations/migration_027_marketing_content.sql \
  migrations/migration_028_manuscript_formatting.sql \
  migrations/migration_029_communication_system.sql \
  migrations/migration_030_slush_pile_management.sql \
  migrations/migration_031_submission_windows_deadlines.sql \
  migrations/migration_032_kdp_integration.sql \
  migrations/migration_033_market_analysis.sql \
  migrations/migration_034_sales_tracking.sql \
  migrations/migration_035_rights_management.sql \
  migrations/migration_036_ai_chat_assistants.sql \
  migrations/migration_037_competitive_analysis.sql \
  migrations/migration_038_security_incidents.sql
do
  if [ -f "$file" ]; then
    echo "Applying: $file"
    "$PSQL" $DB_CONFIG -f "$file" > /dev/null 2>&1
    if [ $? -eq 0 ]; then
      echo "  ✓ Success"
    else
      echo "  ✗ Failed (see errors below)"
      "$PSQL" $DB_CONFIG -f "$file" 2>&1 | grep "ERROR" | head -5
    fi
  else
    echo "Skipping: $file (not found)"
  fi
done

echo ""
echo "Migration complete! Checking table count..."
"$PSQL" $DB_CONFIG -c "SELECT COUNT(*) as table_count FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';"
