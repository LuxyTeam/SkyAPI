# Usar imagen base que incluye Node.js y herramientas del sistema
FROM node:18-bullseye

# Instalar Python 3, pip, curl y ffmpeg
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    curl \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Crear enlace simbólico para python (por si yt-dlp busca 'python')
RUN ln -s /usr/bin/python3 /usr/bin/python

# Establecer directorio de trabajo
WORKDIR /app

# Copiar package.json y package-lock.json (si existe)
COPY package*.json ./

# Instalar dependencias de Node.js
RUN npm install --only=production

# Copiar todo el código fuente
COPY . .

# Exponer el puerto (Railway asignará automáticamente)
EXPOSE 3000

# Comando para iniciar la aplicación
CMD ["npm", "start"]
