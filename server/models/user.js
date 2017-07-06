const mongoose = require('mongoose');
const validator = require('validator');
const jwt = require('jsonwebtoken');
const _ = require('lodash');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    trim: true,
    minlength: 1,
    unique: true,
    validate: {
      validator: validator.isEmail,
      message: `{VALUE} is not a valid email`
    }
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  tokens: [{
    access: {
      type: String,
      required: true
    },
    token: {
      type: String,
      required: true
    }
  }]
});

// gets called when we respond with res.send. JSON.stringify is what calls toJSON.
UserSchema.methods.toJSON = () => {
  const user = this;
  const userObject = user.toObject();

  return _.pick(userObject, ['_id', 'email']);
};

// methods are defined on the document (instance)
UserSchema.methods.generateAuthToken = () => {
  const user = this; // 'this' refers to document
  const access = 'auth';
  // sign( data to sign, secret)
  const token = jwt.sign({ _id: user._id.toHexString(), access }, process.env.JWT_SECRET).toString();
  console.log('from gen auth token: ', token);

  user.tokens.push({ access, token });

  return user.save().then(() => {
    return token;
  });
};

UserSchema.methods.removeToken = (token) => {
  const user = this;

  return user.update({
    $pull: {
      tokens: { token }
    }
  });
};

// statics are the methods defined on the Model.
UserSchema.statics.findbyToken = (token) => {
  const User = this;
  let decoded;

  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (e) {
    return Promise.reject();
  }
  return User.find({
    '_id': decoded._id,
    'tokens.token': token,
    'tokens.access': 'auth'
  });
};

UserSchema.statics.findByCredentials = (email, password) => {
  const User = this;

  return User.find({ email }).then((user) => {
    if (!user) {
      return Promise.reject();
    }

    return new Promise((resolve, reject) => {
      bcrypt.compare(password, user.password, (err, res) => {
        if (res) {
          resolve(user);
        } else {
          reject();
        }
      });
    });
  });
};

// must not use () => as this distrupts 'this'
UserSchema.pre('save', function (next) {
  console.log('inside save 1');
  const user = this;

  if (user.isModified('password')) {
    console.log('inside save 2');
    bcrypt.genSalt(10, (err, salt) => {
      bcrypt.hash(user.password, salt, (err, hash) => {
        console.log('inside pre save , ', hash);
        user.password = hash;
        next();
      });
    });
  }

  next();
});

const User = mongoose.model('User', UserSchema);

module.exports = { User };
