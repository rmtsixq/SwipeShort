// TMDB API
const TMDB_API_KEY = 'fda9bed2dd52a349ecb7cfe38b050ca5';

function getTvIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('id');
}

// Load TV show details
async function loadTvDetails() {
    const tvId = getTvIdFromUrl();
    if (!tvId) {
        window.location.href = 'dashboard.html';
        return;
    }
    try {
        // Fetch TV show details
        const res = await fetch(`https://api.themoviedb.org/3/tv/${tvId}?api_key=${TMDB_API_KEY}&language=en-US`);
        if (!res.ok) throw new Error('TMDB API error!');
        const data = await res.json();
        document.getElementById('tv-title').textContent = data.name;
        document.getElementById('tv-year').textContent = data.first_air_date ? new Date(data.first_air_date).getFullYear() : '';
        document.getElementById('tv-rating').textContent = data.vote_average ? `⭐ ${data.vote_average.toFixed(1)}` : '';
        document.getElementById('tv-runtime').textContent = data.episode_run_time && data.episode_run_time.length ? `${data.episode_run_time[0]} min` : '';
        document.getElementById('tv-release').textContent = data.first_air_date ? `First Air: ${data.first_air_date}` : '';
        const genresDiv = document.getElementById('tv-genres');
        genresDiv.innerHTML = '';
        if (data.genres && data.genres.length > 0) {
            data.genres.forEach(g => {
                const span = document.createElement('span');
                span.className = 'genre-tag';
                span.textContent = g.name;
                genresDiv.appendChild(span);
            });
        }
        document.getElementById('tv-description').textContent = data.overview || '';
        if (data.backdrop_path) {
            document.getElementById('tv-hero').style.backgroundImage = `url('https://image.tmdb.org/t/p/original${data.backdrop_path}')`;
        }
        document.getElementById('tv-poster').src = data.poster_path ? `https://image.tmdb.org/t/p/w500${data.poster_path}` : '';
        document.getElementById('tv-poster').alt = data.name + ' Poster';
        // Load seasons
        if (data.seasons && data.seasons.length > 0) {
            populateSeasonSelect(data.seasons);
        }
        setupLikeButton(tvId);
    } catch (error) {
        document.getElementById('tv-title').textContent = 'TV Show Not Found';
        document.getElementById('tv-description').textContent = 'Could not load TV show details.';
        document.getElementById('start-tv-btn').style.display = 'none';
        document.getElementById('tv-player').style.display = 'none';
    }
}

function populateSeasonSelect(seasons) {
    const select = document.getElementById('season-select');
    select.innerHTML = '';
    seasons.forEach(season => {
        if (season.season_number === 0) return; // Skip specials
        const option = document.createElement('option');
        option.value = season.season_number;
        option.textContent = `Season ${season.season_number}`;
        select.appendChild(option);
    });
    if (seasons.length > 0) {
        loadEpisodes(seasons[0].season_number);
    }
    select.addEventListener('change', function() {
        loadEpisodes(parseInt(this.value));
    });
}

async function loadEpisodes(seasonNumber) {
    const tvId = getTvIdFromUrl();
    const episodeListDiv = document.getElementById('episode-list');
    episodeListDiv.innerHTML = '<div class="loading">Loading episodes...</div>';
    try {
        const res = await fetch(`https://api.themoviedb.org/3/tv/${tvId}/season/${seasonNumber}?api_key=${TMDB_API_KEY}&language=en-US`);
        if (!res.ok) throw new Error('Could not load episodes');
        const data = await res.json();
        episodeListDiv.innerHTML = '';
        data.episodes.forEach(ep => {
            // Like count from localStorage
            const likeKey = `tv_like_${tvId}_${ep.season_number}_${ep.episode_number}`;
            let likeCount = parseInt(localStorage.getItem(likeKey) || '0');
            let liked = localStorage.getItem(likeKey + '_liked') === '1';
            const epDiv = document.createElement('div');
            epDiv.className = 'episode-card';
            epDiv.innerHTML = `
                <div class="episode-thumb">
                    <img src="${ep.still_path ? 'https://image.tmdb.org/t/p/w300' + ep.still_path : '/images/no-poster.png'}" alt="${ep.name}" />
                    <div class="episode-code">S${String(ep.season_number).padStart(2, '0')} E${String(ep.episode_number).padStart(2, '0')}</div>
                </div>
                <div class="episode-info">
                    <h3 class="episode-title">${ep.name}</h3>
                    <div class="episode-meta">
                        <span class="episode-number">Episode ${ep.episode_number}</span>
                        <span class="episode-date">${ep.air_date || ''}</span>
                    </div>
                    <div class="episode-like-area">
                        <button class="episode-like-btn${liked ? ' liked' : ''}" title="Like this episode">
                            <span class="like-icon">${liked ? '❤️' : '🤍'}</span>
                        </button>
                        <span class="episode-like-count">${likeCount}</span>
                    </div>
                    <p class="episode-overview">${ep.overview || ''}</p>
                    <button class="episode-watch-btn" onclick="window.open('watch.html?tv=${getTvIdFromUrl()}&season=${ep.season_number}&episode=${ep.episode_number}','_blank')">Watch</button>
                </div>
            `;
            // Like button logic
            const likeBtn = epDiv.querySelector('.episode-like-btn');
            const likeIcon = likeBtn.querySelector('.like-icon');
            const likeCountSpan = epDiv.querySelector('.episode-like-count');
            likeBtn.addEventListener('click', function() {
                if (!likeBtn.classList.contains('liked')) {
                    likeCount++;
                    likeBtn.classList.add('liked');
                    likeIcon.textContent = '❤️';
                    localStorage.setItem(likeKey, likeCount);
                    localStorage.setItem(likeKey + '_liked', '1');
                } else {
                    likeCount = Math.max(0, likeCount - 1);
                    likeBtn.classList.remove('liked');
                    likeIcon.textContent = '🤍';
                    localStorage.setItem(likeKey, likeCount);
                    localStorage.setItem(likeKey + '_liked', '0');
                }
                likeCountSpan.textContent = likeCount;
            });
            episodeListDiv.appendChild(epDiv);
        });
    } catch (error) {
        episodeListDiv.innerHTML = '<div class="error">Could not load episodes.</div>';
    }
}

// --- Like Button Firestore Logic ---
function setupLikeButton(tvId) {
    const likeBtn = document.getElementById('like-btn');
    const likeCount = document.getElementById('like-count');
    if (!likeBtn || !likeCount || !tvId) return;
    const db = firebase.firestore();
    const likeDoc = db.collection('likes').doc('tv_' + tvId);

    // Real-time update
    likeDoc.onSnapshot(doc => {
        const data = doc.data();
        likeCount.textContent = data && data.count ? data.count : 0;
    });

    likeBtn.addEventListener('click', async () => {
        await db.runTransaction(async (transaction) => {
            const docSnap = await transaction.get(likeDoc);
            const current = docSnap.exists && docSnap.data().count ? docSnap.data().count : 0;
            transaction.set(likeDoc, { count: current + 1 }, { merge: true });
        });
        likeBtn.classList.add('liked');
        setTimeout(() => likeBtn.classList.remove('liked'), 500);
    });
}

document.addEventListener('DOMContentLoaded', loadTvDetails); 