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

// Función para generar cookies de YouTube
function generateYouTubeCookiesFile() {
    const now = Date.now();
    const cookiesPath = path.join(tmpDir, `${now}_youtube_cookies.txt`);

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
        throw new Error(`Error al crear archivo de cookies de YouTube: ${error.message}`);
    }
}

// Función para generar cookies de Spotify (básicas)
function generateSpotifyCookiesFile() {
    const now = Date.now();
    const cookiesPath = path.join(tmpDir, `${now}_spotify_cookies.txt`);

    const netscapeCookies = [
        '# Netscape HTTP Cookie File',
        '# http://curl.haxx.se/rfc/cookie_spec.html',
        '# This is a generated file! Do not edit.',
        '.spotify.com\tTRUE\t/\tFALSE\t0\tsp_t\ttemp_token_placeholder',
        '.open.spotify.com\tTRUE\t/\tFALSE\t0\tsp_dc\ttemp_dc_placeholder'
    ];

    try {
        fs.writeFileSync(cookiesPath, netscapeCookies.join('\n'));
        return cookiesPath;
    } catch (error) {
        throw new Error(`Error al crear archivo de cookies de Spotify: ${error.message}`);
    }
}

// Función para obtener información de video de YouTube
async function getYouTubeVideoInfo(videoUrl, cookiesPath) {
    return new Promise((resolve, reject) => {
        const command = `"${ytDlpPath}" --user-agent "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36" --referer "https://www.youtube.com/" --cookies "${cookiesPath}" --extractor-args "youtube:po_token=MlIA-K3hKvNzAQDDEqKnJ20fjHLnTPKXlzRBO0fMmYY2wAA8D2kU-OhmZpWEX4GahXMUaX0E3thjodkX84alMkci1107MFF913sP2_WkOY0a44Dp" --dump-json "${videoUrl}"`;

        exec(command, { maxBuffer: 1024 * 1024 * 10 }, (error, stdout, stderr) => {
            if (error) {
                reject(new Error(`Error obteniendo información del video de YouTube: ${error.message}`));
                return;
            }

            if (stderr) {
                console.warn('yt-dlp stderr:', stderr);
            }

            try {
                const videoInfo = JSON.parse(stdout);
                resolve({
                    platform: 'youtube',
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
                    })).slice(0, 10) : []
                });
            } catch (e) {
                reject(new Error(`Error analizando datos del video de YouTube: ${e.message}`));
            }
        });
    });
}

// Función para obtener información de track de Spotify
async function getSpotifyTrackInfo(trackUrl, cookiesPath) {
    return new Promise((resolve, reject) => {
        const command = `"${ytDlpPath}" --user-agent "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36" --cookies "${cookiesPath}" --dump-json "${trackUrl}"`;

        exec(command, { maxBuffer: 1024 * 1024 * 10 }, (error, stdout, stderr) => {
            if (error) {
                reject(new Error(`Error obteniendo información del track de Spotify: ${error.message}`));
                return;
            }

            if (stderr) {
                console.warn('yt-dlp stderr:', stderr);
            }

            try {
                const trackInfo = JSON.parse(stdout);
                resolve({
                    platform: 'spotify',
                    title: trackInfo.title || 'Sin título',
                    artist: trackInfo.artist || trackInfo.uploader || 'Artista desconocido',
                    album: trackInfo.album || null,
                    duration: trackInfo.duration || 0,
                    thumbnail: trackInfo.thumbnail || null,
                    releaseDate: trackInfo.release_date || trackInfo.upload_date || null,
                    trackNumber: trackInfo.track_number || null,
                    id: trackInfo.id || null,
                    url: trackInfo.webpage_url || trackUrl,
                    formats: trackInfo.formats ? trackInfo.formats.map(f => ({
                        format_id: f.format_id,
                        ext: f.ext,
                        quality: f.quality,
                        filesize: f.filesize,
                        url: f.url
                    })).slice(0, 10) : []
                });
            } catch (e) {
                reject(new Error(`Error analizando datos del track de Spotify: ${e.message}`));
            }
        });
    });
}

// Función para obtener URL de descarga de YouTube
async function getYouTubeDownloadUrl(videoUrl, cookiesPath, format = 'best[ext=mp4]/best') {
    return new Promise((resolve, reject) => {
        const command = `"${ytDlpPath}" --user-agent "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36" --referer "https://www.youtube.com/" --cookies "${cookiesPath}" --extractor-args "youtube:po_token=MlIA-K3hKvNzAQDDEqKnJ20fjHLnTPKXlzRBO0fMmYY2wAA8D2kU-OhmZpWEX4GahXMUaX0E3thjodkX84alMkci1107MFF913sP2_WkOY0a44Dp" --format "${format}" --get-url "${videoUrl}"`;

        exec(command, { maxBuffer: 1024 * 1024 * 10 }, (error, stdout, stderr) => {
            if (error) {
                reject(new Error(`Error obteniendo URL de descarga de YouTube: ${error.message}`));
                return;
            }

            if (stderr) {
                console.warn('yt-dlp stderr:', stderr);
            }

            const downloadUrl = stdout.trim();
            if (!downloadUrl || !downloadUrl.startsWith('http')) {
                reject(new Error('No se pudo obtener URL de descarga válida de YouTube'));
                return;
            }

            resolve(downloadUrl);
        });
    });
}

// Función para obtener URL de descarga de Spotify
async function getSpotifyDownloadUrl(trackUrl, cookiesPath, format = 'bestaudio[ext=m4a]/bestaudio') {
    return new Promise((resolve, reject) => {
        const command = `"${ytDlpPath}" --user-agent "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36" --cookies "${cookiesPath}" --format "${format}" --get-url "${trackUrl}"`;

        exec(command, { maxBuffer: 1024 * 1024 * 10 }, (error, stdout, stderr) => {
            if (error) {
                reject(new Error(`Error obteniendo URL de descarga de Spotify: ${error.message}`));
                return;
            }

            if (stderr) {
                console.warn('yt-dlp stderr:', stderr);
            }

            const downloadUrl = stdout.trim();
            if (!downloadUrl || !downloadUrl.startsWith('http')) {
                reject(new Error('No se pudo obtener URL de descarga válida de Spotify'));
                return;
            }

            resolve(downloadUrl);
        });
    });
}

// Función para limpiar cookies
function cleanupCookies(cookiesPath) {
    try {
        if (fs.existsSync(cookiesPath)) {
            fs.unlinkSync(cookiesPath);
        }
    } catch (cleanupError) {
        console.warn('No se pudo eliminar cookies:', cleanupError.message);
    }
}

// RUTAS DE YOUTUBE

// Ruta para obtener información de video de YouTube
app.get('/api/youtube/info', async (req, res) => {
    try {
        const { url } = req.query;

        if (!url) {
            return res.status(400).json({
                error: 'URL del video es requerida',
                usage: '/api/youtube/info?url=https://youtube.com/watch?v=...'
            });
        }

        await ensureYtDlp();
        const cookiesPath = generateYouTubeCookiesFile();

        try {
            const result = await getYouTubeVideoInfo(url, cookiesPath);
            res.json({
                success: true,
                data: result
            });
        } finally {
            cleanupCookies(cookiesPath);
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Ruta para obtener URL de descarga de YouTube
app.get('/api/youtube/download-url', async (req, res) => {
    try {
        const { url, format = 'best[ext=mp4]/best' } = req.query;

        if (!url) {
            return res.status(400).json({
                error: 'URL del video es requerida',
                usage: '/api/youtube/download-url?url=https://youtube.com/watch?v=...'
            });
        }

        await ensureYtDlp();
        const cookiesPath = generateYouTubeCookiesFile();

        try {
            const videoInfo = await getYouTubeVideoInfo(url, cookiesPath);
            const downloadUrl = await getYouTubeDownloadUrl(url, cookiesPath, format);

            res.json({
                success: true,
                data: {
                    ...videoInfo,
                    downloadUrl: downloadUrl,
                    format: format
                },
                message: 'Usa la URL downloadUrl para descargar el video directamente'
            });
        } finally {
            cleanupCookies(cookiesPath);
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Ruta para obtener formatos disponibles de YouTube
app.get('/api/youtube/formats', async (req, res) => {
    try {
        const { url } = req.query;

        if (!url) {
            return res.status(400).json({
                error: 'URL del video es requerida',
                usage: '/api/youtube/formats?url=https://youtube.com/watch?v=...'
            });
        }

        await ensureYtDlp();
        const cookiesPath = generateYouTubeCookiesFile();

        try {
            const result = await getYouTubeVideoInfo(url, cookiesPath);

            res.json({
                success: true,
                data: {
                    platform: 'youtube',
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
        } finally {
            cleanupCookies(cookiesPath);
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// RUTAS DE SPOTIFY

// Ruta para obtener información de track de Spotify
app.get('/api/spotify/info', async (req, res) => {
    try {
        const { url } = req.query;

        if (!url) {
            return res.status(400).json({
                error: 'URL del track es requerida',
                usage: '/api/spotify/info?url=https://open.spotify.com/track/...'
            });
        }

        await ensureYtDlp();
        const cookiesPath = generateSpotifyCookiesFile();

        try {
            const result = await getSpotifyTrackInfo(url, cookiesPath);
            res.json({
                success: true,
                data: result
            });
        } finally {
            cleanupCookies(cookiesPath);
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Ruta para obtener URL de descarga de Spotify
app.get('/api/spotify/download-url', async (req, res) => {
    try {
        const { url, format = 'bestaudio[ext=m4a]/bestaudio' } = req.query;

        if (!url) {
            return res.status(400).json({
                error: 'URL del track es requerida',
                usage: '/api/spotify/download-url?url=https://open.spotify.com/track/...'
            });
        }

        await ensureYtDlp();
        const cookiesPath = generateSpotifyCookiesFile();

        try {
            const trackInfo = await getSpotifyTrackInfo(url, cookiesPath);
            const downloadUrl = await getSpotifyDownloadUrl(url, cookiesPath, format);

            res.json({
                success: true,
                data: {
                    ...trackInfo,
                    downloadUrl: downloadUrl,
                    format: format
                },
                message: 'Usa la URL downloadUrl para descargar el audio directamente'
            });
        } finally {
            cleanupCookies(cookiesPath);
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Ruta para obtener formatos disponibles de Spotify
app.get('/api/spotify/formats', async (req, res) => {
    try {
        const { url } = req.query;

        if (!url) {
            return res.status(400).json({
                error: 'URL del track es requerida',
                usage: '/api/spotify/formats?url=https://open.spotify.com/track/...'
            });
        }

        await ensureYtDlp();
        const cookiesPath = generateSpotifyCookiesFile();

        try {
            const result = await getSpotifyTrackInfo(url, cookiesPath);

            res.json({
                success: true,
                data: {
                    platform: 'spotify',
                    title: result.title,
                    artist: result.artist,
                    formats: result.formats,
                    availableQualities: [
                        'bestaudio[ext=m4a]/bestaudio',
                        'bestaudio[ext=mp3]/bestaudio',
                        'bestaudio[ext=ogg]/bestaudio',
                        'bestaudio/best'
                    ]
                }
            });
        } finally {
            cleanupCookies(cookiesPath);
        }
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
        message: 'Multi-Platform Download API funcionando en Vercel',
        platforms: ['youtube', 'spotify'],
        endpoints: {
            youtube: {
                info: '/api/youtube/info?url=VIDEO_URL',
                downloadUrl: '/api/youtube/download-url?url=VIDEO_URL&format=FORMAT',
                formats: '/api/youtube/formats?url=VIDEO_URL'
            },
            spotify: {
                info: '/api/spotify/info?url=TRACK_URL',
                downloadUrl: '/api/spotify/download-url?url=TRACK_URL&format=FORMAT',
                formats: '/api/spotify/formats?url=TRACK_URL'
            }
        },
        note: 'Esta API proporciona URLs de descarga directa, no almacena archivos en el servidor'
    });
});

// Ruta raíz
app.get('/', (req, res) => {
    res.json({
        message: 'Multi-Platform Download API',
        status: 'running',
        platforms: ['YouTube', 'Spotify'],
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
        console.log(`🚀 Multi-Platform API ejecutándose en puerto ${PORT}`);
        console.log('📺 YouTube endpoints: /api/youtube/*');
        console.log('🎵 Spotify endpoints: /api/spotify/*');
    });
}

export default app;
