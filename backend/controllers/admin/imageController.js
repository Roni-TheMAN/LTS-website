// // backend/controllers/imageController.js
// const path = require("path");
// const crypto = require("crypto");
// const { db } = require("../../db");
//
// let storage;
// try {
//     storage = require("../../services/admin/cloudflare/imageStorage");
// } catch {
//     storage = require("../../services/cloudflare/imageStorage");
// }
//
// const { putObject, deleteObject } = storage;
//
// // ---------------- Helpers ----------------
// function mustBePositiveInt(n) {
//     return Number.isInteger(n) && n > 0;
// }
//
// function pickExt(originalName, mimeType) {
//     const extFromName = path.extname(originalName || "").toLowerCase();
//     if (extFromName && extFromName.length <= 8) return extFromName;
//
//     const m = String(mimeType || "").toLowerCase();
//     if (m === "image/jpeg") return ".jpg";
//     if (m === "image/png") return ".png";
//     if (m === "image/webp") return ".webp";
//     if (m === "image/gif") return ".gif";
//     if (m === "image/svg+xml") return ".svg";
//     if (m === "image/avif") return ".avif";
//     return "";
// }
//
// function isLikelyLocalImagesUrl(url) {
//     return typeof url === "string" && url.startsWith("/images/");
// }
//
// function parseCloudflareImageIdFromUrl(url) {
//     try {
//         if (!/^https?:\/\//i.test(String(url || ""))) return null;
//         const u = new URL(url);
//         const parts = u.pathname.split("/").filter(Boolean);
//
//         if (u.hostname.includes("imagedelivery.net")) {
//             if (parts.length >= 2) return parts[1] || null; // [hash, id, variant]
//             return null;
//         }
//
//         if (parts.length >= 1) {
//             const maybeId = parts[0];
//             if (maybeId && (maybeId.startsWith("lts_") || maybeId.length >= 10)) return maybeId;
//         }
//         return null;
//     } catch {
//         return null;
//     }
// }
//
// async function deleteFromRowBestEffort(imgRow) {
//     if (!imgRow) return;
//
//     // Prefer the stored Cloudflare id
//     if (imgRow.cloudflare_id) {
//         await deleteObject({ key: String(imgRow.cloudflare_id) });
//         return;
//     }
//
//     // Fallback (legacy rows) — parse url
//     if (!imgRow.url) return;
//     if (isLikelyLocalImagesUrl(imgRow.url)) return;
//
//     const cfId = parseCloudflareImageIdFromUrl(imgRow.url);
//     if (cfId) await deleteObject({ key: cfId });
// }
//
// function filenameFromUrl(url, cloudflare_id) {
//     try {
//         if (cloudflare_id) return String(cloudflare_id);
//         if (!url) return null;
//
//         if (isLikelyLocalImagesUrl(url)) {
//             return path.basename(decodeURIComponent(url.slice("/images/".length)));
//         }
//
//         const cfId = parseCloudflareImageIdFromUrl(url);
//         if (cfId) return cfId;
//
//         const u = new URL(url);
//         return path.basename(u.pathname) || null;
//     } catch {
//         return String(url).split("/").pop() || null;
//     }
// }
//
// function insertImageRow({ entity_type, entity_id, url, cloudflare_id, alt_text, sort_order }) {
//     const info = db
//         .prepare(
//             `
//       INSERT INTO images (entity_type, entity_id, url, cloudflare_id, alt_text, sort_order)
//       VALUES (?, ?, ?, ?, ?, ?)
//     `
//         )
//         .run(entity_type, entity_id, url, cloudflare_id || null, alt_text, sort_order);
//
//     return db.prepare(`SELECT * FROM images WHERE id = ?`).get(info.lastInsertRowid);
// }
//
// function updateImageRow({ id, url, cloudflare_id, alt_text, sort_order }) {
//     db.prepare(
//         `
//     UPDATE images
//     SET url = ?, cloudflare_id = ?, alt_text = ?, sort_order = ?
//     WHERE id = ?
//   `
//     ).run(url, cloudflare_id || null, alt_text, sort_order, id);
//
//     return db.prepare(`SELECT * FROM images WHERE id = ?`).get(id);
// }
//
// function getImagesByEntity(entity_type, entity_id) {
//     return db
//         .prepare(
//             `
//                 SELECT *
//                 FROM images
//                 WHERE entity_type = ? AND entity_id = ?
//                 ORDER BY sort_order ASC, id ASC
//             `
//         )
//         .all(entity_type, entity_id);
// }
//
// function getImageByEntityAndSort(entity_type, entity_id, sort_order) {
//     return db
//         .prepare(
//             `
//                 SELECT *
//                 FROM images
//                 WHERE entity_type = ? AND entity_id = ? AND sort_order = ?
//                 ORDER BY id ASC
//                 LIMIT 1
//             `
//         )
//         .get(entity_type, entity_id, sort_order);
// }
//
// function countImagesForEntity(entity_type, entity_id) {
//     return (
//         db
//             .prepare(
//                 `
//         SELECT COUNT(*) AS c
//         FROM images
//         WHERE entity_type = ? AND entity_id = ?
//       `
//             )
//             .get(entity_type, entity_id)?.c ?? 0
//     );
// }
//
// function normalizeEntityType(t) {
//     const v = String(t || "").trim().toLowerCase();
//     if (v === "product" || v === "design" || v === "variant") return v;
//     return null;
// }
//
// // -------------- LIST ALL IMAGES --------------
// const listAllImages = (req, res) => {
//     try {
//         const entity_type = req.query?.entity_type ? normalizeEntityType(req.query.entity_type) : null;
//         if (req.query?.entity_type && !entity_type) {
//             return res.status(400).json({ error: "Invalid entity_type (expected product|design|variant)." });
//         }
//
//         const where = entity_type ? `WHERE i.entity_type = ?` : "";
//         const rows = db
//             .prepare(
//                 `
//         SELECT
//           i.*,
//           p.name AS product_name,
//           d.name AS design_name,
//           v.name AS variant_name,
//           CASE
//             WHEN i.entity_type = 'product' THEN CASE WHEN p.id IS NULL THEN 1 ELSE 0 END
//             WHEN i.entity_type = 'design' THEN CASE WHEN d.id IS NULL THEN 1 ELSE 0 END
//             WHEN i.entity_type = 'variant' THEN CASE WHEN v.id IS NULL THEN 1 ELSE 0 END
//             ELSE 0
//           END AS unused
//         FROM images i
//           LEFT JOIN products p ON (i.entity_type = 'product' AND p.id = i.entity_id)
//           LEFT JOIN keycard_designs d ON (i.entity_type = 'design' AND d.id = i.entity_id)
//           LEFT JOIN variants v ON (i.entity_type = 'variant' AND v.id = i.entity_id)
//         ${where}
//         ORDER BY i.created_at DESC, i.id DESC
//       `
//             )
//             .all(entity_type ? [entity_type] : []);
//
//         const enriched = (rows || []).map((r) => {
//             const entity_name =
//                 r.entity_type === "product"
//                     ? r.product_name
//                     : r.entity_type === "design"
//                         ? r.design_name
//                         : r.entity_type === "variant"
//                             ? r.variant_name
//                             : null;
//
//             const filename = filenameFromUrl(r.url, r.cloudflare_id);
//
//             const { product_name, design_name, variant_name, ...rest } = r;
//
//             return {
//                 ...rest,
//                 unused: Boolean(r.unused),
//                 entity_name: entity_name || null,
//                 filename,
//                 file_size_bytes: null,
//             };
//         });
//
//         res.json(enriched);
//     } catch (e) {
//         res.status(500).json({ error: e?.message || "Failed to list images." });
//     }
// };
//
// // -------------- FETCH BY ENTITY --------------
// const getImagesByProductId = (req, res) => {
//     try {
//         const productId = Number(req.params.productId);
//         if (!mustBePositiveInt(productId)) {
//             return res.status(400).json({ error: "Invalid productId (expected a positive integer)." });
//         }
//         res.json(getImagesByEntity("product", productId));
//     } catch (e) {
//         res.status(500).json({ error: e?.message || "Failed to fetch images." });
//     }
// };
//
// const getImagesByDesignId = (req, res) => {
//     try {
//         const designId = Number(req.params.designId);
//         if (!mustBePositiveInt(designId)) {
//             return res.status(400).json({ error: "Invalid designId (expected a positive integer)." });
//         }
//         res.json(getImagesByEntity("design", designId));
//     } catch (e) {
//         res.status(500).json({ error: e?.message || "Failed to fetch images." });
//     }
// };
//
// // -------------- CREATE (FILE UPLOAD) --------------
// async function createImageForEntity({ req, res, entity_type, entity_id, keyPrefix, maxPerEntity }) {
//     const file = req.file;
//     if (!file || !file.buffer) {
//         return res.status(400).json({ error: "Missing file. Send multipart/form-data with field name 'file'." });
//     }
//
//     const mime = String(file.mimetype || "").toLowerCase();
//     if (!mime.startsWith("image/")) {
//         return res.status(400).json({ error: "Only image uploads are allowed." });
//     }
//
//     const alt_text =
//         req.body?.alt_text === undefined || req.body?.alt_text === null
//             ? null
//             : String(req.body.alt_text).trim() || null;
//
//     const sort_order_raw = req.body?.sort_order;
//     let sort_order;
//
//     if (sort_order_raw === undefined || sort_order_raw === null || sort_order_raw === "") {
//         sort_order = db
//             .prepare(
//                 `
//         SELECT COALESCE(MAX(sort_order), -1) + 1 AS next
//         FROM images
//         WHERE entity_type = ? AND entity_id = ?
//       `
//             )
//             .get(entity_type, entity_id)?.next;
//         if (!Number.isFinite(sort_order)) sort_order = 0;
//     } else {
//         sort_order = Math.trunc(Number(sort_order_raw));
//         if (!Number.isFinite(sort_order) || sort_order < 0) {
//             return res.status(400).json({ error: "Invalid sort_order (expected a non-negative number)." });
//         }
//     }
//
//     const existingSlot = getImageByEntityAndSort(entity_type, entity_id, sort_order);
//
//     if (!existingSlot && maxPerEntity && Number.isFinite(maxPerEntity)) {
//         const count = Number(countImagesForEntity(entity_type, entity_id));
//         if (count >= Number(maxPerEntity)) {
//             return res.status(409).json({ error: `Max ${maxPerEntity} images allowed for this ${entity_type}. Delete one first.` });
//         }
//     }
//
//     const ext = pickExt(file.originalname, mime);
//     const rand = crypto.randomBytes(12).toString("hex");
//     const stamp = Date.now();
//     const key = `${keyPrefix}/${entity_id}/${stamp}_${rand}${ext}`;
//
//     const uploaded = await putObject({ key, body: file.buffer });
//     const url = uploaded?.url || uploaded?.absPath;
//     const cloudflare_id = uploaded?.imageId ? String(uploaded.imageId) : null;
//
//     if (!url) return res.status(500).json({ error: "Upload succeeded but no Cloudflare delivery URL returned." });
//
//     if (existingSlot) {
//         const updated = updateImageRow({
//             id: existingSlot.id,
//             url,
//             cloudflare_id,
//             alt_text,
//             sort_order,
//         });
//
//         try {
//             await deleteFromRowBestEffort(existingSlot);
//         } catch {}
//
//         return res.status(200).json(updated);
//     }
//
//     const row = insertImageRow({ entity_type, entity_id, url, cloudflare_id, alt_text, sort_order });
//     return res.status(201).json(row);
// }
//
// const createProductImage = async (req, res) => {
//     try {
//         const productId = Number(req.params.productId);
//         if (!mustBePositiveInt(productId)) {
//             return res.status(400).json({ error: "Invalid productId (expected a positive integer)." });
//         }
//
//         return await createImageForEntity({
//             req,
//             res,
//             entity_type: "product",
//             entity_id: productId,
//             keyPrefix: "products",
//         });
//     } catch (e) {
//         res.status(500).json({ error: e?.message || "Failed to upload image." });
//     }
// };
//
// const createDesignImage = async (req, res) => {
//     try {
//         const designId = Number(req.params.designId);
//         if (!mustBePositiveInt(designId)) {
//             return res.status(400).json({ error: "Invalid designId (expected a positive integer)." });
//         }
//
//         return await createImageForEntity({
//             req,
//             res,
//             entity_type: "design",
//             entity_id: designId,
//             keyPrefix: "designs",
//             maxPerEntity: 2,
//         });
//     } catch (e) {
//         res.status(500).json({ error: e?.message || "Failed to upload image." });
//     }
// };
//
// // -------------- CREATE (EXTERNAL URL) --------------
// const createImageFromUrl = async (req, res) => {
//     try {
//         const entity_type = normalizeEntityType(req.body?.entity_type);
//         const entity_id = Number(req.body?.entity_id);
//         const url = String(req.body?.url || "").trim();
//
//         if (!entity_type) return res.status(400).json({ error: "Invalid entity_type (expected product|design|variant)." });
//         if (!mustBePositiveInt(entity_id)) return res.status(400).json({ error: "Invalid entity_id (expected positive integer)." });
//         if (!url) return res.status(400).json({ error: "Missing url." });
//
//         const isHttp = /^https?:\/\//i.test(url);
//         const isLocal = url.startsWith("/images/");
//         if (!isHttp && !isLocal) return res.status(400).json({ error: "URL must start with http(s):// or /images/." });
//
//         const alt_text =
//             req.body?.alt_text === undefined || req.body?.alt_text === null
//                 ? null
//                 : String(req.body.alt_text).trim() || null;
//
//         const sort_order_raw = req.body?.sort_order;
//         let sort_order;
//
//         if (sort_order_raw === undefined || sort_order_raw === null || sort_order_raw === "") {
//             sort_order = db
//                 .prepare(
//                     `
//                         SELECT COALESCE(MAX(sort_order), -1) + 1 AS next
//                         FROM images
//                         WHERE entity_type = ? AND entity_id = ?
//                     `
//                 )
//                 .get(entity_type, entity_id)?.next;
//             if (!Number.isFinite(sort_order)) sort_order = 0;
//         } else {
//             sort_order = Math.trunc(Number(sort_order_raw));
//             if (!Number.isFinite(sort_order) || sort_order < 0) {
//                 return res.status(400).json({ error: "Invalid sort_order (expected a non-negative number)." });
//             }
//         }
//
//         const maxPerEntity = entity_type === "design" ? 2 : null;
//         const existingSlot = getImageByEntityAndSort(entity_type, entity_id, sort_order);
//
//         if (!existingSlot && maxPerEntity && Number.isFinite(maxPerEntity)) {
//             const count = Number(countImagesForEntity(entity_type, entity_id));
//             if (count >= Number(maxPerEntity)) {
//                 return res.status(409).json({ error: `Max ${maxPerEntity} images allowed for this ${entity_type}. Delete one first.` });
//             }
//         }
//
//         // Best effort: if it's a Cloudflare delivery URL, store cloudflare_id
//         const cloudflare_id = isHttp ? (parseCloudflareImageIdFromUrl(url) || null) : null;
//
//         if (existingSlot) {
//             const updated = updateImageRow({
//                 id: existingSlot.id,
//                 url,
//                 cloudflare_id,
//                 alt_text,
//                 sort_order,
//             });
//
//             try {
//                 await deleteFromRowBestEffort(existingSlot);
//             } catch {}
//
//             return res.status(200).json(updated);
//         }
//
//         const row = insertImageRow({ entity_type, entity_id, url, cloudflare_id, alt_text, sort_order });
//         return res.status(201).json(row);
//     } catch (e) {
//         res.status(500).json({ error: e?.message || "Failed to create image from URL." });
//     }
// };
//
// // -------------- DELETE --------------
// const deleteImageById = async (req, res) => {
//     try {
//         const imageId = Number(req.params.id);
//         if (!mustBePositiveInt(imageId)) {
//             return res.status(400).json({ error: "Invalid id (expected a positive integer)." });
//         }
//
//         const img = db.prepare(`SELECT * FROM images WHERE id = ?`).get(imageId);
//         if (!img) return res.status(404).json({ error: "Image not found." });
//
//         try {
//             await deleteFromRowBestEffort(img);
//         } catch {}
//
//         db.prepare(`DELETE FROM images WHERE id = ?`).run(imageId);
//         res.json({ ok: true, id: imageId });
//     } catch (e) {
//         res.status(500).json({ error: e?.message || "Failed to delete image." });
//     }
// };
//
// module.exports = {
//     listAllImages,
//     getImagesByProductId,
//     getImagesByDesignId,
//     createProductImage,
//     createDesignImage,
//     createImageFromUrl,
//     deleteImageById,
// };


// backend/controllers/admin/imageController.js
const path = require("path");
const crypto = require("crypto");
const { db } = require("../../db");

let storage;
try {
    storage = require("../../services/admin/cloudflare/imageStorage");
} catch {
    storage = require("../../services/admin/cloudflare/imageStorage");
}

const { putObject, deleteObject } = storage;

// ---------------- Helpers ----------------
function mustBePositiveInt(n) {
    return Number.isInteger(n) && n > 0;
}

function pickExt(originalName, mimeType) {
    const extFromName = path.extname(originalName || "").toLowerCase();
    if (extFromName && extFromName.length <= 8) return extFromName;

    const m = String(mimeType || "").toLowerCase();
    if (m === "image/jpeg") return ".jpg";
    if (m === "image/png") return ".png";
    if (m === "image/webp") return ".webp";
    if (m === "image/gif") return ".gif";
    if (m === "image/svg+xml") return ".svg";
    if (m === "image/avif") return ".avif";
    return "";
}

function isLikelyLocalImagesUrl(url) {
    return typeof url === "string" && url.startsWith("/images/");
}

function parseCloudflareImageIdFromUrl(url) {
    try {
        if (!/^https?:\/\//i.test(String(url || ""))) return null;
        const u = new URL(url);
        const parts = u.pathname.split("/").filter(Boolean);

        if (u.hostname.includes("imagedelivery.net")) {
            if (parts.length >= 2) return parts[1] || null; // [hash, id, variant]
            return null;
        }

        if (parts.length >= 1) {
            const maybeId = parts[0];
            if (maybeId && (maybeId.startsWith("lts_") || maybeId.length >= 10)) return maybeId;
        }
        return null;
    } catch {
        return null;
    }
}

async function deleteFromRowBestEffort(imgRow) {
    if (!imgRow) return;

    // Prefer the stored Cloudflare id
    if (imgRow.cloudflare_id) {
        await deleteObject({ key: String(imgRow.cloudflare_id) });
        return;
    }

    // Fallback (legacy rows) — parse url
    if (!imgRow.url) return;
    if (isLikelyLocalImagesUrl(imgRow.url)) return;

    const cfId = parseCloudflareImageIdFromUrl(imgRow.url);
    if (cfId) await deleteObject({ key: cfId });
}

function filenameFromUrl(url, cloudflare_id) {
    try {
        if (cloudflare_id) return String(cloudflare_id);
        if (!url) return null;

        if (isLikelyLocalImagesUrl(url)) {
            return path.basename(decodeURIComponent(url.slice("/images/".length)));
        }

        const cfId = parseCloudflareImageIdFromUrl(url);
        if (cfId) return cfId;

        const u = new URL(url);
        return path.basename(u.pathname) || null;
    } catch {
        return String(url).split("/").pop() || null;
    }
}

function insertImageRow({ entity_type, entity_id, url, cloudflare_id, alt_text, sort_order }) {
    const info = db
        .prepare(
            `
      INSERT INTO images (entity_type, entity_id, url, cloudflare_id, alt_text, sort_order)
      VALUES (?, ?, ?, ?, ?, ?)
    `
        )
        .run(entity_type, entity_id, url, cloudflare_id || null, alt_text, sort_order);

    return db.prepare(`SELECT * FROM images WHERE id = ?`).get(info.lastInsertRowid);
}

function updateImageRow({ id, url, cloudflare_id, alt_text, sort_order }) {
    db.prepare(
        `
    UPDATE images
    SET url = ?, cloudflare_id = ?, alt_text = ?, sort_order = ?
    WHERE id = ?
  `
    ).run(url, cloudflare_id || null, alt_text, sort_order, id);

    return db.prepare(`SELECT * FROM images WHERE id = ?`).get(id);
}

function getImagesByEntity(entity_type, entity_id) {
    return db
        .prepare(
            `
                SELECT *
                FROM images
                WHERE entity_type = ? AND entity_id = ?
                ORDER BY sort_order ASC, id ASC
            `
        )
        .all(entity_type, entity_id);
}

function getImageByEntityAndSort(entity_type, entity_id, sort_order) {
    return db
        .prepare(
            `
                SELECT *
                FROM images
                WHERE entity_type = ? AND entity_id = ? AND sort_order = ?
                ORDER BY id ASC
                LIMIT 1
            `
        )
        .get(entity_type, entity_id, sort_order);
}

function countImagesForEntity(entity_type, entity_id) {
    return (
        db
            .prepare(
                `
        SELECT COUNT(*) AS c
        FROM images
        WHERE entity_type = ? AND entity_id = ?
      `
            )
            .get(entity_type, entity_id)?.c ?? 0
    );
}

function nextSortOrder(entity_type, entity_id) {
    const v = db
        .prepare(
            `
        SELECT COALESCE(MAX(sort_order), -1) + 1 AS next
        FROM images
        WHERE entity_type = ? AND entity_id = ?
      `
        )
        .get(entity_type, entity_id)?.next;
    return Number.isFinite(v) ? v : 0;
}

function normalizeEntityType(t) {
    const v = String(t || "").trim().toLowerCase();
    if (v === "product" || v === "design" || v === "variant") return v;
    return null;
}

function validateFileIsImage(file) {
    if (!file || !file.buffer) return "Missing file buffer.";
    const mime = String(file.mimetype || "").toLowerCase();
    if (!mime.startsWith("image/")) return "Only image uploads are allowed.";
    return null;
}

// -------------- LIST ALL IMAGES --------------
const listAllImages = (req, res) => {
    try {
        const entity_type = req.query?.entity_type ? normalizeEntityType(req.query.entity_type) : null;
        if (req.query?.entity_type && !entity_type) {
            return res.status(400).json({ error: "Invalid entity_type (expected product|design|variant)." });
        }

        const where = entity_type ? `WHERE i.entity_type = ?` : "";
        const rows = db
            .prepare(
                `
        SELECT
          i.*,
          p.name AS product_name,
          d.name AS design_name,
          v.name AS variant_name,
          CASE
            WHEN i.entity_type = 'product' THEN CASE WHEN p.id IS NULL THEN 1 ELSE 0 END
            WHEN i.entity_type = 'design' THEN CASE WHEN d.id IS NULL THEN 1 ELSE 0 END
            WHEN i.entity_type = 'variant' THEN CASE WHEN v.id IS NULL THEN 1 ELSE 0 END
            ELSE 0
          END AS unused
        FROM images i
          LEFT JOIN products p ON (i.entity_type = 'product' AND p.id = i.entity_id)
          LEFT JOIN keycard_designs d ON (i.entity_type = 'design' AND d.id = i.entity_id)
          LEFT JOIN variants v ON (i.entity_type = 'variant' AND v.id = i.entity_id)
        ${where}
        ORDER BY i.created_at DESC, i.id DESC
      `
            )
            .all(entity_type ? [entity_type] : []);

        const enriched = (rows || []).map((r) => {
            const entity_name =
                r.entity_type === "product"
                    ? r.product_name
                    : r.entity_type === "design"
                        ? r.design_name
                        : r.entity_type === "variant"
                            ? r.variant_name
                            : null;

            const filename = filenameFromUrl(r.url, r.cloudflare_id);

            const { product_name, design_name, variant_name, ...rest } = r;

            return {
                ...rest,
                unused: Boolean(r.unused),
                entity_name: entity_name || null,
                filename,
                file_size_bytes: null,
            };
        });

        res.json(enriched);
    } catch (e) {
        res.status(500).json({ error: e?.message || "Failed to list images." });
    }
};

// -------------- FETCH BY ENTITY --------------
const getImagesByProductId = (req, res) => {
    try {
        const productId = Number(req.params.productId);
        if (!mustBePositiveInt(productId)) {
            return res.status(400).json({ error: "Invalid productId (expected a positive integer)." });
        }
        res.json(getImagesByEntity("product", productId));
    } catch (e) {
        res.status(500).json({ error: e?.message || "Failed to fetch images." });
    }
};

const getImagesByDesignId = (req, res) => {
    try {
        const designId = Number(req.params.designId);
        if (!mustBePositiveInt(designId)) {
            return res.status(400).json({ error: "Invalid designId (expected a positive integer)." });
        }
        res.json(getImagesByEntity("design", designId));
    } catch (e) {
        res.status(500).json({ error: e?.message || "Failed to fetch images." });
    }
};

// -------------- CREATE (single file upload) --------------
async function createImageForEntityFromFile({
                                                file,
                                                entity_type,
                                                entity_id,
                                                keyPrefix,
                                                maxPerEntity,
                                                alt_text,
                                                sort_order,
                                            }) {
    const fileErr = validateFileIsImage(file);
    if (fileErr) throw new Error(fileErr);

    const existingSlot = getImageByEntityAndSort(entity_type, entity_id, sort_order);

    if (!existingSlot && maxPerEntity && Number.isFinite(maxPerEntity)) {
        const count = Number(countImagesForEntity(entity_type, entity_id));
        if (count >= Number(maxPerEntity)) {
            const err = new Error(`Max ${maxPerEntity} images allowed for this ${entity_type}. Delete one first.`);
            err.status = 409;
            throw err;
        }
    }

    const mime = String(file.mimetype || "").toLowerCase();
    const ext = pickExt(file.originalname, mime);
    const rand = crypto.randomBytes(12).toString("hex");
    const stamp = Date.now();
    const key = `${keyPrefix}/${entity_id}/${stamp}_${rand}${ext}`;

    const uploaded = await putObject({ key, body: file.buffer });
    const url = uploaded?.url || uploaded?.absPath;
    const cloudflare_id = uploaded?.imageId ? String(uploaded.imageId) : null;

    if (!url) throw new Error("Upload succeeded but no Cloudflare delivery URL returned.");

    if (existingSlot) {
        const updated = updateImageRow({
            id: existingSlot.id,
            url,
            cloudflare_id,
            alt_text,
            sort_order,
        });

        try {
            await deleteFromRowBestEffort(existingSlot);
        } catch {}

        return { row: updated, replaced: true };
    }

    const row = insertImageRow({ entity_type, entity_id, url, cloudflare_id, alt_text, sort_order });
    return { row, replaced: false };
}

async function createImageForEntity({ req, res, entity_type, entity_id, keyPrefix, maxPerEntity }) {
    const file = req.file;
    if (!file || !file.buffer) {
        return res.status(400).json({ error: "Missing file. Send multipart/form-data with field name 'file'." });
    }

    const alt_text =
        req.body?.alt_text === undefined || req.body?.alt_text === null
            ? null
            : String(req.body.alt_text).trim() || null;

    const sort_order_raw = req.body?.sort_order;
    let sort_order;

    if (sort_order_raw === undefined || sort_order_raw === null || sort_order_raw === "") {
        sort_order = nextSortOrder(entity_type, entity_id);
    } else {
        sort_order = Math.trunc(Number(sort_order_raw));
        if (!Number.isFinite(sort_order) || sort_order < 0) {
            return res.status(400).json({ error: "Invalid sort_order (expected a non-negative number)." });
        }
    }

    try {
        const { row } = await createImageForEntityFromFile({
            file,
            entity_type,
            entity_id,
            keyPrefix,
            maxPerEntity,
            alt_text,
            sort_order,
        });
        // If it replaced existing slot, treat as 200, else 201. But row already correct.
        // We don’t know here, so just 200/201 doesn’t matter much; keep 201 for “created” path
        return res.status(201).json(row);
    } catch (e) {
        const status = e?.status || 500;
        return res.status(status).json({ error: e?.message || "Failed to upload image." });
    }
}

const createProductImage = async (req, res) => {
    try {
        const productId = Number(req.params.productId);
        if (!mustBePositiveInt(productId)) {
            return res.status(400).json({ error: "Invalid productId (expected a positive integer)." });
        }

        return await createImageForEntity({
            req,
            res,
            entity_type: "product",
            entity_id: productId,
            keyPrefix: "products",
        });
    } catch (e) {
        res.status(500).json({ error: e?.message || "Failed to upload image." });
    }
};

const createDesignImage = async (req, res) => {
    try {
        const designId = Number(req.params.designId);
        if (!mustBePositiveInt(designId)) {
            return res.status(400).json({ error: "Invalid designId (expected a positive integer)." });
        }

        return await createImageForEntity({
            req,
            res,
            entity_type: "design",
            entity_id: designId,
            keyPrefix: "designs",
            maxPerEntity: 2,
        });
    } catch (e) {
        res.status(500).json({ error: e?.message || "Failed to upload image." });
    }
};

// -------------- CREATE (bulk upload: multiple files) --------------
async function createImagesForEntityBulk({ req, res, entity_type, entity_id, keyPrefix, maxPerEntity }) {
    const files = Array.isArray(req.files) ? req.files : [];
    if (!files.length) {
        return res.status(400).json({
            error: "Missing files. Send multipart/form-data with field name 'files' (multiple).",
        });
    }

    const alt_text =
        req.body?.alt_text === undefined || req.body?.alt_text === null
            ? null
            : String(req.body.alt_text).trim() || null;

    // Optional: allow starting slot
    const start_raw = req.body?.sort_order_start;
    let sort_order_start;
    if (start_raw === undefined || start_raw === null || start_raw === "") {
        sort_order_start = nextSortOrder(entity_type, entity_id);
    } else {
        sort_order_start = Math.trunc(Number(start_raw));
        if (!Number.isFinite(sort_order_start) || sort_order_start < 0) {
            return res.status(400).json({ error: "Invalid sort_order_start (expected a non-negative number)." });
        }
    }

    // Enforce maxPerEntity up-front (best effort)
    if (maxPerEntity && Number.isFinite(maxPerEntity)) {
        const existingCount = Number(countImagesForEntity(entity_type, entity_id));
        if (existingCount >= Number(maxPerEntity)) {
            return res.status(409).json({ error: `Max ${maxPerEntity} images allowed for this ${entity_type}. Delete one first.` });
        }
        const available = Number(maxPerEntity) - existingCount;
        if (files.length > available) {
            return res.status(409).json({
                error: `Only ${available} more image(s) allowed for this ${entity_type}.`,
            });
        }
    }

    const results = [];
    let sort_order = sort_order_start;

    try {
        for (const file of files) {
            const { row } = await createImageForEntityFromFile({
                file,
                entity_type,
                entity_id,
                keyPrefix,
                maxPerEntity,
                alt_text,
                sort_order,
            });

            results.push(row);
            sort_order += 1;
        }

        return res.status(201).json({ ok: true, created: results.length, images: results });
    } catch (e) {
        const status = e?.status || 500;
        return res.status(status).json({
            error: e?.message || "Failed to upload images.",
            partial: results,
        });
    }
}

const createProductImagesBulk = async (req, res) => {
    try {
        const productId = Number(req.params.productId);
        if (!mustBePositiveInt(productId)) {
            return res.status(400).json({ error: "Invalid productId (expected a positive integer)." });
        }

        return await createImagesForEntityBulk({
            req,
            res,
            entity_type: "product",
            entity_id: productId,
            keyPrefix: "products",
        });
    } catch (e) {
        res.status(500).json({ error: e?.message || "Failed to upload images." });
    }
};

const createDesignImagesBulk = async (req, res) => {
    try {
        const designId = Number(req.params.designId);
        if (!mustBePositiveInt(designId)) {
            return res.status(400).json({ error: "Invalid designId (expected a positive integer)." });
        }

        return await createImagesForEntityBulk({
            req,
            res,
            entity_type: "design",
            entity_id: designId,
            keyPrefix: "designs",
            maxPerEntity: 2,
        });
    } catch (e) {
        res.status(500).json({ error: e?.message || "Failed to upload images." });
    }
};

// -------------- CREATE (EXTERNAL URL) --------------
const createImageFromUrl = async (req, res) => {
    try {
        const entity_type = normalizeEntityType(req.body?.entity_type);
        const entity_id = Number(req.body?.entity_id);
        const url = String(req.body?.url || "").trim();

        if (!entity_type) return res.status(400).json({ error: "Invalid entity_type (expected product|design|variant)." });
        if (!mustBePositiveInt(entity_id)) return res.status(400).json({ error: "Invalid entity_id (expected positive integer)." });
        if (!url) return res.status(400).json({ error: "Missing url." });

        const isHttp = /^https?:\/\//i.test(url);
        const isLocal = url.startsWith("/images/");
        if (!isHttp && !isLocal) return res.status(400).json({ error: "URL must start with http(s):// or /images/." });

        const alt_text =
            req.body?.alt_text === undefined || req.body?.alt_text === null
                ? null
                : String(req.body.alt_text).trim() || null;

        const sort_order_raw = req.body?.sort_order;
        let sort_order;

        if (sort_order_raw === undefined || sort_order_raw === null || sort_order_raw === "") {
            sort_order = nextSortOrder(entity_type, entity_id);
        } else {
            sort_order = Math.trunc(Number(sort_order_raw));
            if (!Number.isFinite(sort_order) || sort_order < 0) {
                return res.status(400).json({ error: "Invalid sort_order (expected a non-negative number)." });
            }
        }

        const maxPerEntity = entity_type === "design" ? 2 : null;
        const existingSlot = getImageByEntityAndSort(entity_type, entity_id, sort_order);

        if (!existingSlot && maxPerEntity && Number.isFinite(maxPerEntity)) {
            const count = Number(countImagesForEntity(entity_type, entity_id));
            if (count >= Number(maxPerEntity)) {
                return res.status(409).json({ error: `Max ${maxPerEntity} images allowed for this ${entity_type}. Delete one first.` });
            }
        }

        // Best effort: if it's a Cloudflare delivery URL, store cloudflare_id
        const cloudflare_id = isHttp ? (parseCloudflareImageIdFromUrl(url) || null) : null;

        if (existingSlot) {
            const updated = updateImageRow({
                id: existingSlot.id,
                url,
                cloudflare_id,
                alt_text,
                sort_order,
            });

            try {
                await deleteFromRowBestEffort(existingSlot);
            } catch {}

            return res.status(200).json(updated);
        }

        const row = insertImageRow({ entity_type, entity_id, url, cloudflare_id, alt_text, sort_order });
        return res.status(201).json(row);
    } catch (e) {
        res.status(500).json({ error: e?.message || "Failed to create image from URL." });
    }
};

// -------------- DELETE --------------
const deleteImageById = async (req, res) => {
    try {
        const imageId = Number(req.params.id);
        if (!mustBePositiveInt(imageId)) {
            return res.status(400).json({ error: "Invalid id (expected a positive integer)." });
        }

        const img = db.prepare(`SELECT * FROM images WHERE id = ?`).get(imageId);
        if (!img) return res.status(404).json({ error: "Image not found." });

        try {
            await deleteFromRowBestEffort(img);
        } catch {}

        db.prepare(`DELETE FROM images WHERE id = ?`).run(imageId);
        res.json({ ok: true, id: imageId });
    } catch (e) {
        res.status(500).json({ error: e?.message || "Failed to delete image." });
    }
};

module.exports = {
    listAllImages,
    getImagesByProductId,
    getImagesByDesignId,
    createProductImage,
    createDesignImage,
    // ✅ NEW (bulk)
    createProductImagesBulk,
    createDesignImagesBulk,
    createImageFromUrl,
    deleteImageById,
};
