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
const FILMS_PER_PAGE = 20;
let allMovies = [];
let currentPage = 1;

// Filmleri çek ve kaydet
async function fetchMovies() {
    const res = await fetch(`https://api.themoviedb.org/3/movie/popular?api_key=${TMDB_API_KEY}&page=1`);
    const data = await res.json();
    allMovies = data.results;
    renderGrid();
    renderPagination();
}

// Grid render
function renderGrid() {
    const grid = document.getElementById('film-grid');
    grid.innerHTML = '';
    const start = (currentPage - 1) * FILMS_PER_PAGE;
    const end = start + FILMS_PER_PAGE;
    const movies = allMovies.slice(start, end);
    movies.forEach(movie => {
        const card = document.createElement('div');
        card.className = 'film-thumb-card';
        card.innerHTML = `
            <div class="film-thumb-img-wrap">
                <img src="https://image.tmdb.org/t/p/w500${movie.poster_path}" alt="${movie.title}" class="film-thumb-img" />
                <div class="film-thumb-overlay">
                    <div class="film-thumb-meta">
                        <span>${movie.release_date ? movie.release_date.split('-')[0] : ''}</span>
                        <span><i class='fas fa-comment'></i> 0</span>
                        <span><i class='fas fa-star'></i> ${movie.vote_average ? movie.vote_average.toFixed(1) : '-'}</span>
                    </div>
                    <div class="film-thumb-title">${movie.title}</div>
                    <div class="film-thumb-extra">
                        <span class="film-thumb-label">Dubbed & Subtitled</span>
                    </div>
                </div>
            </div>
        `;
        card.onclick = () => {
            window.location.href = `movie.html?id=${movie.id}`;
        };
        grid.appendChild(card);
    });
}

// Pagination render
function renderPagination() {
    const pagination = document.getElementById('pagination');
    pagination.innerHTML = '';
    const totalPages = Math.ceil(allMovies.length / FILMS_PER_PAGE);
    const createBtn = (label, page, active = false, disabled = false) => {
        const btn = document.createElement('button');
        btn.textContent = label;
        if (active) btn.classList.add('active');
        if (disabled) btn.disabled = true;
        btn.onclick = () => {
            currentPage = page;
            renderGrid();
            renderPagination();
        };
        return btn;
    };
    pagination.appendChild(createBtn('Previous', Math.max(1, currentPage - 1), false, currentPage === 1));
    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || Math.abs(i - currentPage) <= 2) {
            pagination.appendChild(createBtn(i, i, i === currentPage));
        } else if (i === currentPage - 3 || i === currentPage + 3) {
            const dots = document.createElement('span');
            dots.textContent = '...';
            pagination.appendChild(dots);
        }
    }
    pagination.appendChild(createBtn('Next', Math.min(totalPages, currentPage + 1), false, currentPage === totalPages));
    pagination.appendChild(createBtn('Last', totalPages, false, currentPage === totalPages));
}

document.addEventListener('DOMContentLoaded', fetchMovies);

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