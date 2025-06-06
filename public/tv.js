// TMDB API
const TMDB_API_KEY = 'fda9bed2dd52a349ecb7cfe38b050ca5';

function getTvIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('id');
}

// Load TV show details
async function loadTvDetails() {
    console.log('=== Loading TV Details Started ===');
    const tvId = getTvIdFromUrl();
    console.log('TV ID from URL:', tvId);

    if (!tvId) {
        console.log('No TV ID found, redirecting to dashboard');
        window.location.href = 'dashboard.html';
        return;
    }

    try {
        // Önce TV show mu film mi kontrol et
        console.log('Checking if ID is a TV show...');
        const res = await fetch(`https://api.themoviedb.org/3/tv/${tvId}?api_key=${TMDB_API_KEY}&language=en-US`);
        console.log('TMDB response status:', res.status);

        if (!res.ok) {
            // TV show değilse, film olabilir
            console.log('Not a TV show, checking if it\'s a movie...');
            const movieRes = await fetch(`https://api.themoviedb.org/3/movie/${tvId}?api_key=${TMDB_API_KEY}&language=en-US`);
            
            if (movieRes.ok) {
                // Film ID'si ise, dashboard'a yönlendir
                console.log('ID is a movie, redirecting to dashboard');
                window.location.href = 'dashboard.html';
                return;
            }
            throw new Error('TMDB API error!');
        }

        const data = await res.json();
        console.log('TV details received:', data);

        // Update UI with TV show details
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
        
        // Load seasons if available
        if (data.seasons && data.seasons.length > 0) {
            console.log('Found seasons:', data.seasons);
            populateSeasonSelect(data.seasons);
        } else {
            console.log('No seasons found in data');
        }
        
        setupLikeButton(tvId);
    } catch (error) {
        console.error('Error loading TV details:', error);
        document.getElementById('tv-title').textContent = 'TV Show Not Found';
        document.getElementById('tv-description').textContent = 'Could not load TV show details. Please check your internet connection or try again later.';
        document.getElementById('start-tv-btn').style.display = 'none';
        document.getElementById('tv-player').style.display = 'none';
        
        // Add retry button
        const retryBtn = document.createElement('button');
        retryBtn.textContent = 'Retry';
        retryBtn.className = 'start-movie-btn';
        retryBtn.onclick = () => window.location.reload();
        const infoBlock = document.querySelector('.movie-info-block');
        if (infoBlock) infoBlock.appendChild(retryBtn);
    }
}

function populateSeasonSelect(seasons) {
    const select = document.getElementById('season-select');
    select.innerHTML = '';
    
    // Add "All Episodes" option
    const allOption = document.createElement('option');
    allOption.value = 'all';
    allOption.textContent = 'All Episodes';
    select.appendChild(allOption);
    
    // Add "Special Episodes" option if season 0 exists
    const specialSeason = seasons.find(s => s.season_number === 0);
    if (specialSeason) {
        const specialOption = document.createElement('option');
        specialOption.value = '0';
        specialOption.textContent = 'Special Episodes';
        select.appendChild(specialOption);
    }
    
    // Add regular seasons
    seasons.forEach(season => {
        if (season.season_number === 0) return; // Skip specials as we already added them
        const option = document.createElement('option');
        option.value = season.season_number;
        option.textContent = `Season ${season.season_number}`;
        select.appendChild(option);
    });
    
    if (seasons.length > 0) {
        loadEpisodes('all'); // Start with all episodes
    }
    
    select.addEventListener('change', function() {
        loadEpisodes(this.value);
    });
}

async function loadEpisodes(seasonNumber) {
    const tvId = getTvIdFromUrl();
    const episodeListDiv = document.getElementById('episode-list');
    episodeListDiv.innerHTML = '<div class="loading">Loading episodes...</div>';
    
    try {
        if (seasonNumber === 'all') {
            // Load all seasons
            const allEpisodes = [];
            const seasons = Array.from(document.getElementById('season-select').options)
                .map(opt => parseInt(opt.value))
                .filter(val => !isNaN(val));
            
            for (const season of seasons) {
                const res = await fetch(`https://api.themoviedb.org/3/tv/${tvId}/season/${season}?api_key=${TMDB_API_KEY}&language=en-US`);
                if (!res.ok) continue;
                const data = await res.json();
                allEpisodes.push(...data.episodes);
            }
            
            // Sort episodes by season and episode number
            allEpisodes.sort((a, b) => {
                if (a.season_number !== b.season_number) {
                    return a.season_number - b.season_number;
                }
                return a.episode_number - b.episode_number;
            });
            
            renderEpisodes(allEpisodes, tvId);
        } else {
            // Load specific season
            const res = await fetch(`https://api.themoviedb.org/3/tv/${tvId}/season/${seasonNumber}?api_key=${TMDB_API_KEY}&language=en-US`);
            if (!res.ok) throw new Error('Could not load episodes');
            const data = await res.json();
            renderEpisodes(data.episodes, tvId);
        }
    } catch (error) {
        episodeListDiv.innerHTML = '<div class="error">Could not load episodes.</div>';
    }
}

function renderEpisodes(episodes, tvId) {
    const episodeListDiv = document.getElementById('episode-list');
    episodeListDiv.innerHTML = '';
    
    episodes.forEach(ep => {
        const likeKey = `tv_${tvId}_s${ep.season_number}_e${ep.episode_number}`;
        const db = firebase.firestore();
        const likeDoc = db.collection('likes').doc(likeKey);
        let likeCount = 0;
        let liked = false;
        
        // Firestore'dan like sayısını çek
        likeDoc.get().then(doc => {
            if (doc.exists && doc.data().count) {
                likeCount = doc.data().count;
            }
            updateLikeUI();
        });
        
        // Kullanıcıya özel like durumu
        liked = localStorage.getItem(likeKey + '_liked') === '1';
        
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
                    <span class="episode-number">${ep.season_number === 0 ? 'Special' : 'Season ' + ep.season_number} - Episode ${ep.episode_number}</span>
                    <span class="episode-date">${ep.air_date || ''}</span>
                </div>
                <div class="episode-like-area">
                    <button class="episode-like-btn${liked ? ' liked' : ''}" title="Like this episode">
                        <span class="like-icon">${liked ? '❤️' : '🤍'}</span>
                    </button>
                    <span class="episode-like-count">${likeCount}</span>
                </div>
                <p class="episode-overview">${ep.overview || ''}</p>
                <button class="episode-watch-btn" onclick="window.location.href='watch.html?tv=${tvId}&season=${ep.season_number}&episode=${ep.episode_number}'">Watch</button>
            </div>
        `;
        
        const likeBtn = epDiv.querySelector('.episode-like-btn');
        const likeIcon = likeBtn.querySelector('.like-icon');
        const likeCountSpan = epDiv.querySelector('.episode-like-count');
        
        function updateLikeUI() {
            likeCountSpan.textContent = likeCount;
            likeBtn.classList.toggle('liked', liked);
            likeIcon.textContent = liked ? '❤️' : '🤍';
        }
        
        // Firestore'dan gerçek zamanlı güncelleme
        likeDoc.onSnapshot(doc => {
            if (doc.exists && doc.data().count !== undefined) {
                likeCount = doc.data().count;
                updateLikeUI();
            }
        });
        
        likeBtn.addEventListener('click', async function() {
            if (!liked) {
                await db.runTransaction(async (transaction) => {
                    const docSnap = await transaction.get(likeDoc);
                    const current = docSnap.exists && docSnap.data().count ? docSnap.data().count : 0;
                    transaction.set(likeDoc, { count: current + 1 }, { merge: true });
                });
                liked = true;
                localStorage.setItem(likeKey + '_liked', '1');
            } else {
                await db.runTransaction(async (transaction) => {
                    const docSnap = await transaction.get(likeDoc);
                    const current = docSnap.exists && docSnap.data().count ? docSnap.data().count : 0;
                    transaction.set(likeDoc, { count: Math.max(0, current - 1) }, { merge: true });
                });
                liked = false;
                localStorage.setItem(likeKey + '_liked', '0');
            }
        });
        
        episodeListDiv.appendChild(epDiv);
    });
}

// --- Like Button Firestore Logic ---
function setupLikeButton(tvId) {
    const likeBtn = document.getElementById('like-btn');
    const likeCount = document.getElementById('like-count');
    if (!likeBtn || !likeCount || !tvId) return;
    const db = firebase.firestore();
    firebase.auth().onAuthStateChanged(function(user) {
        if (!user) {
            likeBtn.disabled = true;
            likeBtn.title = 'You must be logged in to like.';
            return;
        }
        likeBtn.disabled = false;
        likeBtn.title = '';
        const likeDoc = db.collection('likes').doc('tv_' + tvId);
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
                await userLikeDoc.set({ 
                    liked: true, 
                    userId: user.uid,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp() 
                });
                likeBtn.classList.add('liked');
            } else {
                // Like'ı geri al
                await userLikeDoc.delete();
                likeBtn.classList.remove('liked');
            }
        });
    });
}

document.addEventListener('DOMContentLoaded', function() {
    const startBtn = document.getElementById('start-tv-btn');
    if (startBtn) {
        startBtn.onclick = function() {
            const tvId = getTvIdFromUrl();
            window.location.href = `watch.html?tv=${tvId}&season=1&episode=1`;
        };
    }
});

document.addEventListener('DOMContentLoaded', loadTvDetails); 