const pageNotFound=async (req,res)=>{
    try{
        res.render('page-404')
    }catch(err){
        res.redirect('/pageNotFound')
    }
}


const loadHomepage = async (req,res)=>{
    try{
        const laptopImage='/images/lenovo-aicore.jpg'
        return res.render('home',{
            laptopImage:laptopImage
        })
        
    }catch(err){
        console.log('Home page not found')
        res.status(500).send('Server error')
    }
}

module.exports={
    loadHomepage,pageNotFound
}