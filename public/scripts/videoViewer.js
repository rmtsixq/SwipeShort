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
        const response = await fetch('/data/videos.json');
        const data = await response.json();
        const clips = data.movies[0].clips; // Cars 1 kliplerini al

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
            ambiant.style.background = `center / cover no-repeat url('${clip.thumbnail}')`;
            slide.appendChild(ambiant);

            const videoContainer = document.createElement('div');
            videoContainer.className = 'video-container';
            videoContainer.style.position = 'relative';
            videoContainer.style.zIndex = 1;

            // Google Drive iframe oynatıcı
            const iframe = document.createElement('iframe');
            iframe.src = clip.url.replace('/uc?export=download&id=', '/file/d/') + '/preview';
            iframe.width = '100%';
            iframe.height = '100%';
            iframe.allowFullscreen = true;
            iframe.style.border = 'none';
            iframe.style.background = '#222';
            applyAspectMode(iframe, globalAspectMode, globalFitMode);

            // Add video controls
            const controls = document.createElement('div');
            controls.className = 'video-controls';
            controls.style.position = 'absolute';
            controls.style.bottom = '0';
            controls.style.left = '0';
            controls.style.right = '0';
            controls.style.padding = '10px';
            controls.style.background = 'linear-gradient(transparent, rgba(0,0,0,0.7))';
            controls.style.opacity = '0';
            controls.style.transition = 'opacity 0.3s';
            controls.style.zIndex = '10';

            const title = document.createElement('div');
            title.className = 'clip-title';
            title.textContent = clip.title;
            title.style.color = '#fff';
            title.style.padding = '10px';
            title.style.fontSize = '1.2rem';
            title.style.textShadow = '0 1px 2px rgba(0,0,0,0.5)';
            
            videoContainer.appendChild(iframe);
            videoContainer.appendChild(controls);
            videoContainer.appendChild(title);
            slide.appendChild(videoContainer);
            container.appendChild(slide);

            // Show/hide controls on mouse move
            let controlsTimeout;
            videoContainer.addEventListener('mousemove', () => {
                controls.style.opacity = '1';
                clearTimeout(controlsTimeout);
                controlsTimeout = setTimeout(() => {
                    controls.style.opacity = '0';
                }, 3000);
            });
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
            fadeEffect: { crossFade: true }
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
    
    