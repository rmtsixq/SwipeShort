const ffmpeg = require('fluent-ffmpeg');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
const path = require('path');
const fs = require('fs');

// Set ffmpeg path
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

const videoPath = path.join(__dirname, 'videos', 'cars1.mp4');
const clipsDir = path.join(__dirname, 'clips');

if (!fs.existsSync(clipsDir)) {
    fs.mkdirSync(clipsDir, { recursive: true });
}

console.log('Starting video split process...');
console.log('Video path:', videoPath);
console.log('Output directory:', clipsDir);

ffmpeg.ffprobe(videoPath, (err, metadata) => {
    if (err) {
        console.error('Error reading video file:', err);
        return;
    }
    
    const duration = Math.floor(metadata.format.duration);
    const clipLength = 20; // 20 seconds per clip
    const totalClips = Math.ceil(duration/clipLength);
    let currentClip = 0;

    console.log(`Video duration: ${duration} seconds`);
    console.log(`Will create ${totalClips} clips`);

    function processNextClip() {
        if (currentClip >= totalClips) {
            console.log('All clips have been created successfully!');
            return;
        }

        const start = currentClip * clipLength;
        const output = path.join(clipsDir, `cars1_clip_${currentClip + 1}.mp4`);
        
        console.log(`Processing clip ${currentClip + 1}/${totalClips} (${Math.floor((currentClip/totalClips)*100)}% complete)`);
        
        ffmpeg(videoPath)
            .setStartTime(start)
            .setDuration(Math.min(clipLength, duration - start))
            .output(output)
            .on('end', () => {
                console.log(`Created: ${output}`);
                currentClip++;
                processNextClip();
            })
            .on('error', (err) => {
                console.error(`Error processing clip ${currentClip + 1}:`, err);
                currentClip++;
                processNextClip();
            })
            .run();
    }

    processNextClip();
});