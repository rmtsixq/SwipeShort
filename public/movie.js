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
        const res = await fetch(`https://api.themoviedb.org/3/movie/${movieId}?api_key=${TMDB_API_KEY}`);
        console.log('TMDB response status:', res.status);

        if (!res.ok) {
            throw new Error(`TMDB API error! status: ${res.status}`);
        }

        const movie = await res.json();
        console.log('Movie details received:', movie);

        // Başlık ve meta bilgileri güncelle
        console.log('Updating UI with movie details...');
        document.getElementById('movie-title').textContent = movie.title;
        document.getElementById('movie-year').textContent = movie.release_date.split('-')[0];
        document.getElementById('movie-rating').textContent = `⭐ ${movie.vote_average.toFixed(1)}`;
        document.getElementById('movie-description').textContent = movie.overview;

        // Stream URL'ini al (artık m3u8 URL değil, embed URL)
        console.log('Fetching stream URL...');
        const embedSrc = await getCloudnestraEmbedUrl(movieId); // Fonksiyon adını güncelledik ve direkt embed URL alıyoruz
        console.log('Embed URL received:', embedSrc);

        if (embedSrc) {
            const playerContainer = document.getElementById('movie-player');
            // Video.js player yerine iframe kullan
            playerContainer.innerHTML = `
                <iframe src="${embedSrc}" frameborder="0" allowfullscreen="true" webkitallowfullscreen="true" mozallowfullscreen="true" style="width: 100%; height: 100%;"></iframe>
            `;

            console.log('Iframe player setup completed');

             // Share functionality'nin videoPlayer referansını güncelle (iframe kullanıldığı için bu kısım çalışmayabilir)
             // Eğer share süresi seçimi iframe içindeki videoya bağlıysa, bu özellik devre dışı kalabilir veya yeniden uyarlanması gerekebilir.
             // Şimdilik bu kısmı olduğu gibi bırakıyorum ancak dikkatli olunmalı.

        } else {
            throw new Error('No stream URL found');
        }

        console.log('=== Frontend: Loading Movie Details Completed ===');
    } catch (error) {
        console.error('=== Frontend: Loading Movie Details Failed ===');
        console.error('Error details:', error);
        console.error('Error stack:', error.stack);

        document.getElementById('movie-title').textContent = 'Error loading movie';
        document.getElementById('movie-player').innerHTML = `
            <div class="movie-player-placeholder">
                Error loading video. Please try again later.
                <br>
                <small>Error details: ${error.message}</small>
            </div>
        `;
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