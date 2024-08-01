const User = require('../models/userModel');
const axios = require('axios');
const nodemailer = require('nodemailer');
const { Configuration, OpenAIApi } = require('openai');

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});

const openai = new OpenAIApi(configuration);


const addUser = async (req, res) => {
  const { email, location } = req.body;

  // Fetch weather data based on the location
  const { lat, lon } = location;
  try {
    const weatherResponse = await axios.get(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${process.env.OPENWEATHER_API_KEY}`);
    const weatherData = weatherResponse.data;

    // Create new user with weather data
    const newUser = new User({
      email,
      location,
      weatherData: [{ date: new Date(), data: weatherData }]
    });
    await newUser.save();

    res.status(201).send(newUser);
  } catch (error) {
    console.error('Error fetching weather data:', error);
    res.status(500).send('Error fetching weather data');
  }
};

const updateUserLocation = async (req, res) => {
  const { email } = req.params;
  const { location } = req.body;
  try {
    const user = await User.findOneAndUpdate({ email }, { location }, { new: true });

    // Fetch new weather data based on updated location
    const { lat, lon } = location;
    const weatherResponse = await axios.get(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${process.env.OPENWEATHER_API_KEY}`);
    const weatherData = weatherResponse.data;

    // Add new weather data to the user's weatherData array
    user.weatherData.push({ date: new Date(), data: weatherData });
    await user.save();

    res.send(user);
  } catch (error) {
    console.error('Error updating user location or fetching weather data:', error);
    res.status(500).send('Error updating user location or fetching weather data');
  }
};

const getUserWeatherData = async (req, res) => {
  const { email, date } = req.params;
  const user = await User.findOne({ email });
  const weatherData = user.weatherData.find(data => data.date.toISOString().split('T')[0] === date);
  res.send(weatherData);
};

const generateWeatherText = async (weatherData) => {
  const prompt = `Create a detailed weather report based on the following data: ${JSON.stringify(weatherData)}`;

  try {
    const response = await openai.createCompletion({
      model: 'text-davinci-003',  // You can use other models like 'gpt-3.5-turbo' if available
      prompt,
      max_tokens: 100,
    });

    return response.data.choices[0].text.trim();
  } catch (error) {
    console.error('Error generating weather report text:', error);
    return 'Unable to generate weather report text.';
  }
};

const fetchWeatherDataAndSendEmails = async () => {
  const users = await User.find();
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_PASS
    }
  });

  for (const user of users) {
    const { lat, lon } = user.location;
    const weatherResponse = await axios.get(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${process.env.OPENWEATHER_API_KEY}`);
    const weatherData = weatherResponse.data;

    // Save weather data to user's weatherData array
    user.weatherData.push({ date: new Date(), data: weatherData });
    await user.save();

    const weatherText = await generateWeatherText(weatherData);

    const mailOptions = {
      from: process.env.GMAIL_USER,
      to: user.email,
      subject: 'Hourly Weather Report',
      text: `The weather at your location is: ${weatherData.weather[0].description}\n\nDetailed report:\n${weatherText}`
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.log(error);
      } else {
        console.log('Email sent: ' + info.response);
      }
    });
  }
};

module.exports = {
  addUser,
  updateUserLocation,
  getUserWeatherData,
  fetchWeatherDataAndSendEmails,
  generateWeatherText,
};
