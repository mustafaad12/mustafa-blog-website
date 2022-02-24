require('dotenv').config()

const express = require("express");
const app = express();
const ejs = require("ejs");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");

app.use(bodyParser.urlencoded({extended:true}));
app.use(express.static("public"));
app.set("view engine", "ejs");

app.use(session({
  secret: process.env.SECRET_KEY,
  resave: false,
  saveUninitialized: false,
}));

app.use(passport.initialize());
app.use(passport.session());

mongoose.connect(process.env.ATLASURL);

const postSchema = new mongoose.Schema({
  username: String,
  date: String,
  content: String,
  comments:[
    {
      username: String,
      date: String,
      content: String
    }
  ]
});

const Post = mongoose.model("Post", postSchema);

const userSchema = new mongoose.Schema({
  username: String,
  password: String
});

userSchema.plugin(passportLocalMongoose);

const User = mongoose.model("User", userSchema);

passport.use(User.createStrategy());
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.get("/", (req, res)=>{
  if(req.isAuthenticated()){
    res.render("home", {user:req.user.username, login:"logout"});
  }else{
    res.render("home", {user:"ghost", login:"login"});
  }
})

app.get("/blog", (req, res)=>{
  if(req.isAuthenticated()){
    //find posts
    Post.find({},(err, foundPosts)=>{
      if(!err){
        res.render("blog", {posts:foundPosts, user:req.user.username, login:"logout"});
      }
    });
  }else{
    //render login
    res.render("login", {user:"ghost", login:"login"});
  }
});


app.get("/blog/:postId", (req, res)=>{
  const id = req.params.postId;
  if(req.isAuthenticated()){
    Post.findOne({_id:id}, (err,post)=>{
      if(!err){
        res.render("post",{
          user: req.user.username,
          login: "logout",
          post: post
        });
      }else{
        res.send(err);
      }
    });
  }else{
    res.send("you have to login first");
  }
});


app.get("/compose", (req, res)=>{
  if(req.isAuthenticated()){
    if(req.user.username === "mustafa"){
      Post.find({}, (err, foundPosts)=>{
        if(!err){
          res.render("compose", {posts:foundPosts, user:req.user.username, login:"logout"});
        }
      });
    }else{
      res.send("sorry you don't have permission to access this page it is only for admin")
    }
  }else{
    res.redirect("/login");
  }
})

app.post("/compose", (req, res)=>{
  const content = req.body.content;
  var options = { year: 'numeric', month: 'long', day: 'numeric', hour:'numeric', minute:'numeric'};
  var today  = new Date();
  var todayDate = today.toLocaleDateString("en-US", options);
  const post = new Post({
    username: req.user.username,
    date: todayDate,
    content: content
  });
  post.save((err)=>{
    if(!err){
      res.redirect("/blog");
    }
  })
});

app.post("/delete-post", (req,res)=>{
  Post.deleteOne({_id:req.body.postId}, (err)=>{
    if(!err){
      res.redirect("/compose");
    }else{
      res.send(err);
    }
  });
});

app.post("/comment", (req, res)=>{
  const newComment = req.body.comment;
  const postId = req.body.postId;
  var options = { year: 'numeric', month: 'long', day: 'numeric', hour:'numeric', minute:'numeric'};
  var today  = new Date();
  var todayDate = today.toLocaleDateString("en-US", options);
  const comment = {
    username: req.user.username,
    date: todayDate,
    content: newComment
  }

  Post.findOne({_id:postId}, (err,foundPost)=>{
    foundPost.comments.push(comment);
    foundPost.save((err)=>{
      if(!err){
        res.redirect("/blog/" + postId);
      }else{
        res.send(err);
      }
    });
  });
});

app.post("/delete-comment", (req,res)=>{
  const postId = req.body.postId;
  const commentId = req.body.commentId;
  const postUserName = req.body.postUserName;
  const commentUserName = req.body.commentUserName;

  if(commentUserName === req.user.username || postUserName === req.user.username || "mustafa" === req.user.username){
    Post.updateOne({_id:postId}, {$pull:{comments:{_id:commentId}}}, (err)=>{
      if(!err){
        res.redirect("/blog/" + postId);
      }else{
        res.send(err);
      }
    });
  }else{
    res.send("you cant delete others comments")
  }

});

app.get("/register", (req, res)=>{
  if(req.isAuthenticated()){
    req.logout();
    res.redirect("/register");
  }else{
    res.render("register", {user:"ghost", login:"login"});
  }
});

app.post("/register", (req, res)=>{
  User.register({username: req.body.username}, req.body.password, function(err, user){
    if(err){
        res.render("message", {message: err.message ,user:"ghost", login:"login"});
    }else{
      passport.authenticate("local")(req, res, function(){
        res.redirect("/");
      })
    }
  });
});


app.get("/login", (req, res)=>{
  if(req.isAuthenticated()){
    req.logout();
    res.redirect("/")
  }else{
    res.render("login", {user:"ghost", login:"login"});
  }
})

app.post("/login", (req, res)=>{
  const user = new User({
    username: req.body.username,
    password: req.body.password
  })

  req.login(user, (err, foundUser)=>{
    if(err){
      res.send(err);
    }else{
      passport.authenticate("local")(req, res, function(){
        res.redirect("/blog")
      });
    }
  });
});

app.listen(process.env.PORT || 3000, ()=>{
  console.log("app.listen on the port 3000")
})
