let selectedFile = null;
const processingOverlay = document.querySelector('.processing-overlay');
const clipDurationModal = document.querySelector('.clip-duration-modal');
const durationSlider = document.querySelector('.duration-slider');
const sliderValue = document.querySelector('.slider-value');
const confirmButton = document.querySelector('.confirm-button');

durationSlider.addEventListener('input', (e) => {
    sliderValue.textContent = `${e.target.value} saniye`;
});

function handleFileSelect(file) {
    if (!file) return;
    
    if (!file.type.startsWith('video/')) {
        alert('Lütfen geçerli bir video dosyası seçin.');
        return;
    }

    const maxSize = 100 * 1024 * 1024;
    if (file.size > maxSize) {
        alert('Dosya boyutu çok büyük. Maksimum 100MB olmalıdır.');
        return;
    }

    selectedFile = file;
    
    clipDurationModal.style.display = 'flex';
}

confirmButton.addEventListener('click', async () => {
    const duration = parseInt(durationSlider.value);
    
    clipDurationModal.style.display = 'none';
    processingOverlay.style.display = 'flex';

    try {
        const formData = new FormData();
        formData.append('video', selectedFile);
        formData.append('duration', duration);

        const response = await fetch('/process-video', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error('Video işleme başarısız oldu');
        }

        const result = await response.json();
        
        processingOverlay.style.display = 'none';
        
        if (result.success) {
            alert('Video başarıyla işlendi!');
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

document.querySelector('input[type="file"]').addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        handleFileSelect(e.target.files[0]);
    }
}); 