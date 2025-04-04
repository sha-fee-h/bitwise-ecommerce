const express=require('express');
const app=express();
const path=require("path")
const env=require('dotenv').config();
const db=require('./config/db')




// routes
const authRouter=require('./routes/authRouter')
const adminRouter=require('./routes/adminRouter')
const productRouter=require('./routes/productRouter')
const homeRouter=require('./routes/homeRouter')
const userRouter=require('./routes/userRouter')
const cartRouter=require('./routes/cartRouter')
const wishlistRouter=require('./routes/wishlistRouter')
const checkoutRouter=require('./routes/checkoutRouter')
const orderRoutes=require('./routes/orderRoutes')
const apiRoutes = require('./routes/apiRoutes')


const session = require('express-session')
const nocache = require('nocache')
const passport = require("./config/passport")
const flash = require("connect-flash");

db()

app.use(express.json());
app.use(express.urlencoded({extended:true}));
app.use(session({
    secret:process.env.SESSION_SECRET || 'secret',
    resave:false,
    saveUninitialized:true,
    cookie:{
        secure:false,
        httpOnly:true,
        maxAge:72*60*60*1000
    }
}))

app.use(nocache());

app.use(flash());

app.use((req, res, next) => {
    res.locals.error = req.flash("error");
    res.locals.success = req.flash("success");
    next();
});

app.use(passport.initialize());
app.use(passport.session());

app.set("view engine","ejs");
app.set('views', path.join(__dirname, 'views'))
app.use(express.static('public'))
app.use('/uploads', express.static('uploads'));


app.use('/auth',authRouter);
app.use('/admin',adminRouter)
app.use('/products',productRouter)
app.use('/',homeRouter)
app.use('/user',userRouter)
app.use('/cart',cartRouter)
app.use('/wishlist',wishlistRouter)
app.use('/checkout',checkoutRouter)
app.use('/orders/',orderRoutes)
app.use('/api/',apiRoutes)

app.use((req, res, next) => {
    res.status(404).render('admin/404');
});

app.use((err, req, res, next) => {
    console.error(err.stack);

    const statusCode = err.status || 500;
    const message = err.message || 'Something went wrong on the server';

    if (err.name === 'ValidationError') {
        return res.status(400).json({
            success: false,
            message: 'Validation Error',
            errors: err.errors
        });
    }

    if (err.name === 'UnauthorizedError') {
        return res.status(401).json({
            success: false,
            message: ' Unauthorized access'
        });
    }

    res.status(statusCode).json({
        success: false,
        message: message,
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
});



const PORT= 3000 || process.env.PORT ;
app.listen(PORT,()=>console.log("running on 3000"))

module.exports=app