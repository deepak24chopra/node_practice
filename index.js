const express = require('express');
const app = express();
const Joi = require('Joi');
const md5 = require('md5');

var MongoClient = require('mongodb').MongoClient;
const url = "mongodb://localhost:27017/";

const bodyParser = require('body-parser');
const urlencodedParser = bodyParser.urlencoded({ extended: false});
const expressSession = require('express-session');
//var session =  new nodeSession({secret : '4dWAFoZOYYo2uEJIosu0BQoYnC3EseslR2lth86ClhthGROoXD4u+8l5aVN5SjW8gXvsUNYKK6FwdP+xxioIf9ijC3AIvruYDYX6veqLTYg+4y5R/rzaRGOOE+Wr45EZ'});
app.use(expressSession({ secret: 'keyboard', cookie: { maxAge: 60000 }}))

app.set('view engine', 'ejs');

var form_string = '';

app.get('/', (req, res)=>{
  if(req.session.username) {
    res.render('home',{data : {username : req.session.username} });
  } else {
    res.render('home', {data : {}});
  }
});

const schema  = {
  username  :Joi.string().required().max(30).min(4),
  email : Joi.string().required().regex(/^[a-zA-Z0-9]+@[a-zA-Z0-9]+.com$/),
  password : Joi.string().min(6).required()
};

app.get('/signUp',(req,res)=>{
  req.session.username = '';
  res.render('signUp', {data : {messages : {}}});
});

app.post('/signUp',urlencodedParser ,(req, res)=>{
  req.session.username = '';
  //console.log(req.body);
  MongoClient.connect(url, function(err, db) {
  if (err) throw err;``
  var dbo = db.db("Sandbox");
  var myobj = { username: req.body.username, email: req.body.email , password : req.body.password };
  const result = Joi.validate(myobj, schema);
  if(result.error) {
    var errorMessages='';
    //console.log(result.error.details[0].message);
    for(var mes in result.error.details){
      errorMessages += result.error.details[mes].message;
    }
    res.render('signUp', {data : {messages : {danger : errorMessages}}});
    return;
  }
  dbo.collection("users").insertOne(myobj, function(err, response) {
    if (err) res.render('signUp',{data : {messages : {danger : 'Cannot sign up right now.'}}});
    //res.render('profile', {response: req.body.username});
    db.close();
    req.session.username = response.ops[0].username;
    //console.log(req.session.username);
    res.redirect('/profile');
  });
});
});

app.get('/login', (req,res) => {
  req.session.username = '';
  res.render('login', {data : {messages : {}}});
});

app.post('/login', urlencodedParser, (req,res) => {
  req.session.username = '';
  if(req.body.email.trim() && req.body.password.trim()) {
    MongoClient.connect(url, (err,db) => {
      if (err) res.render('login',{data : {messages : {danger : "Cannot login right now."}}});
      var dbo = db.db("Sandbox");
      dbo.collection('users').findOne({email : req.body.email}, (error,result) => {
        if(error) res.render('login', {data :{messages : {danger : `No account with this '${req.body.email}' has been found.`}}});
        //console.log('result ' + JSON.stringify(result));
        if(req.body.password == result.password) {
          req.session.username = result.username;
          res.redirect('/profile');
        } else {
          res.render('login', {data : {messages : {danger : "Invalid email/password combination"}}});
        }
      })
    })
  } else {
    res.render('login', {data : {messages : {danger : "Fields cannot be empty."}}});
  }
});

app.get('/profile' , (req,res)=>{
  var userdata = {};
  if(req.session.username != undefined) {
    MongoClient.connect(url, (err,db) => {
      if (err) throw err;
      var dbo = db.db("Sandbox");
      dbo.collection('users').findOne({username : req.session.username}, (error,result) => {
        if (error) res.render('profile', {data : {messages : {danger : 'Details cannot be fetched right now.'}}});
        //console.log(result);
        userdata = {
          image : "https://secure.gravatar.com/avatar/" + md5(result.email.toLowerCase()) + "?s=160",
          username : result.username,
          email : result.email
        }
        //console.log('userdata : ' + userdata);
        res.render('profile', {data: {username : req.session.username, user : {userdata}}});
      });
      //res.render('profile', {data: {user : {userdata}}});
    });
    //res.render('profile',{data : {user : userdata} });
  } else {
    res.redirect('/');
  }
});

app.get('/editProfile' ,(req ,res)=>{
  var userdata = {};
  var user_types = [];
  if(req.session.username != undefined){
    MongoClient.connect(url, (err,db) => {
      if (err) throw err;
      var dbo = db.db("Sandbox");
      dbo.collection('users').findOne({username : req.session.username}, (error,result) => {
        if (error) res.render('profile', {data : {messages : {danger : 'Details cannot be fetched right now.'}}});
        //console.log(result);
        userdata = {
          image : "https://secure.gravatar.com/avatar/" + md5(result.email.toLowerCase()) + "?s=160",
          username : result.username,
          email : result.email
        }
      });
      dbo.collection('user_types').find({}).toArray((error,result) => {
        if(error) res.render('profile', {data : {messages : {danger : 'User types cannot be fetched right now.'}}});
        //console.log(result);
        res.render('editProfile', {data: {user_types : result, username : req.session.username, user : {userdata}}});
      });
    });
    //res.render('editProfile', {data: {user_types : user_types, username : req.session.username, user : {userdata}}});
  } else {
    res.redirect('/');
  }
});

app.get('/getFieldsTypes/:type', (req,res) => {
  //here generate html form for type params and return html
  form_string = '<div class="form-group">';
  MongoClient.connect(url, (err,db) => {
    if (err) throw err;
    var dbo = db.db('Sandbox');
    dbo.collection('user_types').findOne({type : req.params.type}, (error,result) => {
      if (error) console.log('DB error while generating forms');
      for(var key in result) {
        if(key == '_id' || key == 'type') {
          continue;
        }
        form_string += `<label> ${key} </label>`;
        if (result[key].trim().toLowerCase() == 'text') {
          form_string += `<input type="text" name="${key}" class="form-control" /></div><div class="form-group">`;
        } else if (result[key].trim().toLowerCase() == 'integer') {
          form_string += `<input type="number" name="${key}" class="form-control" /></div><div class="form-group">`;
        } else if (result[key].trim().toLowerCase() == 'date') {
          form_string += `<input type="date" name="${key}" class="form-control" /></div><div class="form-group">`;
        } else if (result[key].trim().toLowerCase() == 'textarea') {
          form_string += `<textarea name="${key}" class="form-control" /></textarea></div><div class="form-group">`;
        } else if(result[key].substr(0,6).trim().toLowerCase() == 'select') {
          form_string += `<select class="form-control">`
          var str=JSON.parse(result[key].substr(9,result[key].length));
          for(var option in str) {
            form_string += `<option value="${str[option]}">${str[option]}</option>`
          }
          form_string += `</select></div><div class="form-group">`
        }
      }
      form_string += '</div>';
      res.send(form_string);
    });
  });
});

app.get('/logout', (req,res) => {
  req.session.username = '';
  res.redirect('/');
});

app.listen(3000);
