// TMDB API
const TMDB_API_KEY = 'fda9bed2dd52a349ecb7cfe38b050ca5';

// URL'den film ID'sini al
function getMovieIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('id');
}

// Film detaylarını yükle
async function loadMovieDetails() {
    const movieId = getMovieIdFromUrl();
    if (!movieId) {
        window.location.href = 'dashboard.html';
        return;
    }

    try {
        const res = await fetch(`https://api.themoviedb.org/3/movie/${movieId}?api_key=${TMDB_API_KEY}`);
        const movie = await res.json();

        // Başlık ve meta bilgileri güncelle
        document.getElementById('movie-title').textContent = movie.title;
        document.getElementById('movie-year').textContent = movie.release_date.split('-')[0];
        document.getElementById('movie-rating').textContent = `⭐ ${movie.vote_average.toFixed(1)}`;
        document.getElementById('movie-description').textContent = movie.overview;

        // Player'ı güncelle
        const player = document.getElementById('movie-player');
        player.innerHTML = `
            <iframe 
                src="https://vidsrc.to/embed/movie/${movieId}" 
                width="100%" 
                height="100%" 
                frameborder="0" 
                allowfullscreen
            ></iframe>
        `;
    } catch (error) {
        console.error('Error loading movie details:', error);
        document.getElementById('movie-title').textContent = 'Error loading movie';
    }
}

// Sayfa yüklendiğinde film detaylarını yükle
document.addEventListener('DOMContentLoaded', loadMovieDetails); 