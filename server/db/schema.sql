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

CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  buyer_id INTEGER REFERENCES users(id) NOT NULL,
  listing_id INTEGER REFERENCES listings(id) NOT NULL,
  seller_id INTEGER REFERENCES users(id) NOT NULL,
  item_price INTEGER NOT NULL,
  platform_fee INTEGER NOT NULL,
  total_price INTEGER NOT NULL,
  delivery_method TEXT DEFAULT 'collect' CHECK(delivery_method IN ('collect','delivery')),
  delivery_address TEXT NOT NULL,
  delivery_lat DOUBLE PRECISION,
  delivery_lng DOUBLE PRECISION,
  delivery_city TEXT,
  delivery_province TEXT,
  delivery_postal_code TEXT,
  buyer_phone TEXT,
  buyer_notes TEXT,
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending','paid','shipped','delivered','cancelled','refunded')),
  payment_reference TEXT,
  tracking_reference TEXT,
  shipment_id TEXT,
  courier_fee INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
