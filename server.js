require('dotenv').config();

const express = require('express');
const axios = require('axios');
const path    = require('path');
const { connectDB } = require('./config/db');
const playlistRoutes = require('./routes/playlistRoutes');

const app     = express();
const PORT    = process.env.PORT || 3000;

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Connect to MongoDB
connectDB();

const urlIn = "https://same-platform.onrender.com";
const interval = 60000;

function reloadWebsite() {
  axios
    .get(urlIn)
    .then((response) => {
      // console.log("website reloded .in");
    })
    .catch((error) => {
      console.error(`Error (.in) : ${error.message}`);
    });
}

setInterval(reloadWebsite, interval);

// EJS as template engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Serve static files (style.css, img/, youtube-player.js, etc.)
app.use(express.static(path.join(__dirname)));

// Mount Routes
app.use('/', playlistRoutes);

app.listen(PORT, () => {
    console.log(`Casseta running at http://localhost:${PORT}`);
});
