#!/bin/bash

echo "🔍 Diagnóstico de conectividad SkyAPI"
echo "===================================="

# 1. Verificar si el proceso está corriendo
echo "1. 📊 Verificando procesos Node.js:"
ps aux | grep node | grep -v grep
echo ""

# 2. Verificar puertos
echo "2. 🔌 Verificando puerto 3000:"
sudo netstat -tulpn | grep :3000
echo ""

# 3. Verificar conectividad local
echo "3. 🏠 Probando conectividad local:"
if curl -s http://localhost:3000/health > /dev/null; then
    echo "✅ Localhost OK"
    curl -s http://localhost:3000/health | jq . 2>/dev/null || curl -s http://localhost:3000/health
else
    echo "❌ Localhost FALLA"
fi
echo ""

# 4. Verificar IP interna
echo "4. 🌐 Probando IP interna:"
INTERNAL_IP=$(hostname -I | awk '{print $1}')
echo "IP interna: $INTERNAL_IP"
if curl -s http://$INTERNAL_IP:3000/health > /dev/null; then
    echo "✅ IP interna OK"
else
    echo "❌ IP interna FALLA"
fi
echo ""

# 5. Verificar firewall
echo "5. 🔥 Estado del firewall:"
sudo ufw status
echo ""

# 6. Verificar IP pública
echo "6. 🌍 IP pública:"
curl -s ifconfig.me
echo ""

# 7. Verificar archivos de configuración
echo "7. 📁 Verificando archivos:"
if [ -f "index.js" ]; then
    echo "✅ index.js existe"
    if grep -q "HOST.*0.0.0.0" index.js; then
        echo "✅ HOST configurado correctamente"
    else
        echo "❌ HOST no configurado o incorrecto"
    fi
else
    echo "❌ index.js no encontrado"
fi
echo ""

# 8. Verificar PM2 si está instalado
echo "8. 📈 Estado PM2:"
if command -v pm2 &> /dev/null; then
    pm2 status
else
    echo "PM2 no está instalado"
fi
echo ""

echo "🔧 Comandos útiles:"
echo "   - Reiniciar con PM2: pm2 restart skyapi"
echo "   - Ver logs: pm2 logs skyapi"
echo "   - Ejecutar directamente: node index.js"
echo "   - Verificar puerto: sudo netstat -tulpn | grep :3000"
