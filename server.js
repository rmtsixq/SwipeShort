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
            content: `You are a movie and TV show recommendation assistant. Your job is to help users find movies and TV shows. Please follow these rules:
            1. Try to understand the user's tastes and preferences
            2. Provide information about genres, actors, directors, and years
            3. Suggest similar movies and TV shows
            4. Share IMDB ratings and summaries
            5. Always respond in English
            6. Ask questions to make better recommendations
            7. Include popular and recent movies and TV shows in your suggestions
            8. Suggest age-appropriate content
            9. Inform where the content can be watched
            10. Suggest content suitable for the user's mood.
            11. For movies, include IMDB IDs (tt format)
            12. For TV shows, include TMDB IDs in this format: [TMDB:ID] (e.g., [TMDB:1396] for Breaking Bad)
            13. Always mention if it's a movie or TV show in your response.`
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

// Video stream proxy - Cloudnestra videolarını doğrudan stream et
app.get('/api/video-stream', async (req, res) => {
    const { url } = req.query;
    
    if (!url) {
        return res.status(400).json({ error: 'URL parameter is required' });
    }
    
    try {
        console.log('Streaming video from:', url);
        
        // Range request desteği için
        const range = req.headers.range;
        
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Accept': '*/*',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive',
                'Referer': 'https://cloudnestra.com/',
                'Origin': 'https://cloudnestra.com',
                'Range': range || undefined
            },
            timeout: 30000
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        // Video content type'ını al
        const contentType = response.headers.get('content-type') || 'video/mp4';
        const contentLength = response.headers.get('content-length');
        const acceptRanges = response.headers.get('accept-ranges');
        
        // CORS ve video headers ekle
        res.set({
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
            'Access-Control-Allow-Headers': 'Range, Origin, X-Requested-With, Content-Type, Accept, Authorization',
            'Content-Type': contentType,
            'Accept-Ranges': acceptRanges || 'bytes',
            'Cache-Control': 'public, max-age=3600',
            'X-Content-Type-Options': 'nosniff'
        });
        
        // Range request varsa content-length ekle
        if (range && contentLength) {
            res.set('Content-Length', contentLength);
        }
        
        // Video stream'i pipe et
        response.body.pipe(res);
        
    } catch (error) {
        console.error('Video stream error:', error);
        res.status(500).json({ 
            error: 'Video stream error', 
            details: error.message 
        });
    }
});

// Video iframe proxy - HTML iframe içeriğini proxy olarak döndür (fallback için)
app.get('/api/iframe-proxy', async (req, res) => {
    const { url } = req.query;
    
    if (!url) {
        return res.status(400).json({ error: 'URL parameter is required' });
    }
    
            try {
            console.log('Proxying iframe URL:', url);
            
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'Connection': 'keep-alive',
                    'Referer': 'https://cloudnestra.com/',
                    'Origin': 'https://cloudnestra.com',
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache'
                },
                timeout: 15000
            });
        
        if (!response.ok) {
            console.log(`HTTP Error: ${response.status} - ${response.statusText}`);
            
            if (response.status === 404) {
                throw new Error('Cloudnestra embed URL expired (404). This usually means the URL has expired and needs to be refreshed.');
            } else if (response.status === 403) {
                throw new Error('Cloudnestra access denied (403). The embed URL may have expired or been blocked.');
            } else {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
        }
        
        let html = await response.text();
        console.log(`Received HTML length: ${html.length} characters`);
        
        // Relative URL'leri absolute yap ve localhost referanslarını düzelt
        if (html.includes('src="//')) {
            html = html.replace(/src="\/\//g, 'src="https://');
            console.log('Fixed relative URLs');
        }
        
        // Cloudnestra'nın localhost referanslarını tamamen düzelt
        const localhostMatches = html.match(/localhost:\d+/g);
        if (localhostMatches) {
            console.log(`Found ${localhostMatches.length} localhost references, fixing...`);
            html = html.replace(/http:\/\/localhost:\d+/g, 'https://cloudnestra.com');
            html = html.replace(/localhost:\d+/g, 'cloudnestra.com');
        }
        
        // Daha kapsamlı localhost referans düzeltmesi
        html = html.replace(/['"]http:\/\/localhost:\d+['"]/g, '"https://cloudnestra.com"');
        html = html.replace(/['"]localhost:\d+['"]/g, '"cloudnestra.com"');
        
        // CSS ve JS dosya yollarını düzelt
        html = html.replace(/href=["']http:\/\/localhost:\d+\//g, 'href="https://cloudnestra.com/');
        html = html.replace(/src=["']http:\/\/localhost:\d+\//g, 'src="https://cloudnestra.com/');
        
        // Relative path'leri de düzelt
        html = html.replace(/href=["']\//g, 'href="https://cloudnestra.com/');
        html = html.replace(/src=["']\//g, 'src="https://cloudnestra.com/');
        
        // Tüm localhost referanslarını yakala ve düzelt
        const allLocalhostRefs = html.match(/localhost[^"'\s>]*/g);
        if (allLocalhostRefs) {
            console.log(`Found additional localhost references:`, allLocalhostRefs);
            html = html.replace(/localhost[^"'\s>]*/g, 'cloudnestra.com');
        }
        
        // CSS ve JS dosya yollarını özel olarak düzelt
        html = html.replace(/style_rcp-[^"']*\.css/g, 'style_rcp.css');
        html = html.replace(/base64\.js/g, 'base64.js');
        html = html.replace(/sbx\.js/g, 'sbx.js');
        
        // FontAwesome ve diğer CDN referanslarını düzelt
        html = html.replace(/https:\/\/cloudnestra\.com\/\/cdnjs\.cloudflare\.com/g, 'https://cdnjs.cloudflare.com');
        html = html.replace(/https:\/\/cloudnestra\.com\/\/fonts\.googleapis\.com/g, 'https://fonts.googleapis.com');
        html = html.replace(/https:\/\/cloudnestra\.com\/\/fonts\.gstatic\.com/g, 'https://fonts.gstatic.com');
        
        // Çift slash'ları düzelt
        html = html.replace(/https:\/\/cloudnestra\.com\/\//g, 'https://cloudnestra.com/');
        
        // Localhost referanslarını tamamen temizle
        html = html.replace(/http:\/\/localhost:\d+/g, 'https://cloudnestra.com');
        html = html.replace(/localhost:\d+/g, 'cloudnestra.com');
        
        // Cloudnestra'nın kendi dosyalarını düzgün yolla
        html = html.replace(/src=["']\/rcp\//g, 'src="https://cloudnestra.com/rcp/');
        html = html.replace(/href=["']\/rcp\//g, 'href="https://cloudnestra.com/rcp/');
        
        // Relative path'leri absolute yap
        html = html.replace(/src=["']\/(?!https?:\/\/)/g, 'src="https://cloudnestra.com/');
        html = html.replace(/href=["']\/(?!https?:\/\/)/g, 'href="https://cloudnestra.com/');
        
        // CSS ve JS dosyalarını düzgün yolla
        html = html.replace(/src=["']([^"']*\.(css|js))["']/g, (match, filename) => {
            if (filename.startsWith('http')) return match;
            if (filename.startsWith('//')) return `src="https:${filename}"`;
            if (filename.startsWith('/')) return `src="https://cloudnestra.com${filename}"`;
            return `src="https://cloudnestra.com/${filename}"`;
        });
        
        html = html.replace(/href=["']([^"']*\.(css|js))["']/g, (match, filename) => {
            if (filename.startsWith('http')) return match;
            if (filename.startsWith('//')) return `href="https:${filename}"`;
            if (filename.startsWith('/')) return `href="https://cloudnestra.com${filename}"`;
            return `href="https://cloudnestra.com/${filename}"`;
        });
        
        // Cloudnestra asset and AJAX calls should go through our proxy to avoid CORS
        // Attribute references to cloudnestra.com -> backend proxy
        html = html.replace(/(src|href)=["']https:\/\/cloudnestra\.com\/([^"']+)["']/g,
            (m, attr, path) => `${attr}="/api/cn-proxy?url=https://cloudnestra.com/${path}"`);
        
        // Attribute references with relative paths -> backend proxy
        html = html.replace(/(src|href)=["']\/(rcp|prorcp|assets|static|player|cdn)\/([^"']+)["']/g,
            (m, attr, seg, rest) => `${attr}="/api/cn-proxy?url=https://cloudnestra.com/${seg}/${rest}"`);
        
        // JS string usages like '/prorcp/...' -> backend proxy
        html = html.replace(/(["'])\/(rcp|prorcp)\/([^"']+)\1/g,
            (m, q, seg, rest) => `${q}/api/cn-proxy?url=https://cloudnestra.com/${seg}/${rest}${q}`);
        
        // Also handle any remaining absolute cloudnestra.com references
        html = html.replace(/(["'])https:\/\/cloudnestra\.com\/([^"']+)\1/g,
            (m, q, path) => `${q}/api/cn-proxy?url=https://cloudnestra.com/${path}${q}`);
        
        console.log('HTML cleanup completed');
        
        // CORS headers ekle
        res.set({
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization, Range',
            'Content-Type': 'text/html',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
        });
        
        console.log('Sending proxied HTML response');
        res.send(html);
        
    } catch (error) {
        console.error('Iframe proxy error:', error);
        res.status(500).json({ 
            error: 'Iframe proxy error', 
            details: error.message 
        });
    }
});

// Add Cloudnestra asset proxy to avoid CORS and wrong origins for secondary requests
app.get('/api/cn-proxy', async (req, res) => {
  try {
    const { url } = req.query;
    if (!url || !/^https?:\/\/cloudnestra\.com\//.test(url)) {
      return res.status(400).json({ error: 'Valid url query required to cloudnestra.com' });
    }

    // Forward headers to mimic browser and correct referer/origin
    const upstreamHeaders = {
      'User-Agent': req.headers['user-agent'] || 'Mozilla/5.0',
      'Accept': req.headers['accept'] || '*/*',
      'Accept-Language': req.headers['accept-language'] || 'en-US,en;q=0.9',
      'Referer': 'https://cloudnestra.com/',
      'Origin': 'https://cloudnestra.com',
      'Connection': 'keep-alive',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache'
    };

    // Range support
    if (req.headers['range']) {
      upstreamHeaders['Range'] = req.headers['range'];
    }

    const upstream = await fetch(url, { headers: upstreamHeaders });

    // Pass through status for range requests
    res.status(upstream.status);

    // Copy headers of interest
    const passHeaders = [
      'content-type','content-length','accept-ranges','content-range','cache-control','pragma','expires'
    ];
    passHeaders.forEach(h => {
      const v = upstream.headers.get(h);
      if (v) res.setHeader(h, v);
    });

    // Ensure JavaScript files have correct MIME type
    if (url.includes('.js') && (!upstream.headers.get('content-type') || upstream.headers.get('content-type').includes('text/html'))) {
      res.setHeader('Content-Type', 'application/javascript');
    }

    // CORS for our frontend
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Range');

    // Stream body
    if (upstream.body) {
      upstream.body.pipe(res);
    } else {
      const text = await upstream.text();
      res.send(text);
    }
  } catch (err) {
    console.error('cn-proxy error:', err);
    res.status(500).json({ error: 'cn-proxy failed', details: err.message });
  }
});

// Add smart embed URL refresh endpoint that handles expired URLs
app.get('/api/smart-embed', async (req, res) => {
  try {
    const { movieId, retryCount = 0 } = req.query;
    if (!movieId) {
      return res.status(400).json({ error: 'Movie ID required' });
    }

    console.log(`=== Smart Embed Fetching Started (Attempt ${retryCount + 1}) ===`);
    console.log(`Movie ID: ${movieId}`);

    // Try to get embed URL
    const embedUrl = await getCloudnestraEmbedUrl(movieId);
    
    if (!embedUrl) {
      throw new Error('Failed to get embed URL from vidsrc');
    }

    // Test if the URL is actually working
    try {
      const testResponse = await fetch(embedUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': 'https://cloudnestra.com/',
          'Origin': 'https://cloudnestra.com'
        },
        timeout: 10000
      });

      if (testResponse.ok) {
        console.log('✅ Embed URL is working, returning to client');
        return res.json({
          cloudnestraEmbedUrl: embedUrl,
          source: 'cloudnestra',
          status: 'fresh',
          retryCount: retryCount
        });
      } else {
        console.log(`❌ Embed URL returned ${testResponse.status}, trying to refresh...`);
        
        // If we've tried too many times, return error
        if (retryCount >= 2) {
          throw new Error(`Embed URL expired after ${retryCount + 1} attempts. Cloudnestra URLs have very short lifespan.`);
        }

        // Try alternative movie IDs (sometimes different IDs work better)
        const alternativeIds = [
          parseInt(movieId) + 1,
          parseInt(movieId) - 1,
          parseInt(movieId) + 100,
          parseInt(movieId) - 100
        ].filter(id => id > 0);

        for (const altId of alternativeIds) {
          console.log(`Trying alternative movie ID: ${altId}`);
          try {
            const altEmbedUrl = await getCloudnestraEmbedUrl(altId.toString());
            if (altEmbedUrl) {
              const altTestResponse = await fetch(altEmbedUrl, {
                headers: {
                  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                  'Referer': 'https://cloudnestra.com/',
                  'Origin': 'https://cloudnestra.com'
                },
                timeout: 10000
              });

              if (altTestResponse.ok) {
                console.log(`✅ Alternative movie ID ${altId} worked!`);
                return res.json({
                  cloudnestraEmbedUrl: altEmbedUrl,
                  source: 'cloudnestra',
                  status: 'alternative',
                  originalMovieId: movieId,
                  workingMovieId: altId,
                  retryCount: retryCount
                });
              }
            }
          } catch (altErr) {
            console.log(`Alternative ID ${altId} failed:`, altErr.message);
          }
        }

        // If alternatives didn't work, try the original again with retry
        console.log('Trying original movie ID again...');
        return res.redirect(`/api/smart-embed?movieId=${movieId}&retryCount=${retryCount + 1}`);
      }
    } catch (testErr) {
      console.error('Error testing embed URL:', testErr);
      
      if (retryCount >= 2) {
        throw new Error(`Failed to get working embed URL after ${retryCount + 1} attempts: ${testErr.message}`);
      }

      // Retry with exponential backoff
      return res.redirect(`/api/smart-embed?movieId=${movieId}&retryCount=${retryCount + 1}`);
    }

  } catch (error) {
    console.error('Smart embed error:', error);
    res.status(500).json({
      error: 'Smart embed failed',
      details: error.message,
      suggestion: 'Try refreshing the page or try a different movie'
    });
  }
});

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
            const cloudnestraMatch = html.match(/(?:https?:)?\/\/[^"']*cloudnestra[^"']*/);
            const vidplayMatch = html.match(/(?:https?:)?\/\/[^"']*vidplay[^"']*/);
            const upcloudMatch = html.match(/(?:https?:)?\/\/[^"']*upcloud[^"']*/);
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
            // Ensure URL has protocol
            if (embedUrl.startsWith('//')) {
                embedUrl = 'https:' + embedUrl;
            }
            console.log('Found embed URL:', embedUrl);
            
            // URL'yi doğrudan döndür, frontend'de proxy ile test edilecek
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

// Function to extract IMDB IDs and TMDB IDs from AI response
function extractIds(text) {
    const imdbRegex = /tt\d{7,8}/g;
    const tmdbRegex = /\[TMDB:(\d+)\]/g;
    
    const imdbMatches = text.match(imdbRegex) || [];
    const tmdbMatches = Array.from(text.matchAll(tmdbRegex)).map(match => match[1]);
    
    return {
        imdbIds: [...new Set(imdbMatches)],
        tmdbIds: [...new Set(tmdbMatches)]
    };
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

        // Extract IDs from the response
        const { imdbIds, tmdbIds } = extractIds(response);
        console.log('Extracted IDs:', { imdbIds, tmdbIds }); // Debug log

        // Fetch movie details from TMDB for each ID
        const apiKey = process.env.TMDB_API_KEY || 'fda9bed2dd52a349ecb7cfe38b050ca5';
        const movieDetails = await Promise.all([
            // Process IMDB IDs (for movies)
            ...imdbIds.map(async (imdbId) => {
                try {
                    const findUrl = `https://api.themoviedb.org/3/find/${imdbId}?api_key=${apiKey}&language=en-US&external_source=imdb_id`;
                    const findResponse = await fetch(findUrl);
                    const findData = await findResponse.json();

                    if (findData.movie_results && findData.movie_results.length > 0) {
                        const tmdbId = findData.movie_results[0].id;
                        const detailsUrl = `https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${apiKey}&language=en-US`;
                        const detailsResponse = await fetch(detailsUrl);
                        const detailsData = await detailsResponse.json();

                        return {
                            imdbId,
                            tmdbId,
                            title: detailsData.title,
                            posterPath: detailsData.poster_path,
                            overview: detailsData.overview,
                            releaseDate: detailsData.release_date,
                            mediaType: 'movie'
                        };
                    }
                    return null;
                } catch (error) {
                    console.error(`Error fetching details for IMDB ID ${imdbId}:`, error);
                    return null;
                }
            }),
            // Process TMDB IDs (for TV shows)
            ...tmdbIds.map(async (tmdbId) => {
                try {
                    const detailsUrl = `https://api.themoviedb.org/3/tv/${tmdbId}?api_key=${apiKey}&language=en-US`;
                    const detailsResponse = await fetch(detailsUrl);
                    const detailsData = await detailsResponse.json();

                    return {
                        imdbId: null,
                        tmdbId,
                        title: detailsData.name,
                        posterPath: detailsData.poster_path,
                        overview: detailsData.overview,
                        releaseDate: detailsData.first_air_date,
                        mediaType: 'tv'
                    };
                } catch (error) {
                    console.error(`Error fetching details for TMDB ID ${tmdbId}:`, error);
                    return null;
                }
            })
        ]);

        // Filter out any null results
        const validMovieDetails = movieDetails.filter(details => details !== null);
        console.log('Valid movie details:', validMovieDetails); // Debug log

        res.json({
            response,
            imdbIds,
            tmdbIds,
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