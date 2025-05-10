document.addEventListener('DOMContentLoaded', () => {
    loadClips();
    addAspectRatioToggle();
});

async function loadClips() {
    try {
        const response = await fetch('/api/clips');
        const clips = await response.json();
        
        const container = document.getElementById('clipsContainer');
        container.innerHTML = ''; // Clear existing content
        
        clips.forEach(clip => {
            const slide = document.createElement('div');
            slide.className = 'swiper-slide';
            
            const videoContainer = document.createElement('div');
            videoContainer.className = 'video-container';
            
            const video = document.createElement('video');
            video.src = `/clips/${clip.filename}`;
            video.loop = true;
            video.muted = false;
            video.playsInline = true;
            video.autoplay = true;

            // Add subtitle track if available
            let subtitleBtn = null;
            if (clip.subtitle) {
                const track = document.createElement('track');
                track.kind = 'subtitles';
                track.label = 'English';
                track.srclang = 'en';
                track.src = `/clips/${clip.subtitle}`;
                track.default = true;
                video.appendChild(track);
                video.textTracks[0].mode = 'showing';

                // Add subtitle toggle button
                subtitleBtn = document.createElement('button');
                subtitleBtn.className = 'control-button subtitle-toggle';
                subtitleBtn.innerHTML = '<i class="fas fa-closed-captioning"></i>';
                subtitleBtn.title = 'Toggle Subtitles';
                subtitleBtn.onclick = (e) => {
                    e.stopPropagation();
                    const track = video.textTracks[0];
                    if (track.mode === 'showing') {
                        track.mode = 'hidden';
                        subtitleBtn.style.opacity = 0.5;
                    } else {
                        track.mode = 'showing';
                        subtitleBtn.style.opacity = 1;
                    }
                };
            }
            
            // Add play/pause overlay
            const overlay = document.createElement('div');
            overlay.className = 'play-pause-overlay';
            overlay.innerHTML = '<i class="fas fa-pause"></i>';
            
            videoContainer.appendChild(video);
            videoContainer.appendChild(overlay);
            if (subtitleBtn) {
                videoContainer.appendChild(subtitleBtn);
            }
            slide.appendChild(videoContainer);
            container.appendChild(slide);

            // Add click handler for play/pause
            videoContainer.addEventListener('click', (e) => {
                // Prevent toggling play/pause when clicking subtitle button
                if (e.target === subtitleBtn) return;
                if (video.paused) {
                    video.play();
                    overlay.innerHTML = '<i class="fas fa-pause"></i>';
                } else {
                    video.pause();
                    overlay.innerHTML = '<i class="fas fa-play"></i>';
                }
                overlay.classList.add('show');
                setTimeout(() => {
                    overlay.classList.remove('show');
                }, 1000);
            });
        });
        
        // Initialize Swiper
        const swiper = new Swiper('.swiper-container', {
            direction: 'vertical',
            slidesPerView: 1,
            spaceBetween: 0,
            mousewheel: true,
            pagination: {
                el: '.swiper-pagination',
                clickable: true,
            },
            on: {
                slideChange: function () {
                    // Pause all videos
                    document.querySelectorAll('video').forEach(video => {
                        video.pause();
                    });
                    // Play current video
                    const currentVideo = this.slides[this.activeIndex].querySelector('video');
                    if (currentVideo) {
                        currentVideo.muted = false;
                        currentVideo.play();
                        // Enable subtitles for current video
                        if (currentVideo.textTracks.length > 0) {
                            currentVideo.textTracks[0].mode = 'showing';
                        }
                        // Update overlay icon
                        const overlay = this.slides[this.activeIndex].querySelector('.play-pause-overlay');
                        if (overlay) {
                            overlay.innerHTML = '<i class="fas fa-pause"></i>';
                        }
                    }
                }
            }
        });
        
    } catch (error) {
        console.error('Error loading clips:', error);
        alert('Error loading clips. Please try again.');
    }
}

function togglePlay(video, button) {
    if (video.paused) {
        video.play();
        button.innerHTML = '<i class="fas fa-pause"></i>';
    } else {
        video.pause();
        button.innerHTML = '<i class="fas fa-play"></i>';
    }
}

function toggleMute(video, button) {
    video.muted = !video.muted;
    button.innerHTML = video.muted ? '<i class="fas fa-volume-mute"></i>' : '<i class="fas fa-volume-up"></i>';
}

async function downloadClip(filename) {
    try {
        const response = await fetch(`/clips/${filename}`);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    } catch (error) {
        console.error('Error downloading clip:', error);
        alert('Error downloading clip. Please try again.');
    }
}

async function shareClip(filename) {
    try {
        const response = await fetch(`/clips/${filename}`);
        const blob = await response.blob();
        const file = new File([blob], filename, { type: 'video/mp4' });
        
        if (navigator.share) {
            await navigator.share({
                files: [file],
                title: 'Check out this video clip!',
                text: 'Shared from ShortSwipe'
            });
        } else {
            // Fallback for browsers that don't support Web Share API
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        }
    } catch (error) {
        console.error('Error sharing clip:', error);
        alert('Error sharing clip. Please try again.');
    }
}

document.addEventListener('DOMContentLoaded', function() {
    // Create side buttons container
    const sideButtons = document.createElement('div');
    sideButtons.className = 'side-buttons';

    // Mute button
    const muteBtn = document.createElement('button');
    muteBtn.className = 'control-button mute';
    muteBtn.innerHTML = '<i class="fas fa-volume-up"></i>';

    // Download button
    const downloadBtn = document.createElement('button');
    downloadBtn.className = 'control-button download';
    downloadBtn.innerHTML = '<i class="fas fa-download"></i>';

    // Share button
    const shareBtn = document.createElement('button');
    shareBtn.className = 'control-button share';
    shareBtn.innerHTML = '<i class="fas fa-share-alt"></i>';

    sideButtons.append(muteBtn, downloadBtn, shareBtn);
    document.body.appendChild(sideButtons);

    // Helper to get the active video
    function getActiveVideo() {
        const activeSlide = document.querySelector('.swiper-slide-active');
        return activeSlide ? activeSlide.querySelector('video') : null;
    }

    muteBtn.onclick = () => {
        const video = getActiveVideo();
        if (video) {
            video.muted = !video.muted;
            muteBtn.innerHTML = video.muted
                ? '<i class="fas fa-volume-mute"></i>'
                : '<i class="fas fa-volume-up"></i>';
        }
    };

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

    shareBtn.onclick = () => {
        const video = getActiveVideo();
        if (video) {
            // You can implement your share logic here
            // For now, just alert the video src
            alert('Share: ' + video.src);
        }
    };
});

function addAspectRatioToggle() {
    const toggle = document.createElement('button');
    toggle.className = 'aspect-ratio-toggle';
    toggle.innerHTML = '<i class="fas fa-expand"></i>';
    document.body.appendChild(toggle);

    let currentMode = 'landscape'; // landscape, portrait, fullscreen

    toggle.addEventListener('click', () => {
        const videoContainers = document.querySelectorAll('.video-container');
        if (!videoContainers.length) return;

        switch (currentMode) {
            case 'landscape':
                videoContainers.forEach(container => {
                    container.classList.remove('landscape');
                    container.classList.add('portrait');
                });
                toggle.innerHTML = '<i class="fas fa-expand"></i>';
                currentMode = 'portrait';
                break;
            case 'portrait':
                videoContainers.forEach(container => {
                    container.classList.remove('portrait');
                    container.classList.add('fullscreen');
                });
                toggle.innerHTML = '<i class="fas fa-compress"></i>';
                currentMode = 'fullscreen';
                break;
            case 'fullscreen':
                videoContainers.forEach(container => {
                    container.classList.remove('fullscreen');
                    container.classList.add('landscape');
                });
                toggle.innerHTML = '<i class="fas fa-mobile-alt"></i>';
                currentMode = 'landscape';
                break;
        }
    });
}
    
    