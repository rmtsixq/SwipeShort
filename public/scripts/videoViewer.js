let globalAspectMode = 'portrait'; // 'portrait', 'landscape', 'fullscreen'
let globalFitMode = 'contain'; // 'contain' or 'cover'
let swiperInstance = null;

/* Video viewer initialization */
document.addEventListener('DOMContentLoaded', () => {
    loadClips();
    addAspectRatioToggle();
});

/* Load and display video clips */
async function loadClips() {
    try {
        // Get all clips from /clips directory
        const response = await fetch('/api/clips');
        const clips = await response.json();

        const container = document.getElementById('clipsContainer');
        container.innerHTML = '';

        clips.forEach(clip => {
            const slide = document.createElement('div');
            slide.className = 'swiper-slide';
            
            // Ambiant background effect for visual depth
            const ambiant = document.createElement('div');
            ambiant.className = 'ambiant-effect';
            ambiant.style.position = 'absolute';
            ambiant.style.top = 0;
            ambiant.style.left = 0;
            ambiant.style.width = '100%';
            ambiant.style.height = '100%';
            ambiant.style.zIndex = 0;
            ambiant.style.filter = 'blur(40px) brightness(0.7)';
            ambiant.style.background = `center / cover no-repeat url('/clips/${clip.filename}')`;
            slide.appendChild(ambiant);

            const videoContainer = document.createElement('div');
            videoContainer.className = 'video-container';
            videoContainer.style.position = 'relative';
            videoContainer.style.zIndex = 1;

            // Video element
    const video = document.createElement('video');
            video.src = `/clips/${clip.filename}`;
            video.loop = true;
            video.muted = false;
            video.playsInline = true;
            video.autoplay = true;
            video.style.background = '#222';
            applyAspectMode(video, globalAspectMode, globalFitMode);

            // Add video controls
            const videoTime = document.createElement('div');
            videoTime.className = 'video-time';
            videoTime.innerHTML = `
                <span class="current-time">0:00</span>
                <span class="total-time">0:00</span>
            `;

            const progressBar = document.createElement('div');
            progressBar.className = 'progress-bar';
            progressBar.innerHTML = '<div class="progress"></div>';

            const overlay = document.createElement('div');
            overlay.className = 'play-pause-overlay';
            overlay.innerHTML = '<i class="fas fa-pause"></i>';
            overlay.style.opacity = '0';
            overlay.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
            overlay.style.transform = 'translate(-50%, -50%) scale(0.8)';

            const title = document.createElement('div');
            title.className = 'clip-title';
            title.textContent = clip.title || clip.filename;
            
            videoContainer.appendChild(video);
            videoContainer.appendChild(videoTime);
            videoContainer.appendChild(progressBar);
            videoContainer.appendChild(overlay);
            videoContainer.appendChild(title);
            slide.appendChild(videoContainer);
            container.appendChild(slide);

            // Setup video controls
            setupVideoControls(video, videoTime, progressBar, overlay, videoContainer);
        });
        
        /* Initialize Swiper */
        swiperInstance = new Swiper('.swiper-container', {
            direction: 'vertical',
            slidesPerView: 1,
            spaceBetween: 0,
            mousewheel: true,
            pagination: {
                el: '.swiper-pagination',
                clickable: true,
            },
            speed: 600,
            effect: 'slide',
            fadeEffect: { crossFade: true },
            on: {
                slideChange: function () {
                    document.querySelectorAll('video').forEach((video, idx) => {
                        if (this.slides[this.activeIndex].contains(video)) {
                            video.muted = false;
                            video.play().catch(e => console.log('Playback prevented:', e));
                        } else {
                            video.pause();
                            video.muted = true;
                        }
                    });
                }
            }
        });

        // İlk yüklemede sadece ilk video oynasın
        const allVideos = document.querySelectorAll('video');
        allVideos.forEach((video, idx) => {
            if (idx === 0) {
                video.muted = false;
                video.play().catch(e => {});
            } else {
                video.muted = true;
                video.pause();
            }
        });

        // Side buttons (aspect, fit)
        setupSideButtons();
        
    } catch (error) {
        console.error('Error loading clips:', error);
        alert('Error loading clips. Please try again.');
    }
}

function setupSideButtons() {
    let sideButtons = document.querySelector('.side-buttons');
    if (!sideButtons) {
        sideButtons = document.createElement('div');
        sideButtons.className = 'side-buttons';
        sideButtons.style.position = 'fixed';
        sideButtons.style.top = '50%';
        sideButtons.style.right = '24px';
        sideButtons.style.transform = 'translateY(-50%)';
        sideButtons.style.display = 'flex';
        sideButtons.style.flexDirection = 'column';
        sideButtons.style.gap = '18px';
        sideButtons.style.zIndex = '100';
        document.body.appendChild(sideButtons);
    } else {
        sideButtons.innerHTML = '';
    }

    // Mute button
    const muteBtn = document.createElement('button');
    muteBtn.className = 'control-button mute';
    muteBtn.innerHTML = '<i class="fas fa-volume-up"></i>';
    muteBtn.style.fontSize = '1.5rem';
    muteBtn.style.background = 'rgba(0,0,0,0.5)';
    muteBtn.style.color = '#fff';
    muteBtn.style.border = 'none';
    muteBtn.style.borderRadius = '50%';
    muteBtn.style.width = '48px';
    muteBtn.style.height = '48px';
    muteBtn.style.cursor = 'pointer';

    muteBtn.onclick = () => {
        const video = getActiveVideo();
        if (video) {
            video.muted = !video.muted;
            muteBtn.innerHTML = video.muted
                ? '<i class="fas fa-volume-mute"></i>'
                : '<i class="fas fa-volume-up"></i>';
        }
    };

    // Download button
    const downloadBtn = document.createElement('button');
    downloadBtn.className = 'control-button download';
    downloadBtn.innerHTML = '<i class="fas fa-download"></i>';
    downloadBtn.style.fontSize = '1.5rem';
    downloadBtn.style.background = 'rgba(0,0,0,0.5)';
    downloadBtn.style.color = '#fff';
    downloadBtn.style.border = 'none';
    downloadBtn.style.borderRadius = '50%';
    downloadBtn.style.width = '48px';
    downloadBtn.style.height = '48px';
    downloadBtn.style.cursor = 'pointer';

    downloadBtn.onclick = () => {
        const video = getActiveVideo();
        if (video) {
            const src = video.src;
            const a = document.createElement('a');
            a.href = src;
            a.download = src.split('/').pop();
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        }
    };

    // Share button
    const shareBtn = document.createElement('button');
    shareBtn.className = 'control-button share';
    shareBtn.innerHTML = '<i class="fas fa-share-alt"></i>';
    shareBtn.style.fontSize = '1.5rem';
    shareBtn.style.background = 'rgba(0,0,0,0.5)';
    shareBtn.style.color = '#fff';
    shareBtn.style.border = 'none';
    shareBtn.style.borderRadius = '50%';
    shareBtn.style.width = '48px';
    shareBtn.style.height = '48px';
    shareBtn.style.cursor = 'pointer';

    shareBtn.onclick = () => {
        const video = getActiveVideo();
        if (video) {
            alert('Share: ' + video.src);
        }
    };

    // Aspect ratio/resize button
    const aspectBtn = document.createElement('button');
    aspectBtn.className = 'control-button aspect';
    aspectBtn.innerHTML = '<i class="fas fa-mobile-alt"></i>';
    aspectBtn.style.fontSize = '1.5rem';
    aspectBtn.style.background = 'rgba(0,0,0,0.5)';
    aspectBtn.style.color = '#fff';
    aspectBtn.style.border = 'none';
    aspectBtn.style.borderRadius = '50%';
    aspectBtn.style.width = '48px';
    aspectBtn.style.height = '48px';
    aspectBtn.style.cursor = 'pointer';
    aspectBtn.title = 'Change Aspect Ratio';

    aspectBtn.onclick = () => {
        // Cycle: portrait (9:16) -> landscape (16:9) -> fullscreen -> portrait ...
        if (globalAspectMode === 'portrait') {
            globalAspectMode = 'landscape';
            aspectBtn.innerHTML = '<i class="fas fa-tv"></i>';
        } else if (globalAspectMode === 'landscape') {
            globalAspectMode = 'fullscreen';
            aspectBtn.innerHTML = '<i class="fas fa-expand"></i>';
            // Fullscreen API
            const activeSlide = document.querySelector('.swiper-slide-active');
            if (activeSlide) {
                const video = activeSlide.querySelector('video');
                if (video && video.requestFullscreen) {
                    video.requestFullscreen();
                } else if (video && video.webkitRequestFullscreen) {
                    video.webkitRequestFullscreen();
                } else if (video && video.msRequestFullscreen) {
                    video.msRequestFullscreen();
                }
            }
            } else {
            globalAspectMode = 'portrait';
            aspectBtn.innerHTML = '<i class="fas fa-mobile-alt"></i>';
            // Exit fullscreen
            if (document.fullscreenElement) {
                document.exitFullscreen();
            } else if (document.webkitFullscreenElement) {
                document.webkitExitFullscreen();
            } else if (document.msFullscreenElement) {
                document.msExitFullscreen();
            }
        }
        // Apply to all videos
        document.querySelectorAll('video').forEach(video => {
            applyAspectMode(video, globalAspectMode, globalFitMode);
        });
    };

    // Video Fit (cover/contain) button
    const fitBtn = document.createElement('button');
    fitBtn.className = 'control-button fit';
    fitBtn.innerHTML = '<i class="fas fa-arrows-alt"></i>';
    fitBtn.style.fontSize = '1.5rem';
    fitBtn.style.background = 'rgba(0,0,0,0.5)';
    fitBtn.style.color = '#fff';
    fitBtn.style.border = 'none';
    fitBtn.style.borderRadius = '50%';
    fitBtn.style.width = '48px';
    fitBtn.style.height = '48px';
    fitBtn.style.cursor = 'pointer';
    fitBtn.title = 'Toggle Video Fit (cover/contain)';

    fitBtn.onclick = () => {
        globalFitMode = globalFitMode === 'contain' ? 'cover' : 'contain';
        fitBtn.innerHTML = globalFitMode === 'cover' ? '<i class="fas fa-compress-arrows-alt"></i>' : '<i class="fas fa-arrows-alt"></i>';
        document.querySelectorAll('video').forEach(video => {
            applyAspectMode(video, globalAspectMode, globalFitMode);
        });
    };

    sideButtons.append(muteBtn, downloadBtn, shareBtn, aspectBtn, fitBtn);
}

function getActiveVideo() {
    const activeSlide = document.querySelector('.swiper-slide-active');
    return activeSlide ? activeSlide.querySelector('video') : null;
}

function applyAspectMode(video, mode, fit) {
    fit = fit || 'contain';
    if (mode === 'portrait') {
        video.style.width = '100%';
        video.style.maxWidth = '480px';
        video.style.aspectRatio = '9/16';
        video.style.height = '';
        video.style.objectFit = fit;
    } else if (mode === 'landscape') {
        video.style.width = 'auto';
        video.style.maxWidth = '90vw';
        video.style.height = '60vh';
        video.style.aspectRatio = '16/9';
        video.style.objectFit = fit;
    } else if (mode === 'fullscreen') {
        video.style.width = '100vw';
        video.style.height = '100vh';
        video.style.maxWidth = '';
        video.style.aspectRatio = '';
        video.style.objectFit = fit;
    }
}

function addAspectRatioToggle() { /* No-op, handled inline above */ }

function setupVideoControls(video, timeDisplay, progressBar, playPauseOverlay, videoContainer) {
    let isPlaying = true;
    let hideControlsTimeout;

    function formatTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        seconds = Math.floor(seconds % 60);
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }

    function updateTime() {
        const currentTime = formatTime(video.currentTime);
        const totalTime = formatTime(video.duration);
        timeDisplay.innerHTML = `<span class="current-time">${currentTime}</span> / <span class="total-time">${totalTime}</span>`;
    }

    function updateProgress() {
        const progress = (video.currentTime / video.duration) * 100;
        progressBar.querySelector('.progress').style.width = `${progress}%`;
    }

    function togglePlay() {
        if (video.paused) {
            video.play();
            playPauseOverlay.innerHTML = '<i class="fas fa-pause"></i>';
            playPauseOverlay.classList.remove('show');
            void playPauseOverlay.offsetWidth;
            playPauseOverlay.classList.add('show');
            isPlaying = true;
            setTimeout(() => {
                playPauseOverlay.classList.remove('show');
            }, 1000);
        } else {
            video.pause();
            playPauseOverlay.innerHTML = '<i class="fas fa-play"></i>';
            playPauseOverlay.classList.remove('show');
            void playPauseOverlay.offsetWidth;
            playPauseOverlay.classList.add('show');
            isPlaying = false;
            setTimeout(() => {
                playPauseOverlay.classList.remove('show');
            }, 1000);
        }
        showControls();
    }

    function showControls() {
        timeDisplay.style.opacity = '1';
        progressBar.style.opacity = '1';
        playPauseOverlay.classList.remove('show');
        void playPauseOverlay.offsetWidth;
        playPauseOverlay.classList.add('show');
        clearTimeout(hideControlsTimeout);
        hideControlsTimeout = setTimeout(() => {
            if (isPlaying) {
                timeDisplay.style.opacity = '0';
                progressBar.style.opacity = '0';
                playPauseOverlay.classList.remove('show');
            }
        }, 3000);
    }

    // Event listeners
    video.addEventListener('timeupdate', () => {
        updateTime();
        updateProgress();
    });

    video.addEventListener('play', () => {
        playPauseOverlay.innerHTML = '<i class="fas fa-pause"></i>';
        playPauseOverlay.classList.remove('show');
        void playPauseOverlay.offsetWidth;
        playPauseOverlay.classList.add('show');
        isPlaying = true;
        setTimeout(() => {
            playPauseOverlay.classList.remove('show');
        }, 1000);
    });

    video.addEventListener('pause', () => {
        playPauseOverlay.innerHTML = '<i class="fas fa-play"></i>';
        playPauseOverlay.classList.remove('show');
        void playPauseOverlay.offsetWidth;
        playPauseOverlay.classList.add('show');
        isPlaying = false;
        setTimeout(() => {
            playPauseOverlay.classList.remove('show');
        }, 1000);
    });

    video.addEventListener('click', togglePlay);
    video.addEventListener('timeupdate', updateProgress);
    video.addEventListener('ended', () => {
        isPlaying = false;
        playPauseOverlay.innerHTML = '<i class="fas fa-play"></i>';
        playPauseOverlay.classList.remove('show');
        void playPauseOverlay.offsetWidth;
        playPauseOverlay.classList.add('show');
    });

    videoContainer.addEventListener('mousemove', showControls);

    progressBar.addEventListener('click', (e) => {
        const rect = progressBar.getBoundingClientRect();
        const pos = (e.clientX - rect.left) / rect.width;
        video.currentTime = pos * video.duration;
    });
}
    
    