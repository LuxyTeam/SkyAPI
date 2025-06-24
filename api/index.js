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

// Función para extraer información de Spotify usando scraping web
async function getSpotifyTrackInfo(spotifyUrl) {
    return new Promise((resolve, reject) => {
        // Extraer el ID de la canción de la URL de Spotify
        const trackIdMatch = spotifyUrl.match(/track\/([a-zA-Z0-9]+)/);
        if (!trackIdMatch) {
            reject(new Error('URL de Spotify inválida'));
            return;
        }

        const trackId = trackIdMatch[1];
        const embedUrl = `https://open.spotify.com/embed/track/${trackId}`;

        // Usar curl para obtener información básica del embed
        const command = `curl -s -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" "${embedUrl}"`;

        exec(command, (error, stdout, stderr) => {
            if (error) {
                reject(new Error(`Error obteniendo información de Spotify: ${error.message}`));
                return;
            }

            try {
                // Buscar información en el HTML del embed
                const titleMatch = stdout.match(/<title[^>]*>([^<]+)<\/title>/i);
                const ogTitleMatch = stdout.match(/property="og:title"[^>]*content="([^"]+)"/i);
                const ogDescriptionMatch = stdout.match(/property="og:description"[^>]*content="([^"]+)"/i);

                let title = 'Canción desconocida';
                let artist = 'Artista desconocido';

                if (ogTitleMatch) {
                    title = ogTitleMatch[1].replace(/&amp;/g, '&').replace(/&quot;/g, '"');
                } else if (titleMatch) {
                    title = titleMatch[1].replace(/&amp;/g, '&').replace(/&quot;/g, '"');
                }

                if (ogDescriptionMatch) {
                    const description = ogDescriptionMatch[1];
                    const artistMatch = description.match(/Song\s*·\s*([^·]+)/i) || description.match(/([^·]+)\s*·/);
                    if (artistMatch) {
                        artist = artistMatch[1].trim();
                    }
                }

                // Si no encontramos el artista en la descripción, intentar extraerlo del título
                if (artist === 'Artista desconocido' && title.includes('·')) {
                    const parts = title.split('·');
                    if (parts.length >= 2) {
                        artist = parts[0].trim();
                        title = parts[1].trim();
                    }
                }

                resolve({
                    title: title,
                    artist: artist,
                    spotifyUrl: spotifyUrl,
                    trackId: trackId
                });

            } catch (parseError) {
                reject(new Error(`Error analizando información de Spotify: ${parseError.message}`));
            }
        });
    });
}

// Función para buscar en YouTube usando yt-dlp
async function searchYouTube(query, cookiesPath) {
    return new Promise((resolve, reject) => {
        const searchQuery = `ytsearch5:"${query}"`;
        const command = `"${ytDlpPath}" --user-agent "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36" --referer "https://www.youtube.com/" --cookies "${cookiesPath}" --extractor-args "youtube:po_token=MlIA-K3hKvNzAQDDEqKnJ20fjHLnTPKXlzRBO0fMmYY2wAA8D2kU-OhmZpWEX4GahXMUaX0E3thjodkX84alMkci1107MFF913sP2_WkOY0a44Dp" --dump-json "${searchQuery}"`;

        exec(command, { maxBuffer: 1024 * 1024 * 10 }, (error, stdout, stderr) => {
            if (error) {
                reject(new Error(`Error buscando en YouTube: ${error.message}`));
                return;
            }

            if (stderr) {
                console.warn('yt-dlp stderr:', stderr);
            }

            try {
                const lines = stdout.trim().split('\n').filter(line => line.trim());
                const results = lines.map(line => {
                    try {
                        return JSON.parse(line);
                    } catch (e) {
                        return null;
                    }
                }).filter(result => result !== null);

                if (results.length === 0) {
                    reject(new Error('No se encontraron resultados en YouTube'));
                    return;
                }

                // Formatear resultados
                const formattedResults = results.map(video => ({
                    id: video.id,
                    title: video.title,
                    uploader: video.uploader,
                    duration: video.duration,
                    url: video.webpage_url,
                    thumbnail: video.thumbnail
                }));

                resolve(formattedResults);

            } catch (parseError) {
                reject(new Error(`Error analizando resultados de búsqueda: ${parseError.message}`));
            }
        });
    });
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
                    })).slice(0, 10) : []
                });
            } catch (e) {
                reject(new Error(`Error analizando datos del video: ${e.message}`));
            }
        });
    });
}

// Función para obtener URL de descarga directa (sin descargar al servidor)
async function getDownloadUrl(videoUrl, cookiesPath, format = 'bestaudio[ext=m4a]/bestaudio') {
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

// Función principal para procesar video de YouTube
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

// Función principal para procesar canción de Spotify
async function processSpotifyTrack(spotifyUrl, getDirectUrl = false, format = 'bestaudio[ext=m4a]/bestaudio') {
    try {
        await ensureYtDlp();
        
        const cookiesPath = generateCookiesFile();

        try {
            // Obtener información de Spotify
            const spotifyInfo = await getSpotifyTrackInfo(spotifyUrl);
            
            // Buscar en YouTube
            const searchQuery = `${spotifyInfo.artist} ${spotifyInfo.title}`;
            const youtubeResults = await searchYouTube(searchQuery, cookiesPath);
            
            if (youtubeResults.length === 0) {
                throw new Error('No se encontraron resultados en YouTube para esta canción');
            }

            // Usar el primer resultado (más relevante)
            const bestMatch = youtubeResults[0];
            const videoInfo = await getVideoInfo(bestMatch.url, cookiesPath);

            const result = {
                spotify: spotifyInfo,
                youtube: videoInfo,
                searchResults: youtubeResults,
                selectedVideo: bestMatch
            };

            if (getDirectUrl) {
                const downloadUrl = await getDownloadUrl(bestMatch.url, cookiesPath, format);
                result.downloadUrl = downloadUrl;
                result.format = format;
            }

            return result;

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
        console.error('Error en processSpotifyTrack:', error.message);
        throw error;
    }
}

// RUTAS DE LA API

// Ruta para obtener información de canción de Spotify
app.get('/api/spotify/info', async (req, res) => {
    try {
        const { url } = req.query;

        if (!url) {
            return res.status(400).json({
                error: 'URL de Spotify es requerida',
                usage: '/api/spotify/info?url=https://open.spotify.com/track/...'
            });
        }

        if (!url.includes('spotify.com/track/')) {
            return res.status(400).json({
                error: 'URL debe ser de una canción de Spotify',
                example: 'https://open.spotify.com/track/4iV5W9uYEdYUVa79Axb7Rh'
            });
        }

        const result = await processSpotifyTrack(url, false);

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

// Ruta para descargar canción de Spotify
app.get('/api/spotify/download', async (req, res) => {
    try {
        const { url, format = 'bestaudio[ext=m4a]/bestaudio' } = req.query;

        if (!url) {
            return res.status(400).json({
                error: 'URL de Spotify es requerida',
                usage: '/api/spotify/download?url=https://open.spotify.com/track/...'
            });
        }

        if (!url.includes('spotify.com/track/')) {
            return res.status(400).json({
                error: 'URL debe ser de una canción de Spotify',
                example: 'https://open.spotify.com/track/4iV5W9uYEdYUVa79Axb7Rh'
            });
        }

        const result = await processSpotifyTrack(url, true, format);

        res.json({
            success: true,
            data: result,
            message: 'Usa la URL downloadUrl para descargar la canción directamente'
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Ruta para buscar canciones en YouTube
app.get('/api/search', async (req, res) => {
    try {
        const { q } = req.query;

        if (!q) {
            return res.status(400).json({
                error: 'Parámetro de búsqueda "q" es requerido',
                usage: '/api/search?q=nombre de la canción'
            });
        }

        await ensureYtDlp();
        const cookiesPath = generateCookiesFile();

        try {
            const results = await searchYouTube(q, cookiesPath);

            res.json({
                success: true,
                data: {
                    query: q,
                    results: results
                }
            });

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
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Ruta para obtener solo metadata de YouTube
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

// Ruta para obtener URL de descarga directa de YouTube
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
        message: 'YouTube/Spotify Download API funcionando',
        endpoints: {
            // Spotify endpoints
            spotifyInfo: '/api/spotify/info?url=SPOTIFY_TRACK_URL',
            spotifyDownload: '/api/spotify/download?url=SPOTIFY_TRACK_URL&format=FORMAT',
            
            // YouTube endpoints
            youtubeInfo: '/api/info?url=YOUTUBE_URL',
            youtubeDownload: '/api/download-url?url=YOUTUBE_URL&format=FORMAT',
            youtubeFormats: '/api/formats?url=YOUTUBE_URL',
            
            // Search endpoint
            search: '/api/search?q=SEARCH_QUERY'
        },
        supportedFormats: {
            audio: [
                'bestaudio[ext=m4a]/bestaudio',
                'bestaudio[ext=mp3]/bestaudio',
                'worst[ext=m4a]/worst'
            ],
            video: [
                'best[ext=mp4]/best',
                'worst[ext=mp4]/worst',
                'best[height<=720][ext=mp4]/best[height<=720]',
                'best[height<=480][ext=mp4]/best[height<=480]'
            ]
        },
        note: 'Esta API busca canciones de Spotify en YouTube y proporciona URLs de descarga directa'
    });
});

// Ruta raíz
app.get('/', (req, res) => {
    res.json({
        message: 'YouTube/Spotify Download API',
        status: 'running',
        documentation: '/health',
        features: [
            'Descargar videos de YouTube',
            'Buscar y descargar canciones de Spotify via YouTube',
            'Búsqueda de canciones en YouTube',
            'Múltiples formatos de descarga'
        ]
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
        console.log(`📱 Endpoints disponibles:`);
        console.log(`   - Spotify: http://localhost:${PORT}/api/spotify/info?url=SPOTIFY_URL`);
        console.log(`   - YouTube: http://localhost:${PORT}/api/info?url=YOUTUBE_URL`);
        console.log(`   - Búsqueda: http://localhost:${PORT}/api/search?q=QUERY`);
        console.log(`   - Salud: http://localhost:${PORT}/health`);
    });
}

export default app;
