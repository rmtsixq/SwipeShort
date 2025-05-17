// Firebase'i başlatmak için config dosyasını ve CDN'i eklediğinden emin olmalısın!
// Bu dosya dashboard.html'de en altta çağrılmalı.

document.addEventListener('DOMContentLoaded', function() {
    // Kullanıcı login mi kontrol et
    firebase.auth().onAuthStateChanged(function(user) {
        if (user) {
            // Kullanıcı adı varsa göster, yoksa email göster
            const name = user.displayName || user.email || 'User';
            document.getElementById('dashboard-username').textContent = name;
        } else {
            // Login yoksa auth.html'e yönlendir
            window.location.href = 'auth.html?tab=login';
        }
    });

    // Logout butonu
    const logoutBtn = document.querySelector('.logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function() {
            firebase.auth().signOut().then(function() {
                window.location.href = 'auth.html?tab=login';
            });
        });
    }
});

// TMDB API
const TMDB_API_KEY = 'fda9bed2dd52a349ecb7cfe38b050ca5';

// Popüler filmleri çek
async function loadPopularMovies() {
    try {
        const res = await fetch(`https://api.themoviedb.org/3/movie/popular?api_key=${TMDB_API_KEY}`);
        const data = await res.json();
        console.log('Popular Movies:', data.results.slice(0, 5)); // İlk 5 filmi göster
        return data.results;
    } catch (error) {
        console.error('TMDB API Error:', error);
        return [];
    }
}

// Player'ı güncelle
function updatePlayer(tmdbId) {
    const player = document.getElementById('film-player');
    if (!player) return;
    
    player.innerHTML = `
        <iframe 
            src="https://vidsrc.to/embed/movie/${tmdbId}" 
            width="100%" 
            height="400" 
            frameborder="0" 
            allowfullscreen
        ></iframe>
    `;
}

// Grid'i doldur
async function loadBasicGrid() {
    const grid = document.getElementById('film-grid');
    if (!grid) return;
    
    grid.innerHTML = '<div class="film-thumb-card">Loading...</div>';
    
    const movies = await loadPopularMovies();
    
    grid.innerHTML = ''; // Grid'i temizle
    
    movies.forEach(movie => {
        const card = document.createElement('div');
        card.className = 'film-thumb-card';
        card.innerHTML = `
            <img src="https://image.tmdb.org/t/p/w200${movie.poster_path}" class="film-thumb-img" />
            <div class="film-thumb-title">${movie.title}</div>
            <div class="film-thumb-year">${movie.release_date.split('-')[0]}</div>
        `;
        
        // Karta tıklama özelliği ekle
        card.onclick = () => {
            updatePlayer(movie.id);
            // Aktif kartı vurgula
            document.querySelectorAll('.film-thumb-card').forEach(c => c.classList.remove('active'));
            card.classList.add('active');
        };
        
        grid.appendChild(card);
    });
}

// Grid navigasyon
function initGridNavigation() {
    const grid = document.getElementById('film-grid');
    const leftBtn = document.querySelector('.grid-nav-left');
    const rightBtn = document.querySelector('.grid-nav-right');
    
    if (!grid || !leftBtn || !rightBtn) return;
    
    const cardWidth = 220; // Kart genişliği + gap
    const cardsToScroll = 3;
    
    leftBtn.addEventListener('click', () => {
        grid.scrollBy({
            left: -cardWidth * cardsToScroll,
            behavior: 'smooth'
        });
    });
    
    rightBtn.addEventListener('click', () => {
        grid.scrollBy({
            left: cardWidth * cardsToScroll,
            behavior: 'smooth'
        });
    });
}

// Sayfa yüklenince grid'i ve navigasyonu yükle
window.addEventListener('DOMContentLoaded', () => {
    loadBasicGrid();
    initGridNavigation();
});

// TMDB API Test
const testMovie = "Fast X";

async function testTMDB() {
    try {
        const res = await fetch(`https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(testMovie)}`);
        const data = await res.json();
        console.log('TMDB API Test Result:', data.results[0]); // İlk sonucu göster
    } catch (error) {
        console.error('TMDB API Test Error:', error);
    }
}

// Test fonksiyonunu çağır
testTMDB();

// Vidsrc ID'leri
const vidsrcIds = [
    "dawQCziL2v",
    "E1KyOcIMf9v7XHg",
    "gMvO97yE1cfKIXH",
    "thDz4uPKGSYW",
    "ZSsbx4NtMpOoCh"
];

/* Geçici olarak yorum satırına alındı
// Film gridini doldur
async function loadMovies() {
    const grid = document.getElementById('film-grid');
    if (!grid) return;
    grid.innerHTML = '<div class="film-thumb-card">Loading...</div>';
    try {
        const res = await fetch('http://localhost:3000/api/movies');
        const data = await res.json();
        grid.innerHTML = '';
        data.forEach(movie => {
            const card = document.createElement('div');
            card.className = 'film-thumb-card';
            card.innerHTML = `
                <img src="${movie.poster}" alt="${movie.title}" class="film-thumb-img" />
                <div class="film-thumb-title">${movie.title}</div>
                <div class="film-thumb-year">${movie.year || ''}</div>
            `;
            grid.appendChild(card);
        });
    } catch (e) {
        grid.innerHTML = '<div class="film-thumb-card">Failed to load movies.</div>';
    }
}

// Sayfa yüklenince filmleri yükle
window.addEventListener('DOMContentLoaded', loadMovies);
*/ 