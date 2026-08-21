const mongoose = require('mongoose');

let dbConnected = false;

const connectDB = () => {
    if (process.env.MONGODB_URI) {
        mongoose.connect(process.env.MONGODB_URI)
            .then(() => {
                console.log('Connected to MongoDB');
                dbConnected = true;
            })
            .catch(err => console.error('MongoDB connection error:', err));
    } else {
        console.warn('MONGODB_URI not found in .env. Running without database (default playlists only).');
    }
};

const isDbConnected = () => dbConnected;

module.exports = { connectDB, isDbConnected };
