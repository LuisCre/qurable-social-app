#!/bin/bash
# ─────────────────────────────────────────────────────────
# Qurable Social — Setup GitHub + Vercel
# Ejecutar desde la carpeta: _sistema/qurable-social-app/
# ─────────────────────────────────────────────────────────

echo "🚀 Iniciando setup de GitHub..."

# Config git
git config user.email "luis.crecelli@gmail.com"
git config user.name "Luis Crecelli"

# Commit inicial
git add -A
git commit -m "feat: Qurable Social v1.0 — generador de piezas para redes

- 5 templates pro: Bold Dark, Purple Brand, Photo Hero, Clean White, Gradient Dark
- Panel de inputs: plataforma, formato, estilo, copy, imagen de fondo, logo
- Export PNG/JPG a resolución nativa (1080px, 2x pixel ratio)
- Brand Qurable: PP Neue Montreal, #6430F7, #1E293B
- Plataformas: IG, LinkedIn, Facebook — formatos 1:1 / 4:5 / 9:16 / 16:9"

echo ""
echo "✅ Commit listo."
echo ""
echo "Ahora:"
echo "1. Andá a https://github.com/new"
echo "2. Creá un repo llamado: qurable-social-app"
echo "3. NO inicialices con README"
echo "4. Copiá la URL del repo (ej: https://github.com/TU_USUARIO/qurable-social-app.git)"
echo ""
echo "Después corrés:"
echo "   git remote add origin https://github.com/TU_USUARIO/qurable-social-app.git"
echo "   git push -u origin main"
echo ""
echo "En Vercel: Import Project → elegís el repo → Deploy ✓"
