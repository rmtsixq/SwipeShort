document.getElementById("submitBtn").addEventListener("click", async () => {
    const url = document.getElementById("youtubeInput").value.trim();  
    const submitBtn = document.getElementById("submitBtn");
    
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
    }
});

function extractVideoID(url) {
    const regex = /(?:youtube\.com.*(?:\?|&)v=|youtu\.be\/)([^&\n?#]+)/;
    const match = url.match(regex);
    return match ? match[1] : null;
}

async function fetchVideoData(videoId) {
    try {
        // First get video information
        console.log('Fetching video info for ID:', videoId);
        const infoResponse = await fetch(`/api/youtube/info/${videoId}`);
        
        if (!infoResponse.ok) {
            const errorData = await infoResponse.json().catch(() => ({}));
            throw new Error(errorData.error || `HTTP error! status: ${infoResponse.status}`);
        }

        const videoInfo = await infoResponse.json();
        console.log("Video Title: ", videoInfo.title);
        
        // Start download process after getting video info
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