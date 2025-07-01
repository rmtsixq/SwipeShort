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

// DOM Elements
const navbar = document.getElementById('navbar');
const heroSection = document.getElementById('hero');
const loadingScreen = document.getElementById('loading');
const movieModal = document.getElementById('movie-modal');
const modalClose = document.getElementById('modal-close');
const searchInput = document.querySelector('.search-input');

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initApp();
});

async function initApp() {
    showLoading();
    
    // Initialize components
    setupNavigation();
    setupSearch();
    setupModal();
    setupScrollEffects();
    
    // Load initial content
    await loadAllContent();
    
    hideLoading();
}

function showLoading() {
    loadingScreen.classList.remove('hidden');
}

function hideLoading() {
    setTimeout(() => {
        loadingScreen.classList.add('hidden');
    }, 500);
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
            
            // Scroll to section or load content based on target
            if (target.startsWith('#')) {
                const section = document.querySelector(target);
                if (section) {
                    section.scrollIntoView({ behavior: 'smooth' });
                }
            }
        });
    });
}

// Search functionality
function setupSearch() {
    let searchTimeout;
    
    searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        const query = e.target.value.trim();
        
        if (query.length > 2) {
            searchTimeout = setTimeout(() => {
                searchMovies(query);
            }, 500);
        }
    });
    
    searchInput.addEventListener('focus', () => {
        searchInput.parentElement.classList.add('focused');
    });
    
    searchInput.addEventListener('blur', () => {
        setTimeout(() => {
            if (!searchInput.value) {
                searchInput.parentElement.classList.remove('focused');
            }
        }, 100);
    });
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
            runtime: 166
        },
        {
            id: 2,
            title: "Oppenheimer",
            overview: "The story of J. Robert Oppenheimer's role in the development of the atomic bomb during World War II.",
            poster_path: "/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg",
            backdrop_path: "/fm6KqXpk3M2HVveHwCrBSSBaO0V.jpg",
            release_date: "2023-07-21",
            vote_average: 8.3,
            runtime: 180
        },
        {
            id: 3,
            title: "Spider-Man: Across the Spider-Verse",
            overview: "After reuniting with Gwen Stacy, Brooklyn's full-time, friendly neighborhood Spider-Man is catapulted across the Multiverse.",
            poster_path: "/8Vt6mWEReuy4Of61Lnj5Xj704m8.jpg",
            backdrop_path: "/nHf61UzkfFno5X1ofIhugCPus2R.jpg",
            release_date: "2023-06-02",
            vote_average: 8.6,
            runtime: 140
        },
        {
            id: 4,
            title: "The Batman",
            overview: "In his second year of fighting crime, Batman uncovers corruption in Gotham City that connects to his own family while facing a serial killer known as the Riddler.",
            poster_path: "/b0PlSFdDwbyK0cf5RxwDpaOJQvQ.jpg",
            backdrop_path: "/ym1dxyOk4jFcSl4Q2zmRrA5BEEN.jpg",
            release_date: "2022-03-04",
            vote_average: 7.8,
            runtime: 176
        },
        {
            id: 5,
            title: "Everything Everywhere All at Once",
            overview: "An aging Chinese immigrant is swept up in an insane adventure, where she alone can save what's important to her by connecting with the lives she could have led in other universes.",
            poster_path: "/w3LxiVYdWWRvEVdn5RYq6jIqkb1.jpg",
            backdrop_path: "/uUiId6cDc2ert2pwib4xFXrpF9a.jpg",
            release_date: "2022-04-08",
            vote_average: 7.8,
            runtime: 139
        },
        {
            id: 6,
            title: "Avatar: The Way of Water",
            overview: "Set more than a decade after the events of the first film, learn the story of the Sully family.",
            poster_path: "/t6HIqrRAclMCA60NsSmeqe9RmNV.jpg",
            backdrop_path: "/s16H6tpK2utvwDtzZ8Qy4qm5Emw.jpg",
            release_date: "2022-12-16",
            vote_average: 7.6,
            runtime: 192
        }
    ];

    // Simulate different endpoints
    if (endpoint.includes('popular')) {
        return { results: demoMovies.slice(0, 6) };
    } else if (endpoint.includes('trending')) {
        return { results: [...demoMovies].reverse().slice(0, 6) };
    } else if (endpoint.includes('top_rated')) {
        return { results: demoMovies.sort((a, b) => b.vote_average - a.vote_average).slice(0, 6) };
    } else if (endpoint.includes('genre/28')) { // Action movies
        return { results: demoMovies.filter(m => [1, 2, 4].includes(m.id)) };
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
        return { results: demoShows };
    }
    
    return { results: demoMovies };
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
            loadActionMovies()
        ]);
    } catch (error) {
        console.error('Error loading content:', error);
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
        openMovieModal(movie);
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
                <button class="action-btn" onclick="openMovieModal(${JSON.stringify(movie).replace(/"/g, '&quot;')})">
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
    
    modal.classList.add('show');
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    const modal = document.getElementById('movie-modal');
    modal.classList.remove('show');
    document.body.style.overflow = 'auto';
}

// Search function
async function searchMovies(query) {
    if (DEMO_API) {
        // Demo search - filter existing demo data
        const allData = await fetchTMDBData('/movie/popular');
        const filtered = allData.results.filter(movie => 
            movie.title.toLowerCase().includes(query.toLowerCase())
        );
        displaySearchResults(filtered);
        return;
    }
    
    try {
        const data = await fetchTMDBData(`/search/movie?query=${encodeURIComponent(query)}`);
        displaySearchResults(data.results);
    } catch (error) {
        console.error('Search error:', error);
    }
}

function displaySearchResults(results) {
    // Create or update search results container
    let searchContainer = document.getElementById('search-results');
    if (!searchContainer) {
        searchContainer = document.createElement('div');
        searchContainer.id = 'search-results';
        searchContainer.className = 'content-section';
        searchContainer.innerHTML = '<h2 class="section-title">Search Results</h2><div class="movie-grid" id="search-grid"></div>';
        document.querySelector('.main-content').insertBefore(searchContainer, document.querySelector('.content-section'));
    }
    
    const grid = document.getElementById('search-grid');
    grid.innerHTML = '';
    
    if (results && results.length > 0) {
        results.forEach(movie => {
            grid.appendChild(createMovieCard(movie));
        });
        searchContainer.style.display = 'block';
    } else {
        searchContainer.style.display = 'none';
    }
}

// Utility functions
function addToWishlist(movieId) {
    // Placeholder for wishlist functionality
    console.log('Added to wishlist:', movieId);
    
    // Show a toast notification
    showToast('Added to your list!');
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
window.addToWishlist = addToWishlist; 