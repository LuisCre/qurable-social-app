# Qurable Social Generator

Canvas editor para crear piezas de redes sociales con IA. Desarrollado internamente por el equipo de Qurable.

## Stack

- React 18 + Vite 5
- Canvas editor con drag & drop, handles de resize/rotación
- AI layer (OpenAI GPT-4o) para generación de copy y composición
- Export PNG/JPG a resolución nativa (2×)
- Fuente: PP Neue Montreal (self-hosted)

## Features

- **5 templates** — Bold Dark, Purple Brand, Photo Hero, Clean White, Gradient Dark
- **Canvas editor** — texto, imágenes, formas, íconos, botones con propiedades completas
- **AI Generate** — brief → pieza completa con copy, estilo y composición
- **AI Compose** — reorganiza elementos existentes con layout profesional
- **Carousel** — múltiples slides por proyecto
- **Guardar proyectos** — persistencia en localStorage
- **Export** — PNG/JPG en resolución 2× (listo para publicar)

## Setup

```bash
npm install
cp .env.local.example .env.local   # agregar VITE_OPENAI_KEY
npm run dev
```

## Variables de entorno

```
VITE_OPENAI_KEY=sk-...
```

El archivo `.env.local` nunca se commitea. La API key solo vive en tu entorno o en las variables de Vercel.

## Deploy en Vercel

1. Conectar el repo desde [vercel.com](https://vercel.com)
2. Agregar variable de entorno: `VITE_OPENAI_KEY`
3. Framework preset: **Vite**
4. Deploy automático en cada push a `main`

## Docs

- [`docs/BRIEF-sistema-generacion-piezas.md`](docs/BRIEF-sistema-generacion-piezas.md) — brief original del sistema
