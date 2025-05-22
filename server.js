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
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8080;
const upload = multer({ dest: process.env.UPLOAD_DIR || 'uploads/' });

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

// CORS header ekle (güvenli test için)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  next();
});

// CORS middleware
app.use(cors());

// Start server
app.listen(PORT, () => {
    console.log(`Web server running on http://localhost:${PORT}`);
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
    } catch (error) {
        console.error('Error processing video:', error);
        throw error;
    }
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

// Film listesi proxy endpointi
app.get('/api/movies', async (req, res) => {
  try {
    const response = await fetch('https://vidsrc.to/vapi/movie/new');
    const data = await response.json();
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch movies' });
  }
});

// Proxy endpoint for m3u8 streams
app.get('/proxy/stream', async (req, res) => {
    const streamUrl = req.query.url;
    console.log('Proxy request for:', streamUrl);

    if (!streamUrl || !/^https?:\/\//.test(streamUrl)) {
        console.error('Proxy Error: Invalid stream URL format', streamUrl);
        return res.status(400).json({ error: 'Stream URL must be absolute (http/https)' });
    }

    try {
        // Determine if the request is for an M3U8 playlist or a segment
        const isPlaylist = streamUrl.toLowerCase().endsWith('.m3u8');
        console.log('Is playlist request:', isPlaylist);

        const fetchOptions = {
            headers: {
                'Accept': isPlaylist ? 'application/x-mpegURL,application/vnd.apple.mpegurl,*/*' : '*/*',
                'Accept-Language': 'en-US,en;q=0.9',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
                // Potentially add Referer based on the original URL, but let's test without first
                // 'Referer': new URL(streamUrl).origin // Or maybe the base path of the original m3u8 URL?
            }
        };

        console.log('Fetching from original URL:', streamUrl);
        const response = await fetch(streamUrl, fetchOptions);

        if (!response.ok) {
            console.error('Proxy Error: Stream fetch failed', response.status, response.statusText, streamUrl);
            // Fetch sırasında hata olursa, stream sunucusunun döndürdüğü durumu ve hata mesajını döndürelim
            // Ancak 403 Forbidden gibi durumlarda detayları stream sunucusu vermeyebilir.
            // Stream sunucusunun yanıtındaki başlıkları da aktaralım.
            const headers = Object.fromEntries(response.headers.entries());
            return res.status(response.status).json({
                error: `Failed to fetch stream from source (${response.status})`,
                details: response.statusText,
                url: streamUrl,
                headers: headers // Add response headers for debugging
            });
        }

        // Copy original headers to the response, except for CORS-related ones and content-length for playlist
        response.headers.forEach((value, name) => {
            if (!['access-control-allow-origin', 'access-control-allow-methods', 'access-control-allow-headers', 'access-control-expose-headers', 'content-length', 'content-encoding'].includes(name.toLowerCase())) {
                res.setHeader(name, value);
            }
        });

        // Always allow CORS for our frontend
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Range, Origin, Referer'); // Allow relevant headers
        res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range');

        // Handle OPTIONS request for CORS preflight
        if (req.method === 'OPTIONS') {
             console.log('Received OPTIONS request, sending 200 OK');
             return res.status(200).end();
        }

        if (isPlaylist) {
            console.log('Processing M3U8 playlist...');
            const playlistContent = await response.text();
            const lines = playlistContent.split('\n');
            const baseUrl = streamUrl.substring(0, streamUrl.lastIndexOf('/') + 1);

            const processedLines = lines.map(line => {
                // Check if the line is a URL (doesn't start with #) and is relative
                if (line && !line.startsWith('#') && !line.startsWith('http://') && !line.startsWith('https://') && !line.startsWith('/')) {
                    // Resolve relative URL using the base URL of the playlist
                    const absoluteUrl = baseUrl + line;
                    console.log(`Resolved relative URL: ${line} -> ${absoluteUrl}`);
                    // Replace the line with a proxied URL for the segment
                    return `/proxy/stream?url=${encodeURIComponent(absoluteUrl)}`;
                } else if (line && !line.startsWith('#') && line.startsWith('/')) {
                     // Handle root-relative URLs as well
                    const origin = new URL(streamUrl).origin;
                    const absoluteUrl = origin + line;
                     console.log(`Resolved root-relative URL: ${line} -> ${absoluteUrl}`);
                     return `/proxy/stream?url=${encodeURIComponent(absoluteUrl)}`;
                }
                 else if (line && !line.startsWith('#') && (line.startsWith('http://') || line.startsWith('https://'))) {
                    // If it's already an absolute URL in the playlist, proxy it too.
                     console.log(`Found absolute URL in playlist: ${line}`);
                     return `/proxy/stream?url=${encodeURIComponent(line)}`;
                }
                return line; // Keep comment lines and other directives as is
            });

            const processedPlaylist = processedLines.join('\n');
            console.log('Processed Playlist Sample:', processedPlaylist.substring(0, 500)); // Log first 500 chars

            // Set appropriate Content-Type for HLS playlist
            res.setHeader('Content-Type', 'application/x-mpegURL'); // Standard HLS content type
            // res.setHeader('Content-Length', Buffer.byteLength(processedPlaylist)); // Let the browser determine length
            res.status(200).send(processedPlaylist);

        } else {
            console.log('Piping stream segment...');
            // If it's a segment or other file, just pipe the response body
            // Handle range requests if necessary, though fetch might handle it automatically with piping
            response.body.pipe(res);
        }

    } catch (error) {
        console.error('Proxy Error: Exception during proxying', error);
        if (!res.headersSent) {
            res.status(500).json({ 
                error: 'Failed to proxy stream due to internal error', 
                details: error.message,
                url: streamUrl,
                stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
            });
        }
    }
});

// Ana sayfa
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Dashboard sayfası
app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// Film sayfası
app.get('/movie', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'movie.html'));
});