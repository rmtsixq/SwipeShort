// Firebase initialization requires config file and CDN!
// This file should be called at the bottom of dashboard.html

document.addEventListener('DOMContentLoaded', function() {
    // Check if user is logged in
    firebase.auth().onAuthStateChanged(function(user) {
        if (user) {
            // Show username if available, otherwise show email
            const name = user.displayName || user.email || 'User';
            document.getElementById('dashboard-username').textContent = name;
        } else {
            // Redirect to auth.html if not logged in
            window.location.href = 'auth.html?tab=login';
        }
    });

    // Logout button
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
let currentTab = 'New Releases'; // Default tab
let currentType = 'movie'; // Track current content type (movie or tv)

const tabEndpoints = {
    // Movie tabs
    'New Releases': { type: 'movie', endpoint: 'discover', sort: 'release_date.desc', minVote: 0 },
    'Recommended': { type: 'movie', endpoint: 'discover', sort: 'popularity.desc', minVote: 0 },
    'IMDB 7+ Films': { type: 'movie', endpoint: 'discover', sort: 'vote_average.desc', minVote: 7 },
    'Most Commented': { type: 'movie', endpoint: 'discover', sort: 'vote_count.desc', minVote: 0 },
    'Most Liked': { type: 'movie', endpoint: 'discover', sort: 'vote_average.desc', minVote: 0 },
    
    // TV Show tabs
    'New Episodes': { type: 'tv', endpoint: 'discover', sort: 'first_air_date.desc', minVote: 0 },
    'Popular Shows': { type: 'tv', endpoint: 'discover', sort: 'popularity.desc', minVote: 0 },
    'Top Rated': { type: 'tv', endpoint: 'discover', sort: 'vote_average.desc', minVote: 0 },
    'Trending': { type: 'tv', endpoint: 'trending', timeWindow: 'week', minVote: 0 },
    'On The Air': { type: 'tv', endpoint: 'on_the_air', minVote: 0 }
};

// Filter state
let activeFilters = {
    genre: null,
    year: null,
    rating: null
};

// Update filter button state
function updateFilterButton() {
    const filterBtn = document.querySelector('.filter-btn');
    if (!filterBtn) return;
    
    const hasActiveFilters = Object.values(activeFilters).some(value => value !== null);
    filterBtn.disabled = !hasActiveFilters;
    filterBtn.style.cursor = hasActiveFilters ? 'pointer' : 'not-allowed';
    filterBtn.style.opacity = hasActiveFilters ? '1' : '0.7';
}

// Apply filters to movies
function applyFilters(movies) {
    if (!movies || movies.length === 0) {
        console.log('No movies to filter');
        return [];
    }
    
    console.log('Applying filters to', movies.length, 'movies');
    console.log('Active filters:', activeFilters);

    const filteredMovies = movies.filter(movie => {
        // Genre filter
        if (activeFilters.genre) {
            console.log('Checking genre for movie:', movie.title, 'Genre IDs:', movie.genre_ids);
            if (!movie.genre_ids || !Array.isArray(movie.genre_ids)) {
                console.log('No genre_ids for movie:', movie.title);
                return false;
            }
            // Check if movie has the selected genre
            const hasGenre = movie.genre_ids.includes(activeFilters.genre);
            console.log(`Movie ${movie.title} ${hasGenre ? 'has' : 'does not have'} genre ${activeFilters.genre}`);
            if (!hasGenre) return false;
        }

        // Year filter
        if (activeFilters.year && movie.release_date) {
            const movieYear = movie.release_date.split('-')[0];
            const currentYear = new Date().getFullYear();
            // Only filter if the year is valid (not in future)
            if (parseInt(activeFilters.year) <= currentYear) {
                if (movieYear !== activeFilters.year) {
                    console.log('Movie', movie.title, 'does not match year filter');
                    return false;
                }
            } else {
                console.log('Invalid year filter:', activeFilters.year);
                return false;
            }
        }

        // Rating filter
        if (activeFilters.rating && movie.vote_average) {
            // Only apply rating filter if movie has enough votes
            if (movie.vote_count > 10) { // Minimum 10 votes required
                if (movie.vote_average < activeFilters.rating) {
                    console.log('Movie', movie.title, 'does not match rating filter');
                    return false;
                }
            } else {
                console.log('Movie', movie.title, 'has too few votes');
                return false;
            }
        }

        return true;
    });

    console.log('Filtered movies count:', filteredMovies.length);
    return filteredMovies;
}

// Initialize filter panel
function initializeFilterPanel() {
    const filterBtn = document.querySelector('.filter-btn');
    const genreSelect = document.querySelector('select[name="genre"]');
    const yearSelect = document.querySelector('select[name="year"]');
    const ratingSelect = document.querySelector('select[name="rating"]');

    if (!filterBtn || !genreSelect || !yearSelect || !ratingSelect) return;

    // Update year options to only show past and current year
    const currentYear = new Date().getFullYear();
    yearSelect.innerHTML = '<option value="">All Years</option>';
    for(let year = currentYear; year >= 1950; year--) {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        yearSelect.appendChild(option);
    }

    // Genre select event
    genreSelect.addEventListener('change', function() {
        const genreId = this.value ? parseInt(this.value) : null;
        console.log('Genre selected:', genreId);
        activeFilters.genre = genreId;
        updateFilterButton();
    });

    // Year select event
    yearSelect.addEventListener('change', function() {
        const year = this.value || null;
        console.log('Year selected:', year);
        // Validate year is not in the future
        if (year && parseInt(year) > currentYear) {
            console.log('Invalid year selected:', year);
            this.value = '';
            activeFilters.year = null;
        } else {
            activeFilters.year = year;
        }
        updateFilterButton();
    });

    // Rating select event
    ratingSelect.addEventListener('change', function() {
        const rating = this.value ? parseFloat(this.value) : null;
        console.log('Rating selected:', rating);
        activeFilters.rating = rating;
        updateFilterButton();
    });

    // Filter button click event
    filterBtn.addEventListener('click', function() {
        if (this.disabled) return;
        
        console.log('Applying filters...');
        // Reset to page 1 and fetch movies with filters
        currentPage = 1;
        fetchContent(currentTab, 1);
    });
}

async function fetchContent(tabName = 'New Releases', page = 1) {
    try {
        const tab = tabEndpoints[tabName];
        if (!tab) {
            console.error('Invalid tab name:', tabName);
            return;
        }

        currentType = tab.type;
        let url;

        if (tab.endpoint === 'trending') {
            url = `https://api.themoviedb.org/3/trending/${tab.type}/${tab.timeWindow}?api_key=${TMDB_API_KEY}&language=en-US&page=${page}`;
        } else if (tab.endpoint === 'on_the_air') {
            url = `https://api.themoviedb.org/3/tv/${tab.endpoint}?api_key=${TMDB_API_KEY}&language=en-US&page=${page}`;
        } else {
            // Build discover URL with proper parameters
            url = `https://api.themoviedb.org/3/${tab.endpoint}/${tab.type}?api_key=${TMDB_API_KEY}&language=en-US&page=${page}&sort_by=${tab.sort}`;
            
            // Add vote count filter
            url += '&vote_count.gte=10';
            
            // Add air date filter for TV shows
            if (tab.type === 'tv' && tabName === 'New Episodes') {
                const currentDate = new Date().toISOString().split('T')[0];
                const oneYearAgo = new Date();
                oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
                const oneYearAgoStr = oneYearAgo.toISOString().split('T')[0];
                url += `&first_air_date.gte=${oneYearAgoStr}&first_air_date.lte=${currentDate}`;
            }
            
            // Add release date filter for movies
            if (tab.type === 'movie' && tabName === 'New Releases') {
                const currentDate = new Date().toISOString().split('T')[0];
                const oneYearAgo = new Date();
                oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
                const oneYearAgoStr = oneYearAgo.toISOString().split('T')[0];
                url += `&primary_release_date.gte=${oneYearAgoStr}&primary_release_date.lte=${currentDate}`;
            }

            // Add genre filter if active
            if (activeFilters.genre) {
                url += `&with_genres=${activeFilters.genre}`;
            }

            // Add year filter if active
            if (activeFilters.year) {
                const yearStart = `${activeFilters.year}-01-01`;
                const yearEnd = `${activeFilters.year}-12-31`;
                if (tab.type === 'movie') {
                    url += `&primary_release_date.gte=${yearStart}&primary_release_date.lte=${yearEnd}`;
                } else {
                    url += `&first_air_date.gte=${yearStart}&first_air_date.lte=${yearEnd}`;
                }
            }

            // Add rating filter if active
            if (activeFilters.rating) {
                url += `&vote_average.gte=${activeFilters.rating}`;
            }
        }

        console.log('Fetching content with URL:', url);
        const res = await fetch(url);
        const data = await res.json();

        if (!res.ok) {
            throw new Error(`API error: ${data.status_message || 'Unknown error'}`);
        }

        let items = data.results;
        console.log('Fetched content sample:', items[0]);

        // Store original items
        allMovies = items;
        currentPage = page;
        currentTab = tabName;

        renderGrid(items);
        renderPagination(data.total_pages);
    } catch (error) {
        console.error('Error fetching content:', error);
        const grid = document.getElementById('film-grid');
        grid.innerHTML = `<div class="error-message">Error loading content: ${error.message}</div>`;
    }
}

// Grid render
function renderGrid(items = allMovies) {
    const grid = document.getElementById('film-grid');
    if (!grid) return;

    grid.innerHTML = '';
    
    if (!items || items.length === 0) {
        grid.innerHTML = '<div class="no-movies">No content found matching your filters</div>';
        return;
    }

    items.forEach(item => {
        const card = document.createElement('div');
        card.className = 'film-thumb-card';
        card.setAttribute('data-type', currentType);
        
        const title = currentType === 'movie' ? item.title : item.name;
        const releaseDate = currentType === 'movie' ? item.release_date : item.first_air_date;
        const posterPath = item.poster_path;
        
        card.innerHTML = `
            <div class="film-thumb-img-wrap">
                <img src="https://image.tmdb.org/t/p/w500${posterPath}" alt="${title}" class="film-thumb-img" onerror="this.src='https://via.placeholder.com/500x750?text=No+Poster'" />
                <div class="film-thumb-overlay">
                    <div class="film-thumb-meta">
                        <span>${releaseDate ? releaseDate.split('-')[0] : ''}</span>
                        <span><i class='fas fa-comment'></i> ${item.vote_count || 0}</span>
                        <span><i class='fas fa-star'></i> ${item.vote_average ? item.vote_average.toFixed(1) : '-'}</span>
                    </div>
                    <div class="film-thumb-title">${title}</div>
                    <div class="film-thumb-extra">
                        ${currentType === 'tv' ? `<span class="film-thumb-label">${item.first_air_date ? 'TV Series' : 'Upcoming'}</span>` : ''}
                        <span class="film-thumb-label">${item.original_language === 'en' ? 'English' : 'Dubbed'}</span>
                    </div>
                </div>
            </div>
        `;
        
        card.onclick = () => {
            window.location.href = `${currentType}.html?id=${item.id}`;
        };
        
        grid.appendChild(card);
    });
}

// Pagination render
function renderPagination(totalPages = 1) {
    const pagination = document.getElementById('pagination');
    if (!pagination) return;

    pagination.innerHTML = '';

    // Helper function to create pagination buttons
    const createButton = (label, page, isActive = false, isDisabled = false) => {
        const button = document.createElement('button');
        button.textContent = label;
        if (isActive) button.classList.add('active');
        if (isDisabled) button.disabled = true;
        
        if (!isDisabled) {
            button.onclick = () => {
                if (page !== currentPage) {
                    fetchContent(currentTab, page);
                }
            };
        }
        
        return button;
    };

    // Previous button
    pagination.appendChild(
        createButton('Previous', currentPage - 1, false, currentPage === 1)
    );

    // First page
    if (currentPage > 2) {
        pagination.appendChild(createButton('1', 1));
        if (currentPage > 3) {
            const dots = document.createElement('span');
            dots.textContent = '...';
            dots.className = 'pagination-dots';
            pagination.appendChild(dots);
        }
    }

    // Page numbers around current page
    for (let i = Math.max(1, currentPage - 1); i <= Math.min(totalPages, currentPage + 1); i++) {
        pagination.appendChild(createButton(i.toString(), i, i === currentPage));
    }

    // Last page
    if (currentPage < totalPages - 1) {
        if (currentPage < totalPages - 2) {
            const dots = document.createElement('span');
            dots.textContent = '...';
            dots.className = 'pagination-dots';
            pagination.appendChild(dots);
        }
        pagination.appendChild(createButton(totalPages.toString(), totalPages));
    }

    // Next button
    pagination.appendChild(
        createButton('Next', currentPage + 1, false, currentPage === totalPages)
    );
}

// Update renderGenreButtons function to handle genre selection
async function renderGenreButtons() {
    try {
        const type = currentType;
        const res = await fetch(`https://api.themoviedb.org/3/genre/${type}/list?api_key=${TMDB_API_KEY}&language=en`);
        const data = await res.json();
        const genres = data.genres;
        console.log('Available genres:', genres);
        
        // Update genre select options
        const genreSelect = document.querySelector('select[name="genre"]');
        if (genreSelect) {
            genreSelect.innerHTML = '<option value="">All Genres</option>';
            genres.forEach(genre => {
                const option = document.createElement('option');
                option.value = genre.id;
                option.textContent = genre.name;
                genreSelect.appendChild(option);
            });
        }

        // Update genre buttons
        const container = document.getElementById('genre-buttons');
        if (container) {
            container.innerHTML = '';
            genres.forEach(genre => {
                const btn = document.createElement('button');
                btn.className = 'genre-btn';
                btn.textContent = genre.name;
                btn.onclick = function() {
                    document.querySelectorAll('.genre-btn').forEach(b => b.classList.remove('active'));
                    this.classList.add('active');
                    
                    activeFilters.genre = genre.id;
                    console.log('Genre button clicked:', genre.id, genre.name);
                    updateFilterButton();
                    
                    currentPage = 1;
                    fetchContent(currentTab, 1);
                };
                container.appendChild(btn);
            });
        }
    } catch (error) {
        console.error('Error loading genres:', error);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // Content type selector events
    document.querySelectorAll('.content-type-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const type = this.getAttribute('data-type');
            
            // Update active states
            document.querySelectorAll('.content-type-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            
            // Show/hide relevant tabs
            document.querySelectorAll('.film-tabs-header').forEach(header => {
                header.style.display = header.getAttribute('data-type') === type ? 'flex' : 'none';
            });
            
            // Update current type and reset to first tab
            currentType = type;
            const firstTab = document.querySelector(`.film-tabs-header[data-type="${type}"] .film-tab`);
            if (firstTab) {
                document.querySelectorAll('.film-tab').forEach(t => t.classList.remove('active'));
                firstTab.classList.add('active');
                currentTab = firstTab.textContent.trim();
                currentPage = 1;
                fetchContent(currentTab, 1);
            }
        });
    });

    // Tab click events
    document.querySelectorAll('.film-tab').forEach(tab => {
        tab.addEventListener('click', function() {
            const tabName = this.textContent.trim();
            const type = this.getAttribute('data-type');
            
            // Update active states for tabs of the same type
            document.querySelectorAll(`.film-tab[data-type="${type}"]`).forEach(t => {
                t.classList.remove('active');
            });
            this.classList.add('active');
            
            // Reset to page 1 when changing tabs
            currentPage = 1;
            fetchContent(tabName, 1);
        });
    });

    // Initialize filter panel
    initializeFilterPanel();
    
    // Initial load (Movies tab by default)
    fetchContent('New Releases', 1);
    renderGenreButtons();
    setupMajikTrigger();
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

// Typewriter ve oyun için ses efektleri
const majikTypeSound = new Audio('https://cdn.pixabay.com/audio/2022/07/26/audio_124bfae1b2.mp3'); // kısa tıkırtı
const majikSuccessSound = new Audio('https://cdn.pixabay.com/audio/2022/03/15/audio_115b9b7b7c.mp3'); // başarı
const majikFailSound = new Audio('https://cdn.pixabay.com/audio/2022/03/15/audio_115b9b7b7c.mp3'); // başarısızlık (aynı ses, istersen farklı ekleyebilirsin)

function showMajikModal() {
    const modal = document.getElementById('majik-modal');
    const terminal = document.getElementById('majik-terminal-content');
    const gameRoot = document.getElementById('majik-game-root');
    modal.style.display = 'flex';
    terminal.style.display = 'block';
    gameRoot.style.display = 'none';
    document.body.style.overflow = 'hidden';
    // Terminal intro metni
    const introLines = [
        '>> ACCESSING SECRET NODE...\n',
        '>> M4J1K NODE FOUND.\n',
        '>> Navigate through the firewall to extract the CODE.\n',
        '>> Press ENTER to begin.'
    ];
    terminal.innerHTML = '';
    let line = 0;
    function typeLine() {
        if (line < introLines.length) {
            let i = 0;
            function typeChar() {
                if (i < introLines[line].length) {
                    terminal.innerHTML += introLines[line][i] === '\n' ? '<br>' : introLines[line][i];
                    if (introLines[line][i] !== '\n' && introLines[line][i] !== ' ') {
                        majikTypeSound.currentTime = 0;
                        majikTypeSound.play();
                    }
                    i++;
                    setTimeout(typeChar, 28);
                } else {
                    line++;
                    setTimeout(typeLine, 350);
                }
            }
            typeChar();
        }
    }
    typeLine();
    // Enter ile oyuna geç
    function onEnter(e) {
        if (e.key === 'Enter') {
            document.removeEventListener('keydown', onEnter);
            terminal.style.display = 'none';
            gameRoot.style.display = 'flex';
            startMajikGame();
        }
    }
    document.addEventListener('keydown', onEnter);
}

// Sidebar search'a dinleme
function setupMajikTrigger() {
    const searchInput = document.querySelector('.sidebar-search input');
    if (!searchInput) return;
    searchInput.addEventListener('input', function() {
        if (this.value.trim().toLowerCase() === 'majik') {
            showMajikModal();
            this.value = '';
        }
    });
}

// Dummy majik game (şimdilik placeholder)
function startMajikGame() {
    const root = document.getElementById('majik-game-root');
    root.innerHTML = '';
    // Oyun parametreleri
    const W = root.offsetWidth;
    const H = root.offsetHeight;
    // Canvas
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    root.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    // Oyuncu
    let dot = { x: 30, y: H/2, r: 8, color: '#b6ffb6', vx: 0, vy: 0 };
    let mouse = { x: dot.x, y: dot.y };
    // Engeller (örnek: sabit kutular ve çizgiler)
    const obstacles = [
        {x: 120, y: 0, w: 12, h: 180},
        {x: 120, y: 240, w: 12, h: 80},
        {x: 220, y: 60, w: 12, h: 260},
        {x: 320, y: 0, w: 12, h: 200},
        {x: 420, y: 120, w: 12, h: 200},
        {x: 520, y: 0, w: 12, h: 180},
        {x: 520, y: 240, w: 12, h: 80},
        {x: 620, y: 60, w: 12, h: 260}
    ];
    // Oyun durumu
    let playing = true;
    let accessGranted = false;
    let accessDenied = false;
    // Mouse takibi
    canvas.addEventListener('mousemove', e => {
        const rect = canvas.getBoundingClientRect();
        mouse.x = (e.clientX - rect.left) * (canvas.width / rect.width);
        mouse.y = (e.clientY - rect.top) * (canvas.height / rect.height);
    });
    // Glitch efekti
    function glitch() {
        root.classList.add('majik-glitch');
        setTimeout(() => root.classList.remove('majik-glitch'), 350);
    }
    // Çarpışma kontrolü
    function checkCollision() {
        for (const obs of obstacles) {
            if (dot.x + dot.r > obs.x && dot.x - dot.r < obs.x + obs.w &&
                dot.y + dot.r > obs.y && dot.y - dot.r < obs.y + obs.h) {
                return true;
            }
        }
        return false;
    }
    // Oyun döngüsü
    function loop() {
        ctx.clearRect(0,0,W,H);
        // CRT grid
        ctx.save();
        ctx.globalAlpha = 0.08;
        ctx.strokeStyle = '#b6ffb6';
        for(let y=0; y<H; y+=16) ctx.beginPath(),ctx.moveTo(0,y),ctx.lineTo(W,y),ctx.stroke();
        for(let x=0; x<W; x+=32) ctx.beginPath(),ctx.moveTo(x,0),ctx.lineTo(x,H),ctx.stroke();
        ctx.restore();
        // Engeller
        ctx.fillStyle = '#0f0';
        obstacles.forEach(obs => ctx.fillRect(obs.x, obs.y, obs.w, obs.h));
        // Dot hareketi
        dot.x += (mouse.x - dot.x) * 0.18;
        dot.y += (mouse.y - dot.y) * 0.18;
        // Dot
        ctx.shadowColor = '#b6ffb6';
        ctx.shadowBlur = 16;
        ctx.beginPath();
        ctx.arc(dot.x, dot.y, dot.r, 0, 2*Math.PI);
        ctx.fillStyle = dot.color;
        ctx.fill();
        ctx.shadowBlur = 0;
        // Çarpışma
        if (playing && checkCollision()) {
            playing = false;
            accessDenied = true;
            glitch();
            setTimeout(() => showMajikEnd(false), 600);
        }
        // Kazanma
        if (playing && dot.x + dot.r > W - 10) {
            playing = false;
            accessGranted = true;
            setTimeout(() => showMajikEnd(true), 600);
        }
        if (playing) requestAnimationFrame(loop);
    }
    loop();
    // Son ekran
    function showMajikEnd(success) {
        ctx.clearRect(0,0,W,H);
        if (success) {
            majikSuccessSound.currentTime = 0; majikSuccessSound.play();
            ctx.fillStyle = '#b6ffb6';
            ctx.font = 'bold 2.2rem Fira Mono, Consolas, monospace';
            ctx.textAlign = 'center';
            ctx.fillText('ACCESS GRANTED', W/2, H/2-68);
            ctx.font = '1.2rem Fira Mono, Consolas, monospace';
            ctx.fillText('CODE: 🧙‍♂️MAG1K!', W/2, H/2-28);
            // IP ve konum çek
            fetch('https://ipapi.co/json/')
                .then(res => res.json())
                .then(data => {
                    ctx.font = '1.1rem Fira Mono, Consolas, monospace';
                    ctx.fillStyle = '#b6ffb6';
                    ctx.fillText(`Your IP: ${data.ip}`, W/2, H/2+8);
                    ctx.fillText(`City: ${data.city}`, W/2, H/2+32);
                    ctx.fillText(`Region: ${data.region}`, W/2, H/2+56);
                    ctx.fillText(`Country: ${data.country_name}`, W/2, H/2+80);
                    ctx.fillText(`Postal: ${data.postal}`, W/2, H/2+104);
                });
            showLinuxTerminal();
        } else {
            majikFailSound.currentTime = 0; majikFailSound.play();
            ctx.fillStyle = '#ff6666';
            ctx.font = 'bold 2.2rem Fira Mono, Consolas, monospace';
            ctx.textAlign = 'center';
            ctx.fillText('ACCESS DENIED', W/2, H/2-18);
            ctx.font = '1.2rem Fira Mono, Consolas, monospace';
            ctx.fillStyle = '#b6ffb6';
            ctx.fillText('RETRY? (Press R)', W/2, H/2+28);
        }
    }
    // Retry
    document.addEventListener('keydown', function retryHandler(e) {
        if (!playing && accessDenied && e.key.toLowerCase() === 'r') {
            document.removeEventListener('keydown', retryHandler);
            startMajikGame();
        }
        if (!playing && (accessGranted || accessDenied) && e.key === 'Escape') {
            document.removeEventListener('keydown', retryHandler);
            document.getElementById('majik-modal').style.display = 'none';
            document.body.style.overflow = '';
        }
    });
}
// CRT glitch efekti
const majikGlitchStyle = document.createElement('style');
majikGlitchStyle.innerHTML = `
.majik-glitch {
    animation: majik-glitch-anim 0.15s 2;
}
@keyframes majik-glitch-anim {
    0% { filter: blur(0px) brightness(1.2) contrast(1.2); }
    30% { filter: blur(2px) brightness(1.5) contrast(2) hue-rotate(30deg); }
    60% { filter: blur(0px) brightness(1.1) contrast(1.1); }
    100% { filter: none; }
}`;
document.head.appendChild(majikGlitchStyle);

// MAJIK oyununda başarı sonrası retro terminali aç
function showLinuxTerminal() {
    const linuxModal = document.getElementById('linux-modal');
    const terminalContent = document.getElementById('terminal-content');
    const terminalInput = document.getElementById('terminal-input');
    const terminalForm = document.getElementById('terminal-form');
    const tipBtn = document.getElementById('tip-btn');
    linuxModal.style.display = 'flex';
    terminalContent.innerHTML = '';
    terminalInput.value = '';
    terminalInput.disabled = false;
    terminalInput.focus();
    let crashed = false;
    // Typewriter fonksiyonu
    function typeText(text, cb) {
        let i = 0;
        function typeChar() {
            if (i < text.length) {
                terminalContent.innerHTML += text[i] === '\n' ? '<br>' : text[i];
                if (text[i] !== '\n' && text[i] !== ' ') {
                    majikTypeSound.currentTime = 0;
                    majikTypeSound.play();
                }
                i++;
                setTimeout(typeChar, 22);
            } else if (cb) {
                cb();
            }
        }
        typeChar();
    }
    // Tip tuşu
    tipBtn.onclick = function() {
        if (crashed) return;
        typeText('$ ls C:\n', () => {
            terminalInput.focus();
        });
    };
    // Komut gönderme
    terminalForm.onsubmit = function(e) {
        e.preventDefault();
        if (crashed) return;
        const cmd = terminalInput.value.trim();
        terminalContent.innerHTML += '$ ' + cmd + '<br>';
        terminalInput.value = '';
        if (/python\s+neighborhood\.py/i.test(cmd)) {
            crashTerminal();
        } else if (/^ls\s+C:$/i.test(cmd)) {
            setTimeout(() => {
                typeText('neighborhood.py<br>', () => terminalInput.focus());
            }, 300);
        } else {
            setTimeout(() => {
                typeText('command not found<br>', () => terminalInput.focus());
            }, 300);
        }
    };
    // Çökme efekti
    function crashTerminal() {
        crashed = true;
        majikFailSound.currentTime = 0; majikFailSound.play();
        terminalInput.disabled = true;
        setTimeout(() => {
            terminalContent.innerHTML += '<span style="color:#ff6666;">Access Granted</span><br>';
            document.querySelector('.screen').style.background = '#111';
            document.querySelector('.screen').classList.add('majik-glitch');
        }, 400);
        setTimeout(() => {
            linuxModal.style.display = 'none';
            document.body.style.overflow = '';
        }, 2200);
    }
}

// Search functionality (Part 2A)
document.addEventListener('DOMContentLoaded', function() {
    const searchInput = document.querySelector('.sidebar-search input');
    const searchResults = document.getElementById('searchResults');
    const mainContent = document.getElementById('mainContent');
    const searchResultsGrid = document.getElementById('searchResultsGrid');
    const searchCount = document.getElementById('searchCount');

    let searchTimeout;
    let currentUser = null;
    const MAX_SEARCH_HISTORY = 10;
    let showAdultMovies = false;

    // Title-specific keywords (strict control)
    const titleFilteredKeywords = [
        // Single words
        'rape', 'sex', 'orgasm', 'cum', 'porn', 'xxx', 'adult', 'erotic',
        'nude', 'naked', 'pornographic', 'explicit', 'mature', 'adult content',
        'carpenter\'s shop', 'fuck', 'cock', 'dick', 'pussy', 'ass', 'whore',
        'slut', 'bitch', 'penis', 'vagina', 'anal', 'oral', 'blowjob', 'handjob',
        'masturbation', 'ejaculation', 'sperm', 'semen', 'prostitute', 'hooker',
        'escort', 'stripper', 'striptease', 'lapdance', 'brothel', 'whorehouse',
        'bordello', 'sexuality', 'sexual', 'intercourse', 'coitus', 'copulation',
        'fornication', 'prostitution', 'pornography', 'obscenity', 'lewdness',
        'indecency', 'vulgarity', 'crudeness', 'filth', 'smut', 'dirt', 'squirt',
        // Multi-word phrases and names (exact match)
        'Ultimate DFC Slender',
        "Moms's Friend",
        'Mikako Abe',
        'Leggings Mania',
        "Friend's Mother",

    ];

    // General content filtering keywords (checked in both title and overview)
    const contentFilteredKeywords = [
        'porn', 'xxx', 'adult', 'erotic', 'sex', 'nude', 'naked',
        'pornographic', 'explicit', 'mature', 'adult content', 'rape', "Carpenter's Shop",
        'Ultimate DFC Slender'
        // Add more keywords here if needed
    ];

    // Firebase auth state listener
    firebase.auth().onAuthStateChanged(function(user) {
        currentUser = user;
    });

    // Add adult content filter toggle to search header
    const searchHeader = document.querySelector('.search-header');
    const adultFilterDiv = document.createElement('div');
    adultFilterDiv.className = 'adult-filter';
    adultFilterDiv.innerHTML = `
        <label class="adult-filter-toggle">
            <input type="checkbox" id="adultContentToggle">
            <span class="toggle-slider"></span>
            <span class="toggle-label">Show 18+ Movies</span>
        </label>
    `;
    searchHeader.appendChild(adultFilterDiv);

    // Adult content toggle event listener
    const adultContentToggle = document.getElementById('adultContentToggle');
    adultContentToggle.addEventListener('change', function() {
        showAdultMovies = this.checked;
        // If there's a search term, search again with new filter
        const currentSearch = searchInput.value.trim();
        if (currentSearch) {
            searchMovies(currentSearch);
        }
    });

    // Movie filtering function
    function filterMovies(movies) {
        return movies.filter(movie => {
            const title = movie.title.toLowerCase();
            const overview = (movie.overview || '').toLowerCase();
            
            // Check title-specific keywords (strict control)
            const hasFilteredTitle = titleFilteredKeywords.some(keyword => {
                const keywordLower = keyword.toLowerCase();
                
                // Multi-word check (exact match)
                if (keyword.includes(' ')) {
                    // Check if the title contains this exact phrase
                    return title.includes(keywordLower);
                }
                
                // Single word check (word boundary match)
                const regex = new RegExp(`\\b${keywordLower}\\b`, 'i');
                return regex.test(title);
            });

            // Filter out if title contains filtered keywords
            if (hasFilteredTitle) {
                console.log('Filtered movie:', movie.title, 'due to title match');
                return false;
            }

            // Check content keywords
            const hasFilteredContent = contentFilteredKeywords.some(keyword => {
                const keywordLower = keyword.toLowerCase();
                // Multi-word check
                if (keyword.includes(' ')) {
                    return title.includes(keywordLower) || overview.includes(keywordLower);
                }
                // Single word check
                return title.includes(keywordLower) || overview.includes(keywordLower);
            });

            // Filter out if content contains filtered keywords
            if (hasFilteredContent) {
                console.log('Filtered movie:', movie.title, 'due to content match');
                return false;
            }

            // 18+ content check
            if (!showAdultMovies && movie.adult) {
                console.log('Filtered movie:', movie.title, 'due to adult content');
                return false;
            }

            return true;
        });
    }

    // Search input event listener with debounce
    searchInput.addEventListener('input', function(e) {
        const searchTerm = e.target.value.toLowerCase().trim();
        
        // Clear previous timeout
        if (searchTimeout) {
            clearTimeout(searchTimeout);
        }
        
        if (searchTerm.length > 0) {
            // Show loading state
            searchResults.style.display = 'block';
            mainContent.style.display = 'none';
            searchResultsGrid.innerHTML = '<div class="search-loading">Searching...</div>';
            
            // Debounce search to avoid too many API calls
            searchTimeout = setTimeout(() => {
                searchMovies(searchTerm);
            }, 300);
        } else {
            // Hide search results, show main content
            searchResults.style.display = 'none';
            mainContent.style.display = 'block';
        }
    });

    // Function to search movies using TMDB API
    async function searchMovies(query) {
        try {
            const response = await fetch(
                `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&language=en-US&page=1&include_adult=${showAdultMovies}`
            );
            const data = await response.json();
            
            // Get filtered results
            const filteredResults = filterMovies(data.results);
            
            // Update search count
            searchCount.textContent = filteredResults.length;
            
            // Save search to history if user is logged in
            if (currentUser) {
                saveSearchToHistory(query, filteredResults);
            }
            
            // Display filtered results
            displaySearchResults(filteredResults, query);
        } catch (error) {
            console.error('Error searching movies:', error);
            searchResultsGrid.innerHTML = '<div class="search-error">Error loading movies. Please try again.</div>';
        }
    }

    // Function to display search results
    function displaySearchResults(movies, searchTerm) {
        searchResultsGrid.innerHTML = '';
        
        if (movies.length === 0) {
            let message = `No movies found for "${searchTerm}"`;
            if (!showAdultMovies) {
                message += ' (18+ movies are hidden)';
            }
            
            searchResultsGrid.innerHTML = `
                <div class="search-no-results">
                    <p>${message}</p>
                    ${currentUser ? '<p class="search-suggestions">Try one of your recent searches:</p>' : ''}
                </div>
            `;
            
            // Show search suggestions if user is logged in
            if (currentUser) {
                getSearchSuggestions().then(suggestions => {
                    if (suggestions.length > 0) {
                        const suggestionsDiv = document.createElement('div');
                        suggestionsDiv.className = 'search-suggestions-list';
                        suggestions.forEach(term => {
                            const suggestion = document.createElement('button');
                            suggestion.className = 'search-suggestion-btn';
                            suggestion.textContent = term;
                            suggestion.onclick = () => {
                                searchInput.value = term;
                                searchMovies(term);
                            };
                            suggestionsDiv.appendChild(suggestion);
                        });
                        searchResultsGrid.appendChild(suggestionsDiv);
                    }
                });
            }
            return;
        }
        
        movies.forEach(movie => {
            const movieCard = document.createElement('div');
            movieCard.className = 'search-film-card';
            
            // Get poster path with fallback
            const posterPath = movie.poster_path 
                ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
                : 'https://via.placeholder.com/500x750?text=No+Poster';
            
            movieCard.innerHTML = `
                <img src="${posterPath}" alt="${movie.title}" onerror="this.src='https://via.placeholder.com/500x750?text=No+Poster'">
                <div class="search-film-info">
                    <h3 class="search-film-title">${movie.title}</h3>
                    <div class="search-film-meta">
                        <span class="search-film-year">${movie.release_date ? movie.release_date.split('-')[0] : 'N/A'}</span>
                        <span class="search-film-rating">
                            <i class="fas fa-star"></i>
                            ${movie.vote_average ? movie.vote_average.toFixed(1) : 'N/A'}
                        </span>
                    </div>
                </div>
            `;
            
            // Add click event to movie card
            movieCard.addEventListener('click', () => {
                window.location.href = `movie.html?id=${movie.id}`;
            });
            
            searchResultsGrid.appendChild(movieCard);
        });
    }

    // Function to save search to Firebase
    async function saveSearchToHistory(searchTerm, results) {
        if (!currentUser) return;

        try {
            const searchRef = firebase.firestore().collection('searchHistory').doc(currentUser.uid);
            const searchData = {
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                term: searchTerm,
                resultCount: results.length,
                results: results.slice(0, 5).map(movie => ({
                    id: movie.id,
                    title: movie.title,
                    poster_path: movie.poster_path,
                    release_date: movie.release_date,
                    vote_average: movie.vote_average
                }))
            };

            // Get current history
            const doc = await searchRef.get();
            if (doc.exists) {
                const history = doc.data().history || [];
                // Add new search to beginning of array
                history.unshift(searchData);
                // Keep only last MAX_SEARCH_HISTORY searches
                if (history.length > MAX_SEARCH_HISTORY) {
                    history.pop();
                }
                // Update history
                await searchRef.update({ history });
            } else {
                // Create new history document
                await searchRef.set({ history: [searchData] });
            }
        } catch (error) {
            console.error('Error saving search history:', error);
        }
    }

    // Function to get search suggestions based on history
    async function getSearchSuggestions() {
        if (!currentUser) return [];

        try {
            const searchRef = firebase.firestore().collection('searchHistory').doc(currentUser.uid);
            const doc = await searchRef.get();
            
            if (doc.exists) {
                const history = doc.data().history || [];
                // Get unique search terms from history
                const suggestions = [...new Set(history.map(item => item.term))];
                return suggestions.slice(0, 5); // Return top 5 suggestions
            }
            return [];
        } catch (error) {
            console.error('Error getting search suggestions:', error);
            return [];
        }
    }

    // Clear search when clicking outside
    document.addEventListener('click', function(e) {
        if (!searchInput.contains(e.target) && !searchResults.contains(e.target)) {
            searchInput.value = '';
            searchResults.style.display = 'none';
            mainContent.style.display = 'block';
        }
    });
}); 