# OpenStudio Database Schema

This document provides a comprehensive reference for the Supabase PostgreSQL database schema used by OpenStudio.

---

## Generating Schema Documentation

Run the following SQL query in the Supabase SQL Editor to extract a comprehensive schema overview. Copy the results and update the schema sections below.

### Complete Schema Extraction Query

```sql
-- =====================================================
-- OPENSTUDIO COMPREHENSIVE SCHEMA EXTRACTION
-- Run this in Supabase SQL Editor
-- =====================================================

-- 1. ALL TABLES WITH COLUMNS, TYPES, AND CONSTRAINTS
SELECT
    '## Table: ' || t.table_name AS section,
    ''
FROM information_schema.tables t
WHERE t.table_schema = 'public'
  AND t.table_type = 'BASE TABLE'
ORDER BY t.table_name;

-- Detailed table structure
SELECT
    t.table_name,
    c.column_name,
    c.data_type,
    c.udt_name AS underlying_type,
    c.is_nullable,
    c.column_default,
    c.character_maximum_length,
    c.numeric_precision,
    c.numeric_scale,
    CASE
        WHEN pk.column_name IS NOT NULL THEN 'PRIMARY KEY'
        ELSE NULL
    END AS is_primary_key,
    CASE
        WHEN fk.column_name IS NOT NULL THEN fk.foreign_table || '(' || fk.foreign_column || ')'
        ELSE NULL
    END AS foreign_key_reference
FROM information_schema.tables t
JOIN information_schema.columns c
    ON t.table_name = c.table_name
    AND t.table_schema = c.table_schema
LEFT JOIN (
    SELECT
        kcu.table_name,
        kcu.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
    WHERE tc.constraint_type = 'PRIMARY KEY'
        AND tc.table_schema = 'public'
) pk ON c.table_name = pk.table_name AND c.column_name = pk.column_name
LEFT JOIN (
    SELECT
        kcu.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table,
        ccu.column_name AS foreign_column
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu
        ON tc.constraint_name = ccu.constraint_name
        AND tc.table_schema = ccu.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = 'public'
) fk ON c.table_name = fk.table_name AND c.column_name = fk.column_name
WHERE t.table_schema = 'public'
  AND t.table_type = 'BASE TABLE'
ORDER BY t.table_name, c.ordinal_position;

-- 2. ALL INDEXES
SELECT
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

-- 3. ALL FOREIGN KEY RELATIONSHIPS (detailed)
SELECT
    tc.table_name AS source_table,
    kcu.column_name AS source_column,
    ccu.table_name AS target_table,
    ccu.column_name AS target_column,
    tc.constraint_name,
    rc.update_rule,
    rc.delete_rule
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage ccu
    ON tc.constraint_name = ccu.constraint_name
    AND tc.table_schema = ccu.table_schema
JOIN information_schema.referential_constraints rc
    ON tc.constraint_name = rc.constraint_name
    AND tc.table_schema = rc.constraint_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
ORDER BY tc.table_name, kcu.column_name;

-- 4. ALL ENUM TYPES
SELECT
    t.typname AS enum_name,
    e.enumlabel AS enum_value,
    e.enumsortorder AS sort_order
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
JOIN pg_catalog.pg_namespace n ON t.typnamespace = n.oid
WHERE n.nspname = 'public'
ORDER BY t.typname, e.enumsortorder;

-- 5. ALL CHECK CONSTRAINTS
SELECT
    tc.table_name,
    tc.constraint_name,
    cc.check_clause
FROM information_schema.table_constraints tc
JOIN information_schema.check_constraints cc
    ON tc.constraint_name = cc.constraint_name
    AND tc.constraint_schema = cc.constraint_schema
WHERE tc.table_schema = 'public'
    AND tc.constraint_type = 'CHECK'
    AND cc.check_clause NOT LIKE '%IS NOT NULL%'
ORDER BY tc.table_name, tc.constraint_name;

-- 6. ALL UNIQUE CONSTRAINTS
SELECT
    tc.table_name,
    tc.constraint_name,
    string_agg(kcu.column_name, ', ' ORDER BY kcu.ordinal_position) AS columns
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
WHERE tc.constraint_type = 'UNIQUE'
    AND tc.table_schema = 'public'
GROUP BY tc.table_name, tc.constraint_name
ORDER BY tc.table_name, tc.constraint_name;

-- 7. ALL TRIGGERS
SELECT
    trigger_name,
    event_object_table AS table_name,
    event_manipulation AS trigger_event,
    action_timing AS timing,
    action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;

-- 8. ALL FUNCTIONS/STORED PROCEDURES
SELECT
    p.proname AS function_name,
    pg_get_function_arguments(p.oid) AS arguments,
    pg_get_function_result(p.oid) AS return_type,
    CASE p.prokind
        WHEN 'f' THEN 'function'
        WHEN 'p' THEN 'procedure'
        WHEN 'a' THEN 'aggregate'
        WHEN 'w' THEN 'window'
    END AS kind,
    l.lanname AS language,
    p.prosrc AS source_code
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
JOIN pg_language l ON p.prolang = l.oid
WHERE n.nspname = 'public'
    AND p.proname NOT LIKE 'pg_%'
ORDER BY p.proname;

-- 9. ALL VIEWS
SELECT
    table_name AS view_name,
    view_definition
FROM information_schema.views
WHERE table_schema = 'public'
ORDER BY table_name;

-- 10. ROW LEVEL SECURITY (RLS) POLICIES
SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual AS using_expression,
    with_check AS with_check_expression
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- 11. TABLE ROW COUNTS (approximate for large tables)
SELECT
    relname AS table_name,
    n_live_tup AS approximate_row_count
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY n_live_tup DESC;

-- 12. STORAGE/BUCKET INFO (if using Supabase Storage)
SELECT
    id,
    name,
    public,
    created_at,
    updated_at
FROM storage.buckets
ORDER BY name;
```

---

## Quick Reference Queries

### List All Tables

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY table_name;
```

### Table Relationships Diagram Data

```sql
-- Get all relationships for creating an ERD
SELECT
    kcu.table_name AS from_table,
    kcu.column_name AS from_column,
    ccu.table_name AS to_table,
    ccu.column_name AS to_column
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu
    ON tc.constraint_name = ccu.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public';
```

### Check RLS Status Per Table

```sql
SELECT
    schemaname,
    tablename,
    rowsecurity AS rls_enabled,
    forcerowsecurity AS rls_forced
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
```

---

## Current Schema

> **Note:** Run the extraction query above and paste the results here to document the current schema.

### Tables

<!-- Paste extracted table information here -->

*Schema not yet extracted. Run the SQL query above in Supabase SQL Editor.*

### Enums

<!-- Paste extracted enum types here -->

*Schema not yet extracted. Run the SQL query above in Supabase SQL Editor.*

### Foreign Key Relationships

<!-- Paste extracted relationships here -->

*Schema not yet extracted. Run the SQL query above in Supabase SQL Editor.*

### RLS Policies

<!-- Paste extracted RLS policies here -->

*Schema not yet extracted. Run the SQL query above in Supabase SQL Editor.*

### Functions

<!-- Paste extracted functions here -->

*Schema not yet extracted. Run the SQL query above in Supabase SQL Editor.*

### Triggers

<!-- Paste extracted triggers here -->

*Schema not yet extracted. Run the SQL query above in Supabase SQL Editor.*

### Indexes

<!-- Paste extracted indexes here -->

*Schema not yet extracted. Run the SQL query above in Supabase SQL Editor.*

### Storage Buckets

<!-- Paste extracted bucket info here -->

*Schema not yet extracted. Run the SQL query above in Supabase SQL Editor.*

---

## Schema Change Log

| Date | Change | Migration File |
|------|--------|----------------|
| *TBD* | Initial schema documentation | N/A |

---

## Best Practices

### Adding New Tables

1. Always include `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
2. Include `created_at TIMESTAMPTZ DEFAULT NOW()`
3. Include `updated_at TIMESTAMPTZ DEFAULT NOW()` with a trigger
4. Enable RLS and add appropriate policies
5. Add indexes for frequently queried columns
6. Document foreign key relationships

### Naming Conventions

- Tables: `snake_case`, plural (e.g., `audio_tracks`, `user_sessions`)
- Columns: `snake_case` (e.g., `created_at`, `user_id`)
- Foreign keys: `<referenced_table_singular>_id` (e.g., `user_id`, `project_id`)
- Indexes: `idx_<table>_<columns>` (e.g., `idx_tracks_user_id`)
- Constraints: `<table>_<columns>_<type>` (e.g., `users_email_unique`)

### RLS Policy Guidelines

- All tables should have RLS enabled
- Use `auth.uid()` for user-based access control
- Name policies descriptively: `<table>_<action>_<condition>` (e.g., `tracks_select_own`)
