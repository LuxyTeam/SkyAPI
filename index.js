import express from 'express';
import cors from 'cors';
import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import os from 'os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Usar directorios temporales del sistema
const tmpDir = os.tmpdir();
const ytDlpPath = path.join(tmpDir, 'yt-dlp');

// Función para descargar yt-dlp si no existe
async function ensureYtDlp() {
    if (fs.existsSync(ytDlpPath)) {
        return;
    }

    return new Promise((resolve, reject) => {
        console.log('Descargando yt-dlp...');
        
        const command = `curl -L -o "${ytDlpPath}" https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp`;
        
        exec(command, (error, stdout, stderr) => {
            if (error) {
                reject(new Error(`Error descargando yt-dlp: ${error.message}`));
                return;
            }

            try {
                fs.chmodSync(ytDlpPath, 0o755);
                console.log('yt-dlp descargado correctamente.');
                resolve();
            } catch (chmodError) {
                reject(new Error(`Error configurando permisos: ${chmodError.message}`));
            }
        });
    });
}

function generateCookiesFile() {
    const now = Date.now();
    const cookiesPath = path.join(tmpDir, `${now}_cookies.txt`);

    const netscapeCookies = [
        '# Netscape HTTP Cookie File',
        '# http://curl.haxx.se/rfc/cookie_spec.html',
        '# This is a generated file! Do not edit.',
        '.youtube.com\tTRUE\t/\tTRUE\t1775939339\t__Secure-1PSIDTS\tsidts-CjIB7pHpteU8svvP7SINYgQI7auRSlFiz53gkoICGLnRp55N20CdgsgnQHnEQ7iFnBBIxBAA',
        '.youtube.com\tTRUE\t/\tTRUE\t1775939339\t__Secure-3PSIDTS\tsidts-CjIB7pHpteU8svvP7SINYgQI7auRSlFiz53gkoICGLnRp55N20CdgsgnQHnEQ7iFnBBIxBAA',
        '.youtube.com\tTRUE\t/\tTRUE\t1784957601\t__Secure-3PAPISID\thrUFkzqIw_zF9izw/A66_39yGeLLjUGAXN',
        '.youtube.com\tTRUE\t/\tTRUE\t1776018736\t__Secure-3PSIDCC\tAKEyXzW7YaEfmRjqhIl2Lbut8Nl_d0CFSWQ4zmSE67S95L4P9wvHLQcDt9bLdbZIojNVoeW7',
        '.youtube.com\tTRUE\t/\tTRUE\t1750399401\tGPS\t1',
        '.youtube.com\tTRUE\t/\tTRUE\t1784957601\t__Secure-3PSID\tg.a000yQhzMHhDmgBxOJmcfhmuvCmOLsZ6bgr988YiVv4MqUmcEert_5vEi8Doy6EXNAJnczCIIAACgYKAdESARQSFQHGX2Mi5MA_rTbNKbhKYf-okGxuVBoVAUF8yKpO_ZS0r9UiQ_EdI9TFXMyU0076',
        '.youtube.com\tTRUE\t/\tTRUE\t1784957606\tPREF\tf6=40000000&tz=America.Mexico_City',
        '.youtube.com\tTRUE\t/\tTRUE\t0\tYSC\tLkMOx4oA4sY',
        '.youtube.com\tTRUE\t/\tTRUE\t1765949607\tVISITOR_INFO1_LIVE\tde-HbH90xzI',
        '.youtube.com\tTRUE\t/\tTRUE\t1765949607\tVISITOR_PRIVACY_METADATA\tCgJNWBIEGgAgag%3D%3D',
        '.youtube.com\tTRUE\t/\tTRUE\t1765949604\t__Secure-ROLLOUT_TOKEN\tCLTssqW864iVtAEQgP-vmqP_jQMYhOzPm6P_jQM%3D'
    ];

    try {
        fs.writeFileSync(cookiesPath, netscapeCookies.join('\n'));
        return cookiesPath;
    } catch (error) {
        throw new Error(`Error al crear archivo de cookies: ${error.message}`);
    }
}

// Función para obtener información del video (solo metadata)
async function getVideoInfo(videoUrl, cookiesPath) {
    return new Promise((resolve, reject) => {
        const command = `"${ytDlpPath}" --user-agent "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36" --referer "https://www.youtube.com/" --cookies "${cookiesPath}" --extractor-args "youtube:po_token=MlIA-K3hKvNzAQDDEqKnJ20fjHLnTPKXlzRBO0fMmYY2wAA8D2kU-OhmZpWEX4GahXMUaX0E3thjodkX84alMkci1107MFF913sP2_WkOY0a44Dp" --dump-json "${videoUrl}"`;

        exec(command, { maxBuffer: 1024 * 1024 * 10 }, (error, stdout, stderr) => {
            if (error) {
                reject(new Error(`Error obteniendo información del video: ${error.message}`));
                return;
            }

            if (stderr) {
                console.warn('yt-dlp stderr:', stderr);
            }

            try {
                const videoInfo = JSON.parse(stdout);
                resolve({
                    title: videoInfo.title || 'Sin título',
                    duration: videoInfo.duration || 0,
                    resolution: videoInfo.resolution || (videoInfo.height ? `${videoInfo.height}p` : 'N/A'),
                    thumbnail: videoInfo.thumbnail || null,
                    uploader: videoInfo.uploader || null,
                    uploadDate: videoInfo.upload_date || null,
                    viewCount: videoInfo.view_count || null,
                    description: videoInfo.description || null,
                    id: videoInfo.id || null,
                    url: videoInfo.webpage_url || videoUrl,
                    formats: videoInfo.formats ? videoInfo.formats.map(f => ({
                        format_id: f.format_id,
                        ext: f.ext,
                        quality: f.quality,
                        filesize: f.filesize,
                        url: f.url
                    })).slice(0, 10) : [] // Limitamos a 10 formatos para evitar respuestas muy grandes
                });
            } catch (e) {
                reject(new Error(`Error analizando datos del video: ${e.message}`));
            }
        });
    });
}

// Función para obtener URL de descarga directa (sin descargar al servidor)
async function getDownloadUrl(videoUrl, cookiesPath, format = 'best[ext=mp4]/best') {
    return new Promise((resolve, reject) => {
        const command = `"${ytDlpPath}" --user-agent "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36" --referer "https://www.youtube.com/" --cookies "${cookiesPath}" --extractor-args "youtube:po_token=MlIA-K3hKvNzAQDDEqKnJ20fjHLnTPKXlzRBO0fMmYY2wAA8D2kU-OhmZpWEX4GahXMUaX0E3thjodkX84alMkci1107MFF913sP2_WkOY0a44Dp" --format "${format}" --get-url "${videoUrl}"`;

        exec(command, { maxBuffer: 1024 * 1024 * 10 }, (error, stdout, stderr) => {
            if (error) {
                reject(new Error(`Error obteniendo URL de descarga: ${error.message}`));
                return;
            }

            if (stderr) {
                console.warn('yt-dlp stderr:', stderr);
            }

            const downloadUrl = stdout.trim();
            if (!downloadUrl || !downloadUrl.startsWith('http')) {
                reject(new Error('No se pudo obtener URL de descarga válida'));
                return;
            }

            resolve(downloadUrl);
        });
    });
}

// Función principal
async function processYouTubeVideo(videoUrl, getDirectUrl = false, format = 'best[ext=mp4]/best') {
    try {
        await ensureYtDlp();
        
        const cookiesPath = generateCookiesFile();

        try {
            const videoInfo = await getVideoInfo(videoUrl, cookiesPath);

            if (getDirectUrl) {
                const downloadUrl = await getDownloadUrl(videoUrl, cookiesPath, format);
                return {
                    ...videoInfo,
                    downloadUrl: downloadUrl,
                    format: format
                };
            }

            return videoInfo;
        } finally {
            try {
                if (fs.existsSync(cookiesPath)) {
                    fs.unlinkSync(cookiesPath);
                }
            } catch (cleanupError) {
                console.warn('No se pudo eliminar cookies:', cleanupError.message);
            }
        }
    } catch (error) {
        console.error('Error en processYouTubeVideo:', error.message);
        throw error;
    }
}

// RUTAS DE LA API

// Ruta para obtener solo metadata
app.get('/api/info', async (req, res) => {
    try {
        const { url } = req.query;

        if (!url) {
            return res.status(400).json({
                error: 'URL del video es requerida',
                usage: '/api/info?url=https://youtube.com/watch?v=...'
            });
        }

        const result = await processYouTubeVideo(url, false);

        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Ruta para obtener URL de descarga directa
app.get('/api/download-url', async (req, res) => {
    try {
        const { url, format = 'best[ext=mp4]/best' } = req.query;

        if (!url) {
            return res.status(400).json({
                error: 'URL del video es requerida',
                usage: '/api/download-url?url=https://youtube.com/watch?v=...'
            });
        }

        const result = await processYouTubeVideo(url, true, format);

        res.json({
            success: true,
            data: result,
            message: 'Usa la URL downloadUrl para descargar el video directamente'
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Ruta para obtener formatos disponibles
app.get('/api/formats', async (req, res) => {
    try {
        const { url } = req.query;

        if (!url) {
            return res.status(400).json({
                error: 'URL del video es requerida',
                usage: '/api/formats?url=https://youtube.com/watch?v=...'
            });
        }

        const result = await processYouTubeVideo(url, false);

        res.json({
            success: true,
            data: {
                title: result.title,
                formats: result.formats,
                availableQualities: [
                    'best[ext=mp4]/best',
                    'worst[ext=mp4]/worst',
                    'best[height<=720][ext=mp4]/best[height<=720]',
                    'best[height<=480][ext=mp4]/best[height<=480]',
                    'bestaudio[ext=m4a]/bestaudio'
                ]
            }
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Ruta de salud
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        message: 'YouTube Video Download API funcionando en Vercel',
        endpoints: {
            info: '/api/info?url=VIDEO_URL',
            downloadUrl: '/api/download-url?url=VIDEO_URL&format=FORMAT',
            formats: '/api/formats?url=VIDEO_URL'
        },
        note: 'Esta API proporciona URLs de descarga directa, no almacena videos en el servidor'
    });
});

// Ruta raíz
app.get('/', (req, res) => {
    res.json({
        message: 'YouTube Download API',
        status: 'running',
        documentation: '/health'
    });
});

// Manejo de errores globales
app.use((err, req, res, next) => {
    console.error('Error no manejado:', err);
    res.status(500).json({
        success: false,
        error: 'Error interno del servidor'
    });
});

// Para desarrollo local
if (process.env.NODE_ENV !== 'production') {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`🚀 API ejecutándose en puerto ${PORT}`);
    });
}

export default app;
