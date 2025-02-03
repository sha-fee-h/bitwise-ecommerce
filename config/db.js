const mongoose=require('mongoose')
const env=require('dotenv').config()

const connectDB=async ()=>{
    try{
        const conn = await mongoose.connect(process.env.MONGODB_URI,{})
        console.log(`MongoDB Connected  : ✅`);
        console.log('=======================');
        
    }catch(error){
        console.log("DB connection error",error.message);
        process.exit(1)

    }
}
module.exports=connectDB