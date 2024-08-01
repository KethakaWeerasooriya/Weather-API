const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: String,
  location: {
    lat: Number,
    lon: Number
  },
  weatherData: [{
    date: Date,
    data: Object
  }]
});

const User = mongoose.model('User', userSchema);

module.exports = User;
