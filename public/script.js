// Video işleme ve süre seçimi için değişkenler
let selectedFile = null;
const processingOverlay = document.querySelector('.processing-overlay');
const clipDurationModal = document.querySelector('.clip-duration-modal');
const durationSlider = document.querySelector('.duration-slider');
const sliderValue = document.querySelector('.slider-value');
const confirmButton = document.querySelector('.confirm-button');

// Süre slider'ı değiştiğinde
durationSlider.addEventListener('input', (e) => {
    sliderValue.textContent = `${e.target.value} saniye`;
});

// Dosya seçildiğinde
function handleFileSelect(file) {
    if (!file) return;
    
    // Dosya tipini kontrol et
    if (!file.type.startsWith('video/')) {
        alert('Lütfen geçerli bir video dosyası seçin.');
        return;
    }

    // Dosya boyutunu kontrol et (örn: 100MB)
    const maxSize = 100 * 1024 * 1024; // 100MB in bytes
    if (file.size > maxSize) {
        alert('Dosya boyutu çok büyük. Maksimum 100MB olmalıdır.');
        return;
    }

    selectedFile = file;
    
    // Süre seçim modalını göster
    clipDurationModal.style.display = 'flex';
}

// Süre seçimi onaylandığında
confirmButton.addEventListener('click', async () => {
    const duration = parseInt(durationSlider.value);
    
    // Modalı kapat ve işleme overlay'ini göster
    clipDurationModal.style.display = 'none';
    processingOverlay.style.display = 'flex';

    try {
        // FormData oluştur
        const formData = new FormData();
        formData.append('video', selectedFile);
        formData.append('duration', duration);

        // Video işleme isteği gönder
        const response = await fetch('/process-video', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error('Video işleme başarısız oldu');
        }

        const result = await response.json();
        
        // İşlem başarılı olduğunda
        processingOverlay.style.display = 'none';
        
        // Sonuçları göster veya yönlendir
        if (result.success) {
            // İşlem başarılı mesajı göster
            alert('Video başarıyla işlendi!');
            // Gerekirse sayfayı yenile veya başka bir işlem yap
            window.location.reload();
        } else {
            throw new Error(result.message || 'Bir hata oluştu');
        }

    } catch (error) {
        console.error('Hata:', error);
        processingOverlay.style.display = 'none';
        alert('Video işlenirken bir hata oluştu: ' + error.message);
    }
});

// Drag & Drop olayları
const dropZone = document.querySelector('.container');

dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.add('dragover');
});

dropZone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.remove('dragover');
});

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.remove('dragover');
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        handleFileSelect(files[0]);
    }
});

// Dosya input değiştiğinde
document.querySelector('input[type="file"]').addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        handleFileSelect(e.target.files[0]);
    }
}); 