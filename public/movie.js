// TMDB API
const TMDB_API_KEY = 'fda9bed2dd52a349ecb7cfe38b050ca5';

// URL'den film ID'sini al
function getMovieIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('id');
}

// Cloudnestra Embed URL'ini al
async function getCloudnestraEmbedUrl(movieId) {
    console.log('=== Frontend: Cloudnestra Embed URL Fetching Started ===');
    console.log('Movie ID:', movieId);

    try {
        console.log('Fetching from endpoint:', `/api/get-cloudnestra-embed?movieId=${movieId}`);
        const response = await fetch(`/api/get-cloudnestra-embed?movieId=${movieId}`);
        console.log('Response status:', response.status);
        console.log('Response headers:', Object.fromEntries(response.headers.entries()));

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Error response body:', errorText);
            throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
        }

        const data = await response.json();
        console.log('Response data:', data);

        // API'dan gelen yanıta göre embed URL'ini kontrol et
        if (!data.cloudnestraEmbedUrl) {
            console.error('No cloudnestraEmbedUrl in response data');
            throw new Error('No Cloudnestra embed URL found');
        }

        console.log('=== Frontend: Cloudnestra Embed URL Fetching Completed ===');
        return data.cloudnestraEmbedUrl; // Direkt embed URL'i döndür
    } catch (error) {
        console.error('=== Frontend: Cloudnestra Embed URL Fetching Failed ===');
        console.error('Error details:', error);
        console.error('Error stack:', error.stack);
        throw error;
    }
}

// Film detaylarını yükle
async function loadMovieDetails() {
    console.log('=== Frontend: Loading Movie Details Started ===');
    const movieId = getMovieIdFromUrl();
    console.log('Movie ID from URL:', movieId);

    if (!movieId) {
        console.log('No movie ID found in URL, redirecting to dashboard');
        window.location.href = 'dashboard.html';
        return;
    }

    try {
        // TMDB'den film bilgilerini al
        console.log('Fetching movie details from TMDB...');
        const res = await fetch(`https://api.themoviedb.org/3/movie/${movieId}?api_key=${TMDB_API_KEY}&language=en-US`);
        console.log('TMDB response status:', res.status);

        if (!res.ok) {
            throw new Error(`TMDB API error! status: ${res.status}`);
        }

        const data = await res.json();
        console.log('Movie details received:', data);

        // Başlık ve meta bilgileri güncelle
        console.log('Updating UI with movie details...');
        document.getElementById('movie-title').textContent = data.title;
        document.getElementById('movie-title-main').textContent = data.title;
        document.getElementById('movie-year').textContent = data.release_date ? new Date(data.release_date).getFullYear() : '';
        document.getElementById('movie-rating').textContent = data.vote_average ? `⭐ ${data.vote_average.toFixed(1)}` : '';
        document.getElementById('movie-runtime').textContent = data.runtime ? `${data.runtime} min` : '';
        document.getElementById('movie-release').textContent = data.release_date ? `Release: ${data.release_date}` : '';
        const genresDiv = document.getElementById('movie-genres');
        genresDiv.innerHTML = '';
        if (data.genres && data.genres.length > 0) {
            data.genres.forEach(g => {
                const span = document.createElement('span');
                span.className = 'genre-tag';
                span.textContent = g.name;
                genresDiv.appendChild(span);
            });
        }
        document.getElementById('movie-description').textContent = data.overview || '';

        // Set hero background
        if (data.backdrop_path) {
            document.getElementById('movie-hero').style.backgroundImage = `url('https://image.tmdb.org/t/p/original${data.backdrop_path}')`;
        }
        // Poster
        document.getElementById('movie-poster').src = data.poster_path ? `https://image.tmdb.org/t/p/w500${data.poster_path}` : '';
        document.getElementById('movie-poster').alt = data.title + ' Poster';

        // Embed URL (video)
        let embedSrc = null;
        try {
            embedSrc = await getCloudnestraEmbedUrl(movieId);
        } catch (e) {
            embedSrc = null;
        }
        const startBtn = document.getElementById('start-movie-btn');
        if (embedSrc) {
            startBtn.disabled = false;
            startBtn.title = '';
            startBtn.onclick = () => {
                window.open(`watch.html?id=${movieId}`, '_blank');
            };
        } else {
            startBtn.disabled = true;
            startBtn.title = 'Video not available.';
        }
        // Hide player in movie.html
        const playerContainer = document.getElementById('movie-player');
        if (playerContainer) playerContainer.style.display = 'none';

        setupLikeButton(movieId);

        console.log('=== Frontend: Loading Movie Details Completed ===');
    } catch (error) {
        console.error('=== Frontend: Loading Movie Details Failed ===');
        console.error('Error details:', error);
        console.error('Error stack:', error.stack);

        document.getElementById('movie-title').textContent = 'Movie Not Found';
        document.getElementById('movie-title-main').textContent = 'Movie Not Found';
        document.getElementById('movie-description').textContent = 'Could not load movie details.';
        // Hide start button and player
        const startBtn = document.getElementById('start-movie-btn');
        const playerContainer = document.getElementById('movie-player');
        if (startBtn) startBtn.style.display = 'none';
        if (playerContainer) playerContainer.style.display = 'none';
    }
}

// Sayfa yüklendiğinde film detaylarını yükle
document.addEventListener('DOMContentLoaded', loadMovieDetails);

// Share functionality
document.addEventListener('DOMContentLoaded', () => {
    const shareButton = document.querySelector('.share-button');
    const shareModal = document.querySelector('.share-duration-modal');
    const startSlider = document.querySelector('.start-slider');
    const endSlider = document.querySelector('.end-slider');
    const startTime = document.querySelector('.start-time');
    const endTime = document.querySelector('.end-time');
    const confirmBtn = document.querySelector('.share-confirm-btn');
    const cancelBtn = document.querySelector('.share-cancel-btn');
    const videoPlayer = document.querySelector('#video-player');

    function formatTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        seconds = Math.floor(seconds % 60);
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }

    function updateTimeDisplay() {
        startTime.textContent = formatTime(parseFloat(startSlider.value));
        endTime.textContent = formatTime(parseFloat(endSlider.value));
    }

    function updateSliderMax() {
        if (videoPlayer) {
            const duration = videoPlayer.duration || 7200; // Varsayılan 2 saat
            startSlider.max = duration;
            endSlider.max = duration;
            endSlider.value = duration;
            updateTimeDisplay();
        }
    }

    shareButton.addEventListener('click', () => {
        shareModal.style.display = 'flex';
        updateSliderMax();
    });

    startSlider.addEventListener('input', () => {
        if (parseFloat(startSlider.value) >= parseFloat(endSlider.value)) {
            startSlider.value = endSlider.value;
        }
        updateTimeDisplay();
        if (videoPlayer) {
            videoPlayer.currentTime = parseFloat(startSlider.value);
        }
    });

    endSlider.addEventListener('input', () => {
        if (parseFloat(endSlider.value) <= parseFloat(startSlider.value)) {
            endSlider.value = startSlider.value;
        }
        updateTimeDisplay();
    });

    confirmBtn.addEventListener('click', () => {
        const startTime = parseFloat(startSlider.value);
        const endTime = parseFloat(endSlider.value);

        // Create share URL with time parameters
        const currentUrl = new URL(window.location.href);
        currentUrl.searchParams.set('start', startTime);
        currentUrl.searchParams.set('end', endTime);
        const shareUrl = currentUrl.toString();

        // Copy to clipboard
        navigator.clipboard.writeText(shareUrl).then(() => {
            alert('Share link copied to clipboard!');
        }).catch(err => {
            console.error('Failed to copy:', err);
            alert('Failed to copy share link. Please try again.');
        });

        shareModal.style.display = 'none';
    });

    cancelBtn.addEventListener('click', () => {
        shareModal.style.display = 'none';
    });
});

// --- Like Button Firestore Logic ---
function setupLikeButton(movieId) {
    const likeBtn = document.getElementById('like-btn');
    const likeCount = document.getElementById('like-count');
    if (!likeBtn || !likeCount || !movieId) return;
    const db = firebase.firestore();
    firebase.auth().onAuthStateChanged(function(user) {
        if (!user) {
            likeBtn.disabled = true;
            likeBtn.title = 'You must be logged in to like.';
            return;
        }
        likeBtn.disabled = false;
        likeBtn.title = '';
        const likeDoc = db.collection('likes').doc('movie_' + movieId);
        const userLikeDoc = likeDoc.collection('userLikes').doc(user.uid);
        // Toplam like sayısını çek
        likeDoc.collection('userLikes').onSnapshot(snapshot => {
            likeCount.textContent = snapshot.size;
        });
        // Kullanıcı daha önce like'ladı mı?
        userLikeDoc.get().then(doc => {
            if (doc.exists) {
                likeBtn.classList.add('liked');
            } else {
                likeBtn.classList.remove('liked');
            }
        });
        likeBtn.addEventListener('click', async () => {
            const doc = await userLikeDoc.get();
            if (!doc.exists) {
                // Like at
                await userLikeDoc.set({ liked: true, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
                likeBtn.classList.add('liked');
            } else {
                // Like'ı geri al
                await userLikeDoc.delete();
                likeBtn.classList.remove('liked');
            }
        });
    });
}

// Call this after getting movieId in your loadMovieDetails or main init
// setupLikeButton(movieId); 