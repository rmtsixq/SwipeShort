// TMDB API Configuration
const TMDB_API_KEY = 'YOUR_TMDB_API_KEY'; // You'll need to get this from https://www.themoviedb.org/
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';
const TMDB_BACKDROP_BASE_URL = 'https://image.tmdb.org/t/p/w1280';

// For demo purposes, we'll use a free API that doesn't require a key
// In production, replace with actual TMDB API calls
const DEMO_API = true;

// Global variables
let currentScrollPositions = {};
let isLoading = false;
let currentUser = null;
let currentPage = 1;
let currentContentType = 'movie';
let currentCategory = 'new';
let currentFilters = {
    genre: '',
    year: '',
    rating: ''
};

// DOM Elements
const navbar = document.getElementById('navbar');
const heroSection = document.getElementById('hero');
const loadingScreen = document.getElementById('loading');
const movieModal = document.getElementById('movie-modal');
const modalClose = document.getElementById('modal-close');
const searchInput = document.querySelector('.search-input');
const searchModal = document.getElementById('searchModal');
const filmGrid = document.getElementById('film-grid');
const pagination = document.getElementById('pagination');

// Robot character variables
let robotContainer;
let robotCharacter;
let robotSpeechBubble;

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initApp();
});

async function initApp() {
    showLoading();
    
    // Initialize Firebase and check auth
    initFirebase();
    
    // Initialize components
    setupNavigation();
    setupSearch();
    setupModal();
    setupScrollEffects();
    setupRobotCharacter();
    setupDashboardFeatures();
    
    // Load initial content
    await loadAllContent();
    
    hideLoading();
}

// Firebase initialization
function initFirebase() {
    if (typeof firebase !== 'undefined') {
        firebase.auth().onAuthStateChanged(function(user) {
            currentUser = user;
            if (user) {
                console.log('User logged in:', user.uid);
                updateUserProfile(user);
            } else {
                console.log('No user logged in');
                // Set default profile
                document.getElementById('userProfileName').textContent = 'Guest';
            }
        });
    }
}

function updateUserProfile(user) {
    const profilePicture = document.getElementById('userProfilePicture');
    const profileName = document.getElementById('userProfileName');
    
    if (profilePicture && profileName) {
        profilePicture.src = user.photoURL || '/default-avatar.png';
        profileName.textContent = user.displayName || user.email.split('@')[0] || 'User';
    }
}

function showLoading() {
    loadingScreen.classList.remove('hidden');
}

function hideLoading() {
    setTimeout(() => {
        loadingScreen.classList.add('hidden');
    }, 500);
}

// Robot Character Setup
function setupRobotCharacter() {
    robotContainer = document.getElementById('robot-container');
    robotCharacter = document.getElementById('robot-character');
    robotSpeechBubble = document.getElementById('robotSpeechBubble');
    
    if (robotContainer && robotCharacter) {
        robotContainer.addEventListener('click', () => {
            robotCharacter.className = 'robot-loading';
            setTimeout(() => {
                robotCharacter.className = 'robot-idle-right';
                showRobotMessage('Hello! I\'m your movie assistant! 🎬');
            }, 1000);
        });
        
        // Random robot animations
        setInterval(() => {
            if (Math.random() < 0.1) { // 10% chance every 5 seconds
                animateRobot();
            }
        }, 5000);
    }
}

function animateRobot() {
    if (!robotCharacter) return;
    
    const animations = ['robot-walk-left', 'robot-walk-right', 'robot-idle-left', 'robot-idle-right'];
    const randomAnimation = animations[Math.floor(Math.random() * animations.length)];
    
    robotCharacter.className = randomAnimation;
    
    setTimeout(() => {
        robotCharacter.className = 'robot-idle-right';
    }, 2000);
}

function showRobotMessage(message) {
    if (robotSpeechBubble) {
        robotSpeechBubble.textContent = message;
        robotSpeechBubble.style.display = 'block';
        
        setTimeout(() => {
            robotSpeechBubble.style.display = 'none';
        }, 3000);
    }
}

// Dashboard Features Setup
function setupDashboardFeatures() {
    // Content type selector
    document.querySelectorAll('.content-type-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.content-type-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            
            currentContentType = e.target.dataset.type;
            switchContentType(currentContentType);
        });
    });
    
    // Film tabs
    document.querySelectorAll('.film-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            const tabsContainer = e.target.closest('.film-tabs-header');
            tabsContainer.querySelectorAll('.film-tab').forEach(t => t.classList.remove('active'));
            e.target.classList.add('active');
            
            currentCategory = e.target.dataset.category;
            loadMainGrid();
        });
    });
    
    // Filter functionality
    const filterToggle = document.getElementById('filterToggle');
    const applyFiltersBtn = document.getElementById('applyFilters');
    
    if (filterToggle) {
        filterToggle.addEventListener('click', () => {
            const filterContent = document.querySelector('.filter-content');
            filterContent.style.display = filterContent.style.display === 'none' ? 'grid' : 'none';
        });
    }
    
    if (applyFiltersBtn) {
        applyFiltersBtn.addEventListener('click', applyFilters);
    }
    
    // Load genres
    loadGenres();
    loadYears();
}

function switchContentType(type) {
    // Hide all film tabs
    document.querySelectorAll('.film-tabs-header').forEach(header => {
        header.style.display = 'none';
    });
    
    // Show the correct tabs
    const targetHeader = document.querySelector(`.film-tabs-header[data-type="${type}"]`);
    if (targetHeader) {
        targetHeader.style.display = 'flex';
        // Activate first tab
        const firstTab = targetHeader.querySelector('.film-tab');
        if (firstTab) {
            targetHeader.querySelectorAll('.film-tab').forEach(t => t.classList.remove('active'));
            firstTab.classList.add('active');
            currentCategory = firstTab.dataset.category;
        }
    }
    
    // Update main grid title and reload
    const mainGridTitle = document.getElementById('mainGridTitle');
    if (mainGridTitle) {
        mainGridTitle.textContent = type === 'movie' ? 'Movies' : 'TV Shows';
    }
    
    loadMainGrid();
}

function applyFilters() {
    currentFilters = {
        genre: document.getElementById('genreSelect').value,
        year: document.getElementById('yearSelect').value,
        rating: document.getElementById('ratingSelect').value
    };
    
    currentPage = 1;
    loadMainGrid();
    
    showRobotMessage('Filters applied! 🎯');
}

function loadGenres() {
    const genreSelect = document.getElementById('genreSelect');
    if (!genreSelect) return;
    
    const movieGenres = [
        { id: 28, name: 'Action' },
        { id: 12, name: 'Adventure' },
        { id: 16, name: 'Animation' },
        { id: 35, name: 'Comedy' },
        { id: 80, name: 'Crime' },
        { id: 99, name: 'Documentary' },
        { id: 18, name: 'Drama' },
        { id: 10751, name: 'Family' },
        { id: 14, name: 'Fantasy' },
        { id: 36, name: 'History' },
        { id: 27, name: 'Horror' },
        { id: 10402, name: 'Music' },
        { id: 9648, name: 'Mystery' },
        { id: 10749, name: 'Romance' },
        { id: 878, name: 'Science Fiction' },
        { id: 10770, name: 'TV Movie' },
        { id: 53, name: 'Thriller' },
        { id: 10752, name: 'War' },
        { id: 37, name: 'Western' }
    ];
    
    movieGenres.forEach(genre => {
        const option = document.createElement('option');
        option.value = genre.id;
        option.textContent = genre.name;
        genreSelect.appendChild(option);
    });
}

function loadYears() {
    const yearSelect = document.getElementById('yearSelect');
    if (!yearSelect) return;
    
    const currentYear = new Date().getFullYear();
    for (let year = currentYear; year >= 1950; year--) {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        yearSelect.appendChild(option);
    }
}

// Navigation functionality
function setupNavigation() {
    // Navbar scroll effect
    window.addEventListener('scroll', () => {
        if (window.scrollY > 100) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    });

    // Navigation links
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const target = link.getAttribute('href');
            
            // Remove active class from all links
            document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
            // Add active class to clicked link
            link.classList.add('active');
            
            // Handle different navigation targets
            if (target.startsWith('#')) {
                const section = document.querySelector(target);
                if (section) {
                    section.scrollIntoView({ behavior: 'smooth' });
                }
            } else if (target.endsWith('.html')) {
                window.location.href = target;
            }
        });
    });
}

// Enhanced Search functionality
function setupSearch() {
    let searchTimeout;
    const searchIcon = document.getElementById('searchIcon');
    const mainSearchInput = document.getElementById('mainSearchInput');
    const modalSearchInput = document.getElementById('modalSearchInput');
    const searchModalClose = document.getElementById('searchModalClose');
    
    // Main search input
    if (mainSearchInput) {
        mainSearchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            const query = e.target.value.trim();
            
            if (query.length > 0) {
                showSearchModal();
                if (query.length > 2) {
                    searchTimeout = setTimeout(() => {
                        searchContent(query);
                    }, 500);
                }
            } else {
                hideSearchModal();
            }
        });
        
        mainSearchInput.addEventListener('focus', () => {
            if (mainSearchInput.value.trim()) {
                showSearchModal();
            }
        });
    }
    
    // Modal search input
    if (modalSearchInput) {
        modalSearchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            const query = e.target.value.trim();
            
            if (query.length > 2) {
                searchTimeout = setTimeout(() => {
                    searchContent(query);
                }, 500);
            }
        });
    }
    
    // Search icon click
    if (searchIcon) {
        searchIcon.addEventListener('click', () => {
            showSearchModal();
            modalSearchInput.focus();
        });
    }
    
    // Close search modal
    if (searchModalClose) {
        searchModalClose.addEventListener('click', hideSearchModal);
    }
    
    // Close on escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && searchModal.classList.contains('show')) {
            hideSearchModal();
        }
    });
    
    // Close on outside click
    if (searchModal) {
        searchModal.addEventListener('click', (e) => {
            if (e.target === searchModal) {
                hideSearchModal();
            }
        });
    }
    
    // Handle special searches (like MAJIK)
    if (mainSearchInput) {
        mainSearchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const query = e.target.value.trim().toUpperCase();
                if (query === 'MAJIK') {
                    showMajikModal();
                    e.target.value = '';
                    hideSearchModal();
                }
            }
        });
    }
}

function showSearchModal() {
    if (searchModal) {
        searchModal.classList.add('show');
        document.body.style.overflow = 'hidden';
    }
}

function hideSearchModal() {
    if (searchModal) {
        searchModal.classList.remove('show');
        document.body.style.overflow = 'auto';
        
        // Clear search inputs
        const inputs = document.querySelectorAll('#mainSearchInput, #modalSearchInput');
        inputs.forEach(input => input.value = '');
        
        // Clear search results
        const searchModalGrid = document.getElementById('searchModalGrid');
        if (searchModalGrid) {
            searchModalGrid.innerHTML = '';
        }
    }
}

// Modal functionality
function setupModal() {
    modalClose.addEventListener('click', closeModal);
    
    movieModal.addEventListener('click', (e) => {
        if (e.target === movieModal) {
            closeModal();
        }
    });
    
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && movieModal.classList.contains('show')) {
            closeModal();
        }
    });
}

// Scroll effects
function setupScrollEffects() {
    // Intersection Observer for animations
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, observerOptions);
    
    // Observe all content sections
    document.querySelectorAll('.content-section').forEach(section => {
        section.style.opacity = '0';
        section.style.transform = 'translateY(30px)';
        section.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(section);
    });
}

// TMDB API functions (demo versions)
async function fetchTMDBData(endpoint) {
    if (DEMO_API) {
        return generateDemoData(endpoint);
    }
    
    try {
        const url = `${TMDB_BASE_URL}${endpoint}?api_key=${TMDB_API_KEY}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error('Network response was not ok');
        return await response.json();
    } catch (error) {
        console.error('Error fetching TMDB data:', error);
        return generateDemoData(endpoint);
    }
}

// Generate demo data for demonstration
function generateDemoData(endpoint) {
    const demoMovies = [
        {
            id: 1,
            title: "Dune: Part Two",
            overview: "Follow the mythic journey of Paul Atreides as he unites with Chani and the Fremen while on a path of revenge against the conspirators who destroyed his family.",
            poster_path: "/8b8R8l88Qje9dn9OE8PY05Nxl1X.jpg",
            backdrop_path: "/xOMo8BRK7PfcJv9JCnx7s5hj0PX.jpg",
            release_date: "2024-02-28",
            vote_average: 8.2,
            runtime: 166,
            genre_ids: [28, 12, 878]
        },
        {
            id: 2,
            title: "Oppenheimer",
            overview: "The story of J. Robert Oppenheimer's role in the development of the atomic bomb during World War II.",
            poster_path: "/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg",
            backdrop_path: "/fm6KqXpk3M2HVveHwCrBSSBaO0V.jpg",
            release_date: "2023-07-21",
            vote_average: 8.3,
            runtime: 180,
            genre_ids: [18, 36]
        },
        {
            id: 3,
            title: "Spider-Man: Across the Spider-Verse",
            overview: "After reuniting with Gwen Stacy, Brooklyn's full-time, friendly neighborhood Spider-Man is catapulted across the Multiverse.",
            poster_path: "/8Vt6mWEReuy4Of61Lnj5Xj704m8.jpg",
            backdrop_path: "/nHf61UzkfFno5X1ofIhugCPus2R.jpg",
            release_date: "2023-06-02",
            vote_average: 8.6,
            runtime: 140,
            genre_ids: [16, 28, 12]
        },
        {
            id: 4,
            title: "The Batman",
            overview: "In his second year of fighting crime, Batman uncovers corruption in Gotham City that connects to his own family while facing a serial killer known as the Riddler.",
            poster_path: "/b0PlSFdDwbyK0cf5RxwDpaOJQvQ.jpg",
            backdrop_path: "/ym1dxyOk4jFcSl4Q2zmRrA5BEEN.jpg",
            release_date: "2022-03-04",
            vote_average: 7.8,
            runtime: 176,
            genre_ids: [28, 80, 18]
        },
        {
            id: 5,
            title: "Everything Everywhere All at Once",
            overview: "An aging Chinese immigrant is swept up in an insane adventure, where she alone can save what's important to her by connecting with the lives she could have led in other universes.",
            poster_path: "/w3LxiVYdWWRvEVdn5RYq6jIqkb1.jpg",
            backdrop_path: "/uUiId6cDc2ert2pwib4xFXrpF9a.jpg",
            release_date: "2022-04-08",
            vote_average: 7.8,
            runtime: 139,
            genre_ids: [35, 18, 878]
        },
        {
            id: 6,
            title: "Avatar: The Way of Water",
            overview: "Set more than a decade after the events of the first film, learn the story of the Sully family.",
            poster_path: "/t6HIqrRAclMCA60NsSmeqe9RmNV.jpg",
            backdrop_path: "/s16H6tpK2utvwDtzZ8Qy4qm5Emw.jpg",
            release_date: "2022-12-16",
            vote_average: 7.6,
            runtime: 192,
            genre_ids: [878, 12, 10751]
        },
        {
            id: 7,
            title: "Top Gun: Maverick",
            overview: "After more than thirty years of service as one of the Navy's top aviators, Pete 'Maverick' Mitchell is training graduates for a specialized mission.",
            poster_path: "/62HCnUTziyWcpDaBO2i1DX17ljH.jpg",
            backdrop_path: "/odJ4hx6g6vBt4lBWKFD1tI8WS4x.jpg",
            release_date: "2022-05-27",
            vote_average: 8.2,
            runtime: 130,
            genre_ids: [28, 18]
        },
        {
            id: 8,
            title: "Black Panther: Wakanda Forever",
            overview: "Queen Ramonda, Shuri, M'Baku, Okoye and the Dora Milaje fight to protect their nation from intervening world powers in the wake of King T'Challa's death.",
            poster_path: "/sv1xJUazXeYqALzczSZ3O6nkH75.jpg",
            backdrop_path: "/yYrvN5WFeGYjJnRzhY0QXuo4Isw.jpg",
            release_date: "2022-11-11",
            vote_average: 7.3,
            runtime: 161,
            genre_ids: [28, 12, 18]
        }
    ];

    // Simulate different endpoints with filtering
    let results = [...demoMovies];
    
    // Apply filters
    if (currentFilters.genre && endpoint.includes('discover')) {
        results = results.filter(movie => 
            movie.genre_ids && movie.genre_ids.includes(parseInt(currentFilters.genre))
        );
    }
    
    if (currentFilters.year) {
        results = results.filter(movie => 
            movie.release_date && movie.release_date.startsWith(currentFilters.year)
        );
    }
    
    if (currentFilters.rating) {
        const minRating = parseFloat(currentFilters.rating);
        results = results.filter(movie => movie.vote_average >= minRating);
    }
    
    // Sort based on category
    if (currentCategory === 'imdb' || currentCategory === 'top') {
        results.sort((a, b) => b.vote_average - a.vote_average);
    } else if (currentCategory === 'new') {
        results.sort((a, b) => new Date(b.release_date) - new Date(a.release_date));
    }
    
    // Simulate different endpoints
    if (endpoint.includes('popular')) {
        return { results: results.slice(0, 6), total_pages: 100, page: currentPage };
    } else if (endpoint.includes('trending')) {
        return { results: [...results].reverse().slice(0, 6), total_pages: 50, page: currentPage };
    } else if (endpoint.includes('top_rated')) {
        return { results: results.sort((a, b) => b.vote_average - a.vote_average).slice(0, 6), total_pages: 75, page: currentPage };
    } else if (endpoint.includes('genre/28')) { // Action movies
        return { results: results.filter(m => m.genre_ids.includes(28)), total_pages: 30, page: currentPage };
    } else if (endpoint.includes('tv/popular')) {
        // Demo TV shows
        const demoShows = [
            {
                id: 101,
                name: "House of the Dragon",
                overview: "The Targaryen dynasty is at the absolute apex of its power, with more than 10 dragons under their yoke.",
                poster_path: "/z2yahl2uefxDCl0nogcRBstwruJ.jpg",
                backdrop_path: "/etj8E2o0Bud0HkONVQPjyCkIvesi.jpg",
                first_air_date: "2022-08-21",
                vote_average: 8.4
            },
            {
                id: 102,
                name: "The Last of Us",
                overview: "Twenty years after modern civilization has been destroyed, Joel and Ellie must survive in a world where deadly infected roam.",
                poster_path: "/uKvVjHNqB5VmOrdxqAt2F7J78ED.jpg",
                backdrop_path: "/uDgy6hyPd82kOHh6I95FLtLnj6p.jpg",
                first_air_date: "2023-01-15",
                vote_average: 8.7
            },
            {
                id: 103,
                name: "Wednesday",
                overview: "A sleuthing, supernaturally infused mystery charting Wednesday Addams' years as a student at Nevermore Academy.",
                poster_path: "/9PFonBhy4cQy7Jz20NpMygczOkv.jpg",
                backdrop_path: "/iHSwvRVsRyxpX7FE7GbviaDvgGZ.jpg",
                first_air_date: "2022-11-23",
                vote_average: 8.5
            }
        ];
        return { results: demoShows, total_pages: 20, page: currentPage };
    } else if (endpoint.includes('search')) {
        // Search functionality
        return { results: results.slice(0, 10), total_pages: 10, page: 1 };
    }
    
    // Main grid data with pagination
    const itemsPerPage = 20;
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const totalPages = Math.ceil(results.length / itemsPerPage);
    
    return { 
        results: results.slice(startIndex, endIndex), 
        total_pages: totalPages, 
        page: currentPage,
        total_results: results.length
    };
}

// Content loading functions
async function loadAllContent() {
    try {
        await Promise.all([
            loadHeroContent(),
            loadFeaturedContent(),
            loadPopularMovies(),
            loadTrendingContent(),
            loadTopRatedContent(),
            loadPopularTVShows(),
            loadActionMovies(),
            loadMainGrid()
        ]);
    } catch (error) {
        console.error('Error loading content:', error);
    }
}

async function loadMainGrid() {
    const endpoint = currentContentType === 'movie' 
        ? `/discover/movie?page=${currentPage}` 
        : `/discover/tv?page=${currentPage}`;
    
    const data = await fetchTMDBData(endpoint);
    displayMainGrid(data);
    setupPagination(data);
}

function displayMainGrid(data) {
    if (!filmGrid || !data.results) return;
    
    filmGrid.innerHTML = '';
    
    data.results.forEach(item => {
        const card = createMovieCard(item);
        filmGrid.appendChild(card);
    });
    
    // Animate cards in
    filmGrid.querySelectorAll('.movie-card').forEach((card, index) => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(20px)';
        setTimeout(() => {
            card.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
            card.style.opacity = '1';
            card.style.transform = 'translateY(0)';
        }, index * 50);
    });
}

function setupPagination(data) {
    if (!pagination || !data.total_pages) return;
    
    pagination.innerHTML = '';
    
    const totalPages = Math.min(data.total_pages, 500); // Limit to 500 pages
    const currentPageNum = data.page || currentPage;
    
    // Previous button
    if (currentPageNum > 1) {
        const prevBtn = document.createElement('button');
        prevBtn.textContent = 'Previous';
        prevBtn.addEventListener('click', () => {
            currentPage = currentPageNum - 1;
            loadMainGrid();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
        pagination.appendChild(prevBtn);
    }
    
    // Page numbers
    const startPage = Math.max(1, currentPageNum - 2);
    const endPage = Math.min(totalPages, currentPageNum + 2);
    
    for (let i = startPage; i <= endPage; i++) {
        const pageBtn = document.createElement('button');
        pageBtn.textContent = i;
        pageBtn.className = i === currentPageNum ? 'active' : '';
        pageBtn.addEventListener('click', () => {
            currentPage = i;
            loadMainGrid();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
        pagination.appendChild(pageBtn);
    }
    
    // Next button
    if (currentPageNum < totalPages) {
        const nextBtn = document.createElement('button');
        nextBtn.textContent = 'Next';
        nextBtn.addEventListener('click', () => {
            currentPage = currentPageNum + 1;
            loadMainGrid();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
        pagination.appendChild(nextBtn);
    }
}

async function loadHeroContent() {
    const data = await fetchTMDBData('/movie/popular');
    if (data.results && data.results.length > 0) {
        const movie = data.results[0];
        displayHeroMovie(movie);
    }
}

async function loadFeaturedContent() {
    const data = await fetchTMDBData('/trending/movie/day');
    const container = document.getElementById('featured-content');
    if (data.results) {
        container.innerHTML = '';
        data.results.slice(0, 6).forEach(movie => {
            container.appendChild(createMovieCard(movie, true));
        });
    }
}

async function loadPopularMovies() {
    const data = await fetchTMDBData('/movie/popular');
    const container = document.getElementById('popular-movies');
    setupMovieRow(container, data.results, 'popular-movies');
}

async function loadTrendingContent() {
    const data = await fetchTMDBData('/trending/all/week');
    const container = document.getElementById('trending-content');
    setupMovieRow(container, data.results, 'trending');
}

async function loadTopRatedContent() {
    const data = await fetchTMDBData('/movie/top_rated');
    const container = document.getElementById('top-rated-content');
    setupMovieRow(container, data.results, 'top-rated');
}

async function loadPopularTVShows() {
    const data = await fetchTMDBData('/tv/popular');
    const container = document.getElementById('popular-tv');
    setupMovieRow(container, data.results, 'popular-tv');
}

async function loadActionMovies() {
    const data = await fetchTMDBData('/discover/movie?with_genres=28');
    const container = document.getElementById('action-movies');
    setupMovieRow(container, data.results, 'action-movies');
}

// Display functions
function displayHeroMovie(movie) {
    const heroTitle = document.querySelector('.hero-title');
    const heroDescription = document.querySelector('.hero-description');
    const heroBackground = document.querySelector('.hero-background');
    
    heroTitle.textContent = movie.title || movie.name;
    heroDescription.textContent = movie.overview;
    
    if (movie.backdrop_path) {
        heroBackground.style.backgroundImage = `url(${TMDB_BACKDROP_BASE_URL}${movie.backdrop_path})`;
    }
    
    // Add click handlers for hero buttons
    document.querySelector('.btn-primary').addEventListener('click', () => {
        openMovieDetail(movie);
    });
    
    document.querySelector('.btn-secondary').addEventListener('click', () => {
        openMovieModal(movie);
    });
}

function setupMovieRow(container, movies, rowId) {
    if (!movies) return;
    
    container.innerHTML = '';
    movies.forEach(movie => {
        container.appendChild(createMovieCard(movie));
    });
    
    // Setup navigation buttons
    setupRowNavigation(rowId);
}

function createMovieCard(movie, isFeatured = false) {
    const card = document.createElement('div');
    card.className = `movie-card ${isFeatured ? 'featured' : ''}`;
    
    const posterUrl = movie.poster_path 
        ? `${TMDB_IMAGE_BASE_URL}${movie.poster_path}`
        : 'images/no-poster.png';
    
    const title = movie.title || movie.name;
    const releaseDate = movie.release_date || movie.first_air_date;
    const year = releaseDate ? new Date(releaseDate).getFullYear() : 'N/A';
    const rating = movie.vote_average ? movie.vote_average.toFixed(1) : 'N/A';
    
    card.innerHTML = `
        <img src="${posterUrl}" alt="${title}" class="movie-poster" loading="lazy">
        <div class="movie-info">
            <h3 class="movie-title">${title}</h3>
            <div class="movie-meta">
                <span class="movie-year">${year}</span>
                <div class="movie-rating">
                    <i class="fas fa-star"></i>
                    <span>${rating}</span>
                </div>
            </div>
            <p class="movie-overview">${movie.overview}</p>
            <div class="movie-actions">
                <button class="action-btn" onclick="openMovieDetail(${JSON.stringify(movie).replace(/"/g, '&quot;')})">
                    <i class="fas fa-play"></i>
                    Watch
                </button>
                <button class="action-btn secondary" onclick="addToWishlist(${movie.id})">
                    <i class="fas fa-plus"></i>
                    List
                </button>
            </div>
        </div>
    `;
    
    // Add click handler
    card.addEventListener('click', (e) => {
        if (!e.target.closest('.action-btn')) {
            openMovieModal(movie);
        }
    });
    
    return card;
}

// Movie detail navigation
function openMovieDetail(movie) {
    const type = movie.title ? 'movie' : 'tv';
    const id = movie.id;
    window.location.href = `${type}.html?id=${id}`;
}

// Row navigation
function setupRowNavigation(rowId) {
    const container = document.getElementById(rowId);
    const prevBtn = document.getElementById(`${rowId}-prev`);
    const nextBtn = document.getElementById(`${rowId}-next`);
    
    if (!container || !prevBtn || !nextBtn) return;
    
    prevBtn.addEventListener('click', () => {
        container.scrollBy({ left: -400, behavior: 'smooth' });
    });
    
    nextBtn.addEventListener('click', () => {
        container.scrollBy({ left: 400, behavior: 'smooth' });
    });
    
    // Show/hide buttons based on scroll position
    container.addEventListener('scroll', () => {
        const isAtStart = container.scrollLeft <= 0;
        const isAtEnd = container.scrollLeft >= container.scrollWidth - container.clientWidth;
        
        prevBtn.style.opacity = isAtStart ? '0.5' : '1';
        nextBtn.style.opacity = isAtEnd ? '0.5' : '1';
    });
}

// Modal functions
function openMovieModal(movie) {
    const modal = document.getElementById('movie-modal');
    const modalTitle = modal.querySelector('.modal-title');
    const modalYear = modal.querySelector('.modal-year');
    const modalRuntime = modal.querySelector('.modal-runtime');
    const modalRating = modal.querySelector('.modal-rating');
    const modalOverview = modal.querySelector('.modal-overview');
    const modalBackdrop = modal.querySelector('.modal-backdrop');
    
    modalTitle.textContent = movie.title || movie.name;
    modalOverview.textContent = movie.overview;
    
    const releaseDate = movie.release_date || movie.first_air_date;
    const year = releaseDate ? new Date(releaseDate).getFullYear() : 'N/A';
    modalYear.textContent = year;
    
    const runtime = movie.runtime ? `${movie.runtime} min` : '';
    modalRuntime.textContent = runtime;
    
    const rating = movie.vote_average ? `⭐ ${movie.vote_average.toFixed(1)}/10` : '';
    modalRating.textContent = rating;
    
    if (movie.backdrop_path) {
        modalBackdrop.style.backgroundImage = `url(${TMDB_BACKDROP_BASE_URL}${movie.backdrop_path})`;
    }
    
    // Set up modal buttons
    const playBtn = modal.querySelector('.modal-play');
    if (playBtn) {
        playBtn.onclick = () => {
            closeModal();
            openMovieDetail(movie);
        };
    }
    
    modal.classList.add('show');
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    const modal = document.getElementById('movie-modal');
    modal.classList.remove('show');
    document.body.style.overflow = 'auto';
}

// Search function
async function searchContent(query) {
    const searchModalGrid = document.getElementById('searchModalGrid');
    if (!searchModalGrid) return;
    
    searchModalGrid.innerHTML = '<div style="color: #fff; text-align: center; padding: 2rem;">Searching...</div>';
    
    try {
        const data = await fetchTMDBData(`/search/multi?query=${encodeURIComponent(query)}`);
        displaySearchResults(data.results, searchModalGrid);
        
        showRobotMessage(`Found ${data.results.length} results! 🔍`);
    } catch (error) {
        console.error('Search error:', error);
        searchModalGrid.innerHTML = '<div style="color: #ff4d4d; text-align: center; padding: 2rem;">Search failed</div>';
    }
}

function displaySearchResults(results, container) {
    if (!container) return;
    
    container.innerHTML = '';
    
    if (!results || results.length === 0) {
        container.innerHTML = '<div style="color: #b3b3b3; text-align: center; padding: 2rem;">No results found</div>';
        return;
    }
    
    results.forEach(item => {
        const card = createMovieCard(item);
        container.appendChild(card);
    });
}

// Utility functions
function addToWishlist(movieId) {
    // Placeholder for wishlist functionality
    console.log('Added to wishlist:', movieId);
    
    // Show a toast notification
    showToast('Added to your list!');
    showRobotMessage('Added to your watchlist! 📝');
}

function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: #e50914;
        color: white;
        padding: 12px 24px;
        border-radius: 8px;
        z-index: 10000;
        animation: slideIn 0.3s ease;
    `;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Majik Modal Functions (from dashboard)
function showMajikModal() {
    const majikModal = document.getElementById('majik-modal');
    if (majikModal) {
        majikModal.style.display = 'block';
        showRobotMessage('Welcome to MAJIK! 🎮');
    }
}

// CSS for toast animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
`;
document.head.appendChild(style);

// Performance optimizations
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Lazy loading for images
function setupLazyLoading() {
    const imageObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                img.src = img.dataset.src;
                img.classList.remove('lazy');
                observer.unobserve(img);
            }
        });
    });
    
    document.querySelectorAll('img[data-src]').forEach(img => {
        imageObserver.observe(img);
    });
}

// Initialize lazy loading after content is loaded
setTimeout(setupLazyLoading, 1000);

// Export functions for global access
window.openMovieModal = openMovieModal;
window.openMovieDetail = openMovieDetail;
window.addToWishlist = addToWishlist; 