const express = require('express');
const multer = require('multer');
const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');
const fetch = require('node-fetch');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const { v4: uuidv4 } = require('uuid');
const ytdl = require('ytdl-core');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const upload = multer({ dest: process.env.UPLOAD_DIR || 'uploads/' });

// YouTube API Key
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

// Check and create directories
const uploadsDir = path.join(__dirname, process.env.UPLOAD_DIR || 'uploads');
const clipsDir = path.join(__dirname, process.env.CLIPS_DIR || 'clips');

if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
}
if (!fs.existsSync(clipsDir)) {
    fs.mkdirSync(clipsDir);
}

// Middleware
app.use(express.static('public')); // for serving static files (html, css, js)
app.use('/uploads', express.static('uploads'));
app.use('/clips', express.static('clips'));
app.use('/videos', express.static('videos'));

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
}).on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use. Please try a different port.`);
    } else {
        console.error('Server error:', err);
    }
    process.exit(1);
});

// UPLOAD ENDPOINT
app.post('/upload', upload.fields([{ name: 'video' }, { name: 'duration' }]), (req, res) => {
    // Dosya ve duration'ı al
    const file = req.files && req.files['video'] ? req.files['video'][0] : null;
    const durationRaw = req.body && req.body.duration;
    console.log('Duration received from form:', durationRaw);
    if (!durationRaw || isNaN(parseInt(durationRaw))) {
        return res.status(400).send('Duration is missing or invalid!');
    }
    const duration = parseInt(durationRaw);

    console.log('req.body:', req.body);
    console.log('Uploaded File:', file);
    console.log('Selected Duration:', duration);

    if (!file) {
        return res.status(400).send('No file uploaded.');
    }

    const videoPath = path.join(__dirname, file.path);
    splitVideoIntoClips(videoPath, [], duration)
        .then(() => {
            res.send('Video uploaded and split successfully!');
        })
        .catch(err => {
            console.error('Error while splitting:', err);
            res.status(500).send('Error processing video.');
        });
});

// Now add JSON middleware for other endpoints
app.use(express.json());

// Update YouTube download endpoint
app.post('/api/youtube/download', async (req, res) => {
    console.log('Received download request');
    console.log('Request body:', req.body);

    try {
        const { url } = req.body;
        
        if (!url) {
            console.error('URL is missing in request body');
            return res.status(400).json({ error: 'URL is required' });
        }

        console.log('Processing URL:', url);

        // Validate YouTube URL
        if (!url.includes('youtube.com') && !url.includes('youtu.be')) {
            console.error('Invalid YouTube URL:', url);
            return res.status(400).json({ error: 'Invalid YouTube URL' });
        }

        // Extract video ID
        const videoId = url.match(/(?:youtube\.com.*(?:\?|&)v=|youtu\.be\/)([^&\n?#]+)/)?.[1];
        if (!videoId) {
            return res.status(400).json({ error: 'Could not extract video ID' });
        }

        console.log('Video ID:', videoId);

        // Get video information
        const infoUrl = `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&key=${YOUTUBE_API_KEY}&part=snippet,contentDetails`;
        const infoResponse = await fetch(infoUrl);
        const infoData = await infoResponse.json();

        if (!infoData.items || infoData.items.length === 0) {
            return res.status(404).json({ error: 'Video not found' });
        }

        const videoTitle = infoData.items[0].snippet.title;
        const fileName = `${Date.now()}_${videoTitle.replace(/[^a-z0-9]/gi, '_')}.mp4`;
        const outputPath = path.join(uploadsDir, fileName);

        console.log('Will save video to:', outputPath);

        // Download video with yt-dlp
        try {
            console.log('Starting video download...');
            await execPromise(`yt-dlp -f "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best" -o "${outputPath}" "${url}"`);
            console.log('Download completed');

            // Get transcript
            console.log('Getting transcript...');
            const transcript = await getTranscript(videoId);
            console.log('Transcript received');

            // Split video into clips
            console.log('Starting to split video...');
            await splitVideoIntoClips(outputPath, transcript);
            console.log('Video split completed successfully');

            res.json({ 
                message: 'Video downloaded and split successfully',
                title: videoTitle
            });

        } catch (error) {
            console.error('Error during download or splitting:', error);
            res.status(500).json({ 
                error: 'Failed to process YouTube video',
                details: error.message
            });
        }

    } catch (error) {
        console.error('Top level error:', error);
        res.status(500).json({ 
            error: 'Failed to process YouTube video',
            details: error.message
        });
    }
});

async function getTranscript(videoId) {
    try {
        // Use YouTube transcript API
        const transcriptUrl = `https://www.youtube.com/watch?v=${videoId}`;
        const { stdout } = await execPromise(`yt-dlp --skip-download --write-auto-sub --sub-lang en --convert-subs srt "${transcriptUrl}" -o "temp_${videoId}"`);
        
        // Read transcript file
        const transcriptPath = `temp_${videoId}.en.srt`;
        if (!fs.existsSync(transcriptPath)) {
            console.log('No transcript found, trying other languages...');
            // Try other languages
            const languages = ['en', 'tr', 'auto'];
            for (const lang of languages) {
                try {
                    await execPromise(`yt-dlp --skip-download --write-auto-sub --sub-lang ${lang} --convert-subs srt "${transcriptUrl}" -o "temp_${videoId}"`);
                    if (fs.existsSync(`temp_${videoId}.${lang}.srt`)) {
                        console.log(`Found transcript in ${lang}`);
                        return parseSRT(`temp_${videoId}.${lang}.srt`);
                    }
                } catch (err) {
                    console.log(`No transcript found in ${lang}`);
                }
            }
            return [];
        }
        
        const segments = parseSRT(transcriptPath);
        
        // Delete temporary file
        try {
            fs.unlinkSync(transcriptPath);
        } catch (err) {
            console.error('Error deleting temporary file:', err);
        }
        
        return segments;
    } catch (error) {
        console.error('Error getting transcript:', error);
        return [];
    }
}

function parseSRT(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const segments = [];
    const blocks = content.split('\n\n');
    
    for (const block of blocks) {
        if (!block.trim()) continue;
        
        const lines = block.split('\n');
        if (lines.length < 3) continue;
        
        const timeLine = lines[1];
        const [startTime] = timeLine.split(' --> ')[0].split(',');
        const [hours, minutes, seconds] = startTime.split(':').map(Number);
        const startSeconds = hours * 3600 + minutes * 60 + seconds;
        
        const text = lines.slice(2).join(' ').trim();
        if (text) {
            segments.push({
                start: startSeconds,
                text: text
            });
        }
    }
    
    return segments;
}

/* Video processing and splitting */
async function splitVideoIntoClips(videoPath, transcript = [], customDuration = process.env.DEFAULT_CLIP_DURATION || 20) {
    const outputDir = path.join(__dirname, process.env.CLIPS_DIR || 'clips');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir);
    }

    try {
        const metadata = await new Promise((resolve, reject) => {
            ffmpeg.ffprobe(videoPath, (err, data) => {
                if (err) reject(err);
                else resolve(data);
            });
        });

        const duration = metadata.format.duration;
        console.log(`Video Duration: ${duration} seconds`);

        // If transcript exists, use it for YouTube videos
        if (transcript && transcript.length > 0) {
            let currentTime = 0;
            let sentenceCount = 0;
            let currentClipSegments = [];
            const breakPoints = [];

            for (const segment of transcript) {
                if (sentenceCount >= 2 && segment.start - currentTime >= 15 && segment.start - currentTime <= 25) {
                    breakPoints.push({
                        time: segment.start,
                        segments: [...currentClipSegments]
                    });
                    currentTime = segment.start;
                    sentenceCount = 0;
                    currentClipSegments = [];
                }
                currentClipSegments.push(segment);
                sentenceCount++;
            }

            if (currentTime < duration) {
                breakPoints.push({
                    time: duration,
                    segments: currentClipSegments
                });
            }

            // Process YouTube video clips
            for (let i = 0; i < breakPoints.length; i++) {
                const startTime = i === 0 ? 0 : breakPoints[i - 1].time;
                const endTime = breakPoints[i].time;
                const clipDuration = endTime - startTime;

                if (clipDuration < 5) continue;

                const clipId = uuidv4();
                const outputPath = path.join(outputDir, `${clipId}.mp4`);
                const vttPath = path.join(outputDir, `${clipId}.vtt`);

                await new Promise((resolve, reject) => {
                    ffmpeg(videoPath)
                        .setStartTime(startTime)
                        .setDuration(clipDuration)
                        .output(outputPath)
                        .on('end', resolve)
                        .on('error', reject)
                        .run();
                });

                if (breakPoints[i].segments && breakPoints[i].segments.length > 0) {
                    createVTTFile(breakPoints[i].segments, startTime, clipDuration, vttPath);
                }
            }
        } else {
            // For user uploaded videos, split into fixed duration clips
            const totalClips = Math.ceil(duration / customDuration);
            console.log(`Splitting into ${totalClips} clips of ${customDuration} seconds each`);

            const maxParallel = process.env.MAX_PARALLEL_PROCESSES || 3;
            let running = [];
            for (let i = 0; i < totalClips; i++) {
                const startTime = i * customDuration;
                const endTime = Math.min((i + 1) * customDuration, duration);
                const clipDuration = endTime - startTime;

                if (clipDuration < (process.env.MIN_CLIP_DURATION || 5)) continue;

                const clipId = uuidv4();
                const outputPath = path.join(outputDir, `${clipId}.mp4`);

                const p = new Promise((resolve, reject) => {
                    ffmpeg(videoPath)
                        .setStartTime(startTime)
                        .setDuration(clipDuration)
                        .output(outputPath)
                        .on('end', () => {
                            console.log(`Clip ${i + 1} created (${startTime}s to ${endTime}s)`);
                            resolve();
                        })
                        .on('error', reject)
                        .run();
                });

                running.push(p);

                if (running.length >= maxParallel) {
                    await Promise.race(running);
                    // Remove resolved promises
                    running = running.filter(pr => pr.isPending && !pr.isFulfilled);
                }
            }
            await Promise.all(running);
        }
    } catch (error) {
        console.error('Error processing video:', error);
        throw error;
    }
}

function createVTTFile(segments, offset, clipDuration, vttPath) {
    let vtt = 'WEBVTT\n\n';
    for (let i = 0; i < segments.length; i++) {
        const start = Math.max(0, segments[i].start - offset);
        const end = (i < segments.length - 1)
            ? Math.max(0, segments[i + 1].start - offset)
            : clipDuration !== undefined ? clipDuration : start + 5;
        if (end > start) {
            vtt += `${formatTime(start)} --> ${formatTime(end)}\n${segments[i].text}\n\n`;
        }
    }
    fs.writeFileSync(vttPath, vtt);
}

function formatTime(seconds) {
    const date = new Date(seconds * 1000);
    const hh = date.getUTCHours().toString().padStart(2, '0');
    const mm = date.getUTCMinutes().toString().padStart(2, '0');
    const ss = date.getUTCSeconds().toString().padStart(2, '0');
    const ms = date.getUTCMilliseconds().toString().padStart(3, '0');
    return `${hh}:${mm}:${ss}.${ms}`;
}

// Get all clips
app.get('/api/clips', (req, res) => {
    const clipsDir = path.join(__dirname, 'clips');
    fs.readdir(clipsDir, (err, files) => {
        if (err) {
            console.error('Error reading clips directory:', err);
            return res.status(500).json({ error: 'Error reading clips directory' });
        }
        
        const clips = files
            .filter(file => file.endsWith('.mp4'))
            .map(filename => ({
                filename,
                title: filename.replace('.mp4', '').replace(/_/g, ' ')
            }));
            
        res.json(clips);
    });
});

app.get('/api/clips/:id/download', (req,res) => {
    const clipPath = path.join(__dirname, 'clips', `${req.params.id}.mp4`);
    res.download(clipPath);
});

// YouTube video info endpoint
app.get('/api/youtube/info/:videoId', async (req, res) => {
    try {
        const { videoId } = req.params;
        console.log('Fetching video info for ID:', videoId);

        const url = `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&key=${YOUTUBE_API_KEY}&part=snippet,contentDetails`;
        const response = await fetch(url);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(`YouTube API error: ${data.error?.message || 'Unknown error'}`);
        }

        if (!data.items || data.items.length === 0) {
            return res.status(404).json({ error: 'Video not found' });
        }

        const video = data.items[0];
        res.json({
            title: video.snippet.title,
            thumbnail: video.snippet.thumbnails.high.url,
            duration: video.contentDetails.duration
        });

    } catch (error) {
        console.error('Error fetching video info:', error);
        res.status(500).json({ error: 'Failed to fetch video information' });
    }
});


