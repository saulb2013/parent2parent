CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  avatar_url TEXT,
  province TEXT,
  city TEXT,
  phone TEXT,
  bio TEXT,
  reset_token TEXT,
  reset_token_expires TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  emoji TEXT,
  description TEXT
);

CREATE TABLE IF NOT EXISTS listings (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  price INTEGER NOT NULL,
  negotiable BOOLEAN DEFAULT FALSE,
  condition TEXT CHECK(condition IN ('new','like_new','good','fair')) NOT NULL,
  category_id INTEGER REFERENCES categories(id),
  seller_id INTEGER REFERENCES users(id),
  province TEXT NOT NULL,
  city TEXT NOT NULL,
  status TEXT DEFAULT 'active' CHECK(status IN ('active','sold','archived','hidden')),
  views INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS listing_images (
  id SERIAL PRIMARY KEY,
  listing_id INTEGER REFERENCES listings(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  is_primary BOOLEAN DEFAULT FALSE,
  display_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS saved_listings (
  user_id INTEGER REFERENCES users(id),
  listing_id INTEGER REFERENCES listings(id),
  saved_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, listing_id)
);
