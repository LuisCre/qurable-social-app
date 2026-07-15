#!/bin/bash
# ─────────────────────────────────────────────────────────────
# Qurable Social Generator — Deploy script
# Ejecutar desde Terminal: bash deploy.sh
# ─────────────────────────────────────────────────────────────

set -e

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$REPO_DIR"
echo "📁 Directorio: $REPO_DIR"

# ── 1. Limpiar locks y archivos macOS ─────────────────────────
echo ""
echo "🧹 Limpiando..."
rm -f .git/index.lock 2>/dev/null || true
find . -name "._*" -not -path "./.git/*" -delete
find . -name "vite.config.js.timestamp-*" -not -path "./.git/*" -delete
find . -name ".DS_Store" -not -path "./.git/*" -delete

# ── 2. Staging limpio ─────────────────────────────────────────
echo "📦 Preparando archivos..."
git rm -r --cached . -q 2>/dev/null || true
git add .

echo ""
echo "📋 Archivos incluidos:"
git status --short | grep "^[AM]"

# ── 3. Primer commit ──────────────────────────────────────────
echo ""
git config user.name "$(git config user.name 2>/dev/null || echo 'Qurable')"
git config user.email "$(git config user.email 2>/dev/null || echo 'luis.crecelli@gmail.com')"

git commit -m "feat: Qurable Social Generator v1.0

Canvas editor React 18 + Vite con IA (GPT-4o).
Templates: Bold Dark, Purple Brand, Photo Hero, Clean White, Gradient Dark.
AI Generate, AI Compose, drag & drop, resize handles, export PNG/JPG 2x."

echo ""
echo "✅ Commit listo."

# ── 4. GitHub ─────────────────────────────────────────────────
echo ""
echo "──────────────────────────────────────────────────────────"
echo "🚀 PASO SIGUIENTE — Subir a GitHub:"
echo ""
echo "  Opción A — con GitHub CLI (recomendado):"
echo "    brew install gh          # si no lo tenés"
echo "    gh auth login"
echo "    gh repo create qurable-social-app --public --source=. --remote=origin --push"
echo ""
echo "  Opción B — manual:"
echo "    1. Ir a https://github.com/new"
echo "    2. Crear repo: qurable-social-app (sin README, sin .gitignore)"
echo "    3. Copiar la URL del repo (ej: https://github.com/TU_USUARIO/qurable-social-app.git)"
echo "    4. Ejecutar:"
echo "       git remote add origin https://github.com/TU_USUARIO/qurable-social-app.git"
echo "       git branch -M main"
echo "       git push -u origin main"
echo ""
echo "──────────────────────────────────────────────────────────"
echo "🌐 DEPLOY en Vercel:"
echo ""
echo "  Opción A — desde vercel.com (más simple):"
echo "    1. Ir a https://vercel.com/new"
echo "    2. Importar el repo de GitHub"
echo "    3. En Settings → Environment Variables agregar:"
echo "       VITE_OPENAI_KEY = sk-..."
echo "    4. Deploy (framework: Vite, detecta automático)"
echo ""
echo "  Opción B — con Vercel CLI:"
echo "    npm i -g vercel"
echo "    vercel --prod"
echo "    # Agregar VITE_OPENAI_KEY en el dashboard de Vercel"
echo "──────────────────────────────────────────────────────────"
