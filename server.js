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
const puppeteer = require('puppeteer');
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

// TMDb ID (örneğin tt20969586) ile vidsrc.xyz embed sayfasından .m3u8 linkini çeken endpoint
app.get('/api/stream/:tmdb_id', async (req, res) => {
    let browser = null;
    try {
        const tmdbID = req.params.tmdb_id;
        // vidsrc.xyz embed linki oluştur (örneğin tt20969586 için: https://vidsrc.xyz/embed/movie/tt20969586)
        const embedUrl = `https://vidsrc.xyz/embed/movie/${tmdbID}`;
        console.log("embedUrl:", embedUrl);

        // Puppeteer ile headless browser başlat
        browser = await puppeteer.launch({
            headless: 'new',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-web-security',
                '--disable-features=IsolateOrigins,site-per-process',
                '--disable-blink-features=AutomationControlled',
                '--autoplay-policy=no-user-gesture-required',
                '--window-size=1920,1080',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--disable-gpu',
                '--disable-infobars',
                '--disable-notifications',
                '--disable-extensions',
                '--disable-default-apps',
                '--disable-popup-blocking',
                '--disable-save-password-bubble',
                '--disable-translate',
                '--disable-sync',
                '--disable-background-networking',
                '--metrics-recording-only',
                '--mute-audio',
                '--no-first-run',
                '--safebrowsing-disable-auto-update',
                '--js-flags=--random-seed=1157259157',
                '--disable-background-timer-throttling',
                '--disable-backgrounding-occluded-windows',
                '--disable-renderer-backgrounding',
                '--disable-breakpad',
                '--disable-component-extensions-with-background-pages',
                '--disable-features=TranslateUI,BlinkGenPropertyTrees',
                '--disable-ipc-flooding-protection',
                '--disable-renderer-throttling',
                '--enable-features=NetworkService,NetworkServiceInProcess',
                '--force-color-profile=srgb',
                '--hide-scrollbars',
                '--ignore-certificate-errors',
                '--ignore-certificate-errors-spki-list',
                '--lang=en-US,en',
                '--password-store=basic',
                '--use-mock-keychain',
                '--disable-site-isolation-trials'
            ],
            ignoreHTTPSErrors: true,
            protocolTimeout: 60000,
            defaultViewport: {
                width: 1920,
                height: 1080,
                deviceScaleFactor: 1,
                hasTouch: false,
                isLandscape: true,
                isMobile: false
            }
        });

        const page = await browser.newPage();
        
        // Cloudflare bypass için daha agresif stealth ayarları
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
        
        // Ek stealth önlemleri
        await page.setExtraHTTPHeaders({
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1',
            'sec-ch-ua': '"Chromium";v="122", "Google Chrome";v="122", "Not(A:Brand";v="24"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"Windows"',
            'DNT': '1'
        });

        // Add more stealth scripts
        await page.evaluateOnNewDocument(() => {
            // Override permissions
            const originalQuery = window.navigator.permissions.query;
            window.navigator.permissions.query = (parameters) => (
                parameters.name === 'notifications' ?
                    Promise.resolve({ state: Notification.permission }) :
                    originalQuery(parameters)
            );

            // Override plugins
            Object.defineProperty(navigator, 'plugins', {
                get: () => [1, 2, 3, 4, 5].map(() => ({
                    0: {
                        type: "application/x-google-chrome-pdf",
                        suffixes: "pdf",
                        description: "Portable Document Format",
                        enabledPlugin: true
                    },
                    name: "Chrome PDF Plugin",
                    filename: "internal-pdf-viewer",
                    description: "Portable Document Format",
                    length: 1
                }))
            });

            // Override webdriver
            Object.defineProperty(navigator, 'webdriver', {
                get: () => undefined
            });

            // Override languages
            Object.defineProperty(navigator, 'languages', {
                get: () => ['en-US', 'en']
            });

            // Override platform
            Object.defineProperty(navigator, 'platform', {
                get: () => 'Win32'
            });

            // Add Chrome runtime
            window.chrome = {
                runtime: {},
                loadTimes: function() {},
                csi: function() {},
                app: {}
            };

            // Override iframe contentWindow
            const originalGetOwnPropertyDescriptor = Object.getOwnPropertyDescriptor;
            Object.getOwnPropertyDescriptor = function(target, prop) {
                if (prop === 'contentWindow' && target instanceof HTMLIFrameElement) {
                    return {
                        get: function() {
                            return window;
                        },
                        configurable: true
                    };
                }
                return originalGetOwnPropertyDescriptor(target, prop);
            };
        });

        // Add mouse movement simulation
        await page.evaluateOnNewDocument(() => {
            let lastMove = Date.now();
            const moveInterval = setInterval(() => {
                if (Date.now() - lastMove > 1000) {
                    const event = new MouseEvent('mousemove', {
                        bubbles: true,
                        cancelable: true,
                        clientX: Math.random() * window.innerWidth,
                        clientY: Math.random() * window.innerHeight
                    });
                    document.dispatchEvent(event);
                    lastMove = Date.now();
                }
            }, 100);

            // Clean up on page unload
            window.addEventListener('unload', () => clearInterval(moveInterval));
        });

        // Network isteklerini daha agresif filtrele
        await page.setRequestInterception(true);
        page.on('request', (request) => {
            const resourceType = request.resourceType();
            if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
                request.abort();
            } else {
                const headers = request.headers();
                headers['Accept-Language'] = 'en-US,en;q=0.9';
                headers['Accept'] = 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8';
                headers['Accept-Encoding'] = 'gzip, deflate, br';
                headers['Connection'] = 'keep-alive';
                headers['Upgrade-Insecure-Requests'] = '1';
                headers['Sec-Fetch-Dest'] = 'document';
                headers['Sec-Fetch-Mode'] = 'navigate';
                headers['Sec-Fetch-Site'] = 'none';
                headers['Sec-Fetch-User'] = '?1';
                headers['Cache-Control'] = 'max-age=0';
                request.continue({ headers });
            }
        });

        // Debug için console.log'ları yakala (sadece geliştirme ortamında)
        if (process.env.NODE_ENV === 'development') {
            page.on('console', msg => console.log('Browser Console:', msg.text()));
            page.on('pageerror', error => console.error('Page Error:', error));
            page.on('request', request => console.log('Request:', request.method(), request.url()));
            page.on('response', response => console.log('Response:', response.status(), response.url()));
        }

        // embed sayfasına git
        await page.goto(embedUrl, { waitUntil: "networkidle0" });
        console.log("embed sayfası yüklendi.");

        // iframe'leri tespit et (örneğin cloudnestra.com veya multiembed.mov gibi video sağlayıcı iframe'i)
        const iframeSrcs = await page.evaluate(() => {
            const iframes = Array.from(document.querySelectorAll("iframe"));
            return iframes.map(iframe => iframe.src).filter(src => src && (src.includes("cloudnestra.com") || src.includes("multiembed.mov")));
        });
        if (iframeSrcs.length === 0) {
            throw new Error("Video sağlayıcı iframe bulunamadı.");
        }
        console.log("Video sağlayıcı iframe src:", iframeSrcs[0]);

        // Video sağlayıcı iframe'ini aç (yeni bir sayfa olarak)
        const iframePage = await browser.newPage();
        // iframe sayfasına git ve yüklenmesini bekle
        await iframePage.goto(iframeSrcs[0], { waitUntil: "networkidle0" });
        console.log("iframe sayfası yüklendi.");

        // Network isteklerini dinle ve .m3u8 linkini yakala
        let m3u8Link = null;
        iframePage.on("response", (response) => {
            const url = response.url();
            if (url.includes(".m3u8")) {
                m3u8Link = url;
            }
        });
        // (iframe sayfası yüklendiğinde, video oynatıcı genellikle .m3u8 isteği gönderir, bu yüzden biraz bekleyelim)
        await iframePage.waitForTimeout(5000);

        if (!m3u8Link) {
            throw new Error("iframe sayfasında .m3u8 linki bulunamadı.");
        }
        console.log("m3u8 linki bulundu:", m3u8Link);

        // TMDb API'den film adını çek (opsiyonel, sadece bilgi amaçlı)
        const tmdbApiKey = process.env.TMDB_API_KEY;
        let title = "Unknown";
        if (tmdbApiKey) {
            const tmdbUrl = `https://api.themoviedb.org/3/movie/${tmdbID}?api_key=${tmdbApiKey}&language=en-US`;
            const tmdbResp = await axios.get(tmdbUrl).catch(() => ({ data: { title: "Unknown" } }));
            title = tmdbResp.data.title;
        }

        res.json({ title, streamSrc: m3u8Link });
    } catch (err) {
        console.error("Hata:", err);
        res.status(500).json({ error: "Bir hata oluştu", details: err.message });
    } finally {
        if (browser) await browser.close();
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

// M3U8 URL fetching endpoint
app.get('/api/get-m3u8-urls', async (req, res) => {
    const { movieId } = req.query;
    console.log('=== M3U8 URL Fetching Started ===');
    console.log('Movie ID:', movieId);

    if (!movieId) {
        console.log('Error: Movie ID is missing');
        return res.status(400).json({ error: 'Movie ID is required' });
    }

    let browser = null;
    try {
        console.log('Starting Puppeteer browser...');
        browser = await puppeteer.launch({
            headless: 'new',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-web-security',
                '--disable-features=IsolateOrigins,site-per-process',
                '--disable-blink-features=AutomationControlled',
                '--window-size=1920,1080',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--disable-gpu',
                '--disable-infobars',
                '--disable-notifications',
                '--disable-extensions',
                '--disable-default-apps',
                '--disable-popup-blocking',
                '--disable-save-password-bubble',
                '--disable-translate',
                '--disable-sync',
                '--disable-background-networking',
                '--metrics-recording-only',
                '--mute-audio',
                '--no-first-run',
                '--safebrowsing-disable-auto-update',
                '--js-flags=--random-seed=1157259157',
                '--disable-background-timer-throttling',
                '--disable-backgrounding-occluded-windows',
                '--disable-renderer-backgrounding',
                '--disable-breakpad',
                '--disable-component-extensions-with-background-pages',
                '--disable-features=TranslateUI,BlinkGenPropertyTrees',
                '--disable-ipc-flooding-protection',
                '--disable-renderer-throttling',
                '--enable-features=NetworkService,NetworkServiceInProcess',
                '--force-color-profile=srgb',
                '--hide-scrollbars',
                '--ignore-certificate-errors',
                '--ignore-certificate-errors-spki-list',
                '--lang=en-US,en',
                '--password-store=basic',
                '--use-mock-keychain',
                '--disable-site-isolation-trials'
            ],
            ignoreHTTPSErrors: true,
            protocolTimeout: 60000,
            defaultViewport: {
                width: 1920,
                height: 1080,
                deviceScaleFactor: 1,
                hasTouch: false,
                isLandscape: true,
                isMobile: false
            }
        });

        const page = await browser.newPage();
        
        // Network isteklerini dinle ve m3u8 URL'lerini topla
        const m3u8Urls = new Set();
        
        // Network isteklerini dinle
        page.on('response', async (response) => {
            const url = response.url();
            if (url.includes('.m3u8')) {
                console.log('Found m3u8 URL:', url);
                m3u8Urls.add(url);
            }
        });

        // Cloudflare bypass için stealth ayarları
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
        await page.setExtraHTTPHeaders({
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1',
            'sec-ch-ua': '"Chromium";v="122", "Google Chrome";v="122", "Not(A:Brand";v="24"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"Windows"',
            'DNT': '1'
        });

        // Stealth scripts
        await page.evaluateOnNewDocument(() => {
            // Override permissions
            const originalQuery = window.navigator.permissions.query;
            window.navigator.permissions.query = (parameters) => (
                parameters.name === 'notifications' ?
                    Promise.resolve({ state: Notification.permission }) :
                    originalQuery(parameters)
            );

            // Override plugins
            Object.defineProperty(navigator, 'plugins', {
                get: () => [1, 2, 3, 4, 5].map(() => ({
                    0: {
                        type: "application/x-google-chrome-pdf",
                        suffixes: "pdf",
                        description: "Portable Document Format",
                        enabledPlugin: true
                    },
                    name: "Chrome PDF Plugin",
                    filename: "internal-pdf-viewer",
                    description: "Portable Document Format",
                    length: 1
                }))
            });

            // Override webdriver
            Object.defineProperty(navigator, 'webdriver', {
                get: () => undefined
            });

            // Override languages
            Object.defineProperty(navigator, 'languages', {
                get: () => ['en-US', 'en']
            });

            // Override platform
            Object.defineProperty(navigator, 'platform', {
                get: () => 'Win32'
            });

            // Add Chrome runtime
            window.chrome = {
                runtime: {},
                loadTimes: function() {},
                csi: function() {},
                app: {}
            };
        });

        // Network isteklerini filtrele
        await page.setRequestInterception(true);
        page.on('request', (request) => {
            const resourceType = request.resourceType();
            if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
                request.abort();
            } else {
                request.continue();
            }
        });

        // Vidsrc embed sayfasına git
        const embedUrl = `https://vidsrc.xyz/embed/movie/${movieId}`;
        console.log('Navigating to embed page:', embedUrl);
        
        try {
            const response = await page.goto(embedUrl, {
                waitUntil: 'networkidle0',
                timeout: 60000
            });

            // Cloudflare challenge kontrolü
            if (response.status() === 503 || page.url().includes('challenges.cloudflare.com')) {
                await handleCloudflareChallenge(page);
            }

            // Sayfa yüklendikten sonra biraz bekle
            await new Promise(resolve => setTimeout(resolve, 5000));

            // Video player'ı başlat
            console.log('Attempting to start video player...');
            await page.evaluate(async () => {
                // Tüm iframe'leri bul
                const iframes = Array.from(document.querySelectorAll('iframe'));
                console.log('Found iframes:', iframes.length);

                // Her iframe'i kontrol et
                for (const iframe of iframes) {
                    try {
                        console.log('Processing iframe:', iframe.src);
                        
                        // iframe'in yüklenmesini bekle
                        await new Promise((resolve, reject) => {
                            const timeout = setTimeout(() => {
                                reject(new Error('iframe load timeout'));
                            }, 10000);

                            if (iframe.contentDocument?.readyState === 'complete') {
                                clearTimeout(timeout);
                                resolve();
                            } else {
                                iframe.onload = () => {
                                    clearTimeout(timeout);
                                    resolve();
                                };
                                iframe.onerror = (error) => {
                                    clearTimeout(timeout);
                                    reject(error);
                                };
                            }
                        });

                        console.log('iframe loaded, checking content...');

                        // iframe içeriğini kontrol et
                        const iframeDoc = iframe.contentDocument;
                        if (!iframeDoc) {
                            console.log('No contentDocument available for iframe');
                            continue;
                        }

                        // Video elementlerini bul
                        const videoElements = iframeDoc.querySelectorAll('video');
                        console.log('Found video elements:', videoElements.length);

                        // Her video elementini dene
                        for (const video of videoElements) {
                            try {
                                console.log('Attempting to start video element...');
                                
                                // Video elementinin görünür olmasını sağla
                                video.style.cssText = 'display: block !important; visibility: visible !important; opacity: 1 !important; position: relative !important; z-index: 9999 !important;';
                                
                                // Video kontrollerini göster
                                video.controls = true;
                                
                                // Video elementine tıkla
                                const clickEvent = new MouseEvent('click', {
                                    bubbles: true,
                                    cancelable: true,
                                    view: window
                                });
                                video.dispatchEvent(clickEvent);
                                
                                // Video oynatmayı başlat
                                try {
                                    await video.play();
                                    console.log('Video play() successful');
                                } catch (playError) {
                                    console.log('Video play() failed, trying with user interaction...');
                                    // Kullanıcı etkileşimi simülasyonu
                                    const playPromise = video.play();
                                    if (playPromise !== undefined) {
                                        playPromise.catch(() => {
                                            // Otomatik oynatma engellendi, manuel olarak dene
                                            video.muted = true;
                                            video.play().then(() => {
                                                video.muted = false;
                                            }).catch(console.error);
                                        });
                                    }
                                }
                            } catch (error) {
                                console.error('Error with video element:', error);
                            }
                        }

                        // Play butonlarını bul ve tıkla
                        const playButtons = iframeDoc.querySelectorAll('button[aria-label="Play"], .play-button, .vjs-big-play-button, [class*="play"], [class*="Play"]');
                        console.log('Found play buttons:', playButtons.length);

                        for (const button of playButtons) {
                            try {
                                console.log('Clicking play button:', button.outerHTML);
                                button.click();
                                
                                // Click event'ini manuel olarak tetikle
                                const clickEvent = new MouseEvent('click', {
                                    bubbles: true,
                                    cancelable: true,
                                    view: window
                                });
                                button.dispatchEvent(clickEvent);
                            } catch (error) {
                                console.error('Error clicking play button:', error);
                            }
                        }

                        // Video.js player'ı başlat
                        const videoJsPlayers = iframeDoc.querySelectorAll('.video-js, [class*="video-js"]');
                        console.log('Found video.js players:', videoJsPlayers.length);

                        for (const player of videoJsPlayers) {
                            try {
                                console.log('Attempting to start video.js player...');
                                if (window.videojs) {
                                    const videoPlayer = window.videojs(player);
                                    videoPlayer.play().catch(error => {
                                        console.log('Video.js play() failed, trying muted...');
                                        videoPlayer.muted(true);
                                        videoPlayer.play().then(() => {
                                            videoPlayer.muted(false);
                                        }).catch(console.error);
                                    });
                                }
                            } catch (error) {
                                console.error('Error with video.js player:', error);
                            }
                        }

                        // HLS.js player'ı kontrol et
                        const hlsPlayers = iframeDoc.querySelectorAll('[class*="hls"], [class*="Hls"]');
                        console.log('Found HLS.js players:', hlsPlayers.length);

                        for (const player of hlsPlayers) {
                            try {
                                console.log('Attempting to start HLS.js player...');
                                if (window.Hls) {
                                    const hls = new window.Hls();
                                    const video = player.querySelector('video');
                                    if (video && video.src) {
                                        hls.loadSource(video.src);
                                        hls.attachMedia(video);
                                        hls.on(window.Hls.Events.MANIFEST_PARSED, () => {
                                            video.play().catch(console.error);
                                        });
                                    }
                                }
                            } catch (error) {
                                console.error('Error with HLS.js player:', error);
                            }
                        }

                    } catch (error) {
                        console.error('Error processing iframe:', error);
                    }
                }
            });

            // Biraz daha uzun bekle ve m3u8 URL'lerini topla
            console.log('Waiting for m3u8 URLs...');
            await new Promise(resolve => setTimeout(resolve, 15000));

            // M3U8 URL'lerini topla
            const urls = Array.from(m3u8Urls);
            console.log(`Found ${urls.length} m3u8 URLs:`, urls);

            if (urls.length === 0) {
                console.log('No m3u8 URLs found after all attempts');
                return res.status(404).json({ error: 'No m3u8 URLs found' });
            }

            console.log('=== M3U8 URL Fetching Completed ===');
            res.status(200).json({ urls });

        } catch (error) {
            console.error('Error navigating to embed page:', error);
            throw new Error(`Failed to load embed page: ${error.message}`);
        }

    } catch (error) {
        console.error('=== M3U8 URL Fetching Failed ===');
        console.error('Error details:', error);
        console.error('Error stack:', error.stack);
        res.status(500).json({ 
            error: 'Failed to fetch m3u8 URLs', 
            details: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    } finally {
        if (browser) {
            console.log('Closing browser...');
            await browser.close();
            console.log('Browser closed');
        }
        console.log('=== M3U8 URL Fetching Process Ended ===');
    }
});

// Update Cloudflare bypass logic
async function handleCloudflareChallenge(page) {
    console.log('Handling Cloudflare challenge...');
    
    try {
        // Wait for challenge to appear
        await page.waitForSelector('iframe[src*="challenges.cloudflare.com"]', { timeout: 10000 });
        
        // Get all frames
        const frames = page.frames();
        const challengeFrame = frames.find(f => f.url().includes('challenges.cloudflare.com'));
        
        if (challengeFrame) {
            console.log('Found Cloudflare challenge frame');
            
            // Wait for challenge to load
            await challengeFrame.waitForSelector('body', { timeout: 10000 });
            
            // Simulate human-like behavior
            await page.mouse.move(Math.random() * 800, Math.random() * 600);
            await page.waitForTimeout(1000 + Math.random() * 1000);
            
            // Try to find and click the challenge button
            const button = await challengeFrame.$('button[type="submit"]');
            if (button) {
                await button.click();
                console.log('Clicked challenge button');
            }
            
            // Wait for challenge to complete
            await page.waitForTimeout(5000);
            
            // Check if we're still on the challenge page
            const currentUrl = page.url();
            if (currentUrl.includes('challenges.cloudflare.com')) {
                console.log('Still on challenge page, waiting longer...');
                await page.waitForTimeout(10000);
            }
        }
    } catch (error) {
        console.log('Error handling Cloudflare challenge:', error.message);
    }
}