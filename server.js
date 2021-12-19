const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const MongoClient = require('mongodb').MongoClient;
const methodOverride = require('method-override');
const crypto = require('crypto');

//app.use(session({ secret: 'keyboard cat' }));
require('dotenv').config();
app.use(methodOverride('_method'));
app.set('view engine','ejs');

app.use('/public', express.static('public'));

let db;
MongoClient.connect(process.env.DB_URL, { useUnifiedTopology: true }, function(err,client){
    
    if(err){
        return console.log(err);
    }
    
    db = client.db('todod');

    app.listen(process.env.PORT, function(){
        console.log("ok!");
    });
})

app.use(bodyParser.urlencoded({extended : true}));

function isLogin(req, res, next){
    if(req.user){
        next();
    }else{
        res.redirect('/login');
    }
}

app.get('/write',function(req,res){
    res.render('write.ejs');
});

//search
app.get('/search',(req,res)=>{
    var searchCondition = [
        {
            $search: {
                index: 'todoSearch',
                text: {
                  query: req.query.value,
                  path: '일정'
                }
            }
        },
        { $sort : {_id:1}},
        //{$project : { score : {$meta : "searchScore"}}}
    ];
    db.collection('post').aggregate(searchCondition).toArray((err, result)=>{
        if(err) return console.log(err);
        console.log(result);
        res.render('search.ejs',{ans : result});
    });
})

//회원 인증
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const session  = require('express-session');
const res = require('express/lib/response');
const flash = require('connect-flash');

app.use(session({secret : 'asdf', resave : true, saveUninitialized: false}));
app.use(passport.initialize());
app.use(passport.session());
app.use(flash());

//로그인 페이지
app.get('/login', (req, res)=>{
    res.render('login.ejs',{});//
});

app.post('/login', passport.authenticate('local',{
    successRedirect: '/',
    failureRedirect: '/login',
    failureFlash: true,
}));

/*
app.get('/mypage', isLogin,(req,res)=>{
    if(!req.user._id)
        res.redirect('/login',{st : 1});
    else
        res.render('myPage.ejs',{user: req.user.nickname});
});

*/

//로그인
passport.use(new LocalStrategy({
    usernameField: 'id',
    passwordField: 'pw',
    session: true,
    passReqToCallback: false,
  }, function (inputId, inputPw, done) {
    //console.log(inputId, inputPw);
    const psw = crypto.createHash('sha512').update(inputPw).digest('base64');
    db.collection('member').findOne({ id: inputId }, function (err, result) {
      if (err) return done(err);

      if (!result) return done(null, false, { message: '아이디가 존재하지 않습니다.' })
      if (psw == result.password) {
        return done(null, result)
      } else {
        return done(null, false, { message: '비번밀번호가 틀립니다.' })
      }
    })
  }));

  passport.serializeUser((user, done)=>{//user에 위의 result들어감
    done(null, user.id);//이를 세션데이터로 만들어 쿠키를 저장
  });

  passport.deserializeUser((id, done)=>{
      db.collection('member').findOne({id:id}, function(err,result){
        done(null,result);
      });
  });
//sign up

app.get('/signup',(req,res)=>{
    res.render('signup.ejs',{idcheck : false});
});

app.post('/signup',(req,res)=>{
    const psw = crypto.createHash('sha512').update(req.body.pw).digest('base64');

    db.collection('member').findOne({ id: req.body.id }, function (err, result) {
        if (err) return done(err);
        if (!result){
            db.collection('member').insertOne({id :req.body.id, password:psw, nickname:req.body.nickname},
                function(err, result){
                    if(err) return console.log(err);
                    res.redirect('/');
            });
        }else{
            res.render('signup.ejs',{idcheck : true});
        }
    });
})

//글작성
app.post('/add', isLogin, (req,res)=>{
    console.log("send succes");

    db.collection('counter').findOne({name: 'postCount'},
    function(err, result){
        if(!req.user._id)
            res.redirect('/login',{st : 1});
        else{
        console.log(result.total);
        var postsCount = result.total;

        var saveThis = {_id : postsCount+1,  writer : req.user.id,일정:req.body.title, 날짜:req.body.date};

        db.collection('post').insertOne(saveThis,
        function(err, result){
            db.collection('counter').updateOne({name :'postCount'},{ $inc : {total :1 }},function(err, result){
                if(err) return console.log(err);
            });
            res.redirect('/list');
        });
    }
    });
})

app.delete('/delete',function(req,res){

    //var deleteData = {_id : req.body._id, writer : req.user.id};
    db.collection('post').deleteOne({_id : parseInt(req.body._id)},function(err,result){
        if(err){
            res.status(200).send({messege : 'fail'});
            return console.log(err);
        }
        res.status(200).send({messege : 'success'});
    });
});

app.get('/detail/:id', function(req, res){
    db.collection('post').findOne({_id : parseInt(req.params.id)},function(err, result){
        console.log(result);
        res.render('detail.ejs',{ todoData : result });
    });
})

app.get('/edit/:id',(req,res) =>{
    db.collection('post').findOne({_id: parseInt(req.params.id)},(err,result)=>{
        if(err) return console.log(err);
        res.render('edit.ejs',{data: result});
    });
});

app.put('/edit', (req,res)=>{
    db.collection('post').updateOne({_id : parseInt(req.body.id)}, { $set : {일정 : req.body.title,날짜 : req.body.date} },
        (err, result)=>{
            if(err) return console.log('수정 실패');
            res.redirect('/list');
    });
});

//홈
app.get('/',function(req,res){
    if(!req.user){
        res.render('index.ejs',{name : "not login"});
    }else
        res.render('index.ejs',{name : req.user.nickname});
});

//리스트
app.get('/list',function(req,res){

    db.collection('post').find().toArray(function(err, result){
        if(err) return console.log(err);
        if(!req.user){
            res.render('list.ejs',{posts: result, loginuser:'not login'});
        }else{
            res.render('list.ejs',{posts: result, loginuser:req.user.id});
        }
    });
    //
});