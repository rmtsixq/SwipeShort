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
let currentTab = 'popular';

const tabEndpoints = {
    'New Releases': { endpoint: 'now_playing', minVote: 0 },
    'Recommended': { endpoint: 'popular', minVote: 0 },
    'IMDB 7+ Films': { endpoint: 'top_rated', minVote: 7 },
    'Most Commented': { endpoint: 'popular', minVote: 0, sort: 'vote_count.desc' },
    'Most Liked': { endpoint: 'popular', minVote: 0, sort: 'vote_average.desc' }
};

async function fetchMovies(tabName = 'New Releases', page = 1) {
    const tab = tabEndpoints[tabName];
    let url = `https://api.themoviedb.org/3/movie/${tab.endpoint}?api_key=${TMDB_API_KEY}&page=${page}`;
    if (tab.sort) {
        url = `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_API_KEY}&sort_by=${tab.sort}&page=${page}`;
    }
    const res = await fetch(url);
    const data = await res.json();
    let movies = data.results;
    if (tab.minVote > 0) {
        movies = movies.filter(m => m.vote_average >= tab.minVote);
    }
    allMovies = movies;
    renderGrid();
    renderPagination(data.total_pages);
}

// Grid render
function renderGrid() {
    const grid = document.getElementById('film-grid');
    grid.innerHTML = '';
    const start = 0;
    const end = FILMS_PER_PAGE;
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
function renderPagination(totalPages = 5) {
    const pagination = document.getElementById('pagination');
    pagination.innerHTML = '';
    const createBtn = (label, page, active = false, disabled = false) => {
        const btn = document.createElement('button');
        btn.textContent = label;
        if (active) btn.classList.add('active');
        if (disabled) btn.disabled = true;
        btn.onclick = () => {
            currentPage = page;
            fetchMovies(currentTab, currentPage);
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

async function renderGenreButtons() {
    const res = await fetch(`https://api.themoviedb.org/3/genre/movie/list?api_key=${TMDB_API_KEY}&language=en`);
    const data = await res.json();
    const genres = data.genres;
    const container = document.getElementById('genre-buttons');
    container.innerHTML = '';
    genres.forEach(genre => {
        const btn = document.createElement('button');
        btn.className = 'genre-btn';
        btn.textContent = genre.name;
        btn.onclick = function() {
            document.querySelectorAll('.genre-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            // Şimdilik sadece görsel olarak aktif, filtreleme yok
        };
        container.appendChild(btn);
    });
}

document.addEventListener('DOMContentLoaded', () => {
    // Tab click events
    document.querySelectorAll('.film-tab').forEach(tab => {
        tab.addEventListener('click', function() {
            document.querySelectorAll('.film-tab').forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            currentTab = this.textContent.trim();
            currentPage = 1;
            fetchMovies(currentTab, currentPage);
        });
    });
    fetchMovies('New Releases', 1);
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
        'Leggings Mania'
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