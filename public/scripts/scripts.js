document.getElementById("submitBtn").addEventListener("click", () => {
    const url = document.getElementById("youtubeInput").value.trim();  

    const videoId = extractVideoID(url);

    if (videoId) {
        console.log("Video ID:", videoId);
        fetchVideoData(videoId);  
    } else {
        console.log("This is an invalid YouTube URL");
    }
});

function extractVideoID(url) {
    const regex = /(?:youtube\.com.*(?:\?|&)v=|youtu\.be\/)([^&\n?#]+)/;
    const match = url.match(regex);
    return match ? match[1] : null;
}

async function fetchVideoData(videoId) {
    const apiKey = 'AIzaSyBYF0aszjzogOaArdiRB3RMfewydWa9UKQ'; 
    const url = `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&key=${apiKey}&part=snippet,contentDetails`; 

    try {
        const response = await fetch(url);
        const data = await response.json();

        if (data.items && data.items.length > 0) {
            const video = data.items[0];
            console.log("Video Title: ", video.snippet.title);
            console.log("Video Description: ", video.snippet.description);
            console.log("Video Publishing Date: ", video.snippet.publishedAt);
            console.log("Video Channel Name: ", video.snippet.channelTitle);
        } else {
            console.log("Video couldn't find.");
        }
    } catch (error) {
        console.log("An error occurred: ", error);
    }
}
