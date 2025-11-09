-- CONVERTED TO POSTGRESQL SYNTAX (2025-11-09)
-- NOTE: GROUP BY clauses may need manual review for PostgreSQL compatibility
-- Migration 027: Social Media Marketing Content Generator (Issue #45)
-- AI-powered marketing kit generation with platform-specific social media posts,
-- email templates, content calendar, trailer scripts, and reader magnets

-- Master table for marketing kits
CREATE TABLE IF NOT EXISTS marketing_kits (
  id TEXT PRIMARY KEY,
  manuscript_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  kit_name TEXT NOT NULL, -- e.g., "Launch Marketing Kit", "Series Promo Kit"
  genre TEXT,
  target_audience TEXT, -- JSON: demographics, reader interests
  tone TEXT, -- 'professional', 'casual', 'humorous', 'dramatic'
  generation_cost DOUBLE PRECISION, -- Claude API cost
  generated_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,
  created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,
  updated_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,
  FOREIGN KEY (manuscript_id) REFERENCES manuscripts(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_marketing_kits_manuscript ON marketing_kits(manuscript_id);
CREATE INDEX IF NOT EXISTS idx_marketing_kits_user ON marketing_kits(user_id);
CREATE INDEX IF NOT EXISTS idx_marketing_kits_created ON marketing_kits(created_at DESC);

-- Auto-update trigger
CREATE TRIGGER IF NOT EXISTS update_marketing_kits_timestamp
AFTER UPDATE ON marketing_kits
BEGIN
  UPDATE marketing_kits SET updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT WHERE id = NEW.id;
END;

-- Social media posts (platform-specific)
CREATE TABLE IF NOT EXISTS social_media_posts (
  id TEXT PRIMARY KEY,
  kit_id TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN
    ('twitter', 'facebook', 'instagram', 'tiktok', 'linkedin', 'threads', 'bluesky')),
  post_type TEXT NOT NULL CHECK (post_type IN
    ('announcement', 'character_spotlight', 'quote', 'behind_scenes',
     'engagement_question', 'countdown', 'review_request', 'giveaway', 'other')),
  post_text TEXT NOT NULL,
  hashtags TEXT, -- Comma-separated or JSON array
  image_suggestion TEXT, -- Description of recommended image
  optimal_posting_time TEXT, -- e.g., "Weekdays 9am-11am EST"
  character_count INTEGER, -- For platforms with limits
  engagement_hook TEXT, -- Call-to-action or engagement strategy
  post_order INTEGER DEFAULT 0, -- Sequence in campaign
  is_used INTEGER DEFAULT 0, -- Boolean: has author used this post?
  created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,
  FOREIGN KEY (kit_id) REFERENCES marketing_kits(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_social_posts_kit ON social_media_posts(kit_id);
CREATE INDEX IF NOT EXISTS idx_social_posts_platform ON social_media_posts(platform);
CREATE INDEX IF NOT EXISTS idx_social_posts_type ON social_media_posts(post_type);
CREATE INDEX IF NOT EXISTS idx_social_posts_order ON social_media_posts(post_order);

-- 30-day content calendar
CREATE TABLE IF NOT EXISTS content_calendar (
  id TEXT PRIMARY KEY,
  kit_id TEXT NOT NULL,
  day_number INTEGER NOT NULL, -- Day 1-30 (or more)
  calendar_date INTEGER, -- Optional: actual Unix timestamp if scheduled
  platform TEXT NOT NULL,
  post_id TEXT, -- FK to social_media_posts (optional)
  activity_type TEXT NOT NULL CHECK (activity_type IN
    ('post', 'engage', 'email', 'story', 'live', 'blog', 'other')),
  activity_description TEXT NOT NULL,
  time_of_day TEXT, -- 'morning', 'afternoon', 'evening', 'night'
  priority TEXT CHECK (priority IN ('high', 'medium', 'low')),
  completed INTEGER DEFAULT 0, -- Boolean: has author completed this?
  notes TEXT,
  created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,
  FOREIGN KEY (kit_id) REFERENCES marketing_kits(id) ON DELETE CASCADE,
  FOREIGN KEY (post_id) REFERENCES social_media_posts(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_calendar_kit ON content_calendar(kit_id);
CREATE INDEX IF NOT EXISTS idx_calendar_day ON content_calendar(day_number);
CREATE INDEX IF NOT EXISTS idx_calendar_platform ON content_calendar(platform);
CREATE INDEX IF NOT EXISTS idx_calendar_completed ON content_calendar(completed);

-- Marketing materials (emails, scripts, magnets)
CREATE TABLE IF NOT EXISTS marketing_materials (
  id TEXT PRIMARY KEY,
  kit_id TEXT NOT NULL,
  material_type TEXT NOT NULL CHECK (material_type IN
    ('launch_email', 'trailer_script', 'reader_magnet', 'blog_post',
     'press_release', 'interview_qa', 'other')),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  format TEXT, -- 'markdown', 'html', 'plain_text', 'script'
  word_count INTEGER,
  estimated_duration TEXT, -- For video scripts: "2-3 minutes"
  additional_notes TEXT, -- Production notes, requirements, tips
  created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,
  updated_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,
  FOREIGN KEY (kit_id) REFERENCES marketing_kits(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_materials_kit ON marketing_materials(kit_id);
CREATE INDEX IF NOT EXISTS idx_materials_type ON marketing_materials(material_type);

-- Auto-update trigger
CREATE TRIGGER IF NOT EXISTS update_marketing_materials_timestamp
AFTER UPDATE ON marketing_materials
BEGIN
  UPDATE marketing_materials SET updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT WHERE id = NEW.id;
END;

-- Hashtag strategy table (optional, for tracking performance)
CREATE TABLE IF NOT EXISTS hashtag_strategy (
  id TEXT PRIMARY KEY,
  kit_id TEXT NOT NULL,
  genre TEXT NOT NULL,
  platform TEXT NOT NULL,
  hashtag TEXT NOT NULL,
  category TEXT CHECK (category IN
    ('genre', 'trending', 'community', 'author', 'promotional')),
  estimated_reach TEXT, -- 'high', 'medium', 'low'
  notes TEXT,
  created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,
  FOREIGN KEY (kit_id) REFERENCES marketing_kits(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_hashtags_kit ON hashtag_strategy(kit_id);
CREATE INDEX IF NOT EXISTS idx_hashtags_genre ON hashtag_strategy(genre);
CREATE INDEX IF NOT EXISTS idx_hashtags_platform ON hashtag_strategy(platform);

-- Statistics view
CREATE OR REPLACE VIEW marketing_kit_stats AS
SELECT
  k.id as kit_id,
  k.manuscript_id,
  k.user_id,
  k.kit_name,
  k.genre,
  m.title as manuscript_title,
  COUNT(DISTINCT p.id) as total_posts,
  COUNT(DISTINCT CASE WHEN p.platform = 'twitter' THEN p.id END) as twitter_posts,
  COUNT(DISTINCT CASE WHEN p.platform = 'facebook' THEN p.id END) as facebook_posts,
  COUNT(DISTINCT CASE WHEN p.platform = 'instagram' THEN p.id END) as instagram_posts,
  COUNT(DISTINCT CASE WHEN p.platform = 'tiktok' THEN p.id END) as tiktok_posts,
  COUNT(DISTINCT CASE WHEN p.platform = 'linkedin' THEN p.id END) as linkedin_posts,
  COUNT(DISTINCT c.id) as calendar_items,
  COUNT(DISTINCT mat.id) as materials_count,
  SUM(CASE WHEN p.is_used = 1 THEN 1 ELSE 0 END) as posts_used,
  SUM(CASE WHEN c.completed = 1 THEN 1 ELSE 0 END) as calendar_completed,
  k.generation_cost,
  k.generated_at
FROM marketing_kits k
LEFT JOIN manuscripts m ON k.manuscript_id = m.id
LEFT JOIN social_media_posts p ON k.id = p.kit_id
LEFT JOIN content_calendar c ON k.id = c.kit_id
LEFT JOIN marketing_materials mat ON k.id = mat.kit_id
GROUP BY k.id;
