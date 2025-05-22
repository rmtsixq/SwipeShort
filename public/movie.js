// TMDB API
const TMDB_API_KEY = 'fda9bed2dd52a349ecb7cfe38b050ca5';

// URL'den film ID'sini al
function getMovieIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('id');
}

// M3U8 URL'lerini al
async function getM3U8Urls(movieId) {
    console.log('=== Frontend: M3U8 URL Fetching Started ===');
    console.log('Movie ID:', movieId);
    
    try {
        console.log('Fetching from endpoint:', `/api/get-m3u8-urls?movieId=${movieId}`);
        const response = await fetch(`/api/get-m3u8-urls?movieId=${movieId}`);
        console.log('Response status:', response.status);
        console.log('Response headers:', Object.fromEntries(response.headers.entries()));
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Error response body:', errorText);
            throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
        }
        
        const data = await response.json();
        console.log('Response data:', data);
        
        if (!data.urls || data.urls.length === 0) {
            console.error('No m3u8 URLs in response data');
            throw new Error('No m3u8 URLs found');
        }
        
        console.log('=== Frontend: M3U8 URL Fetching Completed ===');
        return data.urls;
    } catch (error) {
        console.error('=== Frontend: M3U8 URL Fetching Failed ===');
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

        // M3U8 URL'lerini al
        console.log('Fetching m3u8 URLs...');
        const m3u8Urls = await getM3U8Urls(movieId);
        console.log('M3U8 URLs received:', m3u8Urls);
        
        if (m3u8Urls && m3u8Urls.length > 0) {
            console.log('Setting up video player with first m3u8 URL:', m3u8Urls[0]);
            // Mevcut player'ı kullan
            const playerContainer = document.getElementById('movie-player');
            // M3U8 URL'lerini proxy üzerinden geçir
            const proxiedM3u8Urls = m3u8Urls.map(url => `/proxy/stream?url=${encodeURIComponent(url)}`);
            console.log('Proxied m3u8 URLs:', proxiedM3u8Urls);

            playerContainer.innerHTML = `
                <video id="video-player" class="video-js vjs-default-skin" controls preload="auto" width="100%" height="100%">
                    <source src="${proxiedM3u8Urls[0]}" type="application/x-mpegURL">
                </video>
            `;

            // Video.js player'ı başlat
            console.log('Initializing video.js player...');
            const player = videojs('video-player', {
                fluid: true,
                aspectRatio: '16:9',
                playbackRates: [0.5, 1, 1.5, 2],
                html5: {
                    hls: {
                        overrideNative: true
                    }
                }
            });

            // Hata durumunda diğer URL'leri dene
            player.on('error', (error) => {
                console.error('Video player error:', error);
                // Orijinal URL listesindeki indeksi bul
                const currentOriginalUrlIndex = m3u8Urls.findIndex(url => `/proxy/stream?url=${encodeURIComponent(url)}` === player.currentSrc());
                console.log('Current URL index:', currentOriginalUrlIndex);
                
                if (currentOriginalUrlIndex < m3u8Urls.length - 1) {
                    console.log('Trying next URL:', proxiedM3u8Urls[currentOriginalUrlIndex + 1]);
                    player.src({ src: proxiedM3u8Urls[currentOriginalUrlIndex + 1], type: 'application/x-mpegURL' });
                    player.play();
                } else {
                    console.error('No more URLs to try');
                }
            });

            console.log('Video player setup completed');
        } else {
            throw new Error('No m3u8 URLs found');
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

    // URL'den zaman parametrelerini kontrol et
    const urlParams = new URLSearchParams(window.location.search);
    const startParam = urlParams.get('start');
    const endParam = urlParams.get('end');

    if (videoPlayer && startParam && endParam) {
        videoPlayer.currentTime = parseFloat(startParam);
        videoPlayer.addEventListener('timeupdate', () => {
            if (videoPlayer.currentTime >= parseFloat(endParam)) {
                videoPlayer.pause();
            }
        });
    }
}); 