PRAGMA foreign_keys = ON;

-- =========================
-- LOOKUPS (Brand / Category)
-- =========================
CREATE TABLE IF NOT EXISTS brands (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL UNIQUE,
  active     INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS categories (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  parent_id  INTEGER REFERENCES categories(id),
  name       TEXT NOT NULL,
  active     INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_categories_parent ON categories(parent_id);

-- =========================
-- PRODUCTS (regular + keycard)
-- =========================
CREATE TABLE IF NOT EXISTS products (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  type               TEXT NOT NULL CHECK (type IN ('regular','keycard')),
  name               TEXT NOT NULL,
  description        TEXT, -- plain text or markdown
  active             INTEGER NOT NULL DEFAULT 1,

  brand_id           INTEGER REFERENCES brands(id),
  category_id        INTEGER REFERENCES categories(id),

  stripe_product_id  TEXT, -- optional mapping
  stripe_sync_status TEXT, -- pending, synced, failed
  stripe_sync_error  TEXT, -- error on failed

  created_at         TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at         TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_products_active   ON products(active);
CREATE INDEX IF NOT EXISTS idx_products_brand    ON products(brand_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);

-- Variants for REGULAR products (color, bundle, etc.)
CREATE TABLE IF NOT EXISTS variants (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id         INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sku                TEXT,
  name               TEXT NOT NULL,
  description        TEXT,
  active             INTEGER NOT NULL DEFAULT 1,
  created_at         TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_variants_product ON variants(product_id, active);

-- Tiered prices per variant
CREATE TABLE IF NOT EXISTS variant_prices (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  variant_id         INTEGER NOT NULL REFERENCES variants(id) ON DELETE CASCADE,
  min_qty            INTEGER NOT NULL DEFAULT 1 CHECK (min_qty >= 1),
  max_qty            INTEGER, -- NULL = "and up"
  currency           TEXT NOT NULL DEFAULT 'usd',
  unit_amount_cents  INTEGER NOT NULL CHECK (unit_amount_cents >= 0),
  active             INTEGER NOT NULL DEFAULT 1,

  -- optional: only if you pre-create Stripe Prices per tier
  stripe_price_id    TEXT,
  stripe_sync_status TEXT, -- pending, synced, failed
  stripe_sync_error  TEXT, -- error on failed

  created_at         TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_variant_prices_lookup
  ON variant_prices(variant_id, active, min_qty, max_qty);

-- Optional structured specs
CREATE TABLE IF NOT EXISTS product_specs (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  label      TEXT NOT NULL,
  value      TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_specs_product ON product_specs(product_id, sort_order);

-- Images for products / variants / designs
-- NOTE: entity_id points to different tables depending on entity_type (app-enforced integrity)
CREATE TABLE IF NOT EXISTS images (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type   TEXT NOT NULL CHECK (entity_type IN ('product','variant','design')),
  entity_id     INTEGER NOT NULL,
  url           TEXT NOT NULL,
  cloudflare_id TEXT,
  alt_text      TEXT,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_images_entity ON images(entity_type, entity_id);

-- =========================
-- KEYCARDS (RFID)
-- =========================

CREATE TABLE IF NOT EXISTS keycard_brands (
                                              id         INTEGER PRIMARY KEY AUTOINCREMENT,
                                              name       TEXT NOT NULL UNIQUE,
                                              active     INTEGER NOT NULL DEFAULT 1,
                                              created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_keycard_brands_active ON keycard_brands(active);

CREATE TABLE IF NOT EXISTS keycard_designs (
                                               id          INTEGER PRIMARY KEY AUTOINCREMENT,
                                               brand_id    INTEGER REFERENCES keycard_brands(id),
                                               code        TEXT NOT NULL UNIQUE,
                                               name        TEXT NOT NULL,
                                               description TEXT,
                                               active      INTEGER NOT NULL DEFAULT 1,
                                               created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_keycard_designs_brand ON keycard_designs(brand_id, active);

CREATE TABLE IF NOT EXISTS lock_tech (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL UNIQUE,
  active     INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS keycard_price_tiers (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  lock_tech_id        INTEGER NOT NULL REFERENCES lock_tech(id),
  min_boxes           INTEGER NOT NULL CHECK (min_boxes >= 1),
  max_boxes           INTEGER, -- NULL = "and up"
  currency            TEXT NOT NULL DEFAULT 'usd',
  price_per_box_cents INTEGER NOT NULL CHECK (price_per_box_cents >= 0),
  active              INTEGER NOT NULL DEFAULT 1,
  created_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_keycard_tiers_lookup
  ON keycard_price_tiers(lock_tech_id, active, min_boxes, max_boxes);

-- =========================
-- ORDERS (supports web + manual/phone + custom pricing + custom items)
-- =========================
CREATE TABLE IF NOT EXISTS orders (
  id                         INTEGER PRIMARY KEY AUTOINCREMENT,
  order_number               TEXT, -- e.g., LTS-2025-000123

  source                     TEXT NOT NULL DEFAULT 'web'
                              CHECK (source IN ('web','phone','manual')),

  order_status               TEXT NOT NULL DEFAULT 'placed'
      CHECK (order_status IN ('placed','cancelled','completed')),

  payment_status             TEXT NOT NULL DEFAULT 'pending'
      CHECK (payment_status IN ('pending','paid','refunded')),

  fulfillment_status         TEXT NOT NULL DEFAULT 'unfulfilled'
      CHECK (fulfillment_status IN ('unfulfilled','fulfilled')),

  shipping_status            TEXT NOT NULL DEFAULT 'pending'
      CHECK (shipping_status IN ('pending','shipped','delivered')),

  payment_method             TEXT NOT NULL DEFAULT 'stripe'
                              CHECK (payment_method IN ('stripe','cash','check','invoice','other')),

  external_ref               TEXT, -- invoice #, square receipt, etc.
  created_by                 TEXT, -- admin username/email/id (optional)
  is_manual_pricing          INTEGER NOT NULL DEFAULT 0, -- 1 if any negotiated/custom pricing

  currency                   TEXT NOT NULL DEFAULT 'usd',

  subtotal_cents             INTEGER NOT NULL DEFAULT 0,
  tax_cents                  INTEGER NOT NULL DEFAULT 0,
  shipping_cents             INTEGER NOT NULL DEFAULT 0,
  total_cents                INTEGER NOT NULL DEFAULT 0,

  -- Customer snapshot
  customer_email             TEXT,
  customer_phone             TEXT,
  customer_name              TEXT,

  -- Shipping snapshot
  ship_name                  TEXT,
  ship_line1                 TEXT,
  ship_line2                 TEXT,
  ship_city                  TEXT,
  ship_state                 TEXT,
  ship_postal_code           TEXT,
  ship_country               TEXT,

  -- Billing snapshot (optional)
  bill_name                  TEXT,
  bill_line1                 TEXT,
  bill_line2                 TEXT,
  bill_city                  TEXT,
  bill_state                 TEXT,
  bill_postal_code           TEXT,
  bill_country               TEXT,

  -- Stripe refs (NULL for manual orders)
  stripe_checkout_session_id TEXT, -- cs_...
  stripe_payment_intent_id   TEXT, -- pi_...
  stripe_customer_id         TEXT, -- cus_... optional

  notes                      TEXT,
  metadata_json              TEXT,

  created_at                 TEXT NOT NULL DEFAULT (datetime('now')),
  paid_at                    TEXT,
  updated_at                 TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_order_number    ON orders(order_number);
CREATE INDEX        IF NOT EXISTS idx_orders_order_status       ON orders(order_status);
CREATE INDEX        IF NOT EXISTS idx_orders_payment_status     ON orders(payment_status);
CREATE INDEX        IF NOT EXISTS idx_orders_fulfillment_status ON orders(fulfillment_status);
CREATE INDEX        IF NOT EXISTS idx_orders_shipping_status    ON orders(shipping_status);
CREATE INDEX        IF NOT EXISTS idx_orders_source          ON orders(source);
CREATE INDEX        IF NOT EXISTS idx_orders_payment_method  ON orders(payment_method);
CREATE INDEX        IF NOT EXISTS idx_orders_stripe_session  ON orders(stripe_checkout_session_id) WHERE stripe_checkout_session_id IS NOT NULL;
CREATE INDEX        IF NOT EXISTS idx_orders_email           ON orders(customer_email);

-- Order line items (regular + keycard + custom items + custom pricing)
CREATE TABLE IF NOT EXISTS order_items (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id           INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,

  item_type          TEXT NOT NULL CHECK (item_type IN ('regular','keycard')),

  -- Regular refs (nullable for custom line items)
  product_id         INTEGER REFERENCES products(id),
  variant_id         INTEGER REFERENCES variants(id),

  -- Keycard refs (for item_type='keycard')
  design_id          INTEGER REFERENCES keycard_designs(id),
  lock_tech_id       INTEGER REFERENCES lock_tech(id),
  box_size           INTEGER NOT NULL DEFAULT 200 CHECK (box_size = 200),
  boxes              INTEGER CHECK (boxes >= 1),

  -- Where did this price come from?
  price_source       TEXT NOT NULL DEFAULT 'catalog'
                      CHECK (price_source IN ('catalog','override','custom')),

  -- Stripe snapshot refs (optional; typically NULL for manual)
  stripe_price_id    TEXT,
  stripe_product_id  TEXT,

  -- Price snapshot (always store what you actually charged)
  currency           TEXT NOT NULL DEFAULT 'usd',
  unit_amount_cents  INTEGER NOT NULL CHECK (unit_amount_cents >= 0),
  quantity           INTEGER NOT NULL CHECK (quantity >= 1),
  line_total_cents   INTEGER NOT NULL CHECK (line_total_cents >= 0),

  -- For custom line items or extra human-readable detail
  description        TEXT,

  -- For full customization details (JSON)
  metadata_json      TEXT,

  created_at         TEXT NOT NULL DEFAULT (datetime('now')),

  -- Guardrails:
  -- - regular items must have a catalog ref OR a description
  -- - keycard items must have lock_tech_id and boxes
  CHECK (
    (item_type = 'regular' AND (
      product_id IS NOT NULL OR
      variant_id IS NOT NULL OR
      (description IS NOT NULL AND length(trim(description)) > 0)
    ))
    OR
    (item_type = 'keycard' AND (
      lock_tech_id IS NOT NULL AND
      boxes IS NOT NULL AND
      boxes >= 1
    ))
  )
);

CREATE INDEX IF NOT EXISTS idx_order_items_order      ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product    ON order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_order_items_variant    ON order_items(variant_id);
CREATE INDEX IF NOT EXISTS idx_order_items_keycard_lt ON order_items(lock_tech_id);
CREATE INDEX IF NOT EXISTS idx_order_items_keycard_ds ON order_items(design_id);

-- =========================
-- OPTIONAL: Stripe webhook dedupe / audit
-- =========================
CREATE TABLE IF NOT EXISTS stripe_events (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id     TEXT NOT NULL UNIQUE, -- evt_...
  event_type   TEXT NOT NULL,
  received_at  TEXT NOT NULL DEFAULT (datetime('now')),
  processed_at TEXT,
  payload_json TEXT
);

-- =========================
-- OPTIONAL (recommended): updated_at triggers
-- =========================
CREATE TRIGGER IF NOT EXISTS trg_products_updated_at
AFTER UPDATE ON products
                            FOR EACH ROW
BEGIN
UPDATE products SET updated_at = datetime('now') WHERE id = OLD.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_orders_updated_at
AFTER UPDATE ON orders
                            FOR EACH ROW
BEGIN
UPDATE orders SET updated_at = datetime('now') WHERE id = OLD.id;
END;

-- =========================
-- ADMIN USERS
-- =========================
CREATE TABLE IF NOT EXISTS admin_users (
                                           id             INTEGER PRIMARY KEY AUTOINCREMENT,
                                           email          TEXT NOT NULL UNIQUE,
                                           name           TEXT,
                                           role           TEXT NOT NULL DEFAULT 'admin'
                                           CHECK (role IN ('admin','staff','read_only')),
    password_hash  TEXT NOT NULL,
    active         INTEGER NOT NULL DEFAULT 1,
    last_login_at  TEXT,
    created_at     TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
    );

CREATE INDEX IF NOT EXISTS idx_admin_users_active ON admin_users(active);

CREATE TRIGGER IF NOT EXISTS trg_admin_users_updated_at
AFTER UPDATE ON admin_users
                            FOR EACH ROW
BEGIN
UPDATE admin_users SET updated_at = datetime('now') WHERE id = OLD.id;
END;

-- =========================
-- ADMIN SESSIONS (cookie-based auth)
-- =========================
CREATE TABLE IF NOT EXISTS admin_sessions (
                                              id            INTEGER PRIMARY KEY AUTOINCREMENT,
                                              user_id       INTEGER NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
    session_token TEXT NOT NULL UNIQUE,
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at    TEXT NOT NULL,
    revoked_at    TEXT
    );

CREATE INDEX IF NOT EXISTS idx_admin_sessions_user    ON admin_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_token   ON admin_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires ON admin_sessions(expires_at);




