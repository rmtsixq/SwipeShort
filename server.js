const express = require('express');
const multer = require('multer');
const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');
const fetch = require('node-fetch');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const speech = require('@google-cloud/speech');

const app = express();
const PORT = process.env.PORT || 3000;
const upload = multer({ dest: 'uploads/' });

// YouTube API Key
const YOUTUBE_API_KEY = 'AIzaSyBYF0aszjzogOaArdiRB3RMfewydWa9UKQ';

// Check and create directories
const uploadsDir = path.join(__dirname, 'uploads');
const clipsDir = path.join(__dirname, 'clips');

if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
}
if (!fs.existsSync(clipsDir)) {
    fs.mkdirSync(clipsDir);
}

// Middleware
app.use(express.static('public')); // for serving static files (html, css, js)
app.use('/clips', express.static('clips')); // for serving video clips
app.use(express.json());

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

app.post('/upload', upload.single('video'), (req, res) => {
    if (!req.file) {
        return res.status(400).send('No file uploaded.');
    }

    console.log('Uploaded File:', req.file);

    const videoPath = path.join(__dirname, req.file.path);
    splitVideoIntoClips(videoPath)
        .then(() => {
            res.send('Video uploaded and split successfully!');
        })
        .catch(err => {
            console.error('Error while splitting:', err);
            res.status(500).send('Error processing video.');
        });
});

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

async function splitVideoIntoClips(videoPath, transcript) {
    const outputDir = path.join(__dirname, 'clips');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir);
    }

    try {
        // Get video duration
        const metadata = await new Promise((resolve, reject) => {
            ffmpeg.ffprobe(videoPath, (err, data) => {
                if (err) reject(err);
                else resolve(data);
            });
        });

        const duration = metadata.format.duration;
        console.log(`Video Duration: ${duration} seconds`);

        // Determine break points using transcript segments
        const breakPoints = [];
        let currentTime = 0;
        let sentenceCount = 0;

        for (const segment of transcript) {
            // Add break point every 2-3 sentences
            if (sentenceCount >= 2 && segment.start - currentTime >= 15 && segment.start - currentTime <= 25) {
                breakPoints.push(segment.start);
                currentTime = segment.start;
                sentenceCount = 0;
            }
            sentenceCount++;
        }

        console.log('Break points:', breakPoints);

        // If no break points found, split into 20-second clips
        if (breakPoints.length === 0) {
            console.log('No break points found, splitting into 20-second clips');
            const totalClips = Math.ceil(duration / 20);
            for (let i = 0; i < totalClips; i++) {
                const startTime = i * 20;
                const endTime = Math.min((i + 1) * 20, duration);
                const outputPath = path.join(outputDir, `clip_${i + 1}.mp4`);

                await new Promise((resolve, reject) => {
                    ffmpeg(videoPath)
                        .setStartTime(startTime)
                        .setDuration(endTime - startTime)
                        .output(outputPath)
                        .on('end', () => {
                            console.log(`Clip ${i + 1} created (${startTime}s to ${endTime}s)`);
                            resolve();
                        })
                        .on('error', reject)
                        .run();
                });
            }
            return;
        }

        // Split video at break points
        let clipNumber = 1;
        for (let i = 0; i < breakPoints.length; i++) {
            const startTime = i === 0 ? 0 : breakPoints[i - 1];
            const endTime = breakPoints[i];
            const outputPath = path.join(outputDir, `clip_${clipNumber}.mp4`);

            await new Promise((resolve, reject) => {
                ffmpeg(videoPath)
                    .setStartTime(startTime)
                    .setDuration(endTime - startTime)
                    .output(outputPath)
                    .on('end', () => {
                        console.log(`Clip ${clipNumber} created (${startTime}s to ${endTime}s)`);
                        clipNumber++;
                        resolve();
                    })
                    .on('error', reject)
                    .run();
            });
        }

        // Process final clip
        if (breakPoints.length > 0 && breakPoints[breakPoints.length - 1] < duration) {
            const startTime = breakPoints[breakPoints.length - 1];
            const outputPath = path.join(outputDir, `clip_${clipNumber}.mp4`);

            await new Promise((resolve, reject) => {
                ffmpeg(videoPath)
                    .setStartTime(startTime)
                    .setDuration(duration - startTime)
                    .output(outputPath)
                    .on('end', () => {
                        console.log(`Final clip ${clipNumber} created (${startTime}s to ${duration}s)`);
                        resolve();
                    })
                    .on('error', reject)
                    .run();
            });
        }

    } catch (error) {
        console.error('Error in splitVideoIntoClips:', error);
        throw error;
    }
}

app.get('/api/clips', async (req, res) => {
    const clipsDir = path.join(__dirname, 'clips');
    try {
        const files = await fs.promises.readdir(clipsDir);
        const clips = await Promise.all(
            files
                .filter(file => file.endsWith('.mp4'))
                .map(async file => {
                    const filePath = path.join(clipsDir, file);
                    const duration = await new Promise((resolve, reject) => {
                        ffmpeg.ffprobe(filePath, (err, metadata) => {
                            if (err) {
                                console.error(`Error getting duration for ${file}:`, err);
                                resolve(0);
                            } else {
                                resolve(Math.round(metadata.format.duration));
                            }
                        });
                    });
                    return {
                        id: file.replace('.mp4', ''),
                        filename: file,
                        title: `Clip ${file.replace('.mp4', '')}`,
                        duration: duration
                    };
                })
        );
        res.json(clips);
    } catch (err) {
        console.error('Error reading clips directory:', err);
        res.status(500).json({ error: 'Failed to read clips directory' });
    }
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

async function findNaturalBreakPoints(videoPath) {
    const client = new speech.SpeechClient();
    const audioPath = path.join(__dirname, 'temp_audio.flac');
    
    // Extract audio from video
    await new Promise((resolve, reject) => {
        ffmpeg(videoPath)
            .toFormat('flac')
            .output(audioPath)
            .on('end', resolve)
            .on('error', reject)
            .run();
    });

    // Read audio file
    const audioBytes = fs.readFileSync(audioPath).toString('base64');

    // Configure request
    const request = {
        audio: {
            content: audioBytes,
        },
        config: {
            encoding: 'FLAC',
            sampleRateHertz: 16000,
            languageCode: 'en-US',
            enableWordTimeOffsets: true,
        },
    };

    // Perform speech recognition
    const [response] = await client.recognize(request);
    const words = response.results
        .map(result => result.alternatives[0].words)
        .flat();

    // Find natural break points (pauses between sentences)
    const breakPoints = [];
    let currentTime = 0;
    let lastWordEnd = 0;

    for (let i = 0; i < words.length; i++) {
        const word = words[i];
        const wordStart = word.startTime.seconds + word.startTime.nanos / 1e9;
        const wordEnd = word.endTime.seconds + word.endTime.nanos / 1e9;

        // If there's a significant pause (more than 0.5 seconds) between words
        if (wordStart - lastWordEnd > 0.5) {
            // If we're close to our target duration (20 seconds)
            if (wordStart - currentTime >= 15 && wordStart - currentTime <= 25) {
                breakPoints.push(wordStart);
                currentTime = wordStart;
            }
        }
        lastWordEnd = wordEnd;
    }

    // Clean up temporary audio file
    fs.unlinkSync(audioPath);

    return breakPoints;
}


