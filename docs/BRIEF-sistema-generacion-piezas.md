# Brief: Sistema de Generación de Piezas para Redes Sociales — Qurable

> Versión 1.0 — Julio 2026

---

## 1. Visión General

Un sistema conversacional + visual que, a partir de inputs simples, genera piezas de comunicación para redes sociales respetando la identidad de Qurable, permite iterar sobre cada pieza y exporta en el formato correcto para cada plataforma.

La interfaz es un panel de inputs en Cowork donde se configuran los parámetros de la pieza. Claude actúa como orquestador: interpreta los inputs, selecciona/construye el layout, incorpora los assets del proyecto, genera imágenes con IA cuando hace falta, renderiza y exporta.

---

## 2. Inputs del Sistema

### 2.1 Inputs Primarios (siempre requeridos)

| Input | Opciones / Descripción |
|---|---|
| **Plataforma** | Instagram · LinkedIn · Facebook · TikTok |
| **Tipo de pieza** | Post simple · Story · Carrusel · Banner · Cover · Reel thumbnail |
| **Formato** | 1:1 (1080×1080) · 4:5 (1080×1350) · 9:16 (1080×1920) · 16:9 (1920×1080) · 4:1 (1584×396 LinkedIn banner) |
| **Información / Copy** | Headline, bajada, CTA, hashtags, mention |
| **Estilo visual** | Ver sección 3 |

### 2.2 Inputs Secundarios (opcionales, enriquecen el resultado)

| Input | Descripción |
|---|---|
| **Imagen/es** | Asset a usar como fondo, hero o elemento compositivo (se elige de la librería o se sube) |
| **Referencia visual** | Imagen de cómo te gustaría que se vea (mood/estilo) |
| **Tema / campaña** | Ligado a un cliente, producto o campaña (Pomelo, Axion, Fin & Pay, etc.) |
| **Tono de comunicación** | Institucional · Humano · Técnico · Celebratorio · Urgente |
| **Persona / Founder** | Si la pieza es sobre alguien del equipo (Borro, Fede, Javi, Rodo) |
| **Paleta de color** | Default brand (negro/blanco) · Accent (según campaña) · Custom hex |
| **Logo** | Q negro · Q blanco · Q iso · Sin logo |
| **Prompt libre** | Descripción en lenguaje natural de lo que querés lograr |
| **Nro de slides** | Para carruseles (2 a 10) |
| **Animación** | Estática · Animada (para Reels/Stories con movimiento) |

### 2.3 Inputs Sugeridos (a incorporar)

| Input | Por qué suma |
|---|---|
| **Fecha de publicación** | Para nombrarlo y archivarlo correctamente en la estructura de carpetas |
| **Variante A/B** | Generar 2 versiones del mismo concepto para testear |
| **Idioma** | Español · Inglés (Qurable opera en LatAm) |
| **Partner logo** | Para contenido co-branded (Pomelo, Rappi, Axion) |
| **Formato de export** | JPG · PNG · PNG transparente |
| **Resolución** | 72dpi (redes) · 150dpi (impresión digital) |

---

## 3. Estilos Presetados

Cada estilo es un conjunto de reglas: background, tipografía, composición, tratamiento de imagen y uso de color.

| Estilo | Descripción | Cuándo usarlo |
|---|---|---|
| **Bold Black** | Fondo negro, PP Neue Montreal Bold, texto blanco, composición limpia y geométrica | Awareness, lanzamientos, frases de impacto |
| **Clean White** | Fondo blanco o claro, TWK Lausanne, mucho espacio negativo, detalles mínimos | Contenido educativo, thought leadership, LinkedIn |
| **Photo Hero** | Imagen fotográfica a full bleed, overlay sutil, texto sobre imagen | Posts con personas, casos de éxito, eventos |
| **Gradient Dark** | Fondo oscuro con gradiente (negro→gris oscuro o negro→color), estilo premium | Anuncios de producto, partnership reveals |
| **Data Visual** | Composición que destaca un número o insight grande, tipografía extra bold | Métricas, estadísticas, Insights |
| **Carousel Deck** | Sistema de slides coherentes: cover + desarrollo + CTA. Colores alternados | Contenido educativo, storytelling, tutoriales |
| **Human Story** | Foto de persona + quote o presentación, cálido, personal | Founders, team, cultura, casos de clientes |
| **Co-Brand** | Dos logos presentes, equilibrio visual entre marcas | Alianzas, partnerships, eventos conjuntos |

---

## 4. Arquitectura del Sistema

```
┌─────────────────────────────────────────────────────────────┐
│                     PANEL DE INPUTS                         │
│  (Interfaz en Cowork — formulario / chat conversacional)    │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    ORQUESTADOR (Claude)                      │
│  • Interpreta inputs y prompt libre                          │
│  • Selecciona estilo y template                              │
│  • Decide qué capas necesita (imagen, texto, logo)           │
│  • Coordina los agentes especializados                       │
└────────┬──────────────┬──────────────┬──────────────────────┘
         │              │              │
         ▼              ▼              ▼
┌──────────────┐ ┌────────────┐ ┌──────────────────────────┐
│ AGENTE       │ │ AGENTE     │ │ AGENTE                   │
│ IMAGEN IA    │ │ LAYOUT     │ │ ASSET MANAGER            │
│              │ │            │ │                          │
│ Genera imgs  │ │ Construye  │ │ Gestiona la librería     │
│ con IA cuando│ │ el HTML/   │ │ local: logos, fonts,     │
│ se necesita  │ │ CSS layout │ │ fotos, backgrounds       │
│ una foto o   │ │ con los    │ │ del proyecto             │
│ ilustración  │ │ assets     │ │                          │
└──────┬───────┘ └─────┬──────┘ └────────────┬─────────────┘
       │               │                      │
       └───────────────▼──────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                   RENDERER / EXPORTER                        │
│  Headless browser (Playwright) → PNG/JPG a la resolución    │
│  correcta según plataforma y formato seleccionado           │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    OUTPUT + ITERACIÓN                        │
│  • Previsualización en Cowork                               │
│  • Archivo guardado en carpeta del proyecto                 │
│  • "¿Querés cambiar algo?" → loop de iteración             │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. Stack de IA para Generación de Imágenes

No todas las piezas necesitan imagen generada — muchas usarán los assets del proyecto. Pero cuando se necesita crear una imagen nueva:

### 5.1 Generadores de Imagen (ranking por uso)

| Herramienta | Fuerte en | API disponible | Cuándo usarla |
|---|---|---|---|
| **GPT-4o Image Gen** (OpenAI) | Composición, texto en imagen, coherencia con instrucciones detalladas | Sí (OpenAI API) | Primera opción: mayor control por prompt, mantiene estilo |
| **Ideogram 3.0** | Texto dentro de imágenes, tipografía generada, diseño gráfico | Sí (Ideogram API) | Cuando la pieza tiene texto integrado en la imagen |
| **Recraft V3** | Consistencia de marca, estilo brand, vectores | Sí (Recraft API) | Brand assets, ilustraciones consistentes |
| **Flux 1.1 Pro** (Black Forest Labs) | Calidad fotorrealista, control fino | Sí (via Replicate/BFL API) | Fotos de personas, productos, ambientes |
| **Midjourney** | La más alta calidad artística | Solo via Discord (sin API oficial aún) | Cuando se necesita algo muy artístico/aspiracional |
| **Stable Diffusion / SDXL** | Open source, control total, local | Sí (Replicate, RunDiffusion) | Fallback, experimentación, sin costo por imagen |

### 5.2 Herramientas de Video/Animación (para Reels y Stories animadas)

| Herramienta | Fuerte en | API |
|---|---|---|
| **Higgsfield** | Motion design, animación de assets existentes | Sí |
| **Kling 2.0** | Text-to-video, image-to-video de calidad | Sí (via Replicate) |
| **Runway Gen-3** | Video premium, consistencia visual | Sí |
| **Luma Dream Machine** | Calidad cinematográfica | Sí |

### 5.3 Herramientas de Edición/Compositing AI

| Herramienta | Uso |
|---|---|
| **Remove.bg / PhotoRoom API** | Eliminar fondos de fotos de personas |
| **Clipdrop (Stability AI)** | Reencuadre, upscale, generative fill |
| **Magnific** | Upscaling de alta calidad para exportar en alta res |

---

## 6. Conexiones Necesarias

### 6.1 APIs a Conectar

| Servicio | Para qué | Prioridad |
|---|---|---|
| **OpenAI API** | GPT-4o image gen + texto + orquestación | Alta |
| **Ideogram API** | Generación con texto integrado | Alta |
| **Replicate API** | Acceso a Flux, Kling, y modelos open source | Media |
| **Recraft API** | Generación brand-consistent | Media |
| **Remove.bg API** | Background removal | Media |
| **Higgsfield API** | Animaciones | Baja (fase 2) |

### 6.2 Infraestructura

| Componente | Opción recomendada | Alternativa |
|---|---|---|
| **Renderer** | Playwright (headless Chromium) | Puppeteer |
| **Compositing** | Pillow (Python) + HTML/CSS | Sharp (Node.js) |
| **Asset server** | Carpeta local del proyecto (ya está) | S3 bucket |
| **Templates** | HTML/CSS con variables | Figma API |
| **Fonts** | PP Neue Montreal + TWK Lausanne (ya están en /Assets/fonts/) | — |

### 6.3 Figma (opcional pero recomendado)

Figma tiene MCP instalado en este Cowork. Se puede usar para:
- Mantener los templates "master" en Figma y exportar desde ahí
- Iterar visualmente en Figma y luego exportar
- Usar el Design System de Qurable como fuente de verdad

---

## 7. Agentes del Sistema

### Agente 1: Orquestador Principal
- Recibe todos los inputs
- Interpreta el prompt libre
- Decide qué agentes activar
- Coordina el flujo completo
- Gestiona la iteración

### Agente 2: Asset Manager
- Indexa y gestiona la librería de assets del proyecto
- Selecciona la imagen más adecuada según el contexto
- Sabe qué fondos, fotos y logos existen y cuándo usar cada uno
- Sugiere assets cuando el usuario no especificó

### Agente 3: Diseñador de Layout
- Construye el layout HTML/CSS para cada template
- Aplica el estilo seleccionado
- Coloca tipografía, logo, imágenes y copy en las posiciones correctas
- Adapta el mismo contenido a distintos formatos (4:5 → 9:16)

### Agente 4: Generador de Imagen IA
- Se activa solo cuando se necesita crear una imagen nueva
- Construye el prompt óptimo según el estilo y contexto
- Llama a la API correcta (GPT-4o, Ideogram, Flux, etc.)
- Itera si la imagen generada no es satisfactoria

### Agente 5: Copy Assistant
- Sugiere y refina headlines, bajadas y CTAs
- Adapta el tono según la plataforma y el tipo de pieza
- Genera variantes de copy para A/B testing

### Agente 6: Exporter
- Renderiza el HTML en el tamaño pixel exacto
- Exporta a JPG/PNG con la calidad correcta
- Nombra el archivo según la convención del proyecto
- Lo guarda en la carpeta correcta

---

## 8. Skills a Desarrollar

| Skill | Descripción |
|---|---|
| `social-piece-generator` | Skill principal: recibe inputs → genera pieza → exporta |
| `brand-style-guide` | Encapsula las reglas visuales de Qurable para que todos los agentes las conozcan |
| `asset-indexer` | Escanea y mantiene actualizado el índice de assets disponibles |
| `format-calculator` | Convierte un concepto entre distintos formatos (misma pieza en 4:5 y 9:16) |
| `image-prompter` | Genera el prompt óptimo para cada generador de IA según el estilo deseado |
| `carousel-builder` | Especializado en generar las N slides de un carrusel con coherencia visual |
| `copy-adapter` | Adapta textos a los límites de cada plataforma y tipo de pieza |

---

## 9. Estructura de Carpetas de Output

Mantener la lógica ya existente en el proyecto:

```
/2026/
├── Assets/                    ← librería de assets (ya existe)
│   ├── fonts/
│   ├── logo/
│   └── [imágenes y fotos]
│
├── Instagram/
│   └── [NN- fecha]/
│       ├── post/              ← 4:5 · 1:1
│       └── story/             ← 9:16
│
├── LinkedIn/
│   └── [NN- fecha]/           ← 1:1 · 4:5 · 16:9
│
├── Facebook/
│   └── [NN- fecha]/
│
└── _sistema/                  ← nuevo: archivos del sistema
    ├── templates/             ← templates HTML/CSS por estilo
    ├── presets/               ← configuraciones guardadas
    └── exports/               ← outputs antes de mover a carpeta final
```

---

## 10. Flujo Completo de Trabajo

```
1. BRIEF
   Usuario configura inputs en el panel
   → Plataforma + Formato + Tipo + Estilo + Copy + Imagen (opcional)
   → Prompt libre si quiere agregar contexto

2. INTERPRETACIÓN
   Claude analiza los inputs
   → Selecciona template base
   → Identifica qué assets usar de la librería
   → Decide si necesita generar imagen con IA

3. GENERACIÓN (si aplica)
   Agente de imagen genera el visual con IA
   → Itera si no es satisfactorio

4. COMPOSICIÓN
   Agente de layout construye el HTML/CSS
   → Aplica tipografía, logo, copy, imagen
   → Respeta el estilo seleccionado

5. RENDER + PREVIEW
   Playwright renderiza a la resolución correcta
   → Se muestra la preview en Cowork

6. ITERACIÓN
   "Cambiá el headline" / "Más oscuro el fondo" / "Probá en 9:16"
   → El orquestador actualiza solo lo que cambió
   → Re-renderiza

7. EXPORT
   Cuando el usuario aprueba:
   → PNG/JPG a máxima calidad
   → Guardado en la carpeta correcta con nombre convencional
   → Opción: generar todas las variantes de formato en batch
```

---

## 11. Convenciones de Nombrado de Archivos

```
[NN]- [Campaña] [Plataforma] _ [Tipo] [Número].jpg

Ejemplos:
16- Pomelo IG _ POST 01.jpg
16- Pomelo IG _ STORY.jpg
16- Pomelo LN _ POST.jpg
16- Pomelo IG _ POST 01.png
```

---

## 12. Fases de Desarrollo

### Fase 1 — MVP (mínimo viable)
- Panel de inputs básico en Cowork
- Templates HTML/CSS para 3 estilos (Bold Black, Clean White, Photo Hero)
- Formatos: 4:5 (IG post) y 9:16 (story)
- Assets del proyecto como fuente de imágenes (sin generación IA aún)
- Export PNG/JPG con Playwright
- Loop de iteración básico

### Fase 2 — Generación IA
- Integración con OpenAI API (image gen)
- Integración con Ideogram (texto en imagen)
- Agente de copy que sugiere y refina textos
- 5 estilos más

### Fase 3 — Escala
- Todos los estilos presetados
- Carruseles
- Multi-plataforma en batch (misma pieza en todos los formatos)
- Integración Figma para templates master
- A/B variants automáticos
- Animación básica (Higgsfield/Kling)

---

## 13. Preguntas a Resolver Antes de Codear

1. ¿Preferís que la interfaz de inputs sea un **formulario visual** (widget interactivo en Cowork) o **100% conversacional** (todo por chat)?
2. ¿Tenés una API key de OpenAI disponible para conectar la generación de imágenes?
3. ¿Hay un **brand guide / color palette** de Qurable documentado en algún lado, o lo inferimos de las piezas existentes?
4. ¿Los templates van a vivir solo en Cowork o también querés poder usarlos desde Figma?
5. ¿La Fase 1 MVP debería arrancar por **Instagram** o por **LinkedIn** primero?

---

*Brief elaborado en base a los assets y piezas existentes en `/Volumes/Expansion/Qurable/Redes/2026/`*
