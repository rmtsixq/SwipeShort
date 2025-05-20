// TMDB API
const TMDB_API_KEY = 'fda9bed2dd52a349ecb7cfe38b050ca5';
const BOT_API_URL = 'http://localhost:3000/api/m3u8';

// URL'den film ID'sini al
function getMovieIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('id');
}

// M3U8 URL'sini bul
async function findM3U8Url(movieId) {
    try {
        const response = await fetch(`${BOT_API_URL}/${movieId}`);
        const data = await response.json();
        
        if (data.success) {
            // URL'yi proxy üzerinden al
            return `/proxy/stream?url=${encodeURIComponent(data.url)}`;
        } else {
            throw new Error(data.error || 'M3U8 URL bulunamadı');
        }
    } catch (error) {
        console.error('M3U8 URL bulma hatası:', error);
        throw error;
    }
}

// Custom loader for proxying all HLS requests
class ProxyLoader extends Hls.DefaultConfig.loader {
    constructor(config) {
        super(config);
    }
    load(context, config, callbacks) {
        // Only proxy if not already proxied
        if (!context.url.startsWith('/proxy/stream')) {
            context.url = `/proxy/stream?url=${encodeURIComponent(context.url)}`;
        }
        super.load(context, config, callbacks);
    }
}

// Film detaylarını yükle
async function loadMovieDetails() {
    const movieId = getMovieIdFromUrl();
    if (!movieId) {
        window.location.href = 'dashboard.html';
        return;
    }

    try {
        // TMDB'den film bilgilerini al
        const res = await fetch(`https://api.themoviedb.org/3/movie/${movieId}?api_key=${TMDB_API_KEY}`);
        const movie = await res.json();

        // Başlık ve meta bilgileri güncelle
        document.getElementById('movie-title').textContent = movie.title;
        document.getElementById('movie-year').textContent = movie.release_date.split('-')[0];
        document.getElementById('movie-rating').textContent = `⭐ ${movie.vote_average.toFixed(1)}`;
        document.getElementById('movie-description').textContent = movie.overview;

        // M3U8 URL'sini bul
        const m3u8Url = await findM3U8Url(movieId);
        
        // Player'ı güncelle
        const player = document.getElementById('movie-player');
        player.innerHTML = `
            <video 
                id="movie-video-player"
                controls
                style="width: 100%; height: 100%;"
                crossorigin="anonymous"
            >
                <source src="${m3u8Url}" type="application/x-mpegURL">
                Your browser does not support the video tag.
            </video>
        `;

        // HLS.js ile video oynatıcıyı başlat
        if (Hls.isSupported()) {
            Hls.DefaultConfig.loader = ProxyLoader;
            const video = document.getElementById('movie-video-player');
            const hls = new Hls({
                debug: true,
                enableWorker: true,
                lowLatencyMode: true,
                backBufferLength: 90
            });
            hls.on(Hls.Events.ERROR, function(event, data) {
                console.error('HLS Error:', data);
                if (data.fatal) {
                    switch(data.type) {
                        case Hls.ErrorTypes.NETWORK_ERROR:
                            console.log('Network error, trying to recover...');
                            hls.startLoad();
                            break;
                        case Hls.ErrorTypes.MEDIA_ERROR:
                            console.log('Media error, trying to recover...');
                            hls.recoverMediaError();
                            break;
                        default:
                            console.log('Fatal error, cannot recover');
                            hls.destroy();
                            break;
                    }
                }
            });
            hls.loadSource(m3u8Url);
            hls.attachMedia(video);
            hls.on(Hls.Events.MANIFEST_PARSED, function() {
                video.play().catch(function(error) {
                    console.log("Playback failed:", error);
                });
            });
        }
    } catch (error) {
        console.error('Error loading movie details:', error);
        document.getElementById('movie-title').textContent = 'Error loading movie';
        document.getElementById('movie-player').innerHTML = `
            <div class="movie-player-placeholder">
                Error loading video. Please try again later.
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
    const iframe = document.querySelector('iframe');
    const previewVideo = document.querySelector('.modal-video-preview');

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
        // Vidsrc iframe'inden video süresini al
        if (iframe) {
            // Varsayılan süre (2 saat)
            const defaultDuration = 7200;
            startSlider.max = defaultDuration;
            endSlider.max = defaultDuration;
            endSlider.value = defaultDuration;
            updateTimeDisplay();
        }
    }

    function setPreviewVideoSource() {
        // Eğer iframe varsa, preview için aynı kaynağı kullan
        if (iframe) {
            // Vidsrc embed yerine bir poster veya örnek video kullanmak gerekebilir
            // Şimdilik demo için örnek bir video dosyası kullanıyoruz
            // Örn: previewVideo.src = 'clips/sample.mp4';
            // Eğer elinizde film dosyasının doğrudan linki varsa onu kullanabilirsiniz
            // previewVideo.src = iframe.src.replace('embed', 'stream');
            // Şimdilik poster olarak siyah bırakıyoruz
            previewVideo.src = '';
            previewVideo.poster = '';
            previewVideo.load();
        }
    }

    shareButton.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        shareModal.style.display = 'flex';
        updateSliderMax();
        setPreviewVideoSource();
    });

    // Slider hareket ettikçe preview güncelle
    function updatePreviewCurrentTime() {
        if (!previewVideo.src) return;
        previewVideo.currentTime = parseFloat(startSlider.value);
        previewVideo.pause();
    }

    startSlider.addEventListener('input', () => {
        if (parseFloat(startSlider.value) >= parseFloat(endSlider.value)) {
            startSlider.value = endSlider.value;
        }
        updateTimeDisplay();
        updatePreviewCurrentTime();
    });

    endSlider.addEventListener('input', () => {
        if (parseFloat(endSlider.value) <= parseFloat(startSlider.value)) {
            endSlider.value = startSlider.value;
        }
        updateTimeDisplay();
        updatePreviewCurrentTime();
    });

    // Preview video sadece seçili aralıkta oynasın
    previewVideo.addEventListener('timeupdate', () => {
        const start = parseFloat(startSlider.value);
        const end = parseFloat(endSlider.value);
        if (previewVideo.currentTime < start) {
            previewVideo.currentTime = start;
        }
        if (previewVideo.currentTime > end) {
            previewVideo.pause();
            previewVideo.currentTime = start;
        }
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

    if (iframe && startParam && endParam) {
        // Vidsrc iframe'ine mesaj gönder
        const message = {
            type: 'setTimeRange',
            start: parseFloat(startParam),
            end: parseFloat(endParam)
        };
        iframe.contentWindow.postMessage(message, '*');
    }
}); 