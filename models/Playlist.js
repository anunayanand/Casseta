const mongoose = require('mongoose');

const playlistSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  side: {
    type: String,
    default: 'A',
  },
  color: {
    type: String,
    required: true,
  },
  accent: {
    type: String,
    required: true,
  },
  bgTint: {
    type: String,
  },
  bgFilter: {
    type: String,
  },
  bgDesktop: {
    type: String,
  },
  bgMobile: {
    type: String,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  }
});

module.exports = mongoose.model('Playlist', playlistSchema);
