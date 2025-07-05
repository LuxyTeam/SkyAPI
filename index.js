import express from 'express';
import cors from 'cors';
import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const [binDir, tmpDir, downloadsDir, audioDir] = ['bin', 'tmp', 'downloads', 'audio'].map(dir => path.join(__dirname, dir));
const ytDlpPath = path.join(binDir, 'yt-dlp');
const BASE_URL = 'http://3.148.245.238:3000';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors(), express.json(), express.urlencoded({ extended: true }));
app.use('/videos', express.static(downloadsDir));
app.use('/audio', express.static(audioDir));

// Utilidades
const ensureDirectories = () => [binDir, tmpDir, downloadsDir, audioDir].forEach(dir => 
    !fs.existsSync(dir) && fs.mkdirSync(dir, { recursive: true }));

const sanitizeFilename = filename => filename.replace(/[<>:"/\\|?*]/g, '').replace(/\s+/g, '_').substring(0, 100);

const execPromise = (command, options = {}) => new Promise((resolve, reject) => 
    exec(command, { maxBuffer: 1024 * 1024 * 50, ...options }, (error, stdout, stderr) => {
        if (error) return reject(error);
        if (stderr) console.warn('stderr:', stderr);
        resolve(stdout);
    }));

// Configuración de cookies y comandos
const generateCookiesFile = () => {
    const cookiesPath = path.join(tmpDir, `${Date.now()}_cookies.txt`);
    const cookies = [
        '# Netscape HTTP Cookie File',
        '.youtube.com\tTRUE\t/\tTRUE\t1786185991\tPREF\tf6=40000000&tz=America.Mexico_City&f7=100',
        '.youtube.com\tTRUE\t/\tTRUE\t1751627005\tGPS\t1',
        '.youtube.com\tTRUE\t/\tTRUE\t1783161870\t__Secure-1PSIDTS\tsidts-CjEB5H03P3bG5rxEWjIkP8-W9i8kFhK-wGDoXBbmeXUu6vbGkgba7RU2JfPd8ddYeRBvEAA',
        '.youtube.com\tTRUE\t/\tTRUE\t1783161870\t__Secure-3PSIDTS\tsidts-CjEB5H03P3bG5rxEWjIkP8-W9i8kFhK-wGDoXBbmeXUu6vbGkgba7RU2JfPd8ddYeRBvEAA',
        '.youtube.com\tTRUE\t/\tFALSE\t1786185870\tHSID\tAqm085LL1ZCovB-Tj',
        '.youtube.com\tTRUE\t/\tTRUE\t1786185870\tSSID\tACnA2V-Hllx7OiudL',
        '.youtube.com\tTRUE\t/\tFALSE\t1786185870\tAPISID\tLj5idti3GYo8NrMm/A8qgmgqiVotoVSiER',
        '.youtube.com\tTRUE\t/\tTRUE\t1786185870\tSAPISID\tmGmMYwOfOG4T7lWT/Aer3CoRlPecpb0RVe',
        '.youtube.com\tTRUE\t/\tTRUE\t1786185870\t__Secure-1PAPISID\tmGmMYwOfOG4T7lWT/Aer3CoRlPecpb0RVe',
        '.youtube.com\tTRUE\t/\tTRUE\t1786185870\t__Secure-3PAPISID\tmGmMYwOfOG4T7lWT/Aer3CoRlPecpb0RVe',
        '.youtube.com\tTRUE\t/\tFALSE\t1786185870\tSID\tg.a000ywhzMLYw5AQur2XqGfM3mQzyztPEb8IvxKWR96yAd0ZSl8ysH-wj47xKF-jnaFFmN_FvlAACgYKARsSARQSFQHGX2Mi1J8KbQ1ZTN-QrFgTIKlU2BoVAUF8yKqYUrsbJvlxtL7-6jmwRczb0076',
        '.youtube.com\tTRUE\t/\tTRUE\t1786185870\t__Secure-1PSID\tg.a000ywhzMLYw5AQur2XqGfM3mQzyztPEb8IvxKWR96yAd0ZSl8yse-qX3vmQz5rDqpyb9939mAACgYKAWYSARQSFQHGX2MiCYrZK7tqv5nBBiauJmNLkxoVAUF8yKoTG3VRGmneo8ioo4y9nfL60076',
        '.youtube.com\tTRUE\t/\tTRUE\t1786185870\t__Secure-3PSID\tg.a000ywhzMLYw5AQur2XqGfM3mQzyztPEb8IvxKWR96yAd0ZSl8ysPIRC501X7WtVOmdJcaXEEQACgYKASoSARQSFQHGX2MiMngnl4jmyg7YufD1ud9EExoVAUF8yKroXhW_zvT0eHmmLUzcMf8i0076',
        '.youtube.com\tTRUE\t/\tTRUE\t1786185870\tLOGIN_INFO\tAFmmF2swRQIhAOi9YcO411Xr24mLgoDP7ffh6tLipFagK0WCdXDlbZfKAiBJnvLpKzpF5l1k1SjaGLW6-PW0sVIhCaYcDGFW9O6DDQ:QUQ3MjNmeVBnNS1WcTlYamt4cnlqLVRoSVVNT3ZZVk9lTlBuSC01MVp1WXp2azhxY0RHaUx6SktlOHI2MUFfRll0OEc5dlF5aVg1cEtUZkVRSlhDZUFVcTlPczNkSmpwUXhqaDVsbFllcXUzNDhZRDVyQjZFbGc5Y2J2TkpsTFNTTGtlMnpBcHF2Z3RXLVIwVGl6UVphek05dmNpckM0Sy1B',
        '.youtube.com\tTRUE\t/\tTRUE\t1751626593\tCONSISTENCY\tAKreu9sg_EOTZFOM7cfTq-X_f3Qmnq_dE9V6L2wz-l2sgz2i4AOzKPNEhZqOj-lPXomplUzR7dSgrJV0s1kR4-h2WUAiB2ftJ0MJJctg-4B8cX8nlQ_KiCXYXnQGCnJQnfEpbgcUbJIIcURr9TuHBWRX',
        '.youtube.com\tTRUE\t/\tFALSE\t1783161998\tSIDCC\tAKEyXzX5LT5pkWj3Z9OhM0PTNFODqXp-zrJot3wjNyEpdwLDxCeL7IhM8BDK_8NjkJOFhLdj',
        '.youtube.com\tTRUE\t/\tTRUE\t1783161998\t__Secure-1PSIDCC\tAKEyXzVeFiQ6H349nqNtrGQiVEfvb_m1S0Oj1QY0x1JPzzgtvXFFUqmvFeAZn_XT5-6yvP570A',
        '.youtube.com\tTRUE\t/\tTRUE\t1783161998\t__Secure-3PSIDCC\tAKEyXzX3bAAAUEhgkz7RkNjV3c7vX1IXd1Kisru6uxzr_Qw8iLT90qJlwbNsyXbRVUmAQdEP',
        '.youtube.com\tTRUE\t/\tTRUE\t1767177876\tVISITOR_INFO1_LIVE\tde-HbH90xzI',
        '.youtube.com\tTRUE\t/\tTRUE\t1767177876\tVISITOR_PRIVACY_METADATA\tCgJNWBIEGgAgag%3D%3D',
        '.youtube.com\tTRUE\t/\tTRUE\t0\tYSC\tVbDrIEdf7x8',
        '.youtube.com\tTRUE\t/\tTRUE\t1767177205\t__Secure-ROLLOUT_TOKEN\tCLTssqW864iVtAEQgP-vmqP_jQMYmfrlsICjjgM%3D'
    ];
    
    fs.writeFileSync(cookiesPath, cookies.join('\n'));
    return cookiesPath;
};

const getYtDlpCommand = (cookiesPath, extraArgs = '') => 
    `"${ytDlpPath}" --user-agent "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36" --referer "https://www.youtube.com/" --cookies "${cookiesPath}" --extractor-args "youtube:po_token=MlIA-K3hKvNzAQDDEqKnJ20fjHLnTPKXlzRBO0fMmYY2wAA8D2kU-OhmZpWEX4GahXMUaX0E3thjodkX84alMkci1107MFF913sP2_WkOY0a44Dp" ${extraArgs}`;

// Descargar yt-dlp
const downloadYtDlp = async () => {
    const commands = [
        `curl -L -o "${ytDlpPath}" https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp`,
        `wget -O "${ytDlpPath}" https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp`
    ];
    
    for (const command of commands) {
        try {
            await execPromise(command);
            if (fs.existsSync(ytDlpPath)) {
                process.platform !== 'win32' && fs.chmodSync(ytDlpPath, 0o755);
                console.log('yt-dlp descargado correctamente');
                return;
            }
        } catch (error) {
            console.warn(`Método ${command.split(' ')[0]} falló:`, error.message);
        }
    }
    throw new Error('No se pudo descargar yt-dlp');
};

// Funciones principales
const getVideoInfo = async (videoUrl, cookiesPath) => {
    const command = getYtDlpCommand(cookiesPath, `--dump-json "${videoUrl}"`);
    const stdout = await execPromise(command);
    const info = JSON.parse(stdout);
    
    return {
        title: info.title || 'Sin título',
        duration: info.duration || 0,
        resolution: info.resolution || (info.height ? `${info.height}p` : 'N/A'),
        thumbnail: info.thumbnail || null,
        uploader: info.uploader || null,
        uploadDate: info.upload_date || null,
        viewCount: info.view_count || null,
        description: info.description || null,
        id: info.id || null
    };
};

const downloadVideo = async (videoUrl, cookiesPath, videoInfo) => {
    const safeTitle = sanitizeFilename(videoInfo.title);
    const filename = `${safeTitle}_${videoInfo.id || Date.now()}.%(ext)s`;
    const outputPath = path.join(downloadsDir, filename);
    
    const command = getYtDlpCommand(cookiesPath, `--format "best[ext=mp4]/best" --output "${outputPath}" "${videoUrl}"`);
    await execPromise(command);
    
    const files = fs.readdirSync(downloadsDir);
    const downloadedFile = files.find(file => file.includes(safeTitle) || (videoInfo.id && file.includes(videoInfo.id)));
    
    if (!downloadedFile) throw new Error('Archivo descargado no encontrado');
    
    const filePath = path.join(downloadsDir, downloadedFile);
    const stats = fs.statSync(filePath);
    
    return {
        filename: downloadedFile,
        path: filePath,
        size: stats.size,
        url: `/videos/${downloadedFile}`,
        downloadUrl: `${BASE_URL}/videos/${downloadedFile}`
    };
};

const downloadAudio = async (videoUrl, cookiesPath, videoInfo, format = 'mp3', quality = '192') => {
    const safeTitle = sanitizeFilename(videoInfo.title);
    const filename = `${safeTitle}_${videoInfo.id || Date.now()}.${format}`;
    const outputPath = path.join(audioDir, filename);
    
    const command = getYtDlpCommand(cookiesPath, `--extract-audio --audio-format ${format} --audio-quality ${quality} --output "${outputPath}" "${videoUrl}"`);
    await execPromise(command);
    
    if (!fs.existsSync(outputPath)) throw new Error('Archivo de audio no encontrado');
    
    const stats = fs.statSync(outputPath);
    return {
        filename,
        path: outputPath,
        size: stats.size,
        format,
        quality,
        url: `/audio/${filename}`,
        downloadUrl: `${BASE_URL}/audio/${filename}`
    };
};

const convertVideoToAudio = async (videoPath, format = 'mp3', quality = '192') => {
    const videoName = path.basename(videoPath, path.extname(videoPath));
    const audioFilename = `${videoName}.${format}`;
    const audioPath = path.join(audioDir, audioFilename);
    
    const codecMap = { mp3: 'libmp3lame', aac: 'aac', ogg: 'libvorbis', wav: 'pcm_s16le' };
    const qualityParam = format === 'ogg' ? `-q:a ${Math.ceil(parseInt(quality) / 32)}` : `-b:a ${quality}k`;
    
    const command = `ffmpeg -i "${videoPath}" -vn -acodec ${codecMap[format]} ${qualityParam} "${audioPath}" -y`;
    await execPromise(command);
    
    if (!fs.existsSync(audioPath)) throw new Error('Conversión falló');
    
    const stats = fs.statSync(audioPath);
    return {
        filename: audioFilename,
        path: audioPath,
        size: stats.size,
        format,
        quality,
        url: `/audio/${audioFilename}`,
        downloadUrl: `${BASE_URL}/audio/${audioFilename}`
    };
};

const cleanup = () => {
    try {
        const files = fs.readdirSync(tmpDir);
        files.filter(file => file.includes('_cookies.txt')).forEach(file => {
            const filePath = path.join(tmpDir, file);
            const stats = fs.statSync(filePath);
            const fileAge = Date.now() - stats.mtime.getTime();
            
            if (fileAge > 3600000) { // 1 hora
                fs.unlinkSync(filePath);
                console.log('Archivo temporal eliminado:', file);
            }
        });
    } catch (error) {
        console.warn('Error en limpieza:', error.message);
    }
};

// Función principal optimizada
const processYouTubeVideo = async (videoUrl, downloadVideo = false, downloadAudio = false, audioFormat = 'mp3', audioQuality = '192') => {
    ensureDirectories();
    cleanup();
    
    if (!fs.existsSync(ytDlpPath)) await downloadYtDlp();
    
    // Verificar permisos
    if (process.platform !== 'win32') {
        const stats = fs.statSync(ytDlpPath);
        if (!(stats.mode & 0o100)) fs.chmodSync(ytDlpPath, 0o755);
    }
    
    const cookiesPath = generateCookiesFile();
    
    try {
        const videoInfo = await getVideoInfo(videoUrl, cookiesPath);
        const result = { ...videoInfo };
        
        if (downloadVideo) {
            const downloadResult = await downloadVideo(videoUrl, cookiesPath, videoInfo);
            result.download = downloadResult;
        }
        
        if (downloadAudio) {
            const audioResult = await downloadAudio(videoUrl, cookiesPath, videoInfo, audioFormat, audioQuality);
            result.audio = audioResult;
        }
        
        return result;
    } finally {
        fs.existsSync(cookiesPath) && fs.unlinkSync(cookiesPath);
    }
};

// Middleware para manejo de errores
const asyncHandler = (fn) => (req, res, next) => fn(req, res, next).catch(next);

const validateUrl = (req, res, next) => {
    if (!req.query.url) {
        return res.status(400).json({
            error: 'URL del video es requerida',
            usage: `${req.path}?url=https://youtube.com/watch?v=...`
        });
    }
    next();
};

const validateAudioFormat = (req, res, next) => {
    const { format = 'mp3' } = req.query;
    const validFormats = ['mp3', 'aac', 'ogg', 'wav'];
    
    if (!validFormats.includes(format)) {
        return res.status(400).json({
            error: `Formato no válido. Formatos soportados: ${validFormats.join(', ')}`
        });
    }
    next();
};

// Rutas optimizadas
app.get('/api/info', validateUrl, asyncHandler(async (req, res) => {
    const result = await processYouTubeVideo(req.query.url);
    res.json({ success: true, data: result });
}));

app.get('/api/download/video', validateUrl, asyncHandler(async (req, res) => {
    const result = await processYouTubeVideo(req.query.url, true, false);
    res.json({ success: true, data: result });
}));

app.get('/api/download/audio', validateUrl, validateAudioFormat, asyncHandler(async (req, res) => {
    const { url, format = 'mp3', quality = '192' } = req.query;
    const result = await processYouTubeVideo(url, false, true, format, quality);
    res.json({ success: true, data: result });
}));

app.post('/api/convert/audio', asyncHandler(async (req, res) => {
    const { filename, format = 'mp3', quality = '192' } = req.body;
    
    if (!filename) {
        return res.status(400).json({
            error: 'Nombre del archivo de video es requerido',
            usage: 'POST /api/convert/audio con body: {"filename": "video.mp4", "format": "mp3", "quality": "192"}'
        });
    }
    
    const videoPath = path.join(downloadsDir, filename);
    if (!fs.existsSync(videoPath)) {
        return res.status(404).json({ error: 'Archivo de video no encontrado' });
    }
    
    const validFormats = ['mp3', 'aac', 'ogg', 'wav'];
    if (!validFormats.includes(format)) {
        return res.status(400).json({
            error: `Formato no válido. Formatos soportados: ${validFormats.join(', ')}`
        });
    }
    
    const audioResult = await convertVideoToAudio(videoPath, format, quality);
    res.json({
        success: true,
        data: {
            originalVideo: filename,
            audio: audioResult
        }
    });
}));

// Rutas de listado optimizadas
const createListRoute = (dir, type) => (req, res) => {
    try {
        const files = fs.readdirSync(dir).map(file => {
            const filePath = path.join(dir, file);
            const stats = fs.statSync(filePath);
            
            return {
                filename: file,
                size: stats.size,
                created: stats.birthtime,
                ...(type === 'audio' && { format: path.extname(file).substring(1) }),
                url: `/${type}/${file}`,
                downloadUrl: `${BASE_URL}/${type}/${file}`
            };
        }).sort((a, b) => new Date(b.created) - new Date(a.created));
        
        res.json({
            success: true,
            data: {
                count: files.length,
                [type]: files
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

app.get('/api/downloads', createListRoute(downloadsDir, 'videos'));
app.get('/api/audio', createListRoute(audioDir, 'audios'));

// Rutas de eliminación optimizadas
const createDeleteRoute = (dir, type) => (req, res) => {
    try {
        const { filename } = req.params;
        const filePath = path.join(dir, filename);
        
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({
                success: false,
                error: `Archivo ${type === 'audio' ? 'de audio ' : ''}no encontrado`
            });
        }
        
        fs.unlinkSync(filePath);
        res.json({
            success: true,
            message: `Archivo ${type === 'audio' ? 'de audio ' : ''}${filename} eliminado correctamente`
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

app.delete('/api/downloads/:filename', createDeleteRoute(downloadsDir, 'video'));
app.delete('/api/audio/:filename', createDeleteRoute(audioDir, 'audio'));

// Ruta de salud
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        message: 'YouTube Video Download API funcionando',
        endpoints: {
            info: '/api/info?url=VIDEO_URL',
            downloadVideo: '/api/download/video?url=VIDEO_URL',
            downloadAudio: '/api/download/audio?url=VIDEO_URL&format=mp3&quality=192',
            convertAudio: '/api/convert/audio (POST)',
            listVideos: '/api/downloads',
            listAudios: '/api/audio',
            deleteVideo: '/api/downloads/FILENAME (DELETE)',
            deleteAudio: '/api/audio/FILENAME (DELETE)'
        },
        supportedAudioFormats: ['mp3', 'aac', 'ogg', 'wav'],
        audioQualities: {
            mp3: '64k, 128k, 192k, 256k, 320k',
            aac: '64k, 128k, 192k, 256k',
            ogg: 'Quality levels 0-10',
            wav: 'Lossless'
        }
    });
});

// Manejo de errores global
app.use((err, req, res, next) => {
    console.error('Error:', err.message);
    res.status(500).json({ success: false, error: err.message });
});

// Inicializar servidor
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 API YouTube Download ejecutándose en puerto ${PORT}`);
    console.log(`🌐 Acceso: ${BASE_URL}`);
    console.log(`📊 Salud: ${BASE_URL}/health`);
});

export default app;
