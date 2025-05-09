const express = require('express');
const multer = require('multer');
const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');

const app = express();
const upload = multer({ dest: 'uploads/' });

app.use(express.static('public')); // static dosyaları (html, css, js) sunmak için

app.listen(3000, () => {
    console.log('Server is running on http://localhost:3000');
});

app.post('/upload', upload.single('video'), (req, res) => {
    if (!req.file) {
        return res.status(400).send('No file uploaded.');
    }

    console.log('Uploaded File:', req.file);

    const videoPath = path.join(__dirname, req.file.path);
    splitVideoIntoClips(videoPath)
        .then(() => {
            res.send('Video uploaded and split successfully!');
        })
        .catch(err => {
            console.error('Error while splitting:', err);
            res.status(500).send('Error processing video.');
        });
});

async function splitVideoIntoClips(videoPath) {
    const outputDir = path.join(__dirname, 'clips');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir);
    }

    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(videoPath, (err, metadata) => {
            if (err) return reject(err);

            const duration = metadata.format.duration;
            const totalClips = Math.ceil(duration / 10);
            console.log(`Video Duration: ${duration} seconds, Total Clips: ${totalClips}`);

            let completed = 0;

            for (let i = 0; i < totalClips; i++) {
                const outputPath = path.join(outputDir, `clip_${i + 1}.mp4`);
                ffmpeg(videoPath)
                    .setStartTime(i * 10)
                    .setDuration(10)
                    .output(outputPath)
                    .on('end', () => {
                        console.log(`Clip ${i + 1} created.`);
                        completed++;
                        if (completed === totalClips) resolve();
                    })
                    .on('error', reject)
                    .run();
            }
        });
    });
}
