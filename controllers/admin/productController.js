const Products = require("../../models/productSchema");
const Category = require("../../models/categorySchema");

const multer = require("multer");
const fs = require("fs");


const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "public/uploads/");
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + "-" + file.originalname);
    },
});
const upload = multer({ storage: storage });




const getProducts = async (req, res) => {
    try {
        const { search = "", page = 1 } = req.query;
        const limit = 10;
        const skip = (page - 1) * limit;
        const regex = new RegExp("^" + search, "i");

        const prds = await Products.find({ name: { $regex: regex } })
            .populate("category")
            .skip(skip)
            .limit(limit);

        // console.log(prds.category);

        const totalProducts = await Products.countDocuments({ name: { $regex: search, $options: "i" } });
        const totalPages = Math.ceil(totalProducts / limit);

        const error_msg = req.query.error;
        const success_msg = req.query.success;
        res.render("admin/product", { products: prds, search: search, currentPage: Number(page), totalPages, error_msg, success_msg });
    } catch (error) {
        console.error("Error from get products : \n", error);
    }
};

const getAddProduct = async (req, res) => {
    try {
        const categories = await Category.find();


        const error_msg = req.query.error;
        const success_msg = req.query.success;
        res.render("admin/addproduct", { categories, error_msg, success_msg });
    } catch (error) {
        console.error("Error from get add Product : \n", error);
    }
};

const postAddProduct = async (req, res) => {
    try {
        const isExist = await Products.findOne({ name: req.body.name });

        if (isExist) {
            return res.redirect("/admin/product-management/add-product?error=Product already exists");
        }

        const imageName = req.files.map((file) => {
            // console.log(file.filename);

            return file.filename;
        });

        if (imageName.length < 3) {
            return res.redirect("/admin/product-management/add-product?error=Atleast 3 images needed");
        }

        
        const newProduct = new Products({
            name: req.body.name,
            brand: req.body.brand,
            category: req.body.category,
            price: req.body.price,
            stock: req.body.stock,
            specifications: {
                processor: {
                    brand: req.body.specifications.processor.brand,
                    model: req.body.specifications.processor.model,
                    cores: req.body.specifications.processor.cores,
                    speed: req.body.specifications.processor.speed,
                },
                ram: {
                    size: req.body.specifications.ram.size,
                    type: req.body.specifications.ram.type,
                },
                storage: {
                    type: req.body.specifications.storage.type,
                    capacity: req.body.specifications.storage.capacity,
                },
                display: {
                    size: req.body.specifications.display.size,
                    resolution: req.body.specifications.display.resolution,
                },
                graphics: {
                    brand: req.body.specifications.graphics.brand,
                    model: req.body.specifications.graphics.model,
                    memory: req.body.specifications.graphics.memory,
                },
                battery: {
                    type: req.body.specifications.battery.type,
                    capacity: req.body.specifications.battery.capacity,
                },
                os: req.body.specifications.os,
                weight: req.body.specifications.weight,
                dimensions: {
                    width: req.body.specifications.dimensions.width,
                    height: req.body.specifications.dimensions.height,
                    depth: req.body.specifications.dimensions.depth,
                },
            },
            warranty: req.body.warranty,
            images: imageName,
            status: req.body.status || "listed",
        });

        
        await newProduct.save();

        // console.log("Document stored successfully");

        
        res.redirect("/admin/product-management/add-product?success=Product added successfully");
    } catch (error) {
        console.error(error);
        res.redirect("/admin/product-management/add-product?error=An error occurred while adding the product.");
    }
};

const updateProductStatus = async (req, res) => {
    try {
        const productId = req.params.id;
        const newStatus = req.body.status;

        await Products.findByIdAndUpdate(productId, { status: newStatus }, { new: true });

        res.json({ success: true });
    } catch (error) {
        res.json({ success: false });
        console.error("Error from Catogory status update : \n", error);
    }
};

const getEditProduct = async (req, res) => {
    try {
        const productId = req.params.id;

        const product = await Products.findById(productId);

        if (!product) {
            res.redirect("/admin/product-management?error=Product not found");
        }

        const categories = await Category.find();

        // console.log(product);

        res.render("admin/editproduct", { categories, product });
    } catch (error) {
        console.error("Error from Get edit product page : \n", error);
    }
};

const postEditProduct = async (req, res) => {
    try {
        const productId = req.params.id;

        
        const product = await Products.findById(productId);
        if (!product) {
            return res.redirect("/admin/product-management?error=Product not found");
        }

        
        const existingImages = req.body.existingImages || []; 
        const newImageNames = req.files.map(file => file.filename); 

        
        let updatedImages = [];
        if (existingImages) {
            updatedImages = Array.isArray(existingImages) ? existingImages : [existingImages];
        }
        if (newImageNames.length > 0) {
            updatedImages = [...updatedImages, ...newImageNames];
        }

        
        if (updatedImages.length < 3) {
            return res.redirect(`/admin/editproduct/${productId}?error=At least 3 images are required`);
        }

        
        const updatedProductData = {
            name: req.body.name,
            brand: req.body.brand,
            category: req.body.category,
            price: req.body.price,
            stock: req.body.stock,
            specifications: {
                processor: {
                    brand: req.body.specifications?.processor?.brand || "",
                    model: req.body.specifications?.processor?.model || "",
                    cores: req.body.specifications?.processor?.cores || "",
                    speed: req.body.specifications?.processor?.speed || "",
                },
                ram: {
                    size: req.body.specifications?.ram?.size || "",
                    type: req.body.specifications?.ram?.type || "",
                },
                storage: {
                    type: req.body.specifications?.storage?.type || "",
                    capacity: req.body.specifications?.storage?.capacity || "",
                },
                display: {
                    size: req.body.specifications?.display?.size || "",
                    resolution: req.body.specifications?.display?.resolution || "",
                },
                graphics: {
                    brand: req.body.specifications?.graphics?.brand || "",
                    model: req.body.specifications?.graphics?.model || "",
                    memory: req.body.specifications?.graphics?.memory || "",
                },
                battery: {
                    type: req.body.specifications?.battery?.type || "",
                    capacity: req.body.specifications?.battery?.capacity || "",
                },
                os: req.body.specifications?.os || "",
                weight: req.body.specifications?.weight || "",
                dimensions: {
                    width: req.body.specifications?.dimensions?.width || "",
                    height: req.body.specifications?.dimensions?.height || "",
                    depth: req.body.specifications?.dimensions?.depth || "",
                },
            },
            warranty: req.body.warranty || "",
            images: updatedImages,
            primaryImageIndex: parseInt(req.body.primaryImageIndex, 10) || 0,
            status: req.body.status || "listed",
        };

        
        const updatedProduct = await Products.findByIdAndUpdate(productId, updatedProductData, { new: true });

        if (!updatedProduct) {
            return res.redirect("/admin/product-management?error=Product not found");
        }

        console.log("Product ID: ", productId);
        console.log("Updated Data: ", updatedProductData);
        console.log("Files: ", req.files);

        res.redirect(`/admin/product-management?success=Product updated successfully`);
    } catch (error) {
        console.error("Error updating product: \n", error);
        res.redirect(`/admin/editproduct/${productId}?error=Error updating product`);
    }
};

module.exports = {getProducts , getAddProduct, postAddProduct ,getEditProduct , postEditProduct , updateProductStatus} 