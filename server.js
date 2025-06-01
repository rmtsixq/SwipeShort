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
const { HfInference } = require('@huggingface/inference');
require('dotenv').config();

// HuggingFace API setup
const HUGGINGFACE_API_KEY = process.env.HUGGINGFACE_API_KEY;
const MODEL_ID = "deepseek-ai/DeepSeek-V3-0324";
const PROVIDER = "novita";

// Initialize HuggingFace client
const hf = new HfInference(HUGGINGFACE_API_KEY);

// Chat history to maintain context
const chatHistories = new Map();

// Get AI response using HuggingFace API
async function getAIResponse(message, userId) {
    try {
        // Initialize chat history for new users
        if (!chatHistories.has(userId)) {
            chatHistories.set(userId, []);
        }
        
        // Get user's chat history
        const history = chatHistories.get(userId);
        
        // System prompt to train AI for movie recommendations (ENGLISH)
        const systemPrompt = {
            role: "system",
            content: `You are a movie recommendation assistant. Your job is to help users find movies. Please follow these rules:
            1. Try to understand the user's tastes and preferences
            2. Provide information about genres, actors, directors, and years
            3. Suggest similar movies
            4. Share IMDB ratings and summaries
            5. Always respond in English
            6. Ask questions to make better recommendations
            7. Include popular and recent movies in your suggestions
            8. Suggest age-appropriate movies
            9. Inform where the movies can be watched
            10. Suggest movies suitable for the user's mood.
            11. Always include IMDB IDs (tt format) for movies you mention.`
        };
        
        // Format messages in the required format
        const messages = [
            systemPrompt,
            ...history.map(msg => ({
                role: msg.startsWith("User:") ? "user" : "assistant",
                content: msg.replace(/^(User:|Assistant:)\s*/, "")
            })),
            { role: "user", content: message }
        ];
        
        // Call HuggingFace API using chatCompletion with optimized parameters
        const result = await hf.chatCompletion({
            provider: PROVIDER,
            model: MODEL_ID,
            messages: messages,
            parameters: {
                max_new_tokens: 150, // Reduced from 250
                temperature: 0.7,    // Reduced from 0.8
                top_p: 0.8,         // Reduced from 0.9
                repetition_penalty: 1.1, // Reduced from 1.2
                do_sample: true,
                return_full_text: false // Don't return the full context
            }
        });
        
        // Get the generated text
        const aiResponse = result.choices[0].message.content.trim();
        
        // Add messages to history
        history.push(`User: ${message}`);
        history.push(`Assistant: ${aiResponse}`);
        
        // Keep only last 3 message pairs (reduced from 5)
        if (history.length > 6) {
            history.splice(0, 2);
        }
        
        return aiResponse;
    } catch (error) {
        console.error("Error getting AI response:", error);
        return "Sorry, I'm having trouble processing your request. Please try again later.";
    }
}

const app = express();
const PORT = process.env.PORT || 8080;
const upload = multer({ dest: process.env.UPLOAD_DIR || 'uploads/' });

// Serve static files from public directory
app.use(express.static('public'));

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

// TV sayfası
app.get('/tv', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'tv.html'));
});

// Cloudnestra embed URL'sini almak için yeni endpoint
app.get('/api/get-cloudnestra-embed', async (req, res) => {
    const { movieId, tvId, season, episode } = req.query;
    console.log('\n=== Cloudnestra Embed Fetching Started ===');
    if (movieId) {
    console.log('Movie ID:', movieId);
    } else if (tvId && season && episode) {
        console.log('TV ID:', tvId, 'Season:', season, 'Episode:', episode);
    } else {
        return res.status(400).json({ error: 'Movie ID or TV ID/Season/Episode is required' });
    }

    try {
        let vidsrcApiUrl;
        if (movieId) {
            vidsrcApiUrl = `https://vidsrc.xyz/embed/movie/${movieId}`;
        } else {
            vidsrcApiUrl = `https://vidsrc.xyz/embed/tv/${tvId}/${season}/${episode}`;
        }
        console.log('Fetching from vidsrc API:', vidsrcApiUrl);

        const response = await fetch(vidsrcApiUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive',
                'Referer': 'https://vidsrc.xyz/',
                'Origin': 'https://vidsrc.xyz',
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'same-origin',
                'Sec-Fetch-User': '?1',
                'Upgrade-Insecure-Requests': '1',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
            },
            timeout: 10000
        });

        if (response.status === 403) {
            throw new Error('Cloudflare protection detected');
        }
        if (response.status === 429) {
            throw new Error('Rate limit exceeded');
        }
        if (!response.ok) {
            throw new Error(`Vidsrc API error: ${response.status}`);
        }

        const html = await response.text();
        console.log('Vidsrc response received');
        console.log('Response length:', html.length);

        if (html.includes('cf-browser-verification') || html.includes('challenge-platform')) {
            throw new Error('Cloudflare verification page detected');
        }

        const iframeMatches = html.match(/<iframe[^>]*src="([^"]*)"[^>]*>/g);
        console.log('Found iframes:', iframeMatches);

        let embedUrl = null;
        let source = null;
        if (iframeMatches) {
            for (const iframe of iframeMatches) {
                const srcMatch = iframe.match(/src="([^"]*)"/);
                if (srcMatch) {
                    const src = srcMatch[1];
                    console.log('Found iframe src:', src);
                    if (src.includes('cloudnestra')) {
                        embedUrl = src;
                        source = 'cloudnestra';
                        break;
                    } else if (src.includes('vidplay')) {
                        embedUrl = src;
                        source = 'vidplay';
                    } else if (src.includes('upcloud')) {
                        embedUrl = src;
                        source = 'upcloud';
                    }
                }
            }
        }
        if (!embedUrl) {
            const cloudnestraMatch = html.match(/https:\/\/[^"']*cloudnestra[^"']*/);
            const vidplayMatch = html.match(/https:\/\/[^"']*vidplay[^"']*/);
            const upcloudMatch = html.match(/https:\/\/[^"']*upcloud[^"']*/);
            if (cloudnestraMatch) {
                embedUrl = cloudnestraMatch[0];
                source = 'cloudnestra';
            } else if (vidplayMatch) {
                embedUrl = vidplayMatch[0];
                source = 'vidplay';
            } else if (upcloudMatch) {
                embedUrl = upcloudMatch[0];
                source = 'upcloud';
            }
        }
        if (embedUrl) {
            console.log('Found embed URL:', embedUrl);
            res.json({ 
                cloudnestraEmbedUrl: embedUrl,
                source: source
            });
        } else {
            console.log('No video source found in HTML content');
            throw new Error('No video source found in the response');
        }
    } catch (error) {
        console.error('Error during embed URL fetching:', error);
        let errorMessage = 'An error occurred while fetching the embed URL.';
        let statusCode = 500;
        if (error.message.includes('Cloudflare')) {
            errorMessage = 'Cloudflare protection detected. Please try again later.';
            statusCode = 403;
        } else if (error.message.includes('Rate limit')) {
            errorMessage = 'Too many requests. Please try again later.';
            statusCode = 429;
        } else if (error.message.includes('timeout')) {
            errorMessage = 'Request timed out. Please try again.';
            statusCode = 504;
        }
        res.status(statusCode).json({ 
            error: errorMessage,
            details: error.message
        });
    }
});

// TMDB Movie Search endpoint
app.get('/api/search-movie', async (req, res) => {
    const query = req.query.query;
    const apiKey = process.env.TMDB_API_KEY || 'fda9bed2dd52a349ecb7cfe38b050ca5';
    if (!query) {
        return res.status(400).json({ error: 'Query parameter is required' });
    }
    try {
        const tmdbUrl = `https://api.themoviedb.org/3/search/movie?api_key=${apiKey}&language=en-US&query=${encodeURIComponent(query)}`;
        const response = await fetch(tmdbUrl);
        const data = await response.json();
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch movies', details: err.message });
    }
});

// TMDB TV Search endpoint
app.get('/api/search-tv', async (req, res) => {
    const query = req.query.query;
    const apiKey = process.env.TMDB_API_KEY || 'fda9bed2dd52a349ecb7cfe38b050ca5';
    if (!query) {
        return res.status(400).json({ error: 'Query parameter is required' });
    }
    try {
        const tmdbUrl = `https://api.themoviedb.org/3/search/tv?api_key=${apiKey}&language=en-US&query=${encodeURIComponent(query)}`;
        const response = await fetch(tmdbUrl);
        const data = await response.json();
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch TV shows', details: err.message });
    }
});

// Function to extract IMDB IDs from AI response
function extractIMDBIds(text) {
    // Regular expression to match IMDB IDs (tt followed by 7-8 digits)
    const imdbRegex = /tt\d{7,8}/g;
    const matches = text.match(imdbRegex);
    return matches ? [...new Set(matches)] : []; // Remove duplicates
}

// Chat endpoint
app.post('/api/chat', async (req, res) => {
    try {
        const { message } = req.body;
        
        if (!message) {
            return res.status(400).json({ error: 'Message is required' });
        }

        // Generate a unique user ID if not provided
        const userId = req.headers['x-user-id'] || Date.now().toString();

        // Get AI response
        const response = await getAIResponse(message, userId);
        
        // Extract IMDB IDs from the response
        const imdbIds = extractIMDBIds(response);
        console.log('Extracted IMDB IDs:', imdbIds); // Debug log

        // Fetch movie details from TMDB for each IMDB ID
        const apiKey = process.env.TMDB_API_KEY || 'fda9bed2dd52a349ecb7cfe38b050ca5';
        const movieDetails = await Promise.all(
            imdbIds.map(async (imdbId) => {
                try {
                    console.log(`Fetching details for IMDB ID: ${imdbId}`); // Debug log
                    // First, find the TMDB ID using the IMDB ID
                    const findUrl = `https://api.themoviedb.org/3/find/${imdbId}?api_key=${apiKey}&language=en-US&external_source=imdb_id`;
                    const findResponse = await fetch(findUrl);
                    const findData = await findResponse.json();

                    // Check if it's a movie or TV show
                    let mediaType = 'movie';
                    let tmdbId = null;
                    let detailsData = null;

                    if (findData.movie_results && findData.movie_results.length > 0) {
                        tmdbId = findData.movie_results[0].id;
                        mediaType = 'movie';
                        console.log(`Found movie with TMDB ID: ${tmdbId}`); // Debug log
                    } else if (findData.tv_results && findData.tv_results.length > 0) {
                        tmdbId = findData.tv_results[0].id;
                        mediaType = 'tv';
                        console.log(`Found TV show with TMDB ID: ${tmdbId}`); // Debug log
                    }

                    if (tmdbId) {
                        // Get the details based on media type
                        const detailsUrl = `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${apiKey}&language=en-US`;
                        const detailsResponse = await fetch(detailsUrl);
                        detailsData = await detailsResponse.json();

                        const result = {
                            imdbId,
                            title: detailsData.title || detailsData.name,
                            posterPath: detailsData.poster_path,
                            overview: detailsData.overview,
                            releaseDate: detailsData.release_date || detailsData.first_air_date,
                            mediaType: mediaType
                        };
                        console.log('Returning details:', result); // Debug log
                        return result;
                    }
                    return null;
                } catch (error) {
                    console.error(`Error fetching details for IMDB ID ${imdbId}:`, error);
                    return null;
                }
            })
        );

        // Filter out any null results
        const validMovieDetails = movieDetails.filter(details => details !== null);
        console.log('Valid movie details:', validMovieDetails); // Debug log

        res.json({
            response,
            imdbIds,
            movieDetails: validMovieDetails
        });
    } catch (error) {
        console.error('Chat endpoint error:', error);
        res.status(500).json({ 
            error: 'Internal server error',
            response: 'Sorry, I am having trouble right now. Please try again later.'
        });
    }
});