// multer.js
const multer = require("multer");
const path = require("path");
const fs = require('fs');

function generateRandomFilename(originalname) {
    const ext = path.extname(originalname);
    return `${Date.now()}_${Math.floor(Math.random() * 10000)}${ext}`; // Generates a timestamp + random number
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(__dirname, '..', 'uploads');
        // Ensure the uploads directory exists
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir); // Directory to save uploaded images
    },
    filename: function (req, file, cb) {
        cb(null, generateRandomFilename(file.originalname)); // Save with a timestamp to avoid collisions
    },
});

// File filter to allow only images
const fileFilter = (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Only JPEG, PNG, and GIF images are allowed'), false);
    }
};

// Configure multer with storage, file filter, and size limit
const productImageUpload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

module.exports = productImageUpload;