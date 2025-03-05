const multer = require("multer");
const path = require("path");
// const crypto = reqire('cryp')

function generateRandomFilename(originalname) {
    const ext = path.extname(originalname);
    return `${Date.now()}_${Math.floor(Math.random() * 10000)}${ext}`; // Generates a timestamp + random number
}


const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, "uploads/"); // Directory to save uploaded images
    },
    filename: function (req, file, cb) {
        cb(null,generateRandomFilename(file.originalname)); // Save with a timestamp to avoid collisions
    },
});

const productImageUpload = multer({ storage: storage });

module.exports = productImageUpload;
