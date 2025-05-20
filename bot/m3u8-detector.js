const puppeteer = require('puppeteer-core');
const express = require('express');
const cors = require('cors');
const path = require('path');
const os = require('os');

const app = express();
app.use(cors());
app.use(express.json());

// Chrome profil dizinini belirle
const userDataDir = path.join(os.homedir(), 'ChromeProfile');

async function findM3U8Url(movieId) {
    const browser = await puppeteer.launch({
        headless: false,
        executablePath: process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        userDataDir: userDataDir,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--window-size=1920x1080',
            '--enable-extensions',
            '--load-extension=' + path.join(os.homedir(), 'AppData', 'Local', 'Google', 'Chrome', 'User Data', 'Default', 'Extensions', 'bndbpnjhldlmmdchlehgnahpclegglkc'),
            '--disable-web-security',
            '--allow-running-insecure-content'
        ]
    });

    try {
        const page = await browser.newPage();
        
        // Network isteklerini dinle
        let m3u8Url = null;
        page.on('response', async response => {
            const url = response.url();
            if (url.includes('.m3u8')) {
                m3u8Url = url;
                console.log('M3U8 URL found:', url);
            }
        });

        // Film sayfasına git
        await page.goto(`https://vidsrc.xyz/embed/movie/${movieId}`, {
            waitUntil: 'networkidle0',
            timeout: 30000
        });

        // Eklentinin m3u8 URL'sini bulması için biraz bekle
        await page.waitForTimeout(10000);

        // Eğer m3u8 URL'si bulunamadıysa, eklentinin arayüzünden almayı dene
        if (!m3u8Url) {
            m3u8Url = await page.evaluate(() => {
                // Eklentinin arayüzünden m3u8 URL'sini al
                const extensionElement = document.querySelector('[data-extension-id="bndbpnjhldlmmdchlehgnahpclegglkc"]');
                if (extensionElement) {
                    return extensionElement.getAttribute('data-stream-url');
                }
                return null;
            });
        }

        return m3u8Url;
    } catch (error) {
        console.error('Error finding m3u8 URL:', error);
        throw error;
    } finally {
        await browser.close();
    }
}

// API endpoint to get m3u8 URL
app.get('/api/m3u8/:movieId', async (req, res) => {
    try {
        const movieId = req.params.movieId;
        const m3u8Url = await findM3U8Url(movieId);
        
        if (m3u8Url) {
            res.json({ success: true, url: m3u8Url });
        } else {
            res.status(404).json({ success: false, error: 'M3U8 URL not found' });
        }
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`M3U8 Detector Bot running on port ${PORT}`);
    console.log('Make sure you have installed the Advanced Streaming URL Detector extension in Chrome!');
}); 