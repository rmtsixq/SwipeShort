// TMDB API Configuration
// Get your API key from: https://www.themoviedb.org/settings/api

const TMDB_CONFIG = {
    // Replace 'YOUR_API_KEY_HERE' with your actual TMDB API key
    API_KEY: 'YOUR_API_KEY_HERE',
    
    // Base URLs for TMDB API
    BASE_URL: 'https://api.themoviedb.org/3',
    IMAGE_BASE_URL: 'https://image.tmdb.org/t/p/w500',
    BACKDROP_BASE_URL: 'https://image.tmdb.org/t/p/w1280',
    
    // Demo mode (set to false when you have a real API key)
    DEMO_MODE: true,
    
    // API endpoints
    ENDPOINTS: {
        POPULAR_MOVIES: '/movie/popular',
        TRENDING: '/trending/all/week',
        TOP_RATED: '/movie/top_rated',
        POPULAR_TV: '/tv/popular',
        ACTION_MOVIES: '/discover/movie?with_genres=28',
        SEARCH: '/search/movie'
    }
};

// Export for use in other files
if (typeof window !== 'undefined') {
    window.TMDB_CONFIG = TMDB_CONFIG;
}

// Instructions for setup:
/*
1. Go to https://www.themoviedb.org/
2. Create an account (free)
3. Go to Settings > API
4. Request an API key
5. Replace 'YOUR_API_KEY_HERE' with your actual key
6. Set DEMO_MODE to false
7. Refresh your page!
*/