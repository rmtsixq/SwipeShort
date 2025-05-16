// YouTube video processing
document.getElementById("submitBtn").addEventListener("click", async () => {
    const url = document.getElementById("youtubeInput").value.trim();  
    const submitBtn = document.getElementById("submitBtn");
    if (typeof processingOverlay !== 'undefined') {
        processingOverlay.style.display = 'flex';
    }
    try {
        submitBtn.disabled = true;
        submitBtn.textContent = "Processing...";

        const videoId = extractVideoID(url);
        if (!videoId) {
            alert("Invalid YouTube URL");
            return;
        }

        console.log("Video ID:", videoId);
        await fetchVideoData(videoId);
    } catch (error) {
        console.error("Error:", error);
        alert(error.message || "An error occurred. Please try again.");
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = "Download";
        if (typeof processingOverlay !== 'undefined') {
            processingOverlay.style.display = 'none';
        }
    }
});

function extractVideoID(url) {
    const regex = /(?:youtube\.com.*(?:\?|&)v=|youtu\.be\/)([^&\n?#]+)/;
    const match = url.match(regex);
    return match ? match[1] : null;
}

document.addEventListener('DOMContentLoaded', function() {
    const uploadBox = document.querySelector('.upload-box');
    const fileInput = document.getElementById('fileInput');
    const label = document.querySelector('.upload-box__label');
    const uploadButton = document.querySelector('.upload-button');
    const form = document.querySelector('form');
  
    ['dragenter', 'dragover'].forEach(event => {
      uploadBox.addEventListener(event, e => {
        e.preventDefault();
        e.stopPropagation();
        uploadBox.classList.add('dragover');
      });
    });
  
    ['dragleave', 'drop'].forEach(event => {
      uploadBox.addEventListener(event, e => {
        e.preventDefault();
        e.stopPropagation();
        uploadBox.classList.remove('dragover');
      });
    });
  
    uploadBox.addEventListener('drop', e => {
      const files = e.dataTransfer.files;
      if (files.length > 0 && files[0].type.startsWith('video/')) {
        fileInput.files = files;
        handleFileSelect(files[0]);
      } else {
        alert('Please select a video file.');
      }
    });
  
    fileInput.addEventListener('change', e => {
      if (e.target.files.length > 0) {
        handleFileSelect(e.target.files[0]);
      }
    });
  
    function handleFileSelect(file) {
      if (!file.type.startsWith('video/')) {
        alert('Please select a video file.');
        return;
      }
      
      const maxSize = 500 * 1024 * 1024;
      if (file.size > maxSize) {
        alert('File size is too large. Maximum size is 500MB.');
        return;
      }
      
      uploadButton.style.display = 'inline-block';
      
      const fileName = document.createElement('div');
      fileName.className = 'selected-file';
      fileName.textContent = `Selected file: ${file.name}`;
      
      const oldFileName = uploadBox.querySelector('.selected-file');
      if (oldFileName) {
        oldFileName.remove();
      }
      
      uploadBox.insertBefore(fileName, uploadButton);
    }
  
    form.addEventListener('submit', async e => {
      e.preventDefault();
      
      const formData = new FormData(form);
      const file = formData.get('video');
      
      if (!file || !file.name) {
        alert('Please select a video file.');
        return;
      }
      
      try {
        uploadButton.disabled = true;
        uploadButton.textContent = 'Uploading...';
        
        const response = await fetch('/upload', {
          method: 'POST',
          body: formData
        });
        
        if (!response.ok) {
          throw new Error('Upload failed');
        }
        
        alert('Video uploaded successfully! Processing...');
        window.location.href = '/videos.html';
        
      } catch (error) {
        console.error('Upload error:', error);
        alert('An error occurred. Please try again.');
        uploadButton.disabled = false;
        uploadButton.textContent = 'Upload Video';
      }
    });
});

// Slot machine animation
var wordlist = [
  'insights','inspirations','hacks','tools','resources','workflows','thoughts','skills','concepts','tips',
  'creators','stories','perspectives','profiles','minds','voices','journeys','teams','characters','vibes',
  'aesthetics','looks','moods','layouts','designs','filters','visuals','interfaces','palettes','elements'
];

function buildSlotItem(text) {
  const coloredText = text.replace(/s/gi, '<span style="color: rgba(255, 102, 196, 1)">s</span>');
  return $('<div>')
    .addClass('slottt-machine-recipe__item')
    .html(coloredText);
}

function buildSlotContents($container, wordlist) {
  const $items = wordlist.map(buildSlotItem);
  $container.append($items);
}

function popPushNItems($container, n) {
  const $children = $container.find('.slottt-machine-recipe__item');
  $children.slice(0, n).insertAfter($children.last());
}

let currentIndex = 0;
let isAnimating = false;

function animate() {
  if (isAnimating) return;
  isAnimating = true;

  const $wordbox = $('#wordbox .slottt-machine-recipe__items_container');
  const itemHeight = 48;

  currentIndex++;
  $wordbox.css({
    transition: 'top 1.2s cubic-bezier(0.4, 0, 0.2, 1)',
    top: -currentIndex * itemHeight + 'px'
  });

  setTimeout(() => {
    popPushNItems($wordbox, 1);
    $wordbox.css({
      transition: 'none',
      top: - (currentIndex - 1) * itemHeight + 'px'
    });

    $wordbox[0].offsetHeight;

    $wordbox.css({
      transition: 'top 1.2s cubic-bezier(0.4, 0, 0.2, 1)',
      top: - (currentIndex - 1) * itemHeight + 'px'
    });

    currentIndex--;
    isAnimating = false;
  }, 1200);
}

$(function () {
  const $wordbox = $('#wordbox .slottt-machine-recipe__items_container');
  buildSlotContents($wordbox, wordlist);
  buildSlotContents($wordbox, wordlist);

  $wordbox.css({
    top: '0',
    transition: 'top 1.2s cubic-bezier(0.4, 0, 0.2, 1)'
  });

  setInterval(animate, 3000);
});

// File upload handling
const fileInput = document.getElementById('fileInput');
const uploadBox = document.querySelector('.upload-box');
const uploadButton = document.querySelector('.upload-button');

// Create duration selection modal
const durationModal = document.createElement('div');
durationModal.className = 'duration-modal';
durationModal.innerHTML = `
    <div class="duration-content">
        <h3>Select Clip Duration</h3>
        <div class="duration-slider">
            <input type="range" min="10" max="40" value="20" class="duration-range" id="durationRange">
            <span class="duration-value">20 seconds</span>
        </div>
        <button class="duration-ok">OK</button>
    </div>
`;

// Create processing overlay
const processingOverlay = document.createElement('div');
processingOverlay.className = 'processing-overlay';
processingOverlay.innerHTML = `
    <div class="processing-content">
        <div class="spinner"></div>
        <p>Processing video...</p>
    </div>
`;

document.body.appendChild(durationModal);
document.body.appendChild(processingOverlay);

fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        if (file.type.startsWith('video/')) {
            uploadBox.classList.add('has-file');
            uploadButton.style.display = 'block';
        } else {
            alert('Please select a video file');
            fileInput.value = '';
        }
    }
});

const form = document.querySelector('form');
if (form) {
    form.onsubmit = null;
    form.action = 'javascript:void(0);';
    form.method = 'GET';
    form.addEventListener('submit', function(e) {
        e.preventDefault();
        return false;
    }, true);
}

uploadButton.onclick = null;
uploadButton.addEventListener('click', (e) => {
    e.preventDefault();
    if (fileInput.files.length > 0) {
        durationModal.style.display = 'flex';
    } else {
        alert('Please select a video file first');
    }
});

const durationRange = document.getElementById('durationRange');
const durationValue = document.querySelector('.duration-value');

durationRange.addEventListener('input', (e) => {
    const value = e.target.value;
    durationValue.textContent = `${value} seconds`;
});

const okBtn = document.querySelector('.duration-ok');
okBtn.onclick = null;
okBtn.addEventListener('click', () => {
    const duration = durationRange.value;
    durationModal.style.display = 'none';
    processingOverlay.style.display = 'flex';

    const formData = new FormData();
    formData.append('video', fileInput.files[0]);
    formData.append('duration', duration);

    fetch('/upload', {
        method: 'POST',
        body: formData
    })
    .then(response => response.text())
    .then(result => {
        console.log('Success:', result);
        processingOverlay.style.display = 'none';
        uploadBox.classList.remove('has-file');
        uploadButton.style.display = 'none';
        fileInput.value = '';
        window.location.href = '/videos.html';
    })
    .catch(error => {
        console.error('Error:', error);
        processingOverlay.style.display = 'none';
        alert('Error processing video. Please try again.');
    });
});

async function fetchVideoData(videoId) {
    try {
        console.log('Fetching video info for ID:', videoId);
        const infoResponse = await fetch(`/api/youtube/info/${videoId}`);
        
        if (!infoResponse.ok) {
            const errorData = await infoResponse.json().catch(() => ({}));
            throw new Error(errorData.error || `HTTP error! status: ${infoResponse.status}`);
        }

        const videoInfo = await infoResponse.json();
        console.log("Video Title: ", videoInfo.title);
        
        const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;
        console.log('Starting download for URL:', youtubeUrl);
        
        const downloadResponse = await fetch('/api/youtube/download', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ url: youtubeUrl })
        });
        
        if (!downloadResponse.ok) {
            const errorData = await downloadResponse.json().catch(() => ({}));
            throw new Error(errorData.error || `HTTP error! status: ${downloadResponse.status}`);
        }

        const downloadData = await downloadResponse.json();
        console.log('Download response:', downloadData);

        alert('Video is being processed! Redirecting to clips page.');
        window.location.href = '/videos.html';

    } catch (error) {
        console.error('Error:', error);
        throw new Error(error.message || 'An error occurred. Please try again.');
    }
}

// PreUploaded Videos: Movie card click error -> Şimdi kullanıcıyı videoya yönlendir
const movieCards = document.querySelectorAll('.movie-card:not(.arrow-card)');
movieCards.forEach(card => {
  card.addEventListener('click', () => {
    window.location.href = 'cars1feed.html';
  });
});
