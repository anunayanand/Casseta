require('dotenv').config();
const mongoose = require('mongoose');
const Playlist = require('./models/Playlist');

const addPlaylists = async () => {
    if (!process.env.MONGODB_URI) {
        console.error('MONGODB_URI is not set in .env');
        process.exit(1);
    }

    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        const roadTrip = new Playlist({
            id: process.env.YT_PLAYLIST_ROAD_TRIP || 'PLPtRlMRuJkHE',
            name: 'Road Trip',
            side: 'C',
            color: '#e76f51',
            accent: '#f4a261',
            bgTint: 'rgba(231,111,81, 0.25)',
            bgFilter: 'sepia(30%) brightness(0.6) saturate(140%) hue-rotate(15deg)',
            bgDesktop: '/img/bg_road_trip_desk.png',
            bgMobile: '/img/bg_road_trip_phone.png',
        });

        const navratri = new Playlist({
            id: process.env.YT_PLAYLIST_NAVRATRI || 'PLCxkXauuDzs0',
            name: 'Navratri & Dandiya',
            side: 'D',
            color: '#d90429',
            accent: '#ef233c',
            bgTint: 'rgba(217,4,41, 0.25)',
            bgFilter: 'sepia(40%) brightness(0.55) saturate(150%) hue-rotate(340deg)',
            bgDesktop: '/img/bg_navratri_desk.png',
            bgMobile: '/img/bg_navratri_phone.png',
        });

        await roadTrip.save();
        console.log('Road Trip playlist added to DB');

        await navratri.save();
        console.log('Navratri & Dandiya playlist added to DB');

        mongoose.connection.close();
        console.log('Done! Disconnected from MongoDB');
    } catch (err) {
        console.error('Error adding playlists:', err);
        mongoose.connection.close();
    }
};

addPlaylists();
