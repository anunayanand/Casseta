// youtube-player.js — Casseta x YouTube Playlist

// -----------------------------------------------------------------
// State
// -----------------------------------------------------------------
let ytPlayer        = null;
let ytReady         = false;
let isPlaying       = false;
let shuffleMode     = true;   // shuffle ON by default
let repeatMode      = false;
let rafId           = null;
let isDragging      = false;
let wavePhase       = 0;
let waveBars        = [];
let consecutiveErrs = 0;      // guard against infinite error-skip loop
const MAX_ERRS      = 5;      // stop auto-skipping after this many in a row

let currentPlaylistIndex = 0; // which cassette is active
let activeBgLayer = 'a'; // track active background layer
let isInitialLoad = false;
let pendingPlaylistPlay = false;
let isInserting = false;
const cassetteSound = new Audio('/sound/Best Cassette Tape Sound Effect.mp3');

// -----------------------------------------------------------------
// DOM references
// -----------------------------------------------------------------
const titleEl         = document.getElementById('sp-title');
const artistEl        = document.getElementById('sp-artist');
const cassetteTitleEl = document.getElementById('cassette-title');
const cassetteSideEl  = document.getElementById('cassette-side');
const currentTimeEl   = document.getElementById('sp-current');
const durationEl      = document.getElementById('sp-duration');
const progressFillEl  = document.getElementById('sp-progress');
const progressBarEl   = document.getElementById('sp-progress-bar');
const progressThumbEl = document.getElementById('sp-thumb');
const playBtn         = document.getElementById('sp-play');
const playIcon        = document.getElementById('sp-play-icon');
const pauseIcon       = document.getElementById('sp-pause-icon');
const prevBtn         = document.getElementById('sp-prev');
const nextBtn         = document.getElementById('sp-next');
const shuffleBtn      = document.getElementById('sp-shuffle');
const repeatBtn       = document.getElementById('sp-repeat');
const cassetteEl      = document.getElementById('cassette');
const waveformEl      = document.getElementById('waveform');
const shelfListEl     = document.getElementById('shelf-list');
const shelfEl         = document.getElementById('cassette-shelf');
const cassetteWrapEl  = document.getElementById('cassette-wrap');
const shelfOverlay    = document.getElementById('shelf-overlay');
const sceneBgEl       = document.getElementById('scene-bg');
const sceneBgBEl      = document.getElementById('scene-bg-b');
const sceneOverlayEl  = document.querySelector('.scene-overlay');
const bannerTitleEl   = document.getElementById('banner-title');

// Modal Elements
const addModal        = document.getElementById('add-playlist-modal');
const addBtn          = document.getElementById('add-cassette-btn');
const closeBtn        = document.getElementById('close-modal-btn');
const addForm         = document.getElementById('add-playlist-form');
const submitBtn       = document.getElementById('submit-playlist-btn');
const submitSpinner   = document.getElementById('submit-spinner');
const toastContainer  = document.getElementById('toast-container');

// -----------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------
function showToast(message, type = 'success') {
    if (!toastContainer) return;
    
    const toast = document.createElement('div');
    toast.className = `vintage-toast toast-${type}`;
    
    const icon = type === 'success' ? '✓' : '✗';
    toast.innerHTML = `
        <div class="toast-icon">${icon}</div>
        <div class="toast-message">${message}</div>
    `;
    
    toastContainer.appendChild(toast);
    
    // Trigger animation
    requestAnimationFrame(() => {
        toast.classList.add('show');
    });
    
    // Auto remove after 4 seconds
    setTimeout(() => {
        toast.classList.remove('show');
        toast.classList.add('fade-out');
        setTimeout(() => toast.remove(), 400); // wait for fade out animation
    }, 4000);
}

function fmt(s) {
    if (!s || isNaN(s) || !isFinite(s)) return '0:00';
    const m   = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec < 10 ? '0' : ''}${sec}`;
}

let lastActionTime = 0;
function canAct(delay = 500) {
    const now = Date.now();
    if (now - lastActionTime < delay) return false;
    lastActionTime = now;
    return true;
}

// -----------------------------------------------------------------
// Waveform
// -----------------------------------------------------------------
function generateWaveform() {
    waveformEl.innerHTML = '';
    for (let i = 0; i < 56; i++) {
        const bar = document.createElement('div');
        bar.className = 'wave-bar';
        bar.style.height = '4px';
        waveformEl.appendChild(bar);
    }
    waveBars = Array.from(waveformEl.querySelectorAll('.wave-bar'));
}

function animateWave() {
    if (!isPlaying) return;
    wavePhase += 0.06;
    for (let i = 0; i < waveBars.length; i++) {
        const w1 = Math.sin(wavePhase       + i * 0.35) * 0.5 + 0.5;
        const w2 = Math.sin(wavePhase * 1.3 + i * 0.22) * 0.5 + 0.5;
        const w3 = Math.sin(wavePhase * 0.7 + i * 0.55) * 0.5 + 0.5;
        waveBars[i].style.height = ((w1*0.5 + w2*0.3 + w3*0.2) * 40 + 4) + 'px';
    }
}

// -----------------------------------------------------------------
// Progress loop
// -----------------------------------------------------------------
function updateProgressUI() {
    if (!ytPlayer || !ytReady) return;
    try {
        const current  = ytPlayer.getCurrentTime() || 0;
        const duration = ytPlayer.getDuration()    || 0;
        if (duration > 0) {
            const pct = (current / duration) * 100;
            progressFillEl.style.width = pct + '%';
            progressThumbEl.style.left = pct + '%';
            currentTimeEl.textContent  = fmt(current);
            durationEl.textContent     = fmt(duration);
        }
    } catch (e) {}
    animateWave();
    if (isPlaying) rafId = requestAnimationFrame(updateProgressUI);
}

// -----------------------------------------------------------------
// UI sync
// -----------------------------------------------------------------
function setPlayingState(playing) {
    isPlaying = playing;
    if (playing) {
        playIcon.style.display  = 'none';
        pauseIcon.style.display = 'block';
        cassetteEl.classList.add('playing');
        waveformEl.classList.add('active');
        cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(updateProgressUI);
        consecutiveErrs = 0; // reset error counter on successful play

        // Spin the mini shelf reels too
        const activeCard = shelfListEl.querySelector('.shelf-cassette--active');
        if (activeCard) activeCard.classList.add('playing');
    } else {
        playIcon.style.display  = 'block';
        pauseIcon.style.display = 'none';
        cassetteEl.classList.remove('playing');
        waveformEl.classList.remove('active');
        cancelAnimationFrame(rafId);
        waveBars.forEach(b => (b.style.height = '4px'));

        // Stop shelf reel spin
        shelfListEl.querySelectorAll('.shelf-cassette').forEach(c => c.classList.remove('playing'));
    }
}

function updateNowPlaying() {
    if (!ytPlayer || !ytReady) return;
    try {
        const data   = ytPlayer.getVideoData();
        const title  = data.title  || 'Now Playing';
        const author = data.author || '';

        titleEl.classList.add('fade-out');
        setTimeout(() => {
            titleEl.textContent         = title;
            cassetteTitleEl.textContent = title;
            artistEl.textContent        = author;
            titleEl.classList.remove('fade-out');
            cassetteTitleEl.setAttribute('title', title); // UX U4
        }, 300);
    } catch (e) {}
}

// -----------------------------------------------------------------
// Cassette shelf — apply the active playlist's color to the main cassette
// -----------------------------------------------------------------
function applyPlaylistTheme(index) {
    const pl = PLAYLISTS[index];
    if (!pl) return;

    // Update the main cassette colour
    cassetteEl.style.background = `linear-gradient(160deg, ${lighten(pl.color, 15)} 0%, ${pl.color} 40%, ${darken(pl.color, 15)} 100%)`;
    if (cassetteSideEl) cassetteSideEl.textContent = pl.side;
    if (bannerTitleEl) bannerTitleEl.textContent = pl.name;

    // Update Background Theme (Feature 3)
    const isMobile = window.innerWidth <= 768;
    const bgUrl = isMobile ? pl.bgMobile : pl.bgDesktop;

    if (activeBgLayer === 'a') {
        if (sceneBgBEl) {
            sceneBgBEl.style.backgroundImage = `url('${bgUrl}')`;
            sceneBgBEl.style.filter = pl.bgFilter || '';
            sceneBgBEl.style.opacity = '1';
        }
        if (sceneBgEl) sceneBgEl.style.opacity = '0';
        activeBgLayer = 'b';
    } else {
        if (sceneBgEl) {
            sceneBgEl.style.backgroundImage = `url('${bgUrl}')`;
            sceneBgEl.style.filter = pl.bgFilter || '';
            sceneBgEl.style.opacity = '1';
        }
        if (sceneBgBEl) sceneBgBEl.style.opacity = '0';
        activeBgLayer = 'a';
    }

    if (sceneOverlayEl) {
        sceneOverlayEl.style.background = `
            linear-gradient(180deg,
                rgba(14, 9, 5, 0.6) 0%,
                rgba(14, 9, 5, 0.1) 30%,
                rgba(14, 9, 5, 0.1) 60%,
                rgba(14, 9, 5, 0.75) 100%),
            radial-gradient(ellipse at 50% 40%, ${pl.bgTint || 'rgba(196, 151, 42, 0.05)'} 0%, transparent 70%)`;
    }

    // Update active highlight in the shelf
    const cards = shelfListEl.querySelectorAll('.shelf-cassette');
    cards.forEach((c, i) => {
        c.classList.toggle('shelf-cassette--active', i === index);
        c.classList.remove('playing');
    });
}

// Tiny colour helpers — shift a hex colour's lightness
function hexToRgb(hex) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return [r, g, b];
}
function lighten(hex, pct) {
    if (!hex || !hex.startsWith('#')) return hex;
    try {
        const [r, g, b] = hexToRgb(hex);
        return `rgb(${Math.min(255, r + pct * 2)},${Math.min(255, g + pct * 2)},${Math.min(255, b + pct * 2)})`;
    } catch { return hex; }
}
function darken(hex, pct) {
    if (!hex || !hex.startsWith('#')) return hex;
    try {
        const [r, g, b] = hexToRgb(hex);
        return `rgb(${Math.max(0, r - pct * 2)},${Math.max(0, g - pct * 2)},${Math.max(0, b - pct * 2)})`;
    } catch { return hex; }
}

// -----------------------------------------------------------------
// Playlist switching
// -----------------------------------------------------------------
async function insertCassette(index) {
    if (index === currentPlaylistIndex || isInserting) {
        toggleShelf();
        return;
    }
    isInserting = true;

    toggleShelf();

    // Eject animation & Stop
    cassetteEl.classList.add('cassette--ejecting');
    try { ytPlayer.stopVideo(); } catch (e) {}
    setPlayingState(false);
    
    // Reset progress UI
    progressFillEl.style.width  = '0%';
    progressThumbEl.style.left  = '0%';
    currentTimeEl.textContent   = '0:00';
    durationEl.textContent      = '0:00';

    // Apply visual theme immediately
    applyPlaylistTheme(index);

    const pl = PLAYLISTS[index];
    titleEl.textContent         = `Loading ${pl.name}…`;
    cassetteTitleEl.textContent = pl.name;
    artistEl.textContent        = '';

    // Play tape sound
    cassetteSound.currentTime = 0;
    cassetteSound.play().catch(e => console.log('Audio blocked:', e));

    // Wait for insertion delay
    await new Promise(r => setTimeout(r, 1800));

    // Insert animation
    cassetteEl.classList.remove('cassette--ejecting');
    cassetteEl.classList.add('cassette--inserting');
    setTimeout(() => {
        cassetteEl.classList.remove('cassette--inserting');
        isInserting = false;
    }, 600);

    switchPlaylist(index);
}

function switchPlaylist(index) {
    if (!ytPlayer || !ytReady) return;

    currentPlaylistIndex = index;
    const pl = PLAYLISTS[index];

    // Cue playlist at index 0 first to get its true length in the CUED state
    pendingPlaylistPlay = true;
    try {
        ytPlayer.cuePlaylist({
            list:     pl.id,
            listType: 'playlist',
            index:    0,
        });
    } catch (e) {
        console.error('switchPlaylist error:', e);
    }
}

// -----------------------------------------------------------------
// Controls
// -----------------------------------------------------------------
function togglePlay() {
    if (!canAct()) return;
    if (!ytPlayer || !ytReady) return;
    const state = ytPlayer.getPlayerState();
    if (state === YT.PlayerState.PLAYING) {
        ytPlayer.pauseVideo();
    } else {
        ytPlayer.playVideo();
    }
}

function nextSong() {
    if (!canAct()) return;
    if (!ytPlayer || !ytReady) return;
    ytPlayer.nextVideo();
}

function prevSong() {
    if (!canAct()) return;
    if (!ytPlayer || !ytReady) return;
    const current = ytPlayer.getCurrentTime() || 0;
    if (current > 3) ytPlayer.seekTo(0, true);
    else             ytPlayer.previousVideo();
}

function seekTo(e) {
    if (!ytPlayer || !ytReady) return;
    const rect    = progressBarEl.getBoundingClientRect();
    const clientX = e.clientX !== undefined
        ? e.clientX
        : (e.touches && e.touches[0] ? e.touches[0].clientX : rect.left);
    const x   = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const dur = ytPlayer.getDuration() || 0;
    if (dur > 0) ytPlayer.seekTo((x / rect.width) * dur, true);
}

// -----------------------------------------------------------------
// YouTube IFrame API
// -----------------------------------------------------------------
window.onYouTubeIframeAPIReady = function () {
    const firstId = PLAYLISTS[0].id;
    console.log('YT API ready, playlist:', firstId);
    ytPlayer = new YT.Player('yt-hidden-player', {
        width:  '200',
        height: '200',
        playerVars: {
            listType:       'playlist',
            list:           firstId,
            autoplay:       0,
            controls:       0,
            disablekb:      1,
            fs:             0,
            iv_load_policy: 3,
            modestbranding: 1,
            rel:            0,
            playsinline:    1,
            origin:         window.location.origin,
        },
        events: {
            onReady:       onPlayerReady,
            onStateChange: onPlayerStateChange,
            onError:       onPlayerError,
        }
    });
};

function onPlayerReady() {
    console.log('YT player ready');
    ytReady = true;

    try { ytPlayer.setLoop(repeatMode); } catch (e) {}

    // Apply the initial (first) playlist's theme
    applyPlaylistTheme(0);

    // Pick a random starting index by cueing first
    isInitialLoad = true;
    ytPlayer.cuePlaylist({
        list:     PLAYLISTS[0].id,
        listType: 'playlist',
        index:    0,
    });

    // Mark shuffle button active visually
    if (shuffleBtn) shuffleBtn.classList.add('active');
    // Title/artist will be set by updateNowPlaying() once PLAYING state fires
}

function onPlayerStateChange(event) {
    const s = event.data;
    console.log('YT state:', s);

    if (s === YT.PlayerState.PLAYING) {
        cassetteSound.pause();
        cassetteSound.currentTime = 0;
        
        const label = document.querySelector('.np-label');
        if (label) {
            label.textContent = 'NOW PLAYING';
            label.classList.remove('blinking');
        }

        setPlayingState(true);
        updateNowPlaying();
    } else if (s === YT.PlayerState.PAUSED) {
        setPlayingState(false);
    } else if (s === YT.PlayerState.BUFFERING) {
        const label = document.querySelector('.np-label');
        if (label) {
            label.textContent = 'BUFFERING...';
            label.classList.add('blinking');
        }
    } else if (s === YT.PlayerState.ENDED && !repeatMode) {
        nextSong();
    } else if (s === 5) {
        // CUED state — song is loaded & ready but not playing yet
        if (isInitialLoad || pendingPlaylistPlay) {
            const list = ytPlayer.getPlaylist();
            const len = list ? list.length : 0;
            const randomStart = len > 0 ? Math.floor(Math.random() * len) : 0;

            if (shuffleMode) {
                try { ytPlayer.setShuffle(true); } catch (e) {}
            }

            if (isInitialLoad) {
                isInitialLoad = false;
                ytPlayer.cuePlaylist({
                    list: PLAYLISTS[currentPlaylistIndex].id,
                    listType: 'playlist',
                    index: randomStart
                });
            } else if (pendingPlaylistPlay) {
                pendingPlaylistPlay = false;
                ytPlayer.playVideoAt(randomStart);
            }
        } else {
            updateNowPlaying();
            const gl = document.getElementById('global-loader');
            if (gl) gl.classList.add('hidden');
        }
    }
}

function onPlayerError(event) {
    const msgs = {
        2:   'Bad parameter',
        5:   'HTML5 error',
        100: 'Video not found',
        101: 'Embedding not allowed by video owner',
        150: 'Embedding not allowed by video owner',
    };
    console.warn('YT error', event.data, '—', msgs[event.data] || 'Unknown');

    consecutiveErrs++;
    if (consecutiveErrs >= MAX_ERRS) {
        // Too many errors in a row — stop skipping, show message
        console.error(`${MAX_ERRS} consecutive errors. Some videos in this playlist may not be embeddable.`);
        titleEl.textContent         = 'Some tracks unavailable';
        cassetteTitleEl.textContent = 'Playlist error';
        artistEl.textContent        = 'Try the next song →';
        consecutiveErrs = 0; // reset so user can manually skip
        return;
    }
    // Skip to next with a delay
    setTimeout(nextSong, 2000);
}

// -----------------------------------------------------------------
// Event listeners — controls
// -----------------------------------------------------------------
playBtn.addEventListener('click', togglePlay);
prevBtn.addEventListener('click', prevSong);
nextBtn.addEventListener('click', nextSong);

shuffleBtn.addEventListener('click', () => {
    if (!canAct()) return;
    shuffleMode = !shuffleMode;
    shuffleBtn.classList.toggle('active', shuffleMode);
    try { ytPlayer && ytReady && ytPlayer.setShuffle(shuffleMode); } catch (e) {}
});

repeatBtn.addEventListener('click', () => {
    if (!canAct()) return;
    repeatMode = !repeatMode;
    repeatBtn.classList.toggle('active', repeatMode);
    try { ytPlayer && ytReady && ytPlayer.setLoop(repeatMode); } catch (e) {}
});

progressBarEl.addEventListener('mousedown',  e  => { isDragging = true;  seekTo(e); });
document.addEventListener('mousemove',        e  => { if (isDragging) seekTo(e); });
document.addEventListener('mouseup',          () => { isDragging = false; });
progressBarEl.addEventListener('touchstart',  e  => { isDragging = true;  seekTo(e); }, { passive: true });
document.addEventListener('touchmove',        e  => { if (isDragging) { e.preventDefault(); seekTo(e); } }, { passive: false });
document.addEventListener('touchend',         () => { isDragging = false; });

document.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    switch (e.code) {
        case 'Space':
            e.preventDefault(); togglePlay(); break;
        case 'ArrowRight':
            e.preventDefault();
            if (e.shiftKey) nextSong();
            else if (ytPlayer && ytReady) ytPlayer.seekTo((ytPlayer.getCurrentTime()||0) + 5, true);
            break;
        case 'ArrowLeft':
            e.preventDefault();
            if (e.shiftKey) prevSong();
            else if (ytPlayer && ytReady) ytPlayer.seekTo(Math.max((ytPlayer.getCurrentTime()||0) - 5, 0), true);
            break;
    }
});

// -----------------------------------------------------------------
// Event listeners — cassette shelf clicks
// -----------------------------------------------------------------
function toggleShelf() {
    if (!shelfEl) return;
    const isOpen = shelfEl.classList.contains('open');
    shelfEl.classList.toggle('open', !isOpen);
    if (shelfOverlay) shelfOverlay.classList.toggle('open', !isOpen);
}

if (cassetteWrapEl) cassetteWrapEl.addEventListener('click', toggleShelf);
if (shelfOverlay) shelfOverlay.addEventListener('click', toggleShelf);

if (shelfListEl) {
    shelfListEl.addEventListener('click', e => {
        const card = e.target.closest('.shelf-cassette');
        if (!card) return;
        const index = parseInt(card.dataset.index, 10);
        if (!isNaN(index)) {
            if (!canAct(500)) {
                // UX U9: Cooldown shake
                card.classList.add('cooldown-shake');
                setTimeout(() => card.classList.remove('cooldown-shake'), 400);
                return;
            }
            insertCassette(index);
        }
    });
}

// -----------------------------------------------------------------
// Event Listeners — Add Playlist Modal
// -----------------------------------------------------------------
if (addBtn) {
    addBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // prevent shelf toggle
        addModal.classList.remove('hidden');
        document.getElementById('pl-name').focus();
    });
}

if (closeBtn) {
    closeBtn.addEventListener('click', () => addModal.classList.add('hidden'));
}

if (addModal) {
    addModal.addEventListener('click', (e) => {
        if (e.target === addModal) addModal.classList.add('hidden');
    });
}

if (addForm) {
    addForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const name = document.getElementById('pl-name').value;
        const link = document.getElementById('pl-link').value;
        
        submitBtn.querySelector('span').textContent = 'Creating...';
        submitSpinner.classList.remove('hidden');
        submitBtn.disabled = true;

        try {
            const res = await fetch('/api/playlists', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, link })
            });
            const data = await res.json();
            
            if (res.ok && data.success) {
                showToast('Cassette successfully added! Reloading...', 'success');
                addModal.classList.add('hidden');
                setTimeout(() => window.location.reload(), 1500);
            } else {
                throw new Error(data.error || 'Failed to add playlist');
            }
        } catch (err) {
            showToast(err.message, 'error');
        } finally {
            submitBtn.querySelector('span').textContent = 'Create Cassette';
            submitSpinner.classList.remove('hidden');
            submitBtn.disabled = false;
        }
    });
}

// -----------------------------------------------------------------
// Init
// -----------------------------------------------------------------
function init() {
    generateWaveform();
    const tag   = document.createElement('script');
    tag.src     = 'https://www.youtube.com/iframe_api';
    const first = document.getElementsByTagName('script')[0];
    first.parentNode.insertBefore(tag, first);
}

init();
