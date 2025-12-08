-- ============================================
-- FILE: 000_enable_extensions.sql
-- Enable required PostgreSQL extensions
-- Must run before other migrations
-- ============================================

-- Enable UUID generation (gen_random_uuid function)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Alternative UUID extension (for uuid_generate_v4)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
