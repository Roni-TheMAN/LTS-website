// // // backend/routes/imageRoutes.js
// // const express = require("express");
// // const multer = require("multer");
// //
// // const {
// //     listAllImages,
// //     getImagesByProductId,
// //     createProductImage,
// //     getImagesByDesignId,
// //     createDesignImage,
// //     createImageFromUrl,
// //     deleteImageById,
// // } = require("../../controllers/admin/imageController");
// //
// // const router = express.Router();
// //
// // // configurable (so you don't keep editing code)
// // const MAX_MB = Number(process.env.UPLOAD_MAX_MB || 10);
// // const MAX_BYTES = MAX_MB * 1024 * 1024;
// //
// // const upload = multer({
// //     storage: multer.memoryStorage(),
// //     limits: { fileSize: MAX_BYTES },
// // });
// //
// // function wrapSingleUpload(handler) {
// //     return (req, res) => {
// //         upload.single("file")(req, res, async (err) => {
// //             if (err) {
// //                 if (err.code === "LIMIT_FILE_SIZE") {
// //                     return res.status(413).json({ error: `File too large. Max ${MAX_MB}MB.` });
// //                 }
// //                 return res.status(400).json({ error: err.message || "Upload failed." });
// //             }
// //             return handler(req, res);
// //         });
// //     };
// // }
// //
// // // List all images (Media Library)
// // router.get("/", listAllImages);
// //
// // // Create from external URL (Media Library URL mode)
// // router.post("/url", createImageFromUrl);
// //
// // // Products
// // router.get("/product/:productId", getImagesByProductId);
// // router.post("/product/:productId", wrapSingleUpload(createProductImage));
// //
// // // Keycard designs
// // router.get("/design/:designId", getImagesByDesignId);
// // router.post("/design/:designId", wrapSingleUpload(createDesignImage));
// //
// // // Common
// // router.delete("/:id", deleteImageById);
// //
// // module.exports = router;
//
//
// // backend/routes/imageRoutes.js
// const express = require("express");
// const multer = require("multer");
//
// // Support either path (some repos have /controllers/admin, some don't)
// let controller;
// try {
//     controller = require("../../controllers/admin/imageController");
// } catch {
//     controller = require("../../controllers/imageController");
// }
//
// const {
//     listAllImages,
//     getImagesByProductId,
//     createProductImage,
//     getImagesByDesignId,
//     createDesignImage,
//     createImageFromUrl,
//     deleteImageById,
// } = controller;
//
// const router = express.Router();
//
// // configurable (so you don't keep editing code)
// const MAX_MB = Number(process.env.UPLOAD_MAX_MB || 10);
// const MAX_BYTES = MAX_MB * 1024 * 1024;
//
// const upload = multer({
//     storage: multer.memoryStorage(),
//     limits: { fileSize: MAX_BYTES },
// });
//
// function wrapSingleUpload(handler) {
//     return (req, res) => {
//         upload.single("file")(req, res, async (err) => {
//             if (err) {
//                 if (err.code === "LIMIT_FILE_SIZE") {
//                     return res.status(413).json({ error: `File too large. Max ${MAX_MB}MB.` });
//                 }
//                 return res.status(400).json({ error: err.message || "Upload failed." });
//             }
//             return handler(req, res);
//         });
//     };
// }
//
// // List all images (Media Library)
// router.get("/", listAllImages);
//
// // Create from external URL (Media Library URL mode)
// router.post("/url", createImageFromUrl);
//
// // Products
// router.get("/product/:productId", getImagesByProductId);
// router.post("/product/:productId", wrapSingleUpload(createProductImage));
//
// // Keycard designs
// router.get("/design/:designId", getImagesByDesignId);
// router.post("/design/:designId", wrapSingleUpload(createDesignImage));
//
// // Common
// router.delete("/:id", deleteImageById);
//
// module.exports = router;


// backend/routes/admin/imageRoutes.js
const express = require("express");
const multer = require("multer");

// Support either path (some repos have /controllers/admin, some don't)
let controller;
try {
    controller = require("../../controllers/admin/imageController");
} catch {
    controller = require("../../controllers/imageController");
}

const {
    listAllImages,
    getImagesByProductId,
    createProductImage,
    createProductImagesBulk, // ✅ NEW
    getImagesByDesignId,
    createDesignImage,
    createDesignImagesBulk,  // ✅ NEW
    createImageFromUrl,
    deleteImageById,
} = controller;

const router = express.Router();

// configurable (so you don't keep editing code)
const MAX_MB = Number(process.env.UPLOAD_MAX_MB || 10);
const MAX_BYTES = MAX_MB * 1024 * 1024;

// limit how many files per request
const MAX_FILES = Number(process.env.UPLOAD_MAX_FILES || 12);

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: MAX_BYTES, // per-file limit
        files: MAX_FILES,
    },
});

function wrapSingleUpload(handler) {
    return (req, res) => {
        upload.single("file")(req, res, async (err) => {
            if (err) {
                if (err.code === "LIMIT_FILE_SIZE") {
                    return res.status(413).json({ error: `File too large. Max ${MAX_MB}MB.` });
                }
                if (err.code === "LIMIT_FILE_COUNT") {
                    return res.status(413).json({ error: `Too many files. Max ${MAX_FILES}.` });
                }
                return res.status(400).json({ error: err.message || "Upload failed." });
            }
            return handler(req, res);
        });
    };
}

function wrapMultiUpload(handler) {
    return (req, res) => {
        upload.array("files", MAX_FILES)(req, res, async (err) => {
            if (err) {
                if (err.code === "LIMIT_FILE_SIZE") {
                    return res.status(413).json({ error: `One of the files is too large. Max ${MAX_MB}MB each.` });
                }
                if (err.code === "LIMIT_FILE_COUNT") {
                    return res.status(413).json({ error: `Too many files. Max ${MAX_FILES}.` });
                }
                return res.status(400).json({ error: err.message || "Upload failed." });
            }
            return handler(req, res);
        });
    };
}

// List all images (Media Library)
router.get("/", listAllImages);

// Create from external URL (Media Library URL mode)
router.post("/url", createImageFromUrl);

// Products
router.get("/product/:productId", getImagesByProductId);
router.post("/product/:productId", wrapSingleUpload(createProductImage));

// ✅ NEW: bulk upload product images
router.post("/product/:productId/bulk", wrapMultiUpload(createProductImagesBulk));

// Keycard designs
router.get("/design/:designId", getImagesByDesignId);
router.post("/design/:designId", wrapSingleUpload(createDesignImage));

// ✅ NEW: bulk upload design images (still respects max 2)
router.post("/design/:designId/bulk", wrapMultiUpload(createDesignImagesBulk));

// Common
router.delete("/:id", deleteImageById);

module.exports = router;
