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

// Kategoriler ve ID'leri
const categories = [
    { id: 'popular', name: 'Popular Films' },
    { id: 'top_rated', name: 'Top Rated Films' },
    { id: 'upcoming', name: 'Upcoming Films' },
    { id: 'now_playing', name: 'Now Playing' }
];

// Her kategori için filmleri yükle
async function loadMoviesByCategory() {
    for (const category of categories) {
        try {
            const res = await fetch(`https://api.themoviedb.org/3/movie/${category.id}?api_key=${TMDB_API_KEY}`);
            const data = await res.json();
            
            // Kategori başlığını oluştur
            const sectionTitle = document.createElement('h2');
            sectionTitle.className = 'film-grid-title';
            sectionTitle.textContent = category.name;
            
            // Film grid container'ı oluştur
            const gridContainer = document.createElement('div');
            gridContainer.className = 'film-grid-container';
            
            // Film grid'i oluştur
            const grid = document.createElement('div');
            grid.className = 'film-grid';
            
            // Filmleri ekle
            data.results.forEach(movie => {
                const card = document.createElement('div');
                card.className = 'film-thumb-card';
                
                card.innerHTML = `
                    <img src="https://image.tmdb.org/t/p/w500${movie.poster_path}" alt="${movie.title}">
                    <h3>${movie.title}</h3>
                `;
                
                // Karta tıklama özelliği ekle
                card.onclick = () => {
                    window.location.href = `movie.html?id=${movie.id}`;
                };
                
                grid.appendChild(card);
            });
            
            // Navigasyon butonlarını ekle
            const leftBtn = document.createElement('button');
            leftBtn.className = 'grid-nav-btn grid-nav-left';
            leftBtn.innerHTML = '❮';
            leftBtn.onclick = () => {
                grid.scrollBy({ left: -220, behavior: 'smooth' });
            };
            
            const rightBtn = document.createElement('button');
            rightBtn.className = 'grid-nav-btn grid-nav-right';
            rightBtn.innerHTML = '❯';
            rightBtn.onclick = () => {
                grid.scrollBy({ left: 220, behavior: 'smooth' });
            };
            
            // Elementleri sayfaya ekle
            gridContainer.appendChild(leftBtn);
            gridContainer.appendChild(grid);
            gridContainer.appendChild(rightBtn);
            
            const section = document.createElement('section');
            section.className = 'film-grid-section';
            section.appendChild(sectionTitle);
            section.appendChild(gridContainer);
            
            document.querySelector('.dashboard-main').appendChild(section);
            
        } catch (error) {
            console.error(`Error loading ${category.name}:`, error);
        }
    }
}

// Sayfa yüklendiğinde filmleri yükle
document.addEventListener('DOMContentLoaded', () => {
    loadMoviesByCategory();
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