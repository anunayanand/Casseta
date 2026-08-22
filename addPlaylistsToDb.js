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


        const bartanTime = new Playlist({
            id: process.env.YT_PLAYLIST_BARTAN_TIME || 'PLKDoMVtNo-6k',
            name: 'Bartan Time',
            side: 'E',
            color: '#0ea5e9', // Sky blue
            accent: '#38bdf8', // Lighter blue
            bgTint: 'rgba(14, 165, 233, 0.25)',
            bgFilter: 'sepia(20%) brightness(0.65) saturate(120%) hue-rotate(180deg)',
            bgDesktop: '/img/bg_bartan_time_desk.png',
            bgMobile: '/img/bg_bartan_time_phone.png',
        });

        await bartanTime.save();
        console.log('Bartan Time playlist added to DB');

        mongoose.connection.close();
        console.log('Done! Disconnected from MongoDB');
    } catch (err) {
        console.error('Error adding playlists:', err);
        mongoose.connection.close();
    }
};

addPlaylists();
