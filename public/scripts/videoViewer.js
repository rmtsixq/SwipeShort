document.addEventListener('DOMContentLoaded', () => {
    loadClips();
});

async function loadClips() {
    try {
        const response = await fetch('/api/clips');
        const clips = await response.json();
        
        const clipsGrid = document.querySelector('.clips-grid');
        clipsGrid.innerHTML = '';
        
        clips.forEach(clip => {
            const clipCard = createClipCard(clip);
            clipsGrid.appendChild(clipCard);
        });
    } catch (error) {
        console.error('Error loading clips:', error);
        const clipsGrid = document.querySelector('.clips-grid');
        clipsGrid.innerHTML = '<p class="error">Failed to load clips. Please try again.</p>';
    }
}

function createClipCard(clipData) {
    const card = document.createElement('div');
    card.className = 'clip-card';
    
    const video = document.createElement('video');
    video.className = 'clip-video';
    video.src = `/clips/${clipData.filename}`;
    video.controls = true;
    video.preload = 'metadata';
    video.setAttribute('data-clip-id', clipData.id);
    
    const info = document.createElement('div');
    info.className = 'clip-info';
    info.innerHTML = `
        <h3>${clipData.title}</h3>
        <p>Duration: ${clipData.duration}s</p>
    `;
    
    const actions = document.createElement('div');
    actions.className = 'clip-actions';
    actions.innerHTML = `
        <button onclick="playClip('${clipData.id}')" class="play-btn">Play</button>
        <button onclick="downloadClip('${clipData.id}')" class="download-btn">Download</button>
        <button onclick="shareClip('${clipData.id}')" class="share-btn">Share</button>
    `;
    
    card.appendChild(video);
    card.appendChild(info);
    card.appendChild(actions);
    
    return card;
}

function playClip(clipId) {
    const allVideos = document.querySelectorAll('video');
    allVideos.forEach(video => {
        video.pause();
        video.currentTime = 0;
    });
    
    const selectedVideo = document.querySelector(`video[data-clip-id="${clipId}"]`);
    if (selectedVideo) {
        selectedVideo.play();
    }
}

async function downloadClip(clipId) {
    try {
        const response = await fetch(`/api/clips/${clipId}/download`);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `clip-${clipId}.mp4`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    } catch (error) {
        console.error('Download error:', error);
        alert('Failed to download clip. Please try again.');
    }
}

async function shareClip(clipId) {
    try {
        if (navigator.share) {
            await navigator.share({
                title: 'ShortSwipe Clip',
                text: 'Check out this clip from ShortSwipe!',
                url: `${window.location.origin}/clips/${clipId}`
            });
        } else {
            const url = `${window.location.origin}/clips/${clipId}`;
            await navigator.clipboard.writeText(url);
            alert('Clip URL copied to clipboard!');
        }
    } catch (error) {
        console.error('Share error:', error);
        alert('Failed to share clip. Please try again.');
    }
}
    