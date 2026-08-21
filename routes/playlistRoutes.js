const express = require('express');
const router = express.Router();
const xss = require('xss');
const rateLimit = require('express-rate-limit');
const Playlist = require('../models/Playlist');
const PLAYLISTS = require('../data/playlists');
const { isDbConnected } = require('../config/db');

// Rate Limiter for adding playlists
const addPlaylistLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // Limit each IP to 5 requests per windowMs
    message: { error: 'Too many playlists added from this IP, please try again after 15 minutes' }
});

// GET /
router.get('/', async (req, res) => {
    let allPlaylists = [];
    
    if (isDbConnected()) {
        try {
            const dbPlaylists = await Playlist.find().sort({ createdAt: 1 });
            const sides = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
            allPlaylists = dbPlaylists.map((p, idx) => ({
                id: p.id,
                name: p.name,
                side: p.side === 'A' ? (sides[idx % sides.length] || '?') : p.side,
                color: p.color,
                accent: p.accent,
                bgTint: p.bgTint,
                bgFilter: p.bgFilter,
                bgDesktop: p.bgDesktop,
                bgMobile: p.bgMobile
            }));
        } catch (err) {
            console.error('Error fetching playlists from DB:', err);
            allPlaylists = [...PLAYLISTS]; // fallback on error
        }
    } else {
        allPlaylists = [...PLAYLISTS]; // fallback if not connected
    }
    
    res.render('index', {
        playlists: allPlaylists,
        title: 'Casseta',
    });
});

// POST /api/playlists
router.post('/api/playlists', addPlaylistLimiter, async (req, res) => {
    if (!isDbConnected()) {
        return res.status(503).json({ error: 'Database not connected. Please ask the admin to set MONGODB_URI.' });
    }

    const { link, name } = req.body;
    
    if (!link || !name) {
        return res.status(400).json({ error: 'Link and name are required' });
    }

    // Extract Playlist ID from URL
    const match = link.match(/[?&]list=([a-zA-Z0-9_-]+)/);
    const playlistId = match ? match[1] : link; // fallback to input if it doesn't match URL format

    // Validate ID format
    if (!/^[a-zA-Z0-9_-]{10,40}$/.test(playlistId)) {
        return res.status(400).json({ error: 'Invalid YouTube Playlist ID or Link' });
    }

    // Sanitize name
    const cleanName = xss(name).substring(0, 40); // limit length

    // Generate completely unique vintage colors (using HEX to ensure frontend compatibility)
    function hslToHex(h, s, l) {
        l /= 100;
        const a = s * Math.min(l, 1 - l) / 100;
        const f = n => {
            const k = (n + h / 30) % 12;
            const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
            return Math.round(255 * color).toString(16).padStart(2, '0');
        };
        return `#${f(0)}${f(8)}${f(4)}`;
    }

    const hue = Math.floor(Math.random() * 360);
    const saturation = Math.floor(Math.random() * 40) + 30; // 30% - 70%
    const lightness = Math.floor(Math.random() * 30) + 50; // 50% - 80%
    
    // Main cassette color
    const randColor = hslToHex(hue, saturation, lightness);
    // Accent color (sticker/stripe) is a slightly darker, more saturated version of the same hue
    const randAccent = hslToHex(hue, Math.min(saturation + 15, 100), Math.max(lightness - 20, 20));
    
    // We use the universal_bg for all newly added user playlists
    const randHue = Math.floor(Math.random() * 30) - 15; // Subtle hue shift to give slight variation without ruining the image

    try {
        const newPlaylist = new Playlist({
            id: playlistId,
            name: cleanName,
            color: randColor,
            accent: randAccent,
            bgTint: 'rgba(50,50,50, 0.25)',
            bgFilter: `sepia(20%) brightness(0.6) saturate(110%) hue-rotate(${randHue}deg)`,
            bgDesktop: `/img/universal_bg_desk.png`,
            bgMobile: `/img/universal_bg_phone.png`
        });

        await newPlaylist.save();
        res.status(201).json({ success: true, playlist: newPlaylist });
    } catch (err) {
        console.error('Error saving playlist:', err);
        res.status(500).json({ error: 'Failed to add playlist' });
    }
});

module.exports = router;
