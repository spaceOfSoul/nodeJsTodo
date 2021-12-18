var router = require('express').Router();

function isLogin(req, res, next){
    if(req.user){
        next();
    }else{
        res.send('not login!');
    }
}

router.use(isLogin);