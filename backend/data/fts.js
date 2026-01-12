// backend/data/fts.js
// Global FTS5 index + triggers + backfill
// Works on existing lts.sqlite (no DB recreation)

// Bump this when you change what gets indexed (triggers/rebuild SQL)
const FTS_VERSION = 2;

const OFFSETS = {
    product: 1000000000000,
    variant: 2000000000000,
    order: 3000000000000,
    design: 4000000000000,
    lock_tech: 5000000000000,
    image: 6000000000000,
    stripe_price: 7000000000000,
};

function createFtsTable(db) {
    // Attempt 1: unicode61 + tokenchars (helps searching SKU like ABC-123, emails, etc.)
    // NOTE: the tokenchars value MUST be single-quoted *inside* the tokenize string,
    // and those quotes must be doubled in SQL.
    const sqlWithTokenchars = `
    CREATE VIRTUAL TABLE IF NOT EXISTS global_fts USING fts5(
      entity_type UNINDEXED,
      entity_id   UNINDEXED,
      title,
      body,
      tags,
      tokenize='unicode61 remove_diacritics 2 tokenchars ''_-@.''',
      prefix='2 3 4'
    );
  `;

    // Attempt 2 (fallback): plain unicode61 (most compatible)
    const sqlPlain = `
    CREATE VIRTUAL TABLE IF NOT EXISTS global_fts USING fts5(
      entity_type UNINDEXED,
      entity_id   UNINDEXED,
      title,
      body,
      tags,
      tokenize='unicode61 remove_diacritics 2',
      prefix='2 3 4'
    );
  `;

    try {
        db.exec(sqlWithTokenchars);
    } catch (e) {
        db.exec(sqlPlain);
    }
}

function ensureFts(db, { rebuild = false } = {}) {
    // Verify FTS5 is usable (practical probe)
    try {
        db.exec("CREATE VIRTUAL TABLE IF NOT EXISTS __fts5_probe USING fts5(x);");
        db.exec("DROP TABLE IF EXISTS __fts5_probe;");
    } catch (e) {
        throw new Error(
            `FTS5 is not available in this SQLite build (better-sqlite3).\n` +
            `Reinstall/rebuild better-sqlite3 for your Node version.\n` +
            `Original error: ${e?.message || e}`
        );
    }

    // Store an internal version so schema/trigger changes automatically rebuild once.
    db.exec(`
    CREATE TABLE IF NOT EXISTS fts_meta (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

    const prev = db.prepare("SELECT value FROM fts_meta WHERE key='fts_version'").get();
    const prevVersion = prev ? Number(prev.value) : null;

    if (!Number.isFinite(prevVersion) || prevVersion !== FTS_VERSION) {
        rebuild = true; // force rebuild when version changes
    }

    createFtsTable(db);

    // Triggers MUST match your current schema.
    // We DROP then recreate so schema changes don't leave old triggers behind.
    db.exec(`
    -- Drop & recreate triggers (keeps this file compatible when schema evolves)
    DROP TRIGGER IF EXISTS trg_fts_products_ai;
    DROP TRIGGER IF EXISTS trg_fts_products_au;
    DROP TRIGGER IF EXISTS trg_fts_products_ad;

    DROP TRIGGER IF EXISTS trg_fts_variants_ai;
    DROP TRIGGER IF EXISTS trg_fts_variants_au;
    DROP TRIGGER IF EXISTS trg_fts_variants_ad;

    DROP TRIGGER IF EXISTS trg_fts_variant_prices_ai;
    DROP TRIGGER IF EXISTS trg_fts_variant_prices_au;
    DROP TRIGGER IF EXISTS trg_fts_variant_prices_ad;

    DROP TRIGGER IF EXISTS trg_fts_orders_ai;
    DROP TRIGGER IF EXISTS trg_fts_orders_au;
    DROP TRIGGER IF EXISTS trg_fts_orders_ad;

    DROP TRIGGER IF EXISTS trg_fts_designs_ai;
    DROP TRIGGER IF EXISTS trg_fts_designs_au;
    DROP TRIGGER IF EXISTS trg_fts_designs_ad;

    DROP TRIGGER IF EXISTS trg_fts_lock_tech_ai;
    DROP TRIGGER IF EXISTS trg_fts_lock_tech_au;
    DROP TRIGGER IF EXISTS trg_fts_lock_tech_ad;

    DROP TRIGGER IF EXISTS trg_fts_images_ai;
    DROP TRIGGER IF EXISTS trg_fts_images_au;
    DROP TRIGGER IF EXISTS trg_fts_images_ad;

    -- PRODUCTS
    CREATE TRIGGER IF NOT EXISTS trg_fts_products_ai
    AFTER INSERT ON products
    BEGIN
      INSERT INTO global_fts(rowid, entity_type, entity_id, title, body, tags)
      VALUES (
        ${OFFSETS.product} + NEW.id,
        'product',
        NEW.id,
        NEW.name,
        trim(
          COALESCE(NEW.description,'') || ' ' ||
          COALESCE(NEW.stripe_product_id,'') || ' ' ||
          COALESCE((SELECT b.name FROM brands b WHERE b.id = NEW.brand_id),'') || ' ' ||
          COALESCE((SELECT c.name FROM categories c WHERE c.id = NEW.category_id),'')
        ),
        'type:' || NEW.type
      );
    END;

    CREATE TRIGGER IF NOT EXISTS trg_fts_products_au
    AFTER UPDATE ON products
    BEGIN
      DELETE FROM global_fts WHERE rowid = ${OFFSETS.product} + OLD.id;
      INSERT INTO global_fts(rowid, entity_type, entity_id, title, body, tags)
      VALUES (
        ${OFFSETS.product} + NEW.id,
        'product',
        NEW.id,
        NEW.name,
        trim(
          COALESCE(NEW.description,'') || ' ' ||
          COALESCE(NEW.stripe_product_id,'') || ' ' ||
          COALESCE((SELECT b.name FROM brands b WHERE b.id = NEW.brand_id),'') || ' ' ||
          COALESCE((SELECT c.name FROM categories c WHERE c.id = NEW.category_id),'')
        ),
        'type:' || NEW.type
      );
    END;

    CREATE TRIGGER IF NOT EXISTS trg_fts_products_ad
    AFTER DELETE ON products
    BEGIN
      DELETE FROM global_fts WHERE rowid = ${OFFSETS.product} + OLD.id;
    END;

    -- VARIANTS
    CREATE TRIGGER IF NOT EXISTS trg_fts_variants_ai
    AFTER INSERT ON variants
    BEGIN
      INSERT INTO global_fts(rowid, entity_type, entity_id, title, body, tags)
      VALUES (
        ${OFFSETS.variant} + NEW.id,
        'variant',
        NEW.id,
        NEW.name,
        trim(
          COALESCE(NEW.sku,'') || ' ' ||
          COALESCE(NEW.description,'') || ' ' ||
          COALESCE((SELECT p.name FROM products p WHERE p.id = NEW.product_id),'')
        ),
        'product_id:' || NEW.product_id
      );
    END;

    CREATE TRIGGER IF NOT EXISTS trg_fts_variants_au
    AFTER UPDATE ON variants
    BEGIN
      DELETE FROM global_fts WHERE rowid = ${OFFSETS.variant} + OLD.id;
      INSERT INTO global_fts(rowid, entity_type, entity_id, title, body, tags)
      VALUES (
        ${OFFSETS.variant} + NEW.id,
        'variant',
        NEW.id,
        NEW.name,
        trim(
          COALESCE(NEW.sku,'') || ' ' ||
          COALESCE(NEW.description,'') || ' ' ||
          COALESCE((SELECT p.name FROM products p WHERE p.id = NEW.product_id),'')
        ),
        'product_id:' || NEW.product_id
      );
    END;

    CREATE TRIGGER IF NOT EXISTS trg_fts_variants_ad
    AFTER DELETE ON variants
    BEGIN
      DELETE FROM global_fts WHERE rowid = ${OFFSETS.variant} + OLD.id;
    END;

    -- VARIANT PRICES (Stripe prices)
    CREATE TRIGGER IF NOT EXISTS trg_fts_variant_prices_ai
    AFTER INSERT ON variant_prices
    BEGIN
      INSERT INTO global_fts(rowid, entity_type, entity_id, title, body, tags)
      VALUES (
        ${OFFSETS.stripe_price} + NEW.id,
        'stripe_price',
        NEW.id,
        COALESCE(NEW.stripe_price_id, 'stripe_price #' || NEW.id),
        trim(
          COALESCE(NEW.stripe_price_id,'') || ' ' ||
          'variant_id:' || NEW.variant_id || ' ' ||
          COALESCE((SELECT v.name FROM variants v WHERE v.id = NEW.variant_id),'') || ' ' ||
          COALESCE((SELECT p.name FROM products p JOIN variants v ON v.product_id=p.id WHERE v.id = NEW.variant_id),'')
        ),
        'variant_id:' || NEW.variant_id
      );
    END;

    CREATE TRIGGER IF NOT EXISTS trg_fts_variant_prices_au
    AFTER UPDATE ON variant_prices
    BEGIN
      DELETE FROM global_fts WHERE rowid = ${OFFSETS.stripe_price} + OLD.id;
      INSERT INTO global_fts(rowid, entity_type, entity_id, title, body, tags)
      VALUES (
        ${OFFSETS.stripe_price} + NEW.id,
        'stripe_price',
        NEW.id,
        COALESCE(NEW.stripe_price_id, 'stripe_price #' || NEW.id),
        trim(
          COALESCE(NEW.stripe_price_id,'') || ' ' ||
          'variant_id:' || NEW.variant_id || ' ' ||
          COALESCE((SELECT v.name FROM variants v WHERE v.id = NEW.variant_id),'') || ' ' ||
          COALESCE((SELECT p.name FROM products p JOIN variants v ON v.product_id=p.id WHERE v.id = NEW.variant_id),'')
        ),
        'variant_id:' || NEW.variant_id
      );
    END;

    CREATE TRIGGER IF NOT EXISTS trg_fts_variant_prices_ad
    AFTER DELETE ON variant_prices
    BEGIN
      DELETE FROM global_fts WHERE rowid = ${OFFSETS.stripe_price} + OLD.id;
    END;

    -- ORDERS (matches schema.sql: order_status/payment_status/fulfillment_status/shipping_status)
    CREATE TRIGGER IF NOT EXISTS trg_fts_orders_ai
    AFTER INSERT ON orders
    BEGIN
      INSERT INTO global_fts(rowid, entity_type, entity_id, title, body, tags)
      VALUES (
        ${OFFSETS.order} + NEW.id,
        'order',
        NEW.id,
        COALESCE(NEW.order_number, 'Order #' || NEW.id),
        trim(
          COALESCE(NEW.order_status,'') || ' ' ||
          COALESCE(NEW.payment_status,'') || ' ' ||
          COALESCE(NEW.fulfillment_status,'') || ' ' ||
          COALESCE(NEW.shipping_status,'') || ' ' ||
          COALESCE(NEW.source,'') || ' ' ||
          COALESCE(NEW.payment_method,'') || ' ' ||
          COALESCE(NEW.customer_email,'') || ' ' ||
          COALESCE(NEW.customer_name,'') || ' ' ||
          COALESCE(NEW.customer_phone,'') || ' ' ||
          COALESCE(NEW.external_ref,'') || ' ' ||
          COALESCE(NEW.stripe_checkout_session_id,'') || ' ' ||
          COALESCE(NEW.stripe_payment_intent_id,'') || ' ' ||
          COALESCE(NEW.notes,'')
        ),
        'order_status:' || NEW.order_status || ' payment_status:' || NEW.payment_status
      );
    END;

    CREATE TRIGGER IF NOT EXISTS trg_fts_orders_au
    AFTER UPDATE ON orders
    BEGIN
      DELETE FROM global_fts WHERE rowid = ${OFFSETS.order} + OLD.id;
      INSERT INTO global_fts(rowid, entity_type, entity_id, title, body, tags)
      VALUES (
        ${OFFSETS.order} + NEW.id,
        'order',
        NEW.id,
        COALESCE(NEW.order_number, 'Order #' || NEW.id),
        trim(
          COALESCE(NEW.order_status,'') || ' ' ||
          COALESCE(NEW.payment_status,'') || ' ' ||
          COALESCE(NEW.fulfillment_status,'') || ' ' ||
          COALESCE(NEW.shipping_status,'') || ' ' ||
          COALESCE(NEW.source,'') || ' ' ||
          COALESCE(NEW.payment_method,'') || ' ' ||
          COALESCE(NEW.customer_email,'') || ' ' ||
          COALESCE(NEW.customer_name,'') || ' ' ||
          COALESCE(NEW.customer_phone,'') || ' ' ||
          COALESCE(NEW.external_ref,'') || ' ' ||
          COALESCE(NEW.stripe_checkout_session_id,'') || ' ' ||
          COALESCE(NEW.stripe_payment_intent_id,'') || ' ' ||
          COALESCE(NEW.notes,'')
        ),
        'order_status:' || NEW.order_status || ' payment_status:' || NEW.payment_status
      );
    END;

    CREATE TRIGGER IF NOT EXISTS trg_fts_orders_ad
    AFTER DELETE ON orders
    BEGIN
      DELETE FROM global_fts WHERE rowid = ${OFFSETS.order} + OLD.id;
    END;

    -- KEYCARD DESIGNS
    CREATE TRIGGER IF NOT EXISTS trg_fts_designs_ai
    AFTER INSERT ON keycard_designs
    BEGIN
      INSERT INTO global_fts(rowid, entity_type, entity_id, title, body, tags)
      VALUES (
        ${OFFSETS.design} + NEW.id,
        'design',
        NEW.id,
        NEW.name,
        trim(COALESCE(NEW.code,'') || ' ' || COALESCE(NEW.description,'')),
        'code:' || NEW.code
      );
    END;

    CREATE TRIGGER IF NOT EXISTS trg_fts_designs_au
    AFTER UPDATE ON keycard_designs
    BEGIN
      DELETE FROM global_fts WHERE rowid = ${OFFSETS.design} + OLD.id;
      INSERT INTO global_fts(rowid, entity_type, entity_id, title, body, tags)
      VALUES (
        ${OFFSETS.design} + NEW.id,
        'design',
        NEW.id,
        NEW.name,
        trim(COALESCE(NEW.code,'') || ' ' || COALESCE(NEW.description,'')),
        'code:' || NEW.code
      );
    END;

    CREATE TRIGGER IF NOT EXISTS trg_fts_designs_ad
    AFTER DELETE ON keycard_designs
    BEGIN
      DELETE FROM global_fts WHERE rowid = ${OFFSETS.design} + OLD.id;
    END;

    -- LOCK TECH
    CREATE TRIGGER IF NOT EXISTS trg_fts_lock_tech_ai
    AFTER INSERT ON lock_tech
    BEGIN
      INSERT INTO global_fts(rowid, entity_type, entity_id, title, body, tags)
      VALUES (
        ${OFFSETS.lock_tech} + NEW.id,
        'lock_tech',
        NEW.id,
        NEW.name,
        NEW.name,
        ''
      );
    END;

    CREATE TRIGGER IF NOT EXISTS trg_fts_lock_tech_au
    AFTER UPDATE ON lock_tech
    BEGIN
      DELETE FROM global_fts WHERE rowid = ${OFFSETS.lock_tech} + OLD.id;
      INSERT INTO global_fts(rowid, entity_type, entity_id, title, body, tags)
      VALUES (
        ${OFFSETS.lock_tech} + NEW.id,
        'lock_tech',
        NEW.id,
        NEW.name,
        NEW.name,
        ''
      );
    END;

    CREATE TRIGGER IF NOT EXISTS trg_fts_lock_tech_ad
    AFTER DELETE ON lock_tech
    BEGIN
      DELETE FROM global_fts WHERE rowid = ${OFFSETS.lock_tech} + OLD.id;
    END;

    -- IMAGES
    CREATE TRIGGER IF NOT EXISTS trg_fts_images_ai
    AFTER INSERT ON images
    BEGIN
      INSERT INTO global_fts(rowid, entity_type, entity_id, title, body, tags)
      VALUES (
        ${OFFSETS.image} + NEW.id,
        'image',
        NEW.id,
        COALESCE(NEW.alt_text, NEW.url),
        trim(
          COALESCE(NEW.url,'') || ' ' ||
          COALESCE(NEW.alt_text,'') || ' ' ||
          COALESCE(NEW.entity_type,'') || ' ' ||
          COALESCE(NEW.entity_id,'')
        ),
        'entity:' || NEW.entity_type || ':' || NEW.entity_id
      );
    END;

    CREATE TRIGGER IF NOT EXISTS trg_fts_images_au
    AFTER UPDATE ON images
    BEGIN
      DELETE FROM global_fts WHERE rowid = ${OFFSETS.image} + OLD.id;
      INSERT INTO global_fts(rowid, entity_type, entity_id, title, body, tags)
      VALUES (
        ${OFFSETS.image} + NEW.id,
        'image',
        NEW.id,
        COALESCE(NEW.alt_text, NEW.url),
        trim(
          COALESCE(NEW.url,'') || ' ' ||
          COALESCE(NEW.alt_text,'') || ' ' ||
          COALESCE(NEW.entity_type,'') || ' ' ||
          COALESCE(NEW.entity_id,'')
        ),
        'entity:' || NEW.entity_type || ':' || NEW.entity_id
      );
    END;

    CREATE TRIGGER IF NOT EXISTS trg_fts_images_ad
    AFTER DELETE ON images
    BEGIN
      DELETE FROM global_fts WHERE rowid = ${OFFSETS.image} + OLD.id;
    END;
  `);

    const existing = db.prepare("SELECT COUNT(*) AS n FROM global_fts").get().n;

    // If forced rebuild OR empty index -> rebuild now
    if (rebuild || existing === 0) {
        rebuildFts(db);
    }

    // Persist current version (only after successful setup)
    db.prepare("INSERT OR REPLACE INTO fts_meta(key, value) VALUES('fts_version', ?)").run(String(FTS_VERSION));
}

function rebuildFts(db) {
    db.exec(`
        DELETE FROM global_fts;

        INSERT INTO global_fts(rowid, entity_type, entity_id, title, body, tags)
        SELECT
            ${OFFSETS.product} + p.id,
            'product',
            p.id,
            p.name,
            trim(
                    COALESCE(p.description,'') || ' ' ||
                    COALESCE(p.stripe_product_id,'') || ' ' ||
                    COALESCE(b.name,'') || ' ' ||
                    COALESCE(c.name,'')
            ),
            'type:' || p.type
        FROM products p
                 LEFT JOIN brands b ON b.id = p.brand_id
                 LEFT JOIN categories c ON c.id = p.category_id;

        INSERT INTO global_fts(rowid, entity_type, entity_id, title, body, tags)
        SELECT
            ${OFFSETS.variant} + v.id,
            'variant',
            v.id,
            v.name,
            trim(
                    COALESCE(v.sku,'') || ' ' ||
                    COALESCE(v.description,'') || ' ' ||
                    COALESCE(p.name,'')
            ),
            'product_id:' || v.product_id
        FROM variants v
                 JOIN products p ON p.id = v.product_id;

        INSERT INTO global_fts(rowid, entity_type, entity_id, title, body, tags)
        SELECT
            ${OFFSETS.stripe_price} + vp.id,
            'stripe_price',
            vp.id,
            COALESCE(vp.stripe_price_id, 'stripe_price #' || vp.id),
            trim(
                    COALESCE(vp.stripe_price_id,'') || ' ' ||
                    'variant_id:' || vp.variant_id || ' ' ||
                    COALESCE(v.name,'') || ' ' ||
                    COALESCE(p.name,'')
            ),
            'variant_id:' || vp.variant_id
        FROM variant_prices vp
                 JOIN variants v ON v.id = vp.variant_id
                 JOIN products p ON p.id = v.product_id;

        INSERT INTO global_fts(rowid, entity_type, entity_id, title, body, tags)
        SELECT
            ${OFFSETS.order} + o.id,
            'order',
            o.id,
            COALESCE(o.order_number, 'Order #' || o.id),
            trim(
                    COALESCE(o.order_status,'') || ' ' ||
                    COALESCE(o.payment_status,'') || ' ' ||
                    COALESCE(o.fulfillment_status,'') || ' ' ||
                    COALESCE(o.shipping_status,'') || ' ' ||
                    COALESCE(o.source,'') || ' ' ||
                    COALESCE(o.payment_method,'') || ' ' ||
                    COALESCE(o.customer_email,'') || ' ' ||
                    COALESCE(o.customer_name,'') || ' ' ||
                    COALESCE(o.customer_phone,'') || ' ' ||
                    COALESCE(o.external_ref,'') || ' ' ||
                    COALESCE(o.stripe_checkout_session_id,'') || ' ' ||
                    COALESCE(o.stripe_payment_intent_id,'') || ' ' ||
                    COALESCE(o.notes,'')
            ),
            'order_status:' || o.order_status || ' payment_status:' || o.payment_status
        FROM orders o;

        INSERT INTO global_fts(rowid, entity_type, entity_id, title, body, tags)
        SELECT
            ${OFFSETS.design} + d.id,
            'design',
            d.id,
            d.name,
            trim(COALESCE(d.code,'') || ' ' || COALESCE(d.description,'')),
            'code:' || d.code
        FROM keycard_designs d;

        INSERT INTO global_fts(rowid, entity_type, entity_id, title, body, tags)
        SELECT
            ${OFFSETS.lock_tech} + lt.id,
            'lock_tech',
            lt.id,
            lt.name,
            lt.name,
            ''
        FROM lock_tech lt;

        INSERT INTO global_fts(rowid, entity_type, entity_id, title, body, tags)
        SELECT
            ${OFFSETS.image} + i.id,
            'image',
            i.id,
            COALESCE(i.alt_text, i.url),
            trim(
                    COALESCE(i.url,'') || ' ' ||
                    COALESCE(i.alt_text,'') || ' ' ||
                    COALESCE(i.entity_type,'') || ' ' ||
                    COALESCE(i.entity_id,'')
            ),
            'entity:' || i.entity_type || ':' || i.entity_id
        FROM images i;
    `);
}

module.exports = { ensureFts, rebuildFts };
