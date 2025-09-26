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
const { HttpsProxyAgent } = require('https-proxy-agent');
const axios = require('axios');
const cors = require('cors');
const { HfInference } = require('@huggingface/inference');
const compression = require('compression');
const slowDown = require('express-slow-down');
require('dotenv').config();

const HUGGINGFACE_API_KEY = process.env.HUGGINGFACE_API_KEY;
const MODEL_ID = "deepseek-ai/DeepSeek-V3-0324";
const PROVIDER = "novita";

const hf = new HfInference(HUGGINGFACE_API_KEY);

const chatHistories = new Map();

async function getAIResponse(message, userId) {
    try {
        if (!chatHistories.has(userId)) {
            chatHistories.set(userId, []);
        }

        const history = chatHistories.get(userId);

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

        const messages = [
            systemPrompt,
            ...history.map(msg => ({
                role: msg.startsWith("User:") ? "user" : "assistant",
                content: msg.replace(/^(User:|Assistant:)\s*/, "")
            })),
            { role: "user", content: message }
        ];

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

        const aiResponse = result.choices[0].message.content.trim();

        history.push(`User: ${message}`);
        history.push(`Assistant: ${aiResponse}`);

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

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    
    callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'HEAD'],
  allowedHeaders: [
    'Origin', 
    'X-Requested-With', 
    'Content-Type', 
    'Accept', 
    'Authorization', 
    'Range',
    'Cache-Control',
    'Pragma',
    'If-Modified-Since',
    'If-None-Match'
  ],
  exposedHeaders: [
    'Content-Length',
    'Content-Range',
    'Accept-Ranges',
    'Content-Type',
    'Cache-Control',
    'Pragma',
    'Expires'
  ],
  maxAge: 86400 // 24 hours
};

app.use(cors(corsOptions));

app.use(compression({
  filter: (req, res) => {
    if (req.path.includes('/api/video-stream') || req.path.includes('/proxy/stream')) {
      return false;
    }
    return compression.filter(req, res);
  },
  level: 6,
  threshold: 1024
}));

const speedLimiter = slowDown({
  windowMs: 15 * 60 * 1000, // 15 minutes
  delayAfter: 100, // Allow 100 requests per 15 minutes, then...
  delayMs: () => 500 // Begin adding 500ms of delay per request above 100 (updated per v2 behavior)
});

app.use('/api/', speedLimiter);
app.use('/proxy/', speedLimiter);

app.get('/health', (req, res) => {
  const healthInfo = {
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    platform: process.platform,
    nodeVersion: process.version,
    memory: process.memoryUsage(),
    headers: req.headers,
    userAgent: req.headers['user-agent'],
    platform: req.headers['sec-ch-ua-platform'] || 'unknown',
    cors: {
      origin: req.headers.origin || 'none',
      method: req.method,
      headers: req.headers
    }
  };
  
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  res.json(healthInfo);
});

app.get('/debug/mac', (req, res) => {
  const debugInfo = {
    timestamp: new Date().toISOString(),
    request: {
      method: req.method,
      url: req.url,
      headers: req.headers,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      platform: req.headers['sec-ch-ua-platform'] || 'unknown',
      accept: req.headers.accept,
      acceptEncoding: req.headers['accept-encoding'],
      acceptLanguage: req.headers['accept-language']
    },
    server: {
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
      memory: process.memoryUsage(),
      env: {
        NODE_ENV: process.env.NODE_ENV,
        PORT: process.env.PORT
      }
    }
  };
  
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Content-Type', 'application/json');
  
  res.json(debugInfo);
});

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, HEAD');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Range, Cache-Control, Pragma, If-Modified-Since, If-None-Match');
  res.header('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges, Content-Type, Cache-Control, Pragma, Expires');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  res.header('X-Content-Type-Options', 'nosniff');
  res.header('X-Frame-Options', 'SAMEORIGIN');
  res.header('X-XSS-Protection', '1; mode=block');
  res.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  if (req.path.includes('/api/video-stream') || req.path.includes('/proxy/stream')) {
    res.header('Cache-Control', 'public, max-age=3600, s-maxage=3600');
  } else {
    res.header('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.header('Pragma', 'no-cache');
    res.header('Expires', '0');
  }
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  next();
});

app.use(express.static('public', {
  setHeaders: (res, path) => {
    if (path.endsWith('.mp4')) {
      res.setHeader('Content-Type', 'video/mp4');
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Cache-Control', 'public, max-age=3600');
    } else if (path.endsWith('.m3u8')) {
      res.setHeader('Content-Type', 'application/x-mpegURL');
      res.setHeader('Cache-Control', 'public, max-age=3600');
    } else if (path.endsWith('.ts')) {
      res.setHeader('Content-Type', 'video/MP2T');
      res.setHeader('Cache-Control', 'public, max-age=3600');
    }
    
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Range, Origin, X-Requested-With, Content-Type, Accept, Authorization');
  }
}));

app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
});

app.get('/api/video-stream', async (req, res) => {
    const { url } = req.query;
    
    if (!url) {
        return res.status(400).json({ error: 'URL parameter is required' });
    }
    
    try {
        console.log('Streaming video from:', url);
        
        const range = req.headers.range;
        
        const fetchHeaders = {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Accept': '*/*',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
            'Referer': 'https://cloudnestra.com/',
            'Origin': 'https://cloudnestra.com',
            'Range': range || undefined,
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
        };
        
        const response = await fetch(url, {
            headers: fetchHeaders,
            timeout: 30000
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const contentType = response.headers.get('content-type') || 'video/mp4';
        const contentLength = response.headers.get('content-length');
        const acceptRanges = response.headers.get('accept-ranges');
        
        res.set({
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
            'Access-Control-Allow-Headers': 'Range, Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control, Pragma, If-Modified-Since, If-None-Match',
            'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges, Content-Type, Cache-Control, Pragma, Expires',
            'Content-Type': contentType,
            'Accept-Ranges': acceptRanges || 'bytes',
            'Cache-Control': 'public, max-age=3600, s-maxage=3600',
            'X-Content-Type-Options': 'nosniff',
            'X-Frame-Options': 'SAMEORIGIN',
            'X-XSS-Protection': '1; mode=block'
        });
        
        if (range && contentLength) {
            res.set('Content-Length', contentLength);
        }
        
        if (req.method === 'OPTIONS') {
            res.status(200).end();
            return;
        }
        
        response.body.on('error', (error) => {
            console.error('Video stream pipe error:', error);
            if (!res.headersSent) {
                res.status(500).json({ 
                    error: 'Video stream error', 
                    details: error.message 
                });
            }
        });
        
        response.body.pipe(res);
        
    } catch (error) {
        console.error('Video stream error:', error);
        
        const errorResponse = {
            error: 'Video stream error',
            details: error.message,
            timestamp: new Date().toISOString(),
            url: url,
            userAgent: req.headers['user-agent'],
            platform: req.headers['sec-ch-ua-platform'] || 'unknown'
        };
        
        res.status(500).json(errorResponse);
    }
});

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
        
        const localhostInHtml = html.match(/localhost[^"'\s>]*/g);
        if (localhostInHtml) {
            console.log(`🔍 Found ${localhostInHtml.length} localhost references in HTML:`, localhostInHtml);
        } else {
            console.log('✅ No localhost references found in HTML');
        }
        
        if (html.includes('src="//')) {
            html = html.replace(/src="\/\//g, 'src="https://');
            console.log('Fixed relative URLs');
        }
        
        const localhostMatches = html.match(/localhost:\d+/g);
        if (localhostMatches) {
            console.log(`Found ${localhostMatches.length} localhost references, fixing...`);
            html = html.replace(/http:\/\/localhost:\d+/g, 'https://cloudnestra.com');
            html = html.replace(/localhost:\d+/g, 'cloudnestra.com');
        }
        
        html = html.replace(/['"]http:\/\/localhost:\d+['"]/g, '"https://cloudnestra.com"');
        html = html.replace(/['"]localhost:\d+['"]/g, '"cloudnestra.com"');
        
        html = html.replace(/href=["']http:\/\/localhost:\d+\//g, 'href="https://cloudnestra.com/');
        html = html.replace(/src=["']http:\/\/localhost:\d+\//g, 'src="https://cloudnestra.com/');
        
        html = html.replace(/href=["']\//g, 'href="https://cloudnestra.com/');
        html = html.replace(/src=["']\//g, 'src="https://cloudnestra.com/');
        
        const allLocalhostRefs = html.match(/localhost[^"'\s>]*/g);
        if (allLocalhostRefs) {
            console.log(`Found additional localhost references:`, allLocalhostRefs);
            html = html.replace(/localhost[^"'\s>]*/g, 'cloudnestra.com');
        }
        
        html = html.replace(/localhost(?::\d+)?(?:\/[^"'\s>]*)?/g, 'cloudnestra.com');
        
        const remainingLocalhost = html.match(/localhost[^"'\s>]*/g);
        if (remainingLocalhost) {
            console.log(`Remaining localhost references after cleanup:`, remainingLocalhost);
        }
        
        html = html.replace(/localhost(?::\d+)?(?:\/[^"'\s>]*)?/g, 'cloudnestra.com');
        html = html.replace(/localhost(?:\/[^"'\s>]*)?/g, 'cloudnestra.com');
        
        html = html.replace(/localhost:\d+/g, 'cloudnestra.com');
        html = html.replace(/localhost\//g, 'cloudnestra.com/');
        
        const finalLocalhost = html.match(/localhost[^"'\s>]*/g);
        if (finalLocalhost) {
            console.log(`⚠️ FINAL WARNING: Still found localhost references:`, finalLocalhost);
            
            html = html.replace(/localhost(?::\d+)?(?:\/[^"'\s>]*)?/g, 'cloudnestra.com');
            html = html.replace(/localhost\//g, 'cloudnestra.com/');
            html = html.replace(/localhost"/g, 'cloudnestra.com"');
            html = html.replace(/localhost'/g, "cloudnestra.com'");
            html = html.replace(/localhost\s/g, 'cloudnestra.com ');
            html = html.replace(/localhost/g, 'cloudnestra.com');
            
            html = html.replace(/(['"])localhost(?::\d+)?([^'"]*)\1/g, '$1cloudnestra.com$2$1');
            html = html.replace(/(['"])localhost([^'"]*)\1/g, '$1cloudnestra.com$2$1');
            
            html = html.replace(/http:\/\/localhost(?::\d+)?/g, 'https://cloudnestra.com');
            html = html.replace(/https:\/\/localhost(?::\d+)?/g, 'https://cloudnestra.com');
            
            html = html.replace(/localhost[^"'\s>]*/g, 'cloudnestra.com');
            html = html.replace(/localhost/g, 'cloudnestra.com');
            
            console.log('🔧 Applied aggressive localhost cleanup');
        } else {
            console.log('✅ All localhost references cleaned successfully');
        }
        
        html = html.replace(/style_rcp-[^"']*\.css/g, 'style_rcp.css');
        html = html.replace(/base64\.js/g, 'base64.js');
        html = html.replace(/\/sbx\.js/g, '/sbx.js');
        html = html.replace(/sbx\.js/g, '/sbx.js');
        
        html = html.replace(/https:\/\/cloudnestra\.com\/\/cdnjs\.cloudflare\.com/g, 'https://cdnjs.cloudflare.com');
        html = html.replace(/https:\/\/cloudnestra\.com\/\/fonts\.googleapis\.com/g, 'https://fonts.googleapis.com');
        html = html.replace(/https:\/\/cloudnestra\.com\/\/fonts\.gstatic\.com/g, 'https://fonts.gstatic.com');
        
        html = html.replace(/https:\/\/cloudnestra\.com\/\//g, 'https://cloudnestra.com/');
        
        html = html.replace(/http:\/\/localhost:\d+/g, 'https://cloudnestra.com');
        html = html.replace(/localhost:\d+/g, 'cloudnestra.com');
        
        html = html.replace(/localhost:8080/g, 'cloudnestra.com');
        html = html.replace(/localhost:80/g, 'cloudnestra.com');
        html = html.replace(/localhost:3000/g, 'cloudnestra.com');
        
        html = html.replace(/localhost\//g, 'cloudnestra.com/');
        html = html.replace(/localhost"/g, 'cloudnestra.com"');
        html = html.replace(/localhost'/g, "cloudnestra.com'");
        html = html.replace(/localhost\s/g, 'cloudnestra.com ');
        
        html = html.replace(/src=["']\/rcp\//g, 'src="https://cloudnestra.com/rcp/');
        html = html.replace(/href=["']\/rcp\//g, 'href="https://cloudnestra.com/rcp/');
        
        html = html.replace(/src=["']\/(?!https?:\/\/)/g, 'src="https://cloudnestra.com/');
        html = html.replace(/href=["']\/(?!https?:\/\/)/g, 'href="https://cloudnestra.com/');
        
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
        
        html = html.replace(/src=["']https:\/\/cloudnestra\.com\/([^"']+)["']/g,
            (m, path) => `src="https://cloudnestra.com/${path}"`);
        
        html = html.replace(/src=["']\/(rcp|prorcp|assets|static|player|cdn)\/([^"']+)["']/g,
            (m, seg, rest) => `src="https://cloudnestra.com/${seg}/${rest}"`);
        
        html = html.replace(/(["'])https:\/\/cloudnestra\.com\/([^"']+)\1/g,
            (m, q, path) => `${q}https://cloudnestra.com/${path}${q}`);
        
        html = html.replace(/(["'])https:\/\/cloudnestra\.com\/([^"']+)\1/g,
            (m, q, path) => `${q}https://cloudnestra.com/${path}${q}`);
        
        html = html.replace(/(['"])localhost(?::\d+)?([^'"]*)\1/g, '$1/api/cn-proxy?url=https://cloudnestra.com$2$1');
        html = html.replace(/(['"])localhost([^'"]*)\1/g, '$1/api/cn-proxy?url=https://cloudnestra.com$2$1');
        
        html = html.replace(/localhost(?::\d+)?(?:\/[^"'\s>]*)?/g, '/api/cn-proxy?url=https://cloudnestra.com');
        
        html = html.replace(/localhost:8080/g, '/api/cn-proxy?url=https://cloudnestra.com');
        html = html.replace(/localhost:80/g, '/api/cn-proxy?url=https://cloudnestra.com');
        html = html.replace(/localhost:3000/g, '/api/cn-proxy?url=https://cloudnestra.com');
        
        html = html.replace(/(['"])localhost(?::\d+)?([^'"]*)\1/g, '$1/api/cn-proxy?url=https://cloudnestra.com$2$1');
        html = html.replace(/(['"])localhost([^'"]*)\1/g, '$1/api/cn-proxy?url=https://cloudnestra.com$2$1');
        
        html = html.replace(/localhost(?::\d+)?(?:\/[^"'\s>]*)?/g, '/api/cn-proxy?url=https://cloudnestra.com');
        
        html = html.replace(/src=["']([^"']*\.(js|css))["']/g, (match, filename) => {
            if (filename.startsWith('http')) return match;
            if (filename.startsWith('//')) return `src="https:${filename}"`;
            if (filename.startsWith('/')) return `src="/api/cn-proxy?url=https://cloudnestra.com${filename}"`;
            return `src="/api/cn-proxy?url=https://cloudnestra.com/${filename}"`;
        });
        
        html = html.replace(/\/sbx\.html/g, '/api/cn-proxy?url=https://cloudnestra.com/sbx.html');
        html = html.replace(/sbx\.html/g, '/api/cn-proxy?url=https://cloudnestra.com/sbx.html');
        
        html = html.replace(/\/api\/cn-proxy\?url=https:\/\/cloudnestra\.com\/\/api\/cn-proxy\?url=https:\/\/cloudnestra\.com/g, '/api/cn-proxy?url=https://cloudnestra.com');
        html = html.replace(/\/api\/cn-proxy\?url=https:\/\/cloudnestra\.com\/api\/cn-proxy\?url=https:\/\/cloudnestra\.com/g, '/api/cn-proxy?url=https://cloudnestra.com');
        
        console.log('HTML cleanup completed');
        
        const debugLocalhost = html.match(/localhost[^"'\s>]*/g);
        if (debugLocalhost) {
            console.log('🚨 DEBUG: HTML cleanup sonrası hala localhost var:', debugLocalhost);
            console.log('HTML sample (first 1000 chars):', html.substring(0, 1000));
            
            html = html.replace(/localhost[^"'\s>]*/g, '/api/cn-proxy?url=https://cloudnestra.com');
            console.log('🔧 Applied final localhost cleanup');
        } else {
            console.log('✅ DEBUG: HTML cleanup başarılı - localhost yok');
        }
        
        const finalCheck = html.match(/localhost[^"'\s>]*/g);
        if (finalCheck) {
            console.log('⚠️ FINAL WARNING: Still found localhost after cleanup:', finalCheck);
            html = html.replace(/localhost/g, '/api/cn-proxy?url=https://cloudnestra.com');
            
            const finalFinalCheck = html.match(/localhost[^"'\s>]*/g);
            if (finalFinalCheck) {
                console.log('🚨 CRITICAL: localhost still exists after final cleanup:', finalFinalCheck);
                html = html.replace(/localhost(?::\d+)?(?:\/[^"'\s>]*)?/g, '/api/cn-proxy?url=https://cloudnestra.com');
                html = html.replace(/localhost/g, '/api/cn-proxy?url=https://cloudnestra.com');
            }
        }
        
        res.set({
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization, Range',
            'Content-Type': 'text/html',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
            'Content-Security-Policy': "default-src 'self' https: http: data: 'unsafe-inline' 'unsafe-eval'; script-src 'self' https: http: 'unsafe-inline' 'unsafe-eval'; connect-src 'self' https: http:; frame-src 'self' https: http:; img-src 'self' https: http: data:; object-src 'none';"
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

app.get('/api/cn-proxy', async (req, res) => {
  try {
    const { url } = req.query;
    if (!url || !/^https?:\/\/cloudnestra\.com\//.test(url)) {
      return res.status(400).json({ error: 'Valid url query required to cloudnestra.com' });
    }

    if (url.includes('sbx.html')) {
      console.log('🔧 Special handling for sbx.html');
      const fallbackHtml = `
<!DOCTYPE html>
<html>
<head>
    <title>SBX Handler</title>
    <script>
        function dtc_sbx() {
            try {
                if (window.parent && window.parent !== window) {
                    window.parent.postMessage('sbx-handled', '*');
                    setTimeout(() => {
                        window.close();
                    }, 100);
                }
            } catch (e) {
                console.log('SBX handler completed');
                setTimeout(() => {
                    window.close();
                }, 100);
            }
        }
        
        dtc_sbx();
        
        setTimeout(() => {
            if (window.parent && window.parent !== window) {
                window.parent.postMessage('sbx-timeout', '*');
                window.close();
            }
        }, 2000);
    </script>
</head>
<body>
    <div>SBX Handler - Processing...</div>
</body>
</html>`;
      
      res.setHeader('Content-Type', 'text/html');
      return res.send(fallbackHtml);
    }

    console.log('🔧 Proxying Cloudnestra asset:', url);

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

    if (req.headers['range']) {
      upstreamHeaders['Range'] = req.headers['range'];
    }

    const upstream = await fetch(url, { headers: upstreamHeaders });

    res.status(upstream.status);

    const passHeaders = [
      'content-type','content-length','accept-ranges','content-range','cache-control','pragma','expires'
    ];
    passHeaders.forEach(h => {
      const v = upstream.headers.get(h);
      if (v) res.setHeader(h, v);
    });

    if (url.includes('.js')) {
      if (!upstream.headers.get('content-type') || upstream.headers.get('content-type').includes('text/html')) {
        res.setHeader('Content-Type', 'application/javascript');
      }
      
      try {
        const jsContent = await upstream.text();
        console.log('🔍 Original JavaScript content (first 200 chars):', jsContent.substring(0, 200));
        
        const cleanedJs = jsContent
          .replace(/localhost:8080/g, '/api/cn-proxy?url=https://cloudnestra.com')
          .replace(/localhost:80/g, '/api/cn-proxy?url=https://cloudnestra.com')
          .replace(/localhost:3000/g, '/api/cn-proxy?url=https://cloudnestra.com')
          .replace(/localhost(?::\d+)?(?:\/[^"'\s>]*)?/g, '/api/cn-proxy?url=https://cloudnestra.com')
          .replace(/localhost/g, '/api/cn-proxy?url=https://cloudnestra.com')
          .replace(/\/sbx\.html/g, '/api/cn-proxy?url=https://cloudnestra.com/sbx.html')
          .replace(/sbx\.html/g, '/api/cn-proxy?url=https://cloudnestra.com/sbx.html')
          .replace(/\/api\/cn-proxy\?url=https:\/\/cloudnestra\.com\/\/api\/cn-proxy\?url=https:\/\/cloudnestra\.com/g, '/api/cn-proxy?url=https://cloudnestra.com')
          .replace(/\/api\/cn-proxy\?url=https:\/\/cloudnestra\.com\/api\/cn-proxy\?url=https:\/\/cloudnestra\.com/g, '/api/cn-proxy?url=https://cloudnestra.com');
        
        console.log('🔧 Cleaned JavaScript file:', url);
        console.log('🔍 Cleaned JavaScript content (first 200 chars):', cleanedJs.substring(0, 200));
        
        return res.send(cleanedJs);
      } catch (err) {
        console.error('JavaScript cleanup failed:', err);
        if (upstream.body) {
          upstream.body.pipe(res);
        } else {
          res.status(500).json({ error: 'JavaScript processing failed' });
        }
      }
    }
    
    if (url.includes('.css')) {
      if (!upstream.headers.get('content-type') || upstream.headers.get('content-type').includes('text/html')) {
        res.setHeader('Content-Type', 'text/css');
      }
    }
    
    if (url.includes('.woff') || url.includes('.woff2') || url.includes('.ttf') || url.includes('.eot')) {
      if (!upstream.headers.get('content-type') || upstream.headers.get('content-type').includes('text/html')) {
        res.setHeader('Content-Type', 'font/woff2');
      }
    }

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Range');

    if (upstream.body) {
      upstream.body.pipe(res).on('error', (err) => {
        console.error('Stream error:', err);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Stream failed', details: err.message });
        }
      });
    } else {
      try {
        const text = await upstream.text();
        res.send(text);
      } catch (err) {
        console.error('Text processing error:', err);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Text processing failed', details: err.message });
        }
      }
    }
  } catch (err) {
    console.error('cn-proxy error:', err);
    res.status(500).json({ error: 'cn-proxy failed', details: err.message });
  }
});

// Proxy listesi - buraya kendi proxy'lerinizi ekleyin
const PROXY_LIST = [
    // Örnek proxy'ler - gerçek proxy'lerle değiştirin
    // 'http://username:password@proxy1.example.com:8080',
    // 'http://username:password@proxy2.example.com:8080',
    // 'http://username:password@proxy3.example.com:8080'
];

// Proxy rotasyon fonksiyonu
function getRandomProxy() {
    if (PROXY_LIST.length === 0) return null;
    return PROXY_LIST[Math.floor(Math.random() * PROXY_LIST.length)];
}

// Proxy agent oluşturma fonksiyonu
function createProxyAgent(proxyUrl) {
    if (!proxyUrl) return null;
    return new HttpsProxyAgent(proxyUrl);
}

async function getCloudnestraEmbedUrl(movieId) {
    try {
        console.log('Getting Cloudnestra embed URL for movie ID:', movieId);
        
        const userAgents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:132.0) Gecko/20100101 Firefox/132.0',
            'Mozilla/5.0 (X11; Linux x86_64; rv:132.0) Gecko/20100101 Firefox/132.0'
        ];
        
        const randomUserAgent = userAgents[Math.floor(Math.random() * userAgents.length)];
        
        const vidsrcApiUrl = `https://vidsrc.icu/embed/movie/${movieId}`;
        console.log('Fetching from vidsrc API:', vidsrcApiUrl);
        console.log('Using User-Agent:', randomUserAgent);

        await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));

        // Proxy seçimi
        const selectedProxy = getRandomProxy();
        const fetchOptions = {
            headers: {
                'User-Agent': randomUserAgent,
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive',
                'Referer': 'https://vidsrc.icu/',
                'Origin': 'https://vidsrc.icu',
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'same-origin',
                'Sec-Fetch-User': '?1',
                'Upgrade-Insecure-Requests': '1',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache',
                'DNT': '1',
                'Sec-Ch-Ua': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
                'Sec-Ch-Ua-Mobile': '?0',
                'Sec-Ch-Ua-Platform': '"Windows"',
                'Sec-Ch-Ua-Platform-Version': '"15.0.0"',
                'Sec-Ch-Ua-Arch': '"x86"',
                'Sec-Ch-Ua-Model': '""',
                'Sec-Ch-Ua-Bitness': '"64"',
                'Sec-Ch-Ua-Full-Version-List': '"Google Chrome";v="131.0.6778.85", "Chromium";v="131.0.6778.85", "Not_A Brand";v="24.0.0.0"'
            },
            timeout: 20000
        };

        // Proxy kullanımı (eğer varsa)
        if (selectedProxy) {
            console.log('Using proxy:', selectedProxy);
            fetchOptions.agent = createProxyAgent(selectedProxy);
        } else {
            console.log('No proxy configured, using direct connection');
        }

        const response = await fetch(vidsrcApiUrl, fetchOptions);

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
        console.log('Vidsrc response received, length:', html.length);

        if (html.includes('cf-browser-verification') || html.includes('challenge-platform')) {
            throw new Error('Cloudflare verification page detected');
        }

        const iframeMatches = html.match(/<iframe[^>]*src="([^"]*)"[^>]*>/g);
        console.log('Found iframes:', iframeMatches);

        let embedUrl = null;
        if (iframeMatches) {
            for (const iframe of iframeMatches) {
                const srcMatch = iframe.match(/src="([^"]*)"/);
                if (srcMatch) {
                    const src = srcMatch[1];
                    console.log('Found iframe src:', src);
                    if (src.includes('vidsrc.icu') || src.includes('cloudnestra')) {
                        embedUrl = src;
                        break;
                    }
                }
            }
        }

        if (!embedUrl) {
            const vidsrcMatch = html.match(/(?:https?:)?\/\/[^"']*vidsrc[^"']*/);
            const cloudnestraMatch = html.match(/(?:https?:)?\/\/[^"']*cloudnestra[^"']*/);
            if (vidsrcMatch) {
                embedUrl = vidsrcMatch[0];
            } else if (cloudnestraMatch) {
                embedUrl = cloudnestraMatch[0];
            }
        }

        if (embedUrl) {
            if (embedUrl.startsWith('//')) {
                embedUrl = 'https:' + embedUrl;
            }
            console.log('Found embed URL:', embedUrl);
            
            if (embedUrl.includes('vidsrcme.vidsrc.icu')) {
                console.log('🔧 Fetching and cleaning vidsrcme player...');
                try {
                    const playerResponse = await fetch(embedUrl, {
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                            'Accept-Language': 'en-US,en;q=0.9',
                            'Referer': 'https://vidsrc.icu/',
                            'Origin': 'https://vidsrc.icu'
                        },
                        timeout: 10000
                    });
                    
                    if (playerResponse.ok) {
                        let playerHtml = await playerResponse.text();
                        console.log('Player HTML received, length:', playerHtml.length);
                        
                        const cleanHtml = playerHtml
                            .replace(/g\.json\?sid=[^"']*/g, '') // Google tracking
                            .replace(/pixels\?src=[^"']*/g, '') // Pixel tracking
                            .replace(/reporting\.js[^"']*/g, '') // Reporting
                            .replace(/cast_sender\.js[^"']*/g, '') // Chrome Cast
                            .replace(/<script[^>]*g\.json[^>]*><\/script>/g, '') // Google script tags
                            .replace(/<script[^>]*pixels[^>]*><\/script>/g, ''); // Pixel script tags
                        
                        console.log('Player cleaned, new length:', cleanHtml.length);
                        
                        return {
                            type: 'html',
                            content: cleanHtml,
                            originalUrl: embedUrl
                        };
                    }
                } catch (playerError) {
                    console.log('Failed to fetch/clean player, returning original URL:', playerError.message);
                }
            }
            
            return {
                type: 'url',
                content: embedUrl
            };
        } else {
            console.log('No embed URL found');
            return null;
        }
    } catch (error) {
        console.error('Error getting Cloudnestra embed URL:', error);
        return null;
    }
}

async function getTvCloudnestraEmbedUrl(tvId, season, episode) {
    try {
        console.log('Getting Cloudnestra embed URL for TV series:', { tvId, season, episode });
        
        const userAgents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:132.0) Gecko/20100101 Firefox/132.0',
            'Mozilla/5.0 (X11; Linux x86_64; rv:132.0) Gecko/20100101 Firefox/132.0'
        ];
        
        const randomUserAgent = userAgents[Math.floor(Math.random() * userAgents.length)];
        
        const vidsrcApiUrl = `https://vidsrc.icu/embed/tv/${tvId}/${season}/${episode}`;
        console.log('Fetching from vidsrc API:', vidsrcApiUrl);
        console.log('Using User-Agent:', randomUserAgent);

        await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));

        // Proxy seçimi
        const selectedProxy = getRandomProxy();
        const fetchOptions = {
            headers: {
                'User-Agent': randomUserAgent,
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive',
                'Referer': 'https://vidsrc.icu/',
                'Origin': 'https://vidsrc.icu',
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'same-origin',
                'Sec-Fetch-User': '?1',
                'Upgrade-Insecure-Requests': '1',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache',
                'DNT': '1',
                'Sec-Ch-Ua': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
                'Sec-Ch-Ua-Mobile': '?0',
                'Sec-Ch-Ua-Platform': '"Windows"',
                'Sec-Ch-Ua-Platform-Version': '"15.0.0"',
                'Sec-Ch-Ua-Arch': '"x86"',
                'Sec-Ch-Ua-Model': '""',
                'Sec-Ch-Ua-Bitness': '"64"',
                'Sec-Ch-Ua-Full-Version-List': '"Google Chrome";v="131.0.6778.85", "Chromium";v="131.0.6778.85", "Not_A Brand";v="24.0.0.0"'
            },
            timeout: 20000
        };

        // Proxy kullanımı (eğer varsa)
        if (selectedProxy) {
            console.log('Using proxy for TV:', selectedProxy);
            fetchOptions.agent = createProxyAgent(selectedProxy);
        } else {
            console.log('No proxy configured for TV, using direct connection');
        }

        const response = await fetch(vidsrcApiUrl, fetchOptions);

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
        console.log('Vidsrc TV response received, length:', html.length);

        if (html.includes('cf-browser-verification') || html.includes('challenge-platform')) {
            throw new Error('Cloudflare verification page detected');
        }

        const iframeMatches = html.match(/<iframe[^>]*src="([^"]*)"[^>]*>/g);
        console.log('Found TV iframes:', iframeMatches);

        let embedUrl = null;
        if (iframeMatches) {
            for (const iframe of iframeMatches) {
                const srcMatch = iframe.match(/src="([^"]*)"/);
                if (srcMatch) {
                    const src = srcMatch[1];
                    console.log('Found TV iframe src:', src);
                    if (src.includes('vidsrc.icu') || src.includes('cloudnestra')) {
                        embedUrl = src;
                        break;
                    }
                }
            }
        }

        if (!embedUrl) {
            const vidsrcMatch = html.match(/(?:https?:)?\/\/[^"']*vidsrc[^"']*/);
            const cloudnestraMatch = html.match(/(?:https?:)?\/\/[^"']*cloudnestra[^"']*/);
            if (vidsrcMatch) {
                embedUrl = vidsrcMatch[0];
            } else if (cloudnestraMatch) {
                embedUrl = cloudnestraMatch[0];
            }
        }

        if (embedUrl) {
            if (embedUrl.startsWith('//')) {
                embedUrl = 'https:' + embedUrl;
            }
            console.log('Found TV embed URL:', embedUrl);
            
            if (embedUrl.includes('vidsrcme.vidsrc.icu')) {
                console.log('🔧 Fetching and cleaning vidsrcme player...');
                try {
                    const playerResponse = await fetch(embedUrl, {
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                            'Accept-Language': 'en-US,en;q=0.9',
                            'Referer': 'https://vidsrc.icu/',
                            'Origin': 'https://vidsrc.icu'
                        },
                        timeout: 10000
                    });
                    
                    if (playerResponse.ok) {
                        let playerHtml = await playerResponse.text();
                        console.log('Player HTML received, length:', playerHtml.length);
                        
                        const cleanHtml = playerHtml
                            .replace(/g\.json\?sid=[^"']*/g, '') // Google tracking
                            .replace(/pixels\?src=[^"']*/g, '') // Pixel tracking
                            .replace(/reporting\.js[^"']*/g, '') // Reporting
                            .replace(/cast_sender\.js[^"']*/g, '') // Chrome Cast
                            .replace(/<script[^>]*g\.json[^>]*><\/script>/g, '') // Google script tags
                            .replace(/<script[^>]*pixels[^>]*><\/script>/g, ''); // Pixel script tags
                        
                        console.log('Player cleaned, new length:', cleanHtml.length);
                        
                        return {
                            type: 'html',
                            content: cleanHtml,
                            originalUrl: embedUrl
                        };
                    }
                } catch (playerError) {
                    console.log('Failed to fetch/clean player, returning original URL:', playerError.message);
                }
            }
            
            return {
                type: 'url',
                content: embedUrl
            };
        } else {
            console.log('No TV embed URL found');
            return null;
        }
    } catch (error) {
        console.error('Error getting TV Cloudnestra embed URL:', error);
        return null;
    }
}

app.get('/api/smart-embed', async (req, res) => {
  try {
    const { movieId, tvId, season, episode, retryCount = 0 } = req.query;
    
    if (tvId && season && episode) {
      console.log(`=== TV Series Embed Fetching Started ===`);
      console.log(`TV ID: ${tvId}, Season: ${season}, Episode: ${episode}`);
      
      try {
        const embedUrl = await getTvCloudnestraEmbedUrl(tvId, season, episode);
        
        if (!embedUrl) {
          throw new Error('Failed to get TV series embed URL from vidsrc');
        }
        
        console.log('✅ TV Series Embed URL is working, returning to client');
        return res.json({
          cloudnestraEmbedUrl: embedUrl,
          source: 'cloudnestra',
          status: 'fresh',
          type: 'tv',
          tvId: tvId,
          season: season,
          episode: episode
        });
        
      } catch (tvError) {
        console.error('TV Series loading error:', tvError);
        return res.status(400).json({ 
          error: 'TV series video not available',
          details: tvError.message 
        });
      }
    }
    
    if (!movieId) {
      return res.status(400).json({ error: 'Movie ID or TV series parameters required' });
    }

    console.log(`=== Smart Embed Fetching Started (Attempt ${retryCount + 1}) ===`);
    console.log(`Movie ID: ${movieId}`);

    const embedUrl = await getCloudnestraEmbedUrl(movieId);
    
    if (!embedUrl) {
      throw new Error('Failed to get embed URL from vidsrc');
    }

    let finalEmbedUrl = embedUrl;
    if (typeof embedUrl === 'object' && embedUrl.type) {
      if (embedUrl.type === 'html') {
        console.log('✅ Cleaned HTML player returned to client');
        return res.json({
          cloudnestraEmbedUrl: embedUrl,
          source: 'vidsrc',
          status: 'fresh',
          retryCount: retryCount
        });
      } else if (embedUrl.type === 'url') {
        finalEmbedUrl = embedUrl.content;
      }
    }

    try {
      const testResponse = await fetch(finalEmbedUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': 'https://vidsrc.icu/',
          'Origin': 'https://vidsrc.icu'
        },
        timeout: 10000
      });

      if (testResponse.ok) {
        console.log('✅ Embed URL is working, returning to client');
        return res.json({
          cloudnestraEmbedUrl: embedUrl, // Return original object/URL
          source: 'vidsrc',
          status: 'fresh',
          retryCount: retryCount
        });
      } else {
        console.log(`❌ Embed URL returned ${testResponse.status}, trying to refresh...`);
        
        if (retryCount >= 2) {
          throw new Error(`Embed URL expired after ${retryCount + 1} attempts. Vidsrc URLs have very short lifespan.`);
        }

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
              let altFinalUrl = altEmbedUrl;
              if (typeof altEmbedUrl === 'object' && altEmbedUrl.type === 'url') {
                altFinalUrl = altEmbedUrl.content;
              }
              
              const altTestResponse = await fetch(altFinalUrl, {
                headers: {
                  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                  'Referer': 'https://vidsrc.icu/',
                  'Origin': 'https://vidsrc.icu'
                },
                timeout: 10000
              });

              if (altTestResponse.ok) {
                console.log(`✅ Alternative movie ID ${altId} worked!`);
                return res.json({
                  cloudnestraEmbedUrl: altEmbedUrl,
                  source: 'vidsrc',
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

        console.log('Trying original movie ID again...');
        return res.redirect(`/api/smart-embed?movieId=${movieId}&retryCount=${retryCount + 1}`);
      }
    } catch (testErr) {
      console.error('Error testing embed URL:', testErr);
      
      if (retryCount >= 2) {
        throw new Error(`Failed to get working embed URL after ${retryCount + 1} attempts: ${testErr.message}`);
      }

      return res.redirect(`/api/smart-embed?movieId=${movieId}&retryCount=${retryCount + 1}`);
    }

  } catch (error) {
    console.error('Smart embed error:', error);
    
    // Check if it's a Cloudflare protection error
    if (error.message.includes('Cloudflare') || error.message.includes('403') || error.message.includes('verification')) {
      res.status(503).json({
        error: 'Video service temporarily unavailable',
        details: 'Cloudflare protection is blocking our server. This is a temporary issue.',
        suggestion: 'Please try again in a few minutes or try a different movie',
        retryAfter: 300 // 5 minutes
      });
    } else if (error.message.includes('Rate limit') || error.message.includes('429')) {
      res.status(429).json({
        error: 'Too many requests',
        details: 'Rate limit exceeded. Please wait before trying again.',
        suggestion: 'Please wait a few minutes before trying again',
        retryAfter: 600 // 10 minutes
      });
    } else {
      res.status(500).json({
        error: 'Smart embed failed',
        details: error.message,
        suggestion: 'Try refreshing the page or try a different movie'
      });
    }
  }
});

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

app.post('/upload', upload.fields([{ name: 'video' }, { name: 'duration' }]), (req, res) => {
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

app.use(express.json());

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
                running = running.filter(pr => pr.isPending && !pr.isFulfilled);
            }
        }
        await Promise.all(running);
    } catch (error) {
        console.error('Error processing video:', error);
        throw error;
    }
}

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

app.get('/api/movies', async (req, res) => {
  try {
    const response = await fetch('https://vidsrc.icu/vapi/movie/new');
    const data = await response.json();
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch movies' });
  }
});

app.get('/proxy/stream', async (req, res) => {
    const streamUrl = req.query.url;
    console.log('Proxy request for:', streamUrl);

    if (!streamUrl || !/^https?:\/\//.test(streamUrl)) {
        console.error('Proxy Error: Invalid stream URL format', streamUrl);
        return res.status(400).json({ error: 'Stream URL must be absolute (http/https)' });
    }

    try {
        const isPlaylist = streamUrl.toLowerCase().endsWith('.m3u8');
        console.log('Is playlist request:', isPlaylist);

        const fetchOptions = {
            headers: {
                'Accept': isPlaylist ? 'application/x-mpegURL,application/vnd.apple.mpegurl,*/*' : '*/*',
                'Accept-Language': 'en-US,en;q=0.9',
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
            }
        };

        console.log('Fetching from original URL:', streamUrl);
        const response = await fetch(streamUrl, fetchOptions);

        if (!response.ok) {
            console.error('Proxy Error: Stream fetch failed', response.status, response.statusText, streamUrl);
            const headers = Object.fromEntries(response.headers.entries());
            return res.status(response.status).json({
                error: `Failed to fetch stream from source (${response.status})`,
                details: response.statusText,
                url: streamUrl,
                headers: headers, // Add response headers for debugging
                timestamp: new Date().toISOString(),
                platform: req.headers['sec-ch-ua-platform'] || 'unknown'
            });
        }

        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS, HEAD');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Range, Origin, Referer, Cache-Control, Pragma, If-Modified-Since, If-None-Match');
        res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges, Content-Type, Cache-Control, Pragma, Expires');
        res.setHeader('Access-Control-Allow-Credentials', 'true');

        if (req.method === 'OPTIONS') {
             console.log('Received OPTIONS request, sending 200 OK');
             return res.status(200).end();
        }

        response.headers.forEach((value, name) => {
            if (!['access-control-allow-origin', 'access-control-allow-methods', 'access-control-allow-headers', 'access-control-expose-headers', 'content-length', 'content-encoding'].includes(name.toLowerCase())) {
                res.setHeader(name, value);
            }
        });

        if (isPlaylist) {
            console.log('Processing M3U8 playlist...');
            const playlistContent = await response.text();
            const lines = playlistContent.split('\n');
            const baseUrl = streamUrl.substring(0, streamUrl.lastIndexOf('/') + 1);

            const processedLines = lines.map(line => {
                if (line && !line.startsWith('#') && !line.startsWith('http://') && !line.startsWith('https://') && !line.startsWith('/')) {
                    const absoluteUrl = baseUrl + line;
                    console.log(`Resolved relative URL: ${line} -> ${absoluteUrl}`);
                    return `/proxy/stream?url=${encodeURIComponent(absoluteUrl)}`;
                } else if (line && !line.startsWith('#') && line.startsWith('/')) {
                    const origin = new URL(streamUrl).origin;
                    const absoluteUrl = origin + line;
                     console.log(`Resolved root-relative URL: ${line} -> ${absoluteUrl}`);
                     return `/proxy/stream?url=${encodeURIComponent(absoluteUrl)}`;
                }
                 else if (line && !line.startsWith('#') && (line.startsWith('http://') || line.startsWith('https://'))) {
                     console.log(`Found absolute URL in playlist: ${line}`);
                     return `/proxy/stream?url=${encodeURIComponent(line)}`;
                }
                return line; // Keep comment lines and other directives as is
            });

            const processedPlaylist = processedLines.join('\n');
            console.log('Processed Playlist Sample:', processedPlaylist.substring(0, 500)); // Log first 500 chars

            res.setHeader('Content-Type', 'application/x-mpegURL'); // Standard HLS content type
            res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600');
            res.status(200).send(processedPlaylist);

        } else {
            console.log('Piping stream segment...');
            
            response.body.on('error', (error) => {
                console.error('Stream pipe error:', error);
                if (!res.headersSent) {
                    res.status(500).json({
                        error: 'Stream pipe failed',
                        details: error.message,
                        timestamp: new Date().toISOString(),
                        url: streamUrl
                    });
                }
            });
            
            response.body.pipe(res);
        }

    } catch (error) {
        console.error('Proxy Error: Exception during proxying', error);
        if (!res.headersSent) {
            res.status(500).json({
                error: 'Failed to proxy stream due to internal error',
                details: error.message,
                url: streamUrl,
                timestamp: new Date().toISOString(),
                platform: req.headers['sec-ch-ua-platform'] || 'unknown',
                stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
            });
        }
    }
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/movie', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'movie.html'));
});

app.get('/tv', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'tv.html'));
});

app.get('/sbx.html', (req, res) => {
    console.log('🔧 Direct sbx.html request received');
    
    const fallbackHtml = `<!DOCTYPE html>
<html>
<head>
    <title>SBX</title>
    <meta charset="utf-8">
</head>
<body>
    <script>
        try {
            if (window.parent && window.parent !== window) {
                window.parent.postMessage('sbx-handled', '*');
                window.close();
            }
        } catch (error) {
            try { window.close(); } catch(e) {}
        }
    </script>
</body>
</html>`;
    
    try {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.send(fallbackHtml);
        console.log('✅ sbx.html response sent successfully');
    } catch (error) {
        console.error('❌ Error sending sbx.html:', error);
        res.status(500).send('Internal Server Error');
    }
});

app.get('/sbx.js', (req, res) => {
    console.log('🔧 Direct sbx.js request received');
    
    const sbxJs = `// Sandbox detection bypass
try {
    if (window.parent && window.parent !== window) {
        window.parent.postMessage('sbx-handled', '*');
        window.close();
    }
} catch (error) {
    try { window.close(); } catch(e) {}
}`;
    
    try {
        res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.send(sbxJs);
        console.log('✅ sbx.js response sent successfully');
    } catch (error) {
        console.error('❌ Error sending sbx.js:', error);
        res.status(500).send('// Error occurred');
    }
});

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
            vidsrcApiUrl = `https://vidsrc.icu/embed/movie/${movieId}`;
        } else {
            vidsrcApiUrl = `https://vidsrc.icu/embed/tv/${tvId}/${season}/${episode}`;
        }
        console.log('Fetching from vidsrc API:', vidsrcApiUrl);

        const userAgents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0'
        ];
        
        const randomUserAgent = userAgents[Math.floor(Math.random() * userAgents.length)];
        console.log('Using User-Agent:', randomUserAgent);

        await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 3000));

        const response = await fetch(vidsrcApiUrl, {
            headers: {
                'User-Agent': randomUserAgent,
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9,tr-TR;q=0.8,tr;q=0.7',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive',
                'Referer': 'https://vidsrc.icu/',
                'Origin': 'https://vidsrc.icu',
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'same-origin',
                'Sec-Fetch-User': '?1',
                'Upgrade-Insecure-Requests': '1',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache',
                'DNT': '1',
                'Sec-Ch-Ua': '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
                'Sec-Ch-Ua-Mobile': '?0',
                'Sec-Ch-Ua-Platform': '"Windows"'
            },
            timeout: 15000
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
                    if (src.includes('vidsrc.icu')) {
                        embedUrl = src;
                        source = 'vidsrc';
                        break;
                    } else if (src.includes('cloudnestra')) {
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
            const vidsrcMatch = html.match(/(?:https?:)?\/\/[^"']*vidsrc[^"']*/);
            const cloudnestraMatch = html.match(/(?:https?:)?\/\/[^"']*cloudnestra[^"']*/);
            const vidplayMatch = html.match(/(?:https?:)?\/\/[^"']*vidplay[^"']*/);
            const upcloudMatch = html.match(/(?:https?:)?\/\/[^"']*upcloud[^"']*/);
            if (vidsrcMatch) {
                embedUrl = vidsrcMatch[0];
                source = 'vidsrc';
            } else if (cloudnestraMatch) {
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
            if (embedUrl.startsWith('//')) {
                embedUrl = 'https:' + embedUrl;
            }
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

app.post('/api/chat', async (req, res) => {
    try {
        const { message } = req.body;

        if (!message) {
            return res.status(400).json({ error: 'Message is required' });
        }

        const userId = req.headers['x-user-id'] || Date.now().toString();

        const response = await getAIResponse(message, userId);

        const { imdbIds, tmdbIds } = extractIds(response);
        console.log('Extracted IDs:', { imdbIds, tmdbIds }); // Debug log

        const apiKey = process.env.TMDB_API_KEY || 'fda9bed2dd52a349ecb7cfe38b050ca5';
        const movieDetails = await Promise.all([
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

app.get('/config/firebase.json', (req, res) => {
  const firebaseConfig = {
    apiKey: process.env.FIREBASE_API_KEY,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN,
    projectId: process.env.FIREBASE_PROJECT_ID,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.FIREBASE_API_ID || process.env.FIREBASE_APP_ID,
    measurementId: process.env.FIREBASE_MEASUREMENT_ID
  };

  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json');
  res.json(firebaseConfig);
});

app.get('/config/firebase.js', (req, res) => {
  const firebaseConfig = {
    apiKey: process.env.FIREBASE_API_KEY,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN,
    projectId: process.env.FIREBASE_PROJECT_ID,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.FIREBASE_API_ID || process.env.FIREBASE_APP_ID,
    measurementId: process.env.FIREBASE_MEASUREMENT_ID
  };

  const body = `window.__FIREBASE_CONFIG__ = ${JSON.stringify(firebaseConfig)};\n` +
    `(function(){\n` +
    `  if (window.firebase && (!firebase.apps || !firebase.apps.length)) {\n` +
    `    firebase.initializeApp(window.__FIREBASE_CONFIG__);\n` +
    `  }\n` +
    `})();`;

  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/javascript');
  res.send(body);
});

app.use(express.static('public', {
  setHeaders: (res, path) => {
    if (path.endsWith('.mp4')) {
      res.setHeader('Content-Type', 'video/mp4');
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Cache-Control', 'public, max-age=3600');
    } else if (path.endsWith('.m3u8')) {
      res.setHeader('Content-Type', 'application/x-mpegURL');
      res.setHeader('Cache-Control', 'public, max-age=3600');
    } else if (path.endsWith('.ts')) {
      res.setHeader('Content-Type', 'video/MP2T');
      res.setHeader('Cache-Control', 'public, max-age=3600');
    }
    
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Range, Origin, X-Requested-With, Content-Type, Accept, Authorization');
  }
}));