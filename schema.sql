CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE COLLATE NOCASE, first_name TEXT NOT NULL, last_name TEXT NOT NULL, password_hash TEXT NOT NULL, salt TEXT NOT NULL, photo_key TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS user_state (user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, state_json TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS customer_orders (id TEXT PRIMARY KEY, owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, order_json TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'new', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX IF NOT EXISTS idx_customer_orders_owner ON customer_orders(owner_user_id, created_at DESC);
CREATE TABLE IF NOT EXISTS notifications (id TEXT PRIMARY KEY, owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, kind TEXT NOT NULL DEFAULT 'info', title TEXT NOT NULL, body TEXT NOT NULL DEFAULT '', data_json TEXT, is_read INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX IF NOT EXISTS idx_notifications_owner ON notifications(owner_user_id, is_read, created_at DESC);

CREATE TABLE IF NOT EXISTS store_settings (
  owner_user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  origin_lat REAL NOT NULL DEFAULT 40.4093,
  origin_lng REAL NOT NULL DEFAULT 49.8671,
  origin_label TEXT NOT NULL DEFAULT 'Bakı mərkəz',
  base_fee REAL NOT NULL DEFAULT 2.5,
  per_km REAL NOT NULL DEFAULT 0.75,
  min_fee REAL NOT NULL DEFAULT 3.5,
  morning_multiplier REAL NOT NULL DEFAULT 1.15,
  evening_multiplier REAL NOT NULL DEFAULT 1.25,
  night_multiplier REAL NOT NULL DEFAULT 1.20,
  weekend_multiplier REAL NOT NULL DEFAULT 1.10,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ai_price_watch (
  owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  product_name TEXT NOT NULL,
  country_key TEXT NOT NULL DEFAULT 'america',
  weight_grams REAL NOT NULL DEFAULT 0,
  current_total_azn REAL NOT NULL DEFAULT 0,
  enabled INTEGER NOT NULL DEFAULT 1,
  threshold_pct REAL NOT NULL DEFAULT 8,
  last_scan_at TEXT,
  best_total_azn REAL,
  best_product_azn REAL,
  best_shipping_azn REAL,
  best_title TEXT,
  best_url TEXT,
  best_source TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(owner_user_id, product_id)
);
CREATE INDEX IF NOT EXISTS idx_ai_watch_owner ON ai_price_watch(owner_user_id,enabled,updated_at);
CREATE TABLE IF NOT EXISTS ai_price_offers (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT '',
  product_price_azn REAL NOT NULL,
  shipping_azn REAL NOT NULL DEFAULT 0,
  total_azn REAL NOT NULL,
  currency TEXT NOT NULL DEFAULT 'AZN',
  raw_price REAL NOT NULL DEFAULT 0,
  found_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_ai_offer_product ON ai_price_offers(owner_user_id,product_id,total_azn,found_at DESC);
