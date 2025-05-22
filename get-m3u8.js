const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { HttpsProxyAgent } = require('https-proxy-agent');
const { SocksProxyAgent } = require('socks-proxy-agent');

// Stealth plugin'i ekle
puppeteer.use(StealthPlugin());

// Cloudflare bypass için gerekli ayarlar
const CLOUDFLARE_BYPASS_OPTIONS = {
    waitUntil: ['networkidle0', 'domcontentloaded'],
    timeout: 30000,
    waitForTimeout: 5000
};

async function getStreamingUrls(imdbId) {
    const url = `https://vidsrc.xyz/embed/movie/${imdbId}`;
    
    // Proxy ayarları (opsiyonel)
    const proxyUrl = process.env.HTTP_PROXY || process.env.HTTPS_PROXY;
    let agent = null;
    if (proxyUrl) {
        if (proxyUrl.startsWith('socks')) {
            agent = new SocksProxyAgent(proxyUrl);
        } else {
            agent = new HttpsProxyAgent(proxyUrl);
        }
    }

    const browser = await puppeteer.launch({ 
        headless: false,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--disable-gpu',
            '--window-size=1920x1080',
            '--disable-web-security',
            '--disable-features=IsolateOrigins,site-per-process',
            '--disable-blink-features=AutomationControlled',
            agent ? `--proxy-server=${proxyUrl}` : ''
        ].filter(Boolean),
        ignoreHTTPSErrors: true
    });
    
    const page = await browser.newPage();
    
    // Cloudflare bypass için gerekli headers
    await page.setExtraHTTPHeaders({
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Cache-Control': 'max-age=0'
    });

    // WebGL ve Canvas fingerprint'lerini gizle
    await page.evaluateOnNewDocument(() => {
        // WebGL fingerprint
        const getParameter = WebGLRenderingContext.prototype.getParameter;
        WebGLRenderingContext.prototype.getParameter = function(parameter) {
            if (parameter === 37445) {
                return 'Intel Inc.';
            }
            if (parameter === 37446) {
                return 'Intel Iris OpenGL Engine';
            }
            return getParameter.apply(this, arguments);
        };

        // Canvas fingerprint
        const originalGetContext = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function(type, attributes) {
            const context = originalGetContext.call(this, type, attributes);
            if (type === '2d') {
                const originalGetImageData = context.getImageData;
                context.getImageData = function() {
                    const imageData = originalGetImageData.apply(this, arguments);
                    // Rastgele noise ekle
                    for (let i = 0; i < imageData.data.length; i += 4) {
                        imageData.data[i] = imageData.data[i] + Math.random() * 2 - 1;
                    }
                    return imageData;
                };
            }
            return context;
        };
    });

    // Performans optimizasyonları
    await page.setRequestInterception(true);
    page.on('request', (request) => {
        const resourceType = request.resourceType();
        if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
            request.abort();
        } else {
            // Cloudflare bypass için özel headers ekle
            const headers = request.headers();
            headers['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
            request.continue({ headers });
        }
    });

    const streamingUrls = new Set();
    let currentUrl = url;
    let redirectCount = 0;
    const MAX_REDIRECTS = 5;

    // Network isteklerini dinle
    page.on('response', async (response) => {
        const responseUrl = response.url();
        if (responseUrl.includes('.m3u8') || 
            responseUrl.includes('/playlist') || 
            responseUrl.includes('/manifest') ||
            responseUrl.includes('/master')) {
            streamingUrls.add(responseUrl);
        }
    });

    try {
        while (redirectCount < MAX_REDIRECTS) {
            // Cloudflare bypass için özel bekleme stratejisi
            await page.goto(currentUrl, CLOUDFLARE_BYPASS_OPTIONS);
            
            // Cloudflare challenge kontrolü
            const isCloudflare = await page.evaluate(() => {
                return document.title.includes('Cloudflare') || 
                       document.querySelector('#challenge-running') !== null ||
                       document.querySelector('#cf-please-wait') !== null;
            });

            if (isCloudflare) {
                console.log('Cloudflare challenge detected, waiting...');
                await page.waitForTimeout(5000); // Cloudflare challenge için bekle
                
                // Challenge'ı geçmek için mouse hareketleri
                await page.mouse.move(Math.random() * 800, Math.random() * 600);
                await page.mouse.move(Math.random() * 800, Math.random() * 600);
                await page.mouse.click(Math.random() * 800, Math.random() * 600);
                
                await page.waitForTimeout(2000);
            }

            // Yeni URL'yi kontrol et
            const newUrl = page.url();
            if (newUrl !== currentUrl) {
                currentUrl = newUrl;
                redirectCount++;
                console.log(`Redirect detected: ${currentUrl}`);
                continue;
            }

            // 1. Server/source butonuna tıkla (varsa)
            const sourceClicked = await page.evaluate(() => {
                const btn = document.querySelector('.server, .source');
                if (btn) {
                    btn.click();
                    return true;
                }
                return false;
            });
            if (sourceClicked) {
                await page.waitForTimeout(1000); // iframe yüklenmesi için bekle
            }

            // 2. iframe'in yüklenmesini bekle
            const iframeSelector = 'iframe';
            let iframeBox = null;
            try {
                await page.waitForSelector(iframeSelector, { timeout: 7000 });
                // 3. iframe'in ortasına tıkla
                iframeBox = await page.evaluate(() => {
                    const iframe = document.querySelector('iframe');
                    if (!iframe) return null;
                    const rect = iframe.getBoundingClientRect();
                    return {
                        x: rect.x + rect.width / 2,
                        y: rect.y + rect.height / 2
                    };
                });
            } catch (e) {
                // iframe yoksa devam et
            }
            if (iframeBox) {
                await page.mouse.click(iframeBox.x, iframeBox.y);
                await page.waitForTimeout(2000); // video başlatma için bekle
            }

            // Script'leri tara
            const scriptUrls = await page.evaluate(() => {
                const urls = new Set();
                const patterns = [
                    /https?:\/\/[^"']*\.m3u8[^"']*/g,
                    /https?:\/\/[^"']*\/playlist[^"']*/g,
                    /https?:\/\/[^"']*\/manifest[^"']*/g,
                    /https?:\/\/[^"']*\/master[^"']*/g
                ];
                document.querySelectorAll('script').forEach(script => {
                    const content = script.textContent;
                    patterns.forEach(pattern => {
                        const matches = content.match(pattern);
                        if (matches) matches.forEach(url => urls.add(url));
                    });
                });
                return Array.from(urls);
            });
            scriptUrls.forEach(url => streamingUrls.add(url));

            // Eğer m3u8 URL'si bulunduysa hemen çık
            if (streamingUrls.size > 0) {
                break;
            }

            // Yeni içerik kontrolü
            const newContent = await page.evaluate(() => ({
                hasNewVideo: !!document.querySelector('video'),
                hasNewIframe: !!document.querySelector('iframe')
            }));

            if (!newContent.hasNewVideo && !newContent.hasNewIframe) {
                break;
            }

            // Kısa bekleme
            await page.waitForTimeout(1000);
        }

        // URL'leri temizle ve filtrele
        const cleanUrls = Array.from(streamingUrls)
            .filter(url => {
                try {
                    new URL(url);
                    return true;
                } catch {
                    return false;
                }
            })
            .map(url => {
                try {
                    const urlObj = new URL(url);
                    const params = new URLSearchParams(urlObj.search);
                    const cleanParams = new URLSearchParams();
                    
                    ['token', 'expires', 'signature', 't', 'e', 's'].forEach(param => {
                        if (params.has(param)) {
                            cleanParams.set(param, params.get(param));
                        }
                    });

                    urlObj.search = cleanParams.toString();
                    return urlObj.toString();
                } catch {
                    return url;
                }
            });

        return [...new Set(cleanUrls)];

    } catch (error) {
        console.error('Hata:', error);
        return [];
    } finally {
        await browser.close();
    }
}

// Test fonksiyonu
async function testStreamingUrls() {
    const testMovies = [
        { id: 'tt1392170', name: 'The Hunger Games' },
        { id: 'tt1375666', name: 'Inception' },
        { id: 'tt0111161', name: 'The Shawshank Redemption' }
    ];

    for (const movie of testMovies) {
        console.log(`\n${movie.name} (${movie.id}) için streaming URL'leri aranıyor...`);
        const urls = await getStreamingUrls(movie.id);
        
        if (urls.length > 0) {
            console.log('Bulunan streaming URL\'leri:');
            urls.forEach((url, index) => {
                console.log(`${index + 1}. ${url}`);
            });
        } else {
            console.log('Streaming URL\'i bulunamadı.');
        }
    }
}

// Test çalıştır
testStreamingUrls().catch(console.error);

module.exports = getStreamingUrls;