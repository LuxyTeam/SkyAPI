import express from 'express';
import cors from 'cors';
import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const binDir = path.join(__dirname, 'bin');
const tmpDir = path.join(__dirname, 'tmp');
const downloadsDir = path.join(__dirname, 'downloads'); // Nueva carpeta para videos descargados
const audioDir = path.join(__dirname, 'audio'); // Nueva carpeta para audios convertidos
const ytDlpPath = path.join(binDir, 'yt-dlp');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir archivos estáticos desde la carpeta downloads y audio
app.use('/videos', express.static(downloadsDir));
app.use('/audio', express.static(audioDir));

// Crear directorios necesarios
function ensureDirectories() {
    [binDir, tmpDir, downloadsDir, audioDir].forEach(dir => {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
            console.log(`Directorio creado: ${dir}`);
        }
    });
}

function generateCookiesFile() {
    const now = Date.now();
    const cookiesPath = path.join(tmpDir, `${now}_cookies.txt`);

    const netscapeCookies = [
        '# Netscape HTTP Cookie File',
        '# http://curl.haxx.se/rfc/cookie_spec.html',
        '# This is a generated file!  Do not edit.',
        '.youtube.com\tTRUE\t/\tTRUE\t1775939339\t__Secure-1PSIDTS\tsidts-CjIB7pHpteU8svvP7SINYgQI7auRSlFiz53gkoICGLnRp55N20CdgsgnQHnEQ7iFnBBIxBAA',
        '.youtube.com\tTRUE\t/\tTRUE\t1775939339\t__Secure-3PSIDTS\tsidts-CjIB7pHpteU8svvP7SINYgQI7auRSlFiz53gkoICGLnRp55N20CdgsgnQHnEQ7iFnBBIxBAA',
        '.youtube.com\tTRUE\t/\tTRUE\t1784957601\t__Secure-3PAPISID\thrUFkzqIw_zF9izw/A66_39yGeLLjUGAXN',
        '.youtube.com\tTRUE\t/\tTRUE\t1776018736\t__Secure-3PSIDCC\tAKEyXzW7YaEfmRjqhIl2Lbut8Nl_d0CFSWQ4zmSE67S95L4P9wvHLQcDt9bLdbZIojNVoeW7',
        '.youtube.com\tTRUE\t/\tTRUE\t1784957601\t__Secure-3PSID\tg.a000yQhzMHhDmgBxOJmcfhmuvCmOLsZ6bgr988YiVv4MqUmcEert_5vEi8Doy6EXNAJnczCIIAACgYKAdESARQSFQHGX2Mi5MA_rTbNKbhKYf-okGxuVBoVAUF8yKpO_ZS0r9UiQ_EdI9TFXMyU0076',
        '.youtube.com\tTRUE\t/\tTRUE\t1785375272\tPREF\tf6=40000000&tz=America.Mexico_City',
        '.youtube.com\tTRUE\t/\tTRUE\t1750817067\tGPS\t1',
        '.youtube.com\tTRUE\t/\tTRUE\t1766367276\tVISITOR_INFO1_LIVE\tde-HbH90xzI',
        '.youtube.com\tTRUE\t/\tTRUE\t1766367276\tVISITOR_PRIVACY_METADATA\tCgJNWBIEGgAgag%3D%3D',
        '.youtube.com\tTRUE\t/\tTRUE\t0\tYSC\tfIfFa_ifKL0',
        '.youtube.com\tTRUE\t/\tTRUE\t1766367267\t__Secure-ROLLOUT_TOKEN\tCLTssqW864iVtAEQgP-vmqP_jQMY0MrJkLeLjgM%3D'
    ];

    try {
        fs.writeFileSync(cookiesPath, netscapeCookies.join('\n'));
        return cookiesPath;
    } catch (error) {
        throw new Error(`Error al crear archivo de cookies: ${error.message}`);
    }
}

function downloadYtDlp() {
    return new Promise((resolve, reject) => {
        console.log('Descargando yt-dlp...');

        const commands = [
            `curl -L -o "${ytDlpPath}" https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp`,
            `wget -O "${ytDlpPath}" https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp`
        ];

        const tryDownload = (commandIndex = 0) => {
            if (commandIndex >= commands.length) {
                reject(new Error('No se pudo descargar yt-dlp con ningún método'));
                return;
            }

            const command = commands[commandIndex];
            console.log(`Intentando método ${commandIndex + 1}: ${command.split(' ')[0]}`);

            exec(command, (error, stdout, stderr) => {
                if (error) {
                    console.warn(`Método ${commandIndex + 1} falló:`, error.message);
                    tryDownload(commandIndex + 1);
                    return;
                }

                if (stderr) {
                    console.warn(`Advertencia: ${stderr}`);
                }

                if (!fs.existsSync(ytDlpPath)) {
                    console.warn(`Archivo no encontrado después de descarga`);
                    tryDownload(commandIndex + 1);
                    return;
                }

                if (process.platform !== 'win32') {
                    try {
                        fs.chmodSync(ytDlpPath, 0o755);
                    } catch (chmodError) {
                        console.warn('No se pudo cambiar permisos:', chmodError.message);
                    }
                }

                console.log('yt-dlp descargado correctamente.');
                resolve();
            });
        };

        tryDownload();
    });
}

// Función para limpiar nombre de archivo
function sanitizeFilename(filename) {
    return filename
        .replace(/[<>:"/\\|?*]/g, '') // Remover caracteres no válidos
        .replace(/\s+/g, '_')         // Reemplazar espacios con guiones bajos
        .substring(0, 100);           // Limitar longitud
}

// Función para obtener información del video
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
                    resolution: videoInfo.resolution || videoInfo.height ? `${videoInfo.height}p` : 'N/A',
                    thumbnail: videoInfo.thumbnail || null,
                    uploader: videoInfo.uploader || null,
                    uploadDate: videoInfo.upload_date || null,
                    viewCount: videoInfo.view_count || null,
                    description: videoInfo.description || null,
                    id: videoInfo.id || null
                });
            } catch (e) {
                reject(new Error(`Error analizando datos del video: ${e.message}`));
            }
        });
    });
}

// Función para descargar video localmente
async function downloadVideoToLocal(videoUrl, cookiesPath, videoInfo) {
    return new Promise((resolve, reject) => {
        const safeTitle = sanitizeFilename(videoInfo.title);
        const filename = `${safeTitle}_${videoInfo.id || Date.now()}.%(ext)s`;
        const outputPath = path.join(downloadsDir, filename);

        // Comando para descargar el video en la mejor calidad MP4 disponible
        const command = `"${ytDlpPath}" --user-agent "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36" --referer "https://www.youtube.com/" --cookies "${cookiesPath}" --extractor-args "youtube:po_token=MlIA-K3hKvNzAQDDEqKnJ20fjHLnTPKXlzRBO0fMmYY2wAA8D2kU-OhmZpWEX4GahXMUaX0E3thjodkX84alMkci1107MFF913sP2_WkOY0a44Dp" --format "best[ext=mp4]/best" --output "${outputPath}" "${videoUrl}"`;

        console.log(`Iniciando descarga: ${videoInfo.title}`);

        exec(command, { maxBuffer: 1024 * 1024 * 50 }, (error, stdout, stderr) => {
            if (error) {
                reject(new Error(`Error descargando video: ${error.message}`));
                return;
            }

            if (stderr) {
                console.warn('yt-dlp stderr durante descarga:', stderr);
            }

            // Buscar el archivo descargado
            try {
                const files = fs.readdirSync(downloadsDir);
                const downloadedFile = files.find(file => 
                    file.includes(safeTitle) || 
                    (videoInfo.id && file.includes(videoInfo.id))
                );

                if (!downloadedFile) {
                    reject(new Error('No se pudo encontrar el archivo descargado'));
                    return;
                }

                const filePath = path.join(downloadsDir, downloadedFile);
                const stats = fs.statSync(filePath);

                console.log(`Video descargado exitosamente: ${downloadedFile}`);

                resolve({
                    filename: downloadedFile,
                    path: filePath,
                    size: stats.size,
                    url: `/videos/${downloadedFile}`
                });
            } catch (e) {
                reject(new Error(`Error verificando descarga: ${e.message}`));
            }
        });
    });
}

// Nueva función para descargar directamente como audio
async function downloadAudioToLocal(videoUrl, cookiesPath, videoInfo, format = 'mp3', quality = '192') {
    return new Promise((resolve, reject) => {
        const safeTitle = sanitizeFilename(videoInfo.title);
        const filename = `${safeTitle}_${videoInfo.id || Date.now()}.${format}`;
        const outputPath = path.join(audioDir, filename);

        // Comando para descargar directamente como audio con yt-dlp y ffmpeg
        const command = `"${ytDlpPath}" --user-agent "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36" --referer "https://www.youtube.com/" --cookies "${cookiesPath}" --extractor-args "youtube:po_token=MlIA-K3hKvNzAQDDEqKnJ20fjHLnTPKXlzRBO0fMmYY2wAA8D2kU-OhmZpWEX4GahXMUaX0E3thjodkX84alMkci1107MFF913sP2_WkOY0a44Dp" --extract-audio --audio-format ${format} --audio-quality ${quality} --output "${outputPath}" "${videoUrl}"`;

        console.log(`Iniciando descarga de audio: ${videoInfo.title}`);

        exec(command, { maxBuffer: 1024 * 1024 * 50 }, (error, stdout, stderr) => {
            if (error) {
                reject(new Error(`Error descargando audio: ${error.message}`));
                return;
            }

            if (stderr) {
                console.warn('yt-dlp stderr durante descarga de audio:', stderr);
            }

            // Verificar que el archivo fue creado
            try {
                if (!fs.existsSync(outputPath)) {
                    reject(new Error('No se pudo encontrar el archivo de audio descargado'));
                    return;
                }

                const stats = fs.statSync(outputPath);
                console.log(`Audio descargado exitosamente: ${filename}`);

                resolve({
                    filename: filename,
                    path: outputPath,
                    size: stats.size,
                    format: format,
                    quality: quality,
                    url: `/audio/${filename}`
                });
            } catch (e) {
                reject(new Error(`Error verificando descarga de audio: ${e.message}`));
            }
        });
    });
}

// Función para convertir video existente a audio con ffmpeg
async function convertVideoToAudio(videoPath, format = 'mp3', quality = '192') {
    return new Promise((resolve, reject) => {
        const videoName = path.basename(videoPath, path.extname(videoPath));
        const audioFilename = `${videoName}.${format}`;
        const audioPath = path.join(audioDir, audioFilename);

        // Configurar calidad según el formato
        let qualityParam;
        if (format === 'mp3') {
            qualityParam = `-b:a ${quality}k`;
        } else if (format === 'aac') {
            qualityParam = `-b:a ${quality}k`;
        } else if (format === 'ogg') {
            qualityParam = `-q:a ${Math.ceil(parseInt(quality) / 32)}`;
        } else {
            qualityParam = `-b:a ${quality}k`;
        }

        const command = `ffmpeg -i "${videoPath}" -vn -acodec ${format === 'mp3' ? 'libmp3lame' : format === 'aac' ? 'aac' : 'libvorbis'} ${qualityParam} "${audioPath}" -y`;

        console.log(`Convirtiendo video a audio: ${audioFilename}`);

        exec(command, { maxBuffer: 1024 * 1024 * 50 }, (error, stdout, stderr) => {
            if (error) {
                reject(new Error(`Error convirtiendo a audio: ${error.message}`));
                return;
            }

            if (stderr) {
                console.warn('ffmpeg stderr:', stderr);
            }

            try {
                if (!fs.existsSync(audioPath)) {
                    reject(new Error('No se pudo crear el archivo de audio'));
                    return;
                }

                const stats = fs.statSync(audioPath);
                console.log(`Audio convertido exitosamente: ${audioFilename}`);

                resolve({
                    filename: audioFilename,
                    path: audioPath,
                    size: stats.size,
                    format: format,
                    quality: quality,
                    url: `/audio/${audioFilename}`
                });
            } catch (e) {
                reject(new Error(`Error verificando conversión: ${e.message}`));
            }
        });
    });
}

function cleanup() {
    try {
        // Limpiar cookies temporales
        const files = fs.readdirSync(tmpDir);
        files.forEach(file => {
            if (file.includes('_cookies.txt')) {
                const filePath = path.join(tmpDir, file);
                const stats = fs.statSync(filePath);
                const now = Date.now();
                const fileAge = now - stats.mtime.getTime();

                if (fileAge > 3600000) { // 1 hora
                    fs.unlinkSync(filePath);
                    console.log('Archivo temporal eliminado:', file);
                }
            }
        });

        // Opcional: Limpiar archivos antiguos
        /*
        [downloadsDir, audioDir].forEach(dir => {
            const files = fs.readdirSync(dir);
            files.forEach(file => {
                const filePath = path.join(dir, file);
                const stats = fs.statSync(filePath);
                const now = Date.now();
                const fileAge = now - stats.mtime.getTime();

                // Eliminar archivos más antiguos que 24 horas
                if (fileAge > 86400000) {
                    fs.unlinkSync(filePath);
                    console.log('Archivo antiguo eliminado:', file);
                }
            });
        });
        */
    } catch (error) {
        console.warn('Error en limpieza:', error.message);
    }
}

// Función principal
async function processYouTubeVideo(videoUrl, downloadVideo = false, downloadAudio = false, audioFormat = 'mp3', audioQuality = '192') {
    try {
        ensureDirectories();
        cleanup();

        if (!fs.existsSync(ytDlpPath)) {
            await downloadYtDlp();
        }

        if (process.platform !== 'win32') {
            try {
                const stats = fs.statSync(ytDlpPath);
                if (!(stats.mode & 0o100)) {
                    fs.chmodSync(ytDlpPath, 0o755);
                }
            } catch (permError) {
                console.warn('No se pudieron verificar/cambiar permisos:', permError.message);
            }
        }

        const cookiesPath = generateCookiesFile();

        try {
            // Obtener información del video
            const videoInfo = await getVideoInfo(videoUrl, cookiesPath);
            let result = { ...videoInfo };

            if (downloadVideo) {
                // Descargar video localmente
                const downloadResult = await downloadVideoToLocal(videoUrl, cookiesPath, videoInfo);
                result.download = {
                    filename: downloadResult.filename,
                    size: downloadResult.size,
                    url: downloadResult.url,
                    downloadUrl: `https://skyapi-production-e3e0.up.railway.app${downloadResult.url}`
                };
            }

            if (downloadAudio) {
                // Descargar directamente como audio
                const audioResult = await downloadAudioToLocal(videoUrl, cookiesPath, videoInfo, audioFormat, audioQuality);
                result.audio = {
                    filename: audioResult.filename,
                    size: audioResult.size,
                    format: audioResult.format,
                    quality: audioResult.quality,
                    url: audioResult.url,
                    downloadUrl: `http://skyapi-production-e3e0.up.railway.app${audioResult.url}`
                };
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

        const result = await processYouTubeVideo(url, false, false);

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

// Ruta para descargar video localmente
app.get('/api/download/video', async (req, res) => {
    try {
        const { url } = req.query;

        if (!url) {
            return res.status(400).json({
                error: 'URL del video es requerida',
                usage: '/api/download/video?url=https://youtube.com/watch?v=...'
            });
        }

        const result = await processYouTubeVideo(url, true, false);

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

// Nueva ruta para descargar directamente como audio
app.get('/api/download/audio', async (req, res) => {
    try {
        const { url, format = 'mp3', quality = '192' } = req.query;

        if (!url) {
            return res.status(400).json({
                error: 'URL del video es requerida',
                usage: '/api/download/audio?url=https://youtube.com/watch?v=...&format=mp3&quality=192'
            });
        }

        // Validar formato
        const validFormats = ['mp3', 'aac', 'ogg', 'wav'];
        if (!validFormats.includes(format)) {
            return res.status(400).json({
                error: `Formato no válido. Formatos soportados: ${validFormats.join(', ')}`
            });
        }

        const result = await processYouTubeVideo(url, false, true, format, quality);

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

// Nueva ruta para convertir video existente a audio
app.post('/api/convert/audio', async (req, res) => {
    try {
        const { filename, format = 'mp3', quality = '192' } = req.body;

        if (!filename) {
            return res.status(400).json({
                error: 'Nombre del archivo de video es requerido',
                usage: 'POST /api/convert/audio con body: {"filename": "video.mp4", "format": "mp3", "quality": "192"}'
            });
        }

        const videoPath = path.join(downloadsDir, filename);

        if (!fs.existsSync(videoPath)) {
            return res.status(404).json({
                error: 'Archivo de video no encontrado'
            });
        }

        // Validar formato
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
                audio: {
                    filename: audioResult.filename,
                    size: audioResult.size,
                    format: audioResult.format,
                    quality: audioResult.quality,
                    url: audioResult.url,
                    downloadUrl: `http://skyapi-production-e3e0.up.railway.app${audioResult.url}`
                }
            }
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Ruta para listar videos descargados
app.get('/api/downloads', (req, res) => {
    try {
        const files = fs.readdirSync(downloadsDir);
        const videoFiles = files.map(file => {
            const filePath = path.join(downloadsDir, file);
            const stats = fs.statSync(filePath);

            return {
                filename: file,
                size: stats.size,
                created: stats.birthtime,
                url: `/videos/${file}`,
                downloadUrl: `https://skyapi-production-e3e0.up.railway.app/videos/${file}`
            };
        }).sort((a, b) => new Date(b.created) - new Date(a.created));

        res.json({
            success: true,
            data: {
                count: videoFiles.length,
                videos: videoFiles
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Nueva ruta para listar audios convertidos
app.get('/api/audio', (req, res) => {
    try {
        const files = fs.readdirSync(audioDir);
        const audioFiles = files.map(file => {
            const filePath = path.join(audioDir, file);
            const stats = fs.statSync(filePath);

            return {
                filename: file,
                size: stats.size,
                created: stats.birthtime,
                format: path.extname(file).substring(1),
                url: `/audio/${file}`,
                downloadUrl: `https://skyapi-production-e3e0.up.railway.app/audio/${file}`
            };
        }).sort((a, b) => new Date(b.created) - new Date(a.created));

        res.json({
            success: true,
            data: {
                count: audioFiles.length,
                audios: audioFiles
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Ruta para eliminar un video específico
app.delete('/api/downloads/:filename', (req, res) => {
    try {
        const { filename } = req.params;
        const filePath = path.join(downloadsDir, filename);

        if (!fs.existsSync(filePath)) {
            return res.status(404).json({
                success: false,
                error: 'Archivo no encontrado'
            });
        }

        fs.unlinkSync(filePath);

        res.json({
            success: true,
            message: `Archivo ${filename} eliminado correctamente`
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Nueva ruta para eliminar un audio específico
app.delete('/api/audio/:filename', (req, res) => {
    try {
        const { filename } = req.params;
        const filePath = path.join(audioDir, filename);

        if (!fs.existsSync(filePath)) {
            return res.status(404).json({
                success: false,
                error: 'Archivo de audio no encontrado'
            });
        }

        fs.unlinkSync(filePath);

        res.json({
            success: true,
            message: `Archivo de audio ${filename} eliminado correctamente`
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
        message: 'YouTube Video Download API funcionando',
        endpoints: {
            info: '/api/info?url=VIDEO_URL',
            downloadVideo: '/api/download/video?url=VIDEO_URL',
            downloadAudio: '/api/download/audio?url=VIDEO_URL&format=mp3&quality=192',
            convertAudio: '/api/convert/audio (POST) - Convert existing video to audio',
            listVideos: '/api/downloads',
            listAudios: '/api/audio',
            deleteVideo: '/api/downloads/FILENAME (DELETE method)',
            deleteAudio: '/api/audio/FILENAME (DELETE method)'
        },
        supportedAudioFormats: ['mp3', 'aac', 'ogg', 'wav'],
        audioQualities: {
            mp3: '64k, 128k, 192k, 256k, 320k',
            aac: '64k, 128k, 192k, 256k',
            ogg: 'Quality levels 0-10 (converted from bitrate)',
            wav: 'Lossless'
        }
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

// Inicializar servidor
app.listen(PORT, () => {
    console.log(`🚀 API YouTube Video Download ejecutándose en puerto ${PORT}`);
    console.log(`📊 Salud: http://skyapi-production-e3e0.up.railway.app/health`);
    console.log(`📹 Descargar video: http://skyapi-production-e3e0.up.railway.app/api/download/video?url=https://youtube.com/watch?v=dQw4w9WgXcQ`);
    console.log(`🎵 Descargar audio: http://skyapi-production-e3e0.up.railway.app/api/download/audio?url=https://youtube.com/watch?v=dQw4w9WgXcQ&format=mp3&quality=192`);
    console.log(`🔄 Convertir a audio: POST http://skyapi-production-e3e0.up.railway.app/api/convert/audio`);
    console.log(`📂 Listar videos: http://skyapi-production-e3e0.up.railway.app/api/downloads`);
    console.log(`🎶 Listar audios: http://skyapi-production-e3e0.up.railway.app/api/audio`);
    console.log(`🎥 Videos servidos en: http://skyapi-production-e3e0.up.railway.app/videos/`);
    console.log(`🔊 Audios servidos en: http://skyapi-production-e3e0.up.railway.app/audio/`);
});

export default app;
