import express from 'express';
import cors from 'cors';
import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dirs = ['bin', 'tmp', 'downloads', 'audio'].reduce((acc, dir) => ({ ...acc, [dir]: path.join(__dirname, dir) }), {});
const ytDlpPath = path.join(dirs.bin, 'yt-dlp');
const BASE_URL = 'http://3.148.245.238:3000';

const app = express();
app.use(cors(), express.json(), express.static('public'));
app.use('/videos', express.static(dirs.downloads));
app.use('/audio', express.static(dirs.audio));

// Utilidades
const ensureDirs = () => Object.values(dirs).forEach(dir => !fs.existsSync(dir) && fs.mkdirSync(dir, { recursive: true }));
const sanitize = name => name.replace(/[<>:"/\\|?*]/g, '').replace(/\s+/g, '_').substring(0, 100);
const exec$ = cmd => new Promise((resolve, reject) => exec(cmd, { maxBuffer: 50 * 1024 * 1024 }, (err, out) => err ? reject(err) : resolve(out)));
const asyncWrap = fn => (req, res, next) => fn(req, res, next).catch(next);

// Configuración yt-dlp
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

const createCookies = () => {
    const file = path.join(dirs.tmp, `${Date.now()}_cookies.txt`);
    fs.writeFileSync(file, cookies.join('\n'));
    return file;
};

const ytCmd = (cookies, args) => `"${ytDlpPath}" --user-agent "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" --referer "https://www.youtube.com/" --cookies "${cookies}" --extractor-args "youtube:po_token=MlIA-K3hKvNzAQDDEqKnJ20fjHLnTPKXlzRBO0fMmYY2wAA8D2kU-OhmZpWEX4GahXMUaX0E3thjodkX84alMkci1107MFF913sP2_WkOY0a44Dp" ${args}`;

// Inicialización
const initYtDlp = async () => {
    if (fs.existsSync(ytDlpPath)) return;
    
    for (const cmd of [`curl -L -o "${ytDlpPath}" https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp`, `wget -O "${ytDlpPath}" https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp`]) {
        try {
            await exec$(cmd);
            if (fs.existsSync(ytDlpPath)) {
                process.platform !== 'win32' && fs.chmodSync(ytDlpPath, 0o755);
                return;
            }
        } catch (e) { continue; }
    }
    throw new Error('No se pudo descargar yt-dlp');
};

// Funciones principales
const getInfo = async (url, cookies) => {
    const out = await exec$(ytCmd(cookies, `--dump-json "${url}"`));
    const info = JSON.parse(out);
    return {
        title: info.title || 'Sin título',
        duration: info.duration || 0,
        resolution: info.resolution || (info.height ? `${info.height}p` : 'N/A'),
        thumbnail: info.thumbnail,
        uploader: info.uploader,
        uploadDate: info.upload_date,
        viewCount: info.view_count,
        description: info.description,
        id: info.id
    };
};

const downloadVideo = async (url, cookies, info) => {
    const safe = sanitize(info.title);
    const output = path.join(dirs.downloads, `${safe}_${info.id || Date.now()}.%(ext)s`);
    await exec$(ytCmd(cookies, `--format "best[ext=mp4]/best" --output "${output}" "${url}"`));
    
    const files = fs.readdirSync(dirs.downloads);
    const file = files.find(f => f.includes(safe) || (info.id && f.includes(info.id)));
    if (!file) throw new Error('Archivo no encontrado');
    
    const filePath = path.join(dirs.downloads, file);
    return {
        filename: file,
        path: filePath,
        size: fs.statSync(filePath).size,
        url: `/videos/${file}`,
        downloadUrl: `${BASE_URL}/videos/${file}`
    };
};

const downloadAudio = async (url, cookies, info, format = 'mp3', quality = '192') => {
    const safe = sanitize(info.title);
    const filename = `${safe}_${info.id || Date.now()}.${format}`;
    const output = path.join(dirs.audio, filename);
    
    await exec$(ytCmd(cookies, `--extract-audio --audio-format ${format} --audio-quality ${quality} --output "${output}" "${url}"`));
    
    return {
        filename,
        path: output,
        size: fs.statSync(output).size,
        format,
        quality,
        url: `/audio/${filename}`,
        downloadUrl: `${BASE_URL}/audio/${filename}`
    };
};

const convertToAudio = async (videoPath, format = 'mp3', quality = '192') => {
    const name = path.basename(videoPath, path.extname(videoPath));
    const audioFile = `${name}.${format}`;
    const audioPath = path.join(dirs.audio, audioFile);
    
    const codecs = { mp3: 'libmp3lame', aac: 'aac', ogg: 'libvorbis', wav: 'pcm_s16le' };
    const qualityParam = format === 'ogg' ? `-q:a ${Math.ceil(parseInt(quality) / 32)}` : `-b:a ${quality}k`;
    
    await exec$(`ffmpeg -i "${videoPath}" -vn -acodec ${codecs[format]} ${qualityParam} "${audioPath}" -y`);
    
    return {
        filename: audioFile,
        path: audioPath,
        size: fs.statSync(audioPath).size,
        format,
        quality,
        url: `/audio/${audioFile}`,
        downloadUrl: `${BASE_URL}/audio/${audioFile}`
    };
};

const cleanup = () => {
    try {
        fs.readdirSync(dirs.tmp)
            .filter(f => f.includes('_cookies.txt'))
            .forEach(f => {
                const file = path.join(dirs.tmp, f);
                if (Date.now() - fs.statSync(file).mtime.getTime() > 3600000) fs.unlinkSync(file);
            });
    } catch (e) {}
};

// Procesamiento principal
const processVideo = async (url, dlVideo = false, dlAudio = false, audioFormat = 'mp3', audioQuality = '192') => {
    ensureDirs();
    cleanup();
    await initYtDlp();
    
    const cookies = createCookies();
    try {
        const info = await getInfo(url, cookies);
        const result = { ...info };
        
        if (dlVideo) result.download = await downloadVideo(url, cookies, info);
        if (dlAudio) result.audio = await downloadAudio(url, cookies, info, audioFormat, audioQuality);
        
        return result;
    } finally {
        fs.existsSync(cookies) && fs.unlinkSync(cookies);
    }
};

// Middlewares
const validateUrl = (req, res, next) => req.query.url ? next() : res.status(400).json({ error: 'URL requerida' });
const validateFormat = (req, res, next) => ['mp3', 'aac', 'ogg', 'wav'].includes(req.query.format || 'mp3') ? next() : res.status(400).json({ error: 'Formato inválido' });

// Rutas
app.get('/api/info', validateUrl, asyncWrap(async (req, res) => {
    const result = await processVideo(req.query.url);
    res.json({ success: true, data: result });
}));

app.get('/api/download/video', validateUrl, asyncWrap(async (req, res) => {
    const result = await processVideo(req.query.url, true);
    res.json({ success: true, data: result });
}));

app.get('/api/download/audio', validateUrl, validateFormat, asyncWrap(async (req, res) => {
    const { url, format = 'mp3', quality = '192' } = req.query;
    const result = await processVideo(url, false, true, format, quality);
    res.json({ success: true, data: result });
}));

app.post('/api/convert/audio', asyncWrap(async (req, res) => {
    const { filename, format = 'mp3', quality = '192' } = req.body;
    if (!filename) return res.status(400).json({ error: 'Filename requerido' });
    
    const videoPath = path.join(dirs.downloads, filename);
    if (!fs.existsSync(videoPath)) return res.status(404).json({ error: 'Video no encontrado' });
    if (!['mp3', 'aac', 'ogg', 'wav'].includes(format)) return res.status(400).json({ error: 'Formato inválido' });
    
    const audio = await convertToAudio(videoPath, format, quality);
    res.json({ success: true, data: { originalVideo: filename, audio } });
}));

// Listar archivos
const createList = (dir, type) => (req, res) => {
    try {
        const files = fs.readdirSync(dir).map(file => {
            const stats = fs.statSync(path.join(dir, file));
            return {
                filename: file,
                size: stats.size,
                created: stats.birthtime,
                ...(type === 'audio' && { format: path.extname(file).substring(1) }),
                url: `/${type}/${file}`,
                downloadUrl: `${BASE_URL}/${type}/${file}`
            };
        }).sort((a, b) => new Date(b.created) - new Date(a.created));
        
        res.json({ success: true, data: { count: files.length, [type]: files } });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
};

app.get('/api/downloads', createList(dirs.downloads, 'videos'));
app.get('/api/audio', createList(dirs.audio, 'audios'));

// Eliminar archivos
const createDelete = (dir, type) => (req, res) => {
    try {
        const file = path.join(dir, req.params.filename);
        if (!fs.existsSync(file)) return res.status(404).json({ error: 'Archivo no encontrado' });
        
        fs.unlinkSync(file);
        res.json({ success: true, message: `${req.params.filename} eliminado` });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
};

app.delete('/api/downloads/:filename', createDelete(dirs.downloads, 'video'));
app.delete('/api/audio/:filename', createDelete(dirs.audio, 'audio'));

// Salud
app.get('/health', (req, res) => res.json({
    status: 'ok',
    endpoints: {
        info: '/api/info?url=VIDEO_URL',
        downloadVideo: '/api/download/video?url=VIDEO_URL',
        downloadAudio: '/api/download/audio?url=VIDEO_URL&format=mp3&quality=192',
        convertAudio: '/api/convert/audio (POST)',
        listVideos: '/api/downloads',
        listAudios: '/api/audio'
    }
}));

// Error handler
app.use((err, req, res, next) => res.status(500).json({ error: err.message }));

// Servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 API running on ${BASE_URL}`));

export default app;
