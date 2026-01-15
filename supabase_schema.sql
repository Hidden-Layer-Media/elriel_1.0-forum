-- Elriel - Supabase Schema
-- Execute this in the Supabase SQL Editor to create all tables

-- Enable RLS (Row Level Security)
-- Note: Managed through Supabase dashboard, no need to set JWT secret manually

-- Users table
CREATE TABLE IF NOT EXISTS public.users (
  id SERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  last_login TIMESTAMPTZ,
  is_admin INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active'
);

-- Enable RLS on users table
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status TEXT,
  background_image TEXT,
  custom_css TEXT,
  custom_html TEXT,
  blog_layout TEXT DEFAULT 'feed',
  glyph_id INTEGER,
  district_id INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Enable RLS on profiles table
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Posts table
CREATE TABLE IF NOT EXISTS public.posts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  tags TEXT,
  is_encrypted INTEGER DEFAULT 0,
  encryption_key TEXT,
  glyph_id INTEGER,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Enable RLS on posts table
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

-- Glyphs table
CREATE TABLE IF NOT EXISTS public.glyphs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
  svg_data TEXT NOT NULL,
  audio_data TEXT,
  seed TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Enable RLS on glyphs table
ALTER TABLE public.glyphs ENABLE ROW LEVEL SECURITY;

-- Whispers table (anonymous messages)
CREATE TABLE IF NOT EXISTS public.whispers (
  id SERIAL PRIMARY KEY,
  content TEXT NOT NULL,
  glyph_id INTEGER REFERENCES public.glyphs(id) ON DELETE SET NULL,
  is_encrypted INTEGER DEFAULT 0,
  encryption_key TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Enable RLS on whispers table
ALTER TABLE public.whispers ENABLE ROW LEVEL SECURITY;

-- Districts table (aesthetic sub-networks)
CREATE TABLE IF NOT EXISTS public.districts (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  theme TEXT,
  is_hidden INTEGER DEFAULT 0,
  access_code TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Enable RLS on districts table
ALTER TABLE public.districts ENABLE ROW LEVEL SECURITY;

-- Announcements table (for admin messages on landing page)
CREATE TABLE IF NOT EXISTS public.announcements (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  is_active INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Enable RLS on announcements table
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- Add RLS policies

-- Basic RLS policies for initial setup
-- Note: For simplicity, we're using basic policies until authentication is properly set up

-- Users policies
CREATE POLICY "Allow public access to users"
  ON public.users FOR SELECT
  USING (true);

-- For development only - replace with proper auth later
CREATE POLICY "Temporary allow all operations on users"
  ON public.users FOR ALL
  USING (true);

-- Profiles policies
CREATE POLICY "Allow public access to profiles"
  ON public.profiles FOR SELECT
  USING (true);

-- For development only - replace with proper auth later
CREATE POLICY "Temporary allow all operations on profiles"
  ON public.profiles FOR ALL
  USING (true);

-- Posts policies
CREATE POLICY "Allow public access to non-encrypted posts"
  ON public.posts FOR SELECT
  USING (is_encrypted = 0);

-- For development only - replace with proper auth later
CREATE POLICY "Temporary allow all operations on posts"
  ON public.posts FOR ALL
  USING (true);

-- Glyphs policies
CREATE POLICY "Allow public access to glyphs"
  ON public.glyphs FOR SELECT
  USING (true);

-- For development only - replace with proper auth later
CREATE POLICY "Temporary allow all operations on glyphs"
  ON public.glyphs FOR ALL
  USING (true);

-- Whispers policies
CREATE POLICY "Allow public access to whispers"
  ON public.whispers FOR SELECT
  USING (true);

-- For development only - replace with proper auth later
CREATE POLICY "Temporary allow all operations on whispers"
  ON public.whispers FOR ALL
  USING (true);

-- Districts policies
CREATE POLICY "Allow public access to districts"
  ON public.districts FOR SELECT
  USING (true);

-- For development only - replace with proper auth later
CREATE POLICY "Temporary allow all operations on districts"
  ON public.districts FOR ALL
  USING (true);

-- Announcements policies
CREATE POLICY "Allow public access to announcements"
  ON public.announcements FOR SELECT
  USING (true);

-- For development only - replace with proper auth later
CREATE POLICY "Temporary allow all operations on announcements"
  ON public.announcements FOR ALL
  USING (true);

-- Forums table
CREATE TABLE IF NOT EXISTS public.forums (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  position INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Enable RLS on forums table
ALTER TABLE public.forums ENABLE ROW LEVEL SECURITY;

-- Policies for forums
CREATE POLICY "Allow public access to forums"
  ON public.forums FOR SELECT
  USING (true);

-- For development only - replace with proper auth later
CREATE POLICY "Temporary allow all operations on forums"
  ON public.forums FOR ALL
  USING (true);

-- Forum topics table
CREATE TABLE IF NOT EXISTS public.forum_topics (
  id SERIAL PRIMARY KEY,
  forum_id INTEGER NOT NULL REFERENCES public.forums(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  is_pinned INTEGER DEFAULT 0,
  view_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Enable RLS on forum_topics table
ALTER TABLE public.forum_topics ENABLE ROW LEVEL SECURITY;

-- Policies for forum_topics
CREATE POLICY "Allow public access to forum topics"
  ON public.forum_topics FOR SELECT
  USING (true);

CREATE POLICY "Allow authenticated users to create topics"
  ON public.forum_topics FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow users to update their own topics"
  ON public.forum_topics FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow users to delete their own topics"
  ON public.forum_topics FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- For development only - replace with proper auth later
CREATE POLICY "Temporary allow all operations on forum topics"
  ON public.forum_topics FOR ALL
  USING (true);

-- Forum comments table
CREATE TABLE IF NOT EXISTS public.forum_comments (
  id SERIAL PRIMARY KEY,
  topic_id INTEGER NOT NULL REFERENCES public.forum_topics(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Enable RLS on forum_comments table
ALTER TABLE public.forum_comments ENABLE ROW LEVEL SECURITY;

-- Policies for forum_comments
CREATE POLICY "Allow public access to forum comments"
  ON public.forum_comments FOR SELECT
  USING (true);

CREATE POLICY "Allow authenticated users to create comments"
  ON public.forum_comments FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow users to update their own comments"
  ON public.forum_comments FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow users to delete their own comments"
  ON public.forum_comments FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- For development only - replace with proper auth later
CREATE POLICY "Temporary allow all operations on forum comments"
  ON public.forum_comments FOR ALL
  USING (true);

-- User signatures table
CREATE TABLE IF NOT EXISTS public.user_signatures (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  content TEXT,
  is_enabled INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Enable RLS on user_signatures table
ALTER TABLE public.user_signatures ENABLE ROW LEVEL SECURITY;

-- Policies for user_signatures
CREATE POLICY "Allow public access to user signatures"
  ON public.user_signatures FOR SELECT
  USING (true);

CREATE POLICY "Allow users to manage their own signatures"
  ON public.user_signatures FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- For development only - replace with proper auth later
CREATE POLICY "Temporary allow all operations on user signatures"
  ON public.user_signatures FOR ALL
  USING (true);

-- User rewards table
CREATE TABLE IF NOT EXISTS public.user_rewards (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  reward_id INTEGER NOT NULL,
  is_equipped INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Enable RLS on user_rewards table
ALTER TABLE public.user_rewards ENABLE ROW LEVEL SECURITY;

-- Policies for user_rewards
CREATE POLICY "Allow public access to user rewards"
  ON public.user_rewards FOR SELECT
  USING (true);

CREATE POLICY "Allow users to manage their own rewards"
  ON public.user_rewards FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- For development only - replace with proper auth later
CREATE POLICY "Temporary allow all operations on user rewards"
  ON public.user_rewards FOR ALL
  USING (true);

-- Repute rewards table (rewards users can earn)
CREATE TABLE IF NOT EXISTS public.repute_rewards (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  reputation_cost INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Enable RLS on repute_rewards table
ALTER TABLE public.repute_rewards ENABLE ROW LEVEL SECURITY;

-- Policies for repute_rewards
CREATE POLICY "Allow public access to repute rewards"
  ON public.repute_rewards FOR SELECT
  USING (true);

-- For development only - replace with proper auth later
CREATE POLICY "Temporary allow all operations on repute rewards"
  ON public.repute_rewards FOR ALL
  USING (true);

-- Insert sample forum (Scrapyard)
INSERT INTO public.forums (title, slug, description, position)
VALUES ('Scrapyard', 'scrapyard', 'A digital wasteland marketplace for sharing code artifacts, images, and web assets.', 1)
ON CONFLICT (slug) DO NOTHING;

-- Insert sample rewards
INSERT INTO public.repute_rewards (id, name, description, reputation_cost)
VALUES
  (1, 'Forum Badge', 'Badge for active forum participation', 10),
  (2, 'Topic Creator', 'Award for creating engaging topics', 25)
ON CONFLICT (id) DO NOTHING;

-- Create increment function for reputation
CREATE OR REPLACE FUNCTION increment_reputation(user_id INTEGER, amount INTEGER)
RETURNS INTEGER AS $$
BEGIN
  UPDATE public.profiles
  SET reputation = reputation + amount
  WHERE user_id = $1;
  
  RETURN amount;
END;
$$ LANGUAGE plpgsql;

-- Insert default scrapyard forum if not exists
INSERT INTO public.forums (title, slug, description, position)
SELECT 'Scrapyard', 'scrapyard', 'Digital asset marketplace and code sharing hub.', 99
WHERE NOT EXISTS (SELECT 1 FROM public.forums WHERE slug = 'scrapyard');

-- Insert default district (Numbpill Cell)
INSERT INTO public.districts (id, name, description, theme)
VALUES (1, 'Numbpill Cell', 'The primary node of the Elriel network. A digital wasteland of glitched terminals and corrupted data.', 'terminal')
ON CONFLICT (id) DO NOTHING;

-- Insert initial announcement
INSERT INTO public.announcements (id, title, content)
VALUES (1, 'SYSTEM ALERT', 'Welcome to Elriel. This terminal has been compromised. Proceed with caution. The Numbpill Cell awaits your contribution.')
ON CONFLICT (id) DO NOTHING;

-- Profile Enhancements

-- Create ENUM for layout_type
CREATE TYPE IF NOT EXISTS profile_layout_type AS ENUM ('one-column', 'two-column');

-- Add new columns to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS avatar_url TEXT,
ADD COLUMN IF NOT EXISTS bio TEXT,
ADD COLUMN IF NOT EXISTS layout_type profile_layout_type DEFAULT 'two-column',
ADD COLUMN IF NOT EXISTS sidebar_config JSONB DEFAULT '{}'::JSONB,
ADD COLUMN IF NOT EXISTS main_content JSONB[] DEFAULT ARRAY[]::JSONB;

-- Create ENUM for zone
CREATE TYPE IF NOT EXISTS profile_zone AS ENUM ('sidebar', 'main-left', 'main-right');

-- Create profile_containers table
CREATE TABLE IF NOT EXISTS public.profile_containers (
  id SERIAL PRIMARY KEY,
  profile_id INTEGER NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  zone profile_zone NOT NULL,
  container_type TEXT NOT NULL,
  title TEXT,
  content TEXT,
  position INTEGER DEFAULT 0,
  settings JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Enable RLS on profile_containers table
ALTER TABLE public.profile_containers ENABLE ROW LEVEL SECURITY;

-- Policies for profile_containers
CREATE POLICY "Allow public access to profile containers"
  ON public.profile_containers FOR SELECT
  USING (true);

-- For development only - replace with proper auth later
CREATE POLICY "Temporary allow all operations on profile containers"
  ON public.profile_containers FOR ALL
  USING (true);
-- Add missing columns for profile enhancements
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS header_image TEXT;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS theme_template TEXT DEFAULT 'default';

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS glyph_3d BOOLEAN DEFAULT false;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS glyph_rotation_speed INTEGER DEFAULT 3;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS profile_bg_type TEXT DEFAULT 'single';

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS profile_bg_tile BOOLEAN DEFAULT false;

-- Ensure updated_at trigger for profiles (if not exists)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE
    ON public.profiles FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- Similar trigger for profile_containers if needed
CREATE TRIGGER update_profile_containers_updated_at BEFORE UPDATE
    ON public.profile_containers FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- Comments table for posts
CREATE TABLE IF NOT EXISTS public.post_comments (
  id SERIAL PRIMARY KEY,
  post_id INTEGER NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Enable RLS on post_comments table
ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;

-- Policies for post_comments
CREATE POLICY "Allow public access to post comments"
  ON public.post_comments FOR SELECT
  USING (true);

CREATE POLICY "Allow authenticated users to create comments"
  ON public.post_comments FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow users to update their own comments"
  ON public.post_comments FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow users to delete their own comments"
  ON public.post_comments FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- For development only - replace with proper auth later
CREATE POLICY "Temporary allow all operations on post comments"
  ON public.post_comments FOR ALL
  USING (true);

-- Likes table for posts
CREATE TABLE IF NOT EXISTS public.post_likes (
  id SERIAL PRIMARY KEY,
  post_id INTEGER NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('like', 'dislike')),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(post_id, user_id)
);

-- Enable RLS on post_likes table
ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;

-- Policies for post_likes
CREATE POLICY "Allow public access to post likes"
  ON public.post_likes FOR SELECT
  USING (true);

CREATE POLICY "Allow authenticated users to manage likes"
  ON public.post_likes FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- For development only - replace with proper auth later
CREATE POLICY "Temporary allow all operations on post likes"
  ON public.post_likes FOR ALL
  USING (true);

-- Add vote columns to forum_topics
ALTER TABLE public.forum_topics
ADD COLUMN IF NOT EXISTS upvotes INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS downvotes INTEGER DEFAULT 0;

-- Votes table for forum topics
CREATE TABLE IF NOT EXISTS public.forum_topic_votes (
  id SERIAL PRIMARY KEY,
  topic_id INTEGER NOT NULL REFERENCES public.forum_topics(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  vote_type TEXT NOT NULL CHECK (vote_type IN ('up', 'down')),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(topic_id, user_id)
);

-- Enable RLS on forum_topic_votes table
ALTER TABLE public.forum_topic_votes ENABLE ROW LEVEL SECURITY;

-- Policies for forum_topic_votes
CREATE POLICY "Allow public access to forum topic votes"
  ON public.forum_topic_votes FOR SELECT
  USING (true);

CREATE POLICY "Allow authenticated users to manage votes"
  ON public.forum_topic_votes FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- For development only - replace with proper auth later
CREATE POLICY "Temporary allow all operations on forum topic votes"
  ON public.forum_topic_votes FOR ALL
  USING (true);