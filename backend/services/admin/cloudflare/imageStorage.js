// // backend/services/cloudflare/imageStorage.js
// const fs = require("fs");
// const path = require("path");
//
// // Local folder where files are stored (swap this file later for Cloudflare/R2)
// const IMAGES_ROOT = process.env.IMAGE_LOCAL_DIR
//     ? path.resolve(process.env.IMAGE_LOCAL_DIR)
//     : path.resolve(process.cwd(), "images"); // <projectRoot>/images
//
// function safeAbsPathFromKey(key) {
//     const normalized = String(key || "").replace(/\\/g, "/"); // force POSIX
//     const abs = path.resolve(IMAGES_ROOT, normalized);
//
//     const rootWithSep = IMAGES_ROOT.endsWith(path.sep) ? IMAGES_ROOT : IMAGES_ROOT + path.sep;
//     if (!abs.startsWith(rootWithSep) && abs !== IMAGES_ROOT) {
//         throw new Error("Invalid key path (blocked).");
//     }
//     return abs;
// }
//
// async function putObject({ key, body /* Buffer */ }) {
//     const absPath = safeAbsPathFromKey(key);
//     await fs.promises.mkdir(path.dirname(absPath), { recursive: true });
//     await fs.promises.writeFile(absPath, body);
//     return { key, absPath };
// }
//
// async function deleteObject({ key }) {
//     const absPath = safeAbsPathFromKey(key);
//     try {
//         await fs.promises.unlink(absPath);
//     } catch (e) {
//         if (e?.code !== "ENOENT") throw e; // ignore missing
//     }
// }
//
// module.exports = {
//     IMAGES_ROOT,
//     putObject,
//     deleteObject,
// };

// backend/services/cloudflare/imageStorage.js
const path = require("path");
const crypto = require("crypto");

const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const CLOUDFLARE_API_TOKEN =
    process.env.CLOUDFLARE_API_TOKEN || process.env.API_TOKEN;

const CLOUDFLARE_IMAGES_VARIANT =
    process.env.CLOUDFLARE_IMAGES_VARIANT || "public";

const CLOUDFLARE_IMAGES_REQUIRE_SIGNED_URLS =
    String(process.env.CLOUDFLARE_IMAGES_REQUIRE_SIGNED_URLS || "false").toLowerCase() ===
    "true";

const IMAGES_ROOT = process.env.CLOUDFLARE_IMAGES_ROOT || "cloudflare://images";

function assertEnv() {
    if (!CLOUDFLARE_ACCOUNT_ID) {
        throw new Error("Missing env CLOUDFLARE_ACCOUNT_ID (required for Cloudflare Images).");
    }
    if (!CLOUDFLARE_API_TOKEN) {
        throw new Error("Missing env CLOUDFLARE_API_TOKEN (or API_TOKEN) (required for Cloudflare Images).");
    }
}

function sha256Hex(input) {
    return crypto.createHash("sha256").update(String(input)).digest("hex");
}

// ✅ IMPORTANT: allow passing a real CF id directly (so deletes work)
function cloudflareImageIdFromKey(key) {
    const s = String(key || "");
    if (s.startsWith("lts_")) return s;          // already a CF custom id
    return `lts_${sha256Hex(s)}`;                // derived deterministic id
}

function guessMimeTypeFromKey(key) {
    const ext = String(path.extname(key || "")).toLowerCase();
    switch (ext) {
        case ".jpg":
        case ".jpeg":
            return "image/jpeg";
        case ".png":
            return "image/png";
        case ".webp":
            return "image/webp";
        case ".gif":
            return "image/gif";
        case ".svg":
            return "image/svg+xml";
        case ".avif":
            return "image/avif";
        default:
            return "application/octet-stream";
    }
}

function pickBestVariantUrl(variants, desiredVariant) {
    if (!Array.isArray(variants) || variants.length === 0) return null;

    const normalized = String(desiredVariant || "").trim();
    if (normalized) {
        const match = variants.find((u) => String(u).endsWith("/" + normalized));
        if (match) return match;
    }

    const publicMatch = variants.find((u) => String(u).endsWith("/public"));
    if (publicMatch) return publicMatch;

    const originalMatch = variants.find((u) => String(u).endsWith("/original"));
    if (originalMatch) return originalMatch;

    return variants[0];
}

async function cfFetch(url, init) {
    const res = await fetch(url, {
        ...init,
        headers: {
            Authorization: `Bearer ${CLOUDFLARE_API_TOKEN}`,
            ...(init && init.headers ? init.headers : {}),
        },
    });

    let json = null;
    try {
        json = await res.json();
    } catch (_) {}

    return { res, json };
}

async function uploadToCloudflareImages({ key, body }) {
    assertEnv();

    const imageId = cloudflareImageIdFromKey(key);
    const filename = path.basename(String(key || "upload"));
    const mimeType = guessMimeTypeFromKey(key);

    const apiUrl = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/images/v1`;

    const form = new FormData();
    form.append("id", imageId);
    form.append(
        "metadata",
        JSON.stringify({
            storage_key: String(key),
            source: "lts-backend",
        })
    );
    form.append("requireSignedURLs", String(CLOUDFLARE_IMAGES_REQUIRE_SIGNED_URLS));

    const blob = new Blob([body], { type: mimeType });
    form.append("file", blob, filename);

    const { res, json } = await cfFetch(apiUrl, { method: "POST", body: form });

    if (!res.ok || !json || json.success !== true) {
        const msg =
            (json && (json.errors || json.messages))
                ? JSON.stringify({ errors: json.errors, messages: json.messages })
                : (await res.text().catch(() => ""));

        const isConflict = res.status === 409 || /already exists/i.test(msg);
        if (isConflict) {
            await deleteObject({ key }); // will derive same id
            return uploadToCloudflareImages({ key, body });
        }

        throw new Error(`Cloudflare Images upload failed (${res.status} ${res.statusText}): ${msg}`);
    }

    const result = json.result || {};
    const variants = result.variants || [];
    const publicUrl = pickBestVariantUrl(variants, CLOUDFLARE_IMAGES_VARIANT);

    if (!publicUrl) {
        throw new Error("Cloudflare Images upload succeeded but no delivery URL (variants) was returned.");
    }

    return {
        key,
        imageId: result.id || imageId,
        url: publicUrl,
        variants,
    };
}

async function putObject({ key, body }) {
    if (!Buffer.isBuffer(body)) throw new Error("putObject expects body to be a Buffer.");
    if (!key) throw new Error("putObject expects a non-empty key.");

    const uploaded = await uploadToCloudflareImages({ key, body });

    return {
        key,
        absPath: uploaded.url,     // kept for compatibility
        url: uploaded.url,
        imageId: uploaded.imageId, // ✅ this is what you should store in DB now
        variants: uploaded.variants,
    };
}

async function deleteObject({ key }) {
    assertEnv();
    if (!key) return;

    const imageId = cloudflareImageIdFromKey(key);
    const apiUrl = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/images/v1/${imageId}`;

    const { res, json } = await cfFetch(apiUrl, { method: "DELETE" });

    if (res.status === 404) return;

    if (!res.ok || !json || json.success !== true) {
        const msg =
            (json && (json.errors || json.messages))
                ? JSON.stringify({ errors: json.errors, messages: json.messages })
                : (await res.text().catch(() => ""));
        throw new Error(`Cloudflare Images delete failed (${res.status} ${res.statusText}): ${msg}`);
    }
}

module.exports = { IMAGES_ROOT, putObject, deleteObject };
