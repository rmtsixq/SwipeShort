const puppeteer = require('puppeteer');

async function getStreamingUrls(imdbId) {
    const url = `https://vidsrc.xyz/embed/movie/${imdbId}`;
    const browser = await puppeteer.launch({ 
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    const streamingUrls = new Set();

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
        // Sayfayı yükle
        await page.goto(url, { 
            waitUntil: 'networkidle2',
            timeout: 30000
        });

        // Video player'ı başlat
        await page.evaluate(async () => {
            // Video elementini bul ve oynat
            const video = document.querySelector('video');
            if (video) {
                try {
                    await video.play();
                    // Video başladıktan sonra quality seçeneklerini kontrol et
                    const qualityButtons = document.querySelectorAll('button[data-quality], .quality-button');
                    if (qualityButtons.length > 0) {
                        // En yüksek kaliteyi seç (genelde ilk buton)
                        qualityButtons[0].click();
                    }
                } catch (e) {
                    console.log('Video otomatik başlatılamadı:', e);
                }
            }

            // Play butonuna tıkla (eğer varsa)
            const playButtons = document.querySelectorAll('button[aria-label="Play"], .play-button, .vjs-big-play-button');
            for (const button of playButtons) {
                try {
                    button.click();
                    break; // İlk çalışan butonu bul
                } catch (e) {}
            }

            // iframe içindeki videoları da kontrol et
            document.querySelectorAll('iframe').forEach(iframe => {
                try {
                    const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
                    const iframeVideo = iframeDoc.querySelector('video');
                    if (iframeVideo) {
                        iframeVideo.play().catch(() => {});
                    }
                } catch (e) {}
            });
        });

        // Sayfadaki script'leri tara
        const scriptUrls = await page.evaluate(() => {
            const urls = new Set();
            const patterns = [
                /https?:\/\/[^"']*\.m3u8[^"']*/g,
                /https?:\/\/[^"']*\/playlist[^"']*/g,
                /https?:\/\/[^"']*\/manifest[^"']*/g,
                /https?:\/\/[^"']*\/master[^"']*/g
            ];

            // Script içeriklerini tara
            document.querySelectorAll('script').forEach(script => {
                const content = script.textContent;
                patterns.forEach(pattern => {
                    const matches = content.match(pattern);
                    if (matches) matches.forEach(url => urls.add(url));
                });
            });

            return Array.from(urls);
        });

        // Script'lerden bulunan URL'leri ekle
        scriptUrls.forEach(url => streamingUrls.add(url));

        // Video başladıktan sonra biraz bekle
        await new Promise(r => setTimeout(r, 5000));

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
                    
                    // Önemli parametreleri koru
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

        return [...new Set(cleanUrls)]; // Tekrar eden URL'leri kaldır

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