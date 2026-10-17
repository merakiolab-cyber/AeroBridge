import { AssetItem, FolderNode } from '../types';

export const INITIAL_FOLDERS: FolderNode[] = [
  {
    id: 'f-all',
    name: 'Všechny soubory (All Media)',
    path: '/',
    itemCount: 12,
    subfolders: [
      {
        id: 'f-adobe',
        name: '01. Adobe Projekty (PSD, AI, INDD, AEP)',
        path: '/adobe-projects',
        itemCount: 5,
      },
      {
        id: 'f-commercial',
        name: '02. Studio & Commercial Foto',
        path: '/commercial',
        itemCount: 3,
      },
      {
        id: 'f-fashion',
        name: '03. Editorial & Fashion',
        path: '/fashion',
        itemCount: 2,
      },
      {
        id: 'f-arch-landscape',
        name: '04. Architektura & Krajina',
        path: '/arch-landscape',
        itemCount: 2,
      },
    ],
  },
  {
    id: 'f-local',
    name: 'Lokální složka (Local PC)',
    path: '/local',
    itemCount: 0,
  },
];

export const INITIAL_ASSETS: AssetItem[] = [
  // 1. Photoshop Document
  {
    id: 'asset-psd-1',
    name: 'Brand_Campaign_KeyVisual_v04.psd',
    folder: '/adobe-projects',
    fullPath: 'Projects/Brand2026/Brand_Campaign_KeyVisual_v04.psd',
    url: '/src/assets/images/commercial_product_perfume_1791929225199.jpg',
    type: 'adobe-psd',
    category: 'adobe-psd',
    format: 'Photoshop Document',
    extension: 'PSD',
    colorBadge: '#31a8ff',
    size: 248900140, // ~248 MB
    dimensions: { width: 5120, height: 3840 },
    dateModified: '2026-10-12 16:44:10',
    dateCreated: '2026-10-10 09:20:00',
    rating: 5,
    label: 'green',
    flag: 'pick',
    exif: {
      software: 'Adobe Photoshop 2026 (v27.2)',
      colorProfile: 'Adobe RGB (1998)',
      bitDepth: '16-bit / Layered Multi-Channel',
      resolutionDpi: 300,
    },
    iptc: {
      title: 'Commercial Campaign Key Visual Master Composite',
      caption: 'Layered master PSD with 48 smart objects, grading LUTs, and typography masks.',
      creator: 'Elena Rostova',
      copyright: '© 2026 Luminaire Brand Studio',
      keywords: ['psd', 'photoshop', 'master', 'layers', 'commercial', 'perfume', 'retouch'],
    },
    colorPalette: ['#b46a1b', '#dca249', '#784713', '#c8bfae'],
  },

  // 2. Illustrator Vector Asset
  {
    id: 'asset-ai-1',
    name: 'Brand_Iconography_Vector_System.ai',
    folder: '/adobe-projects',
    fullPath: 'Projects/Brand2026/Brand_Iconography_Vector_System.ai',
    url: '/src/assets/images/architecture_brutalist_facade_1791929225276.jpg',
    type: 'adobe-ai',
    category: 'adobe-ai',
    format: 'Adobe Illustrator Artwork',
    extension: 'AI',
    colorBadge: '#ff9a00',
    size: 42100800, // ~42 MB
    dimensions: { width: 4096, height: 4096 },
    dateModified: '2026-10-11 11:15:30',
    dateCreated: '2026-10-08 14:00:22',
    rating: 5,
    label: 'blue',
    flag: 'pick',
    exif: {
      software: 'Adobe Illustrator 2026 (v30.0)',
      colorProfile: 'sRGB IEC61966-2.1',
      bitDepth: 'Resolution Independent Vector',
      resolutionDpi: 600,
    },
    iptc: {
      title: 'Global Iconography & Monogram Grid System',
      caption: 'Precision vector bezier assets with PDF compatibility stream.',
      creator: 'Elena Rostova',
      copyright: '© 2026 Luminaire Brand Studio',
      keywords: ['illustrator', 'vector', 'ai', 'branding', 'iconography', 'bezier'],
    },
    colorPalette: ['#ff9a00', '#1e293b', '#64748b'],
  },

  // 3. InDesign Publication Document
  {
    id: 'asset-indd-1',
    name: 'Editorial_Lookbook_Autumn2026.indd',
    folder: '/adobe-projects',
    fullPath: 'Projects/Editorial/Editorial_Lookbook_Autumn2026.indd',
    url: '/src/assets/images/editorial_fashion_portrait_1791929224454.jpg',
    type: 'adobe-indd',
    category: 'adobe-indd',
    format: 'Adobe InDesign Document',
    extension: 'INDD',
    colorBadge: '#ff3366',
    size: 89420000, // ~89 MB
    dimensions: { width: 3508, height: 4961 }, // A3 portrait
    dateModified: '2026-10-13 10:05:12',
    dateCreated: '2026-10-09 13:20:00',
    rating: 4,
    label: 'purple',
    flag: 'pick',
    exif: {
      software: 'Adobe InDesign 2026 (v21.1)',
      colorProfile: 'FOGRA51 Coated (CMYK)',
      bitDepth: 'Page Layout Publication (64 Pages)',
      resolutionDpi: 300,
    },
    iptc: {
      title: 'Haute Couture Editorial Lookbook Layout',
      caption: 'Multi-page print publication with linked assets, bleed boxes, and master spreads.',
      creator: 'Marc de Vries',
      copyright: '© 2026 Haute Couture Publishing',
      keywords: ['indesign', 'indd', 'layout', 'print', 'editorial', 'lookbook', 'cmyk'],
    },
    colorPalette: ['#ff3366', '#2b2d42', '#edf2f4'],
  },

  // 4. After Effects Project
  {
    id: 'asset-ae-1',
    name: 'Logo_Reveal_Kinetic_Intro.aep',
    folder: '/adobe-projects',
    fullPath: 'Motion/Logo_Reveal_Kinetic_Intro.aep',
    url: '/src/assets/images/architecture_brutalist_facade_1791929225276.jpg',
    type: 'adobe-ae',
    category: 'adobe-ae',
    format: 'After Effects Project',
    extension: 'AEP',
    colorBadge: '#9999ff',
    size: 15400200,
    dimensions: { width: 3840, height: 2160 },
    duration: 12.5,
    dateModified: '2026-10-12 18:30:00',
    dateCreated: '2026-10-11 10:00:00',
    rating: 5,
    label: 'yellow',
    flag: 'pick',
    exif: {
      software: 'Adobe After Effects 2026 (v26.0)',
      colorProfile: 'Rec.709 Gamma 2.4',
      bitDepth: '32-bit Floating Point (Float)',
      resolutionDpi: 72,
    },
    iptc: {
      title: '4K 60fps Broadcast 3D Kinetic Logo Reveal',
      caption: 'Dynamic motion graphics comp with shape layers, 3D camera depth of field, and sound sync.',
      creator: 'Alex Chen',
      copyright: '© 2026 Lumina Motion',
      keywords: ['after-effects', 'aep', 'motion', 'animation', '4k', 'kinetic', 'vfx'],
    },
    colorPalette: ['#9999ff', '#1a1a2e', '#16213e'],
  },

  // 5. PDF Presentation
  {
    id: 'asset-pdf-1',
    name: 'Brand_Identity_Guidelines_Master.pdf',
    folder: '/adobe-projects',
    fullPath: 'Specs/Brand_Identity_Guidelines_Master.pdf',
    url: '/src/assets/images/commercial_product_perfume_1791929225199.jpg',
    type: 'pdf',
    category: 'pdf',
    format: 'PDF Document',
    extension: 'PDF',
    colorBadge: '#ff2d20',
    size: 18200400,
    dimensions: { width: 3840, height: 2160 },
    dateModified: '2026-10-09 15:45:00',
    dateCreated: '2026-10-05 11:20:00',
    rating: 4,
    label: 'red',
    flag: 'unflagged',
    exif: {
      software: 'Adobe Acrobat Pro 2026 (PDF 1.7)',
      colorProfile: 'sRGB IEC61966-2.1',
      bitDepth: 'Digital Vector / Raster Hybrid',
      resolutionDpi: 300,
    },
    iptc: {
      title: 'Luminaire Global Visual Identity Standards',
      caption: 'Comprehensive 42-page brand book specifying typography, spacing rules, and color palettes.',
      creator: 'Brand Governance Team',
      copyright: '© 2026 Luminaire Parfums Inc.',
      keywords: ['pdf', 'guidelines', 'brandbook', 'design-system', 'specs'],
    },
    colorPalette: ['#ff2d20', '#1e293b', '#f8fafc'],
  },

  // 6. High-Res Commercial Photography (JPEG)
  {
    id: 'asset-img-1',
    name: 'LUM_Aurora_Perfume_Shot01.jpg',
    folder: '/commercial',
    fullPath: 'Photography/Commercial/LUM_Aurora_Perfume_Shot01.jpg',
    url: '/src/assets/images/commercial_product_perfume_1791929225199.jpg',
    type: 'image',
    category: 'image',
    format: 'JPG Image',
    extension: 'JPG',
    colorBadge: '#10b981',
    size: 4892014,
    dimensions: { width: 4096, height: 3072 },
    dateModified: '2026-10-10 14:22:18',
    dateCreated: '2026-10-10 11:05:40',
    rating: 5,
    label: 'green',
    flag: 'pick',
    exif: {
      camera: 'Hasselblad H6D-100c',
      lens: 'HC 100mm f/2.2',
      focalLength: '100mm',
      aperture: 'f/8.0',
      shutterSpeed: '1/160s',
      iso: 64,
      colorProfile: 'ProPhoto RGB',
      bitDepth: '16-bit',
      resolutionDpi: 300,
      exposureCompensation: '0 EV',
      whiteBalance: 'Flash 5600K',
    },
    iptc: {
      title: 'Aurora Eau de Parfum Studio Hero',
      caption: 'Commercial beauty still life of amber flacon on porous travertine plinth with directional soft rim light.',
      creator: 'Elena Rostova',
      copyright: '© 2026 Luminaire Parfums Inc. All Rights Reserved.',
      keywords: ['perfume', 'luxury', 'commercial', 'still-life', 'glass', 'amber', 'travertine'],
      location: 'Studio Beta, Prague',
    },
    colorPalette: ['#b46a1b', '#dca249', '#784713', '#c8bfae', '#3c3227'],
  },

  // 7. Commercial Photography Alt (JPEG)
  {
    id: 'asset-img-2',
    name: 'LUM_Aurora_Perfume_Shot02_Alt.jpg',
    folder: '/commercial',
    fullPath: 'Photography/Commercial/LUM_Aurora_Perfume_Shot02_Alt.jpg',
    url: '/src/assets/images/commercial_product_perfume_1791929225199.jpg',
    type: 'image',
    category: 'image',
    format: 'JPG Image',
    extension: 'JPG',
    colorBadge: '#10b981',
    size: 4721990,
    dimensions: { width: 4096, height: 3072 },
    dateModified: '2026-10-10 14:25:02',
    dateCreated: '2026-10-10 11:08:12',
    rating: 4,
    label: 'blue',
    flag: 'unflagged',
    exif: {
      camera: 'Hasselblad H6D-100c',
      lens: 'HC 100mm f/2.2',
      focalLength: '100mm',
      aperture: 'f/5.6',
      shutterSpeed: '1/200s',
      iso: 64,
      colorProfile: 'ProPhoto RGB',
      bitDepth: '16-bit',
      resolutionDpi: 300,
      exposureCompensation: '-0.3 EV',
      whiteBalance: 'Flash 5600K',
    },
    iptc: {
      title: 'Aurora Flacon Low Angle Variant',
      caption: 'Alternative exposure bracket testing bottle specular highlight reflection.',
      creator: 'Elena Rostova',
      copyright: '© 2026 Luminaire Parfums Inc.',
      keywords: ['perfume', 'luxury', 'amber', 'commercial'],
      location: 'Studio Beta, Prague',
    },
    colorPalette: ['#9e5512', '#c98932', '#653a0f', '#bbb09f'],
  },

  // 8. Editorial Fashion Portrait (JPEG)
  {
    id: 'asset-img-3',
    name: 'FASHION_Sculptural_Hair_Key01.jpg',
    folder: '/fashion',
    fullPath: 'Photography/Fashion/FASHION_Sculptural_Hair_Key01.jpg',
    url: '/src/assets/images/editorial_fashion_portrait_1791929224454.jpg',
    type: 'image',
    category: 'image',
    format: 'JPG Image',
    extension: 'JPG',
    colorBadge: '#10b981',
    size: 5120330,
    dimensions: { width: 3072, height: 4096 },
    dateModified: '2026-10-11 16:40:11',
    dateCreated: '2026-10-11 15:10:04',
    rating: 5,
    label: 'green',
    flag: 'pick',
    exif: {
      camera: 'Leica S3 Medium Format',
      lens: 'Leica Summarit-S 70mm f/2.5 ASPH CS',
      focalLength: '70mm',
      aperture: 'f/4.0',
      shutterSpeed: '1/250s',
      iso: 100,
      colorProfile: 'Adobe RGB (1998)',
      bitDepth: '16-bit',
      resolutionDpi: 300,
      exposureCompensation: '+0.3 EV',
      whiteBalance: 'K-5400',
    },
    iptc: {
      title: 'Sculptural Origami Avant-Garde Portrait',
      caption: 'Editorial portrait featuring geometric folded hair structure, tailored wool jacket, and high contrast rim light.',
      creator: 'Marc de Vries',
      copyright: '© 2026 Haute Couture Magazine / Marc de Vries',
      keywords: ['fashion', 'editorial', 'portrait', 'sculptural', 'avant-garde', 'monochrome', 'leica'],
      location: 'Atelier Marais, Paris',
    },
    colorPalette: ['#1e1c1b', '#484443', '#8b8481', '#cfc8c2', '#a67252'],
  },

  // 9. Editorial Fashion Outtake (Raw)
  {
    id: 'asset-img-4',
    name: 'FASHION_Contact_Sheet_Test.ARW',
    folder: '/fashion',
    fullPath: 'Photography/Fashion/FASHION_Contact_Sheet_Test.ARW',
    url: '/src/assets/images/editorial_fashion_portrait_1791929224454.jpg',
    type: 'raw',
    category: 'image',
    format: 'Sony Alpha RAW (ARW)',
    extension: 'ARW',
    colorBadge: '#06b6d4',
    size: 61840000,
    dimensions: { width: 9504, height: 6336 },
    dateModified: '2026-10-11 15:15:00',
    dateCreated: '2026-10-11 15:15:00',
    rating: 2,
    label: 'none',
    flag: 'reject',
    exif: {
      camera: 'Sony Alpha 1',
      lens: 'FE 85mm f/1.4 GM II',
      focalLength: '85mm',
      aperture: 'f/2.8',
      shutterSpeed: '1/320s',
      iso: 200,
      colorProfile: 'Sony RAW 14bit',
      bitDepth: '14-bit',
      resolutionDpi: 300,
    },
    iptc: {
      title: 'Outtake - Blink Detection',
      caption: 'Rejected frame during rapid burst testing strobe recharge speed.',
      creator: 'Marc de Vries',
      copyright: '© 2026 Marc de Vries',
      keywords: ['outtake', 'raw', 'test'],
    },
    colorPalette: ['#2a2827', '#6e6966'],
  },

  // 10. Brutalist Architecture (JPEG)
  {
    id: 'asset-img-5',
    name: 'ARCH_Brutalist_Cantilever_GoldenHour.jpg',
    folder: '/arch-landscape',
    fullPath: 'Architecture/ARCH_Brutalist_Cantilever_GoldenHour.jpg',
    url: '/src/assets/images/architecture_brutalist_facade_1791929225276.jpg',
    type: 'image',
    category: 'image',
    format: 'JPG Image',
    extension: 'JPG',
    colorBadge: '#10b981',
    size: 5882100,
    dimensions: { width: 4096, height: 3072 },
    dateModified: '2026-10-12 18:14:20',
    dateCreated: '2026-10-12 17:45:12',
    rating: 5,
    label: 'green',
    flag: 'pick',
    exif: {
      camera: 'Fujifilm GFX 100 II',
      lens: 'GF 30mm f/5.6 T/S Tilt-Shift',
      focalLength: '30mm',
      aperture: 'f/11.0',
      shutterSpeed: '1/60s',
      iso: 80,
      colorProfile: 'Display P3',
      bitDepth: '16-bit',
      resolutionDpi: 300,
      exposureCompensation: '-0.7 EV',
      whiteBalance: 'Daylight 5500K',
    },
    iptc: {
      title: 'Civic Cultural Center Brutalist Wing',
      caption: 'Monumental board-formed concrete facade with deep recessed shadows during low autumn sunset.',
      creator: 'Jan Novák',
      copyright: '© 2026 Architectural Digest / Jan Novák',
      keywords: ['architecture', 'concrete', 'brutalism', 'geometric', 'golden-hour', 'facade'],
      location: 'Valencia, Spain',
    },
    colorPalette: ['#e4a861', '#947a61', '#514c47', '#4b5e67'],
  },

  // 11. Nordic Landscape (JPEG)
  {
    id: 'asset-img-6',
    name: 'LANDSCAPE_Reine_Fjord_MorningMist.jpg',
    folder: '/arch-landscape',
    fullPath: 'Expeditions/LANDSCAPE_Reine_Fjord_MorningMist.jpg',
    url: '/src/assets/images/landscape_nordic_fjord_1791929225473.jpg',
    type: 'image',
    category: 'image',
    format: 'JPG Image',
    extension: 'JPG',
    colorBadge: '#10b981',
    size: 6420100,
    dimensions: { width: 4096, height: 2304 },
    dateModified: '2026-10-09 09:30:15',
    dateCreated: '2026-10-09 06:12:44',
    rating: 5,
    label: 'green',
    flag: 'pick',
    exif: {
      camera: 'Nikon Z8',
      lens: 'NIKKOR Z 24-70mm f/2.8 S',
      focalLength: '35mm',
      aperture: 'f/8.0',
      shutterSpeed: '1/125s',
      iso: 64,
      colorProfile: 'Adobe RGB (1998)',
      bitDepth: '14-bit',
      resolutionDpi: 300,
      exposureCompensation: '-0.3 EV',
      whiteBalance: 'Cloudy 6500K',
    },
    iptc: {
      title: 'Lofoten Fjord at First Dawn',
      caption: 'Moody alpine peaks plunging into icy fjord waters with floating morning clouds and traditional rorbuer cabins.',
      creator: 'Astrid Lindholm',
      copyright: '© 2026 National Geographic Traveler / Astrid Lindholm',
      keywords: ['landscape', 'norway', 'fjord', 'mountains', 'mist', 'cinematic', 'nordic', 'water'],
      location: 'Reine, Lofoten Islands, Norway',
    },
    colorPalette: ['#142433', '#394e5e', '#7b95a8', '#d0d8dc'],
  },
  {
    id: 'asset-fig-1',
    name: 'AeroBridge_Design_System_v3.fig',
    folder: '/ui-designs',
    fullPath: 'Designs/AeroBridge_Design_System_v3.fig',
    url: '/src/assets/images/architecture_brutalist_facade_1791929225276.jpg',
    type: 'figma',
    category: 'figma',
    format: 'Figma Design',
    extension: 'FIG',
    colorBadge: '#a259ff',
    size: 42180000, // ~42 MB
    dimensions: { width: 3840, height: 2160 },
    dateModified: '2026-10-16 19:42:00',
    dateCreated: '2026-10-14 10:15:20',
    rating: 5,
    label: 'purple',
    flag: 'pick',
    exif: {
      software: 'Figma Desktop 124.8.2',
      colorProfile: 'sRGB IEC61966-2.1',
      bitDepth: 'Vector Frames & Components',
      resolutionDpi: 72,
    },
    iptc: {
      title: 'AeroBridge Studio Design System & UI Kit',
      caption: 'Complete UI component library, dark mode tokens, typography scale, and responsive wireframes.',
      creator: 'Meraki Creative Lab',
      copyright: '© 2026 Merakiolab Cyber',
      keywords: ['figma', 'ui', 'design-system', 'tokens', 'dark-mode', 'components'],
    },
    colorPalette: ['#a259ff', '#1e1e1e', '#2c2c2c', '#0acf83'],
  },
  {
    id: 'asset-svg-1',
    name: 'AeroBridge_Studio_Brandmark.svg',
    folder: '/branding-vectors',
    fullPath: 'Vectors/AeroBridge_Studio_Brandmark.svg',
    url: '/icon.svg',
    type: 'vector',
    category: 'vector',
    format: 'SVG Vector',
    extension: 'SVG',
    colorBadge: '#f59e0b',
    size: 1087, // ~1 KB
    dimensions: { width: 512, height: 512 },
    dateModified: '2026-10-16 21:10:00',
    dateCreated: '2026-10-15 14:00:00',
    rating: 5,
    label: 'yellow',
    flag: 'pick',
    exif: {
      software: 'Vector Graphics XML Specification 1.1',
      colorProfile: 'sRGB IEC61966-2.1',
      bitDepth: 'Scalable Vector Bezier Curves',
      resolutionDpi: 72,
    },
    iptc: {
      title: 'AeroBridge Official Studio Vector Monogram',
      caption: 'Precision vector monogram with gradient geometry and drop shadow filter.',
      creator: 'Meraki Creative Lab',
      copyright: '© 2026 Merakiolab Cyber',
      keywords: ['svg', 'vector', 'logo', 'branding', 'monogram', 'aerobridge'],
    },
    colorPalette: ['#2d333b', '#1f2329', '#f8fafc', '#f59e0b'],
  },
  {
    id: 'asset-html-1',
    name: 'Dashboard_Overview_Component.html',
    folder: '/adobe-projects',
    fullPath: 'Web/Dashboard_Overview_Component.html',
    url: "data:image/svg+xml;charset=utf-8," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
      <defs>
        <linearGradient id="g1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#0f172a"/>
          <stop offset="100%" stop-color="#1e293b"/>
        </linearGradient>
      </defs>
      <rect width="800" height="600" fill="url(#g1)"/>
      <rect width="800" height="42" fill="#182234"/>
      <circle cx="20" cy="21" r="6" fill="#ef4444"/>
      <circle cx="38" cy="21" r="6" fill="#f59e0b"/>
      <circle cx="56" cy="21" r="6" fill="#10b981"/>
      <rect x="80" y="9" width="320" height="24" rx="6" fill="#0f172a"/>
      <text x="96" y="25" fill="#94a3b8" font-family="-apple-system, sans-serif" font-size="11">Dashboard_Overview_Component.html</text>
      <rect x="40" y="70" width="340" height="180" rx="12" fill="#1e293b" stroke="#334155" stroke-width="1"/>
      <text x="64" y="105" fill="#f8fafc" font-family="-apple-system, sans-serif" font-size="18" font-weight="bold">System Analytics</text>
      <text x="64" y="130" fill="#94a3b8" font-family="-apple-system, sans-serif" font-size="12">Real-time throughput &amp; telemetry</text>
      <rect x="64" y="160" width="120" height="60" rx="8" fill="#0f172a"/>
      <text x="76" y="185" fill="#e44d26" font-family="-apple-system, sans-serif" font-size="20" font-weight="bold">99.8%</text>
      <text x="76" y="205" fill="#64748b" font-family="-apple-system, sans-serif" font-size="10">UPTIME</text>
      <rect x="420" y="70" width="340" height="180" rx="12" fill="#1e293b" stroke="#334155" stroke-width="1"/>
      <text x="444" y="105" fill="#f8fafc" font-family="-apple-system, sans-serif" font-size="18" font-weight="bold">Recent Deployments</text>
      <rect x="444" y="130" width="292" height="28" rx="6" fill="#0f172a"/>
      <rect x="444" y="170" width="292" height="28" rx="6" fill="#0f172a"/>
      <rect x="40" y="280" width="720" height="260" rx="12" fill="#1e293b" stroke="#334155" stroke-width="1"/>
      <text x="64" y="320" fill="#f8fafc" font-family="-apple-system, sans-serif" font-size="16" font-weight="600">HTML5 Semantic DOM Tree</text>
      <rect x="64" y="340" width="672" height="170" rx="8" fill="#0b0f19"/>
      <text x="84" y="375" fill="#e44d26" font-family="monospace" font-size="12">&lt;section class="analytics-card"&gt;</text>
      <text x="108" y="405" fill="#38bdf8" font-family="monospace" font-size="12">&lt;h2&gt;AeroBridge Telemetry Node&lt;/h2&gt;</text>
      <text x="108" y="435" fill="#94a3b8" font-family="monospace" font-size="12">&lt;p&gt;Active connections: 1,420&lt;/p&gt;</text>
      <text x="84" y="465" fill="#e44d26" font-family="monospace" font-size="12">&lt;/section&gt;</text>
    </svg>`),
    type: 'html',
    category: 'html',
    format: 'HTML Document',
    extension: 'HTML',
    colorBadge: '#e44d26',
    size: 24580, // ~24 KB
    dimensions: { width: 1440, height: 900 },
    dateModified: '2026-10-16 23:15:00',
    dateCreated: '2026-10-16 22:30:00',
    rating: 5,
    label: 'orange',
    flag: 'pick',
    exif: {
      software: 'W3C HTML5 Specification / DOM Living Standard',
      colorProfile: 'sRGB IEC61966-2.1',
      bitDepth: '24-bit DOM Render',
      resolutionDpi: 96,
    },
    iptc: {
      title: 'Interactive Web Dashboard Component',
      caption: 'Modular responsive HTML5 dashboard template with embedded CSS3 styles and components.',
      creator: 'Meraki Creative Lab',
      copyright: '© 2026 Merakiolab Cyber',
      keywords: ['html', 'web', 'dom', 'template', 'dashboard', 'responsive'],
    },
    colorPalette: ['#e44d26', '#0f172a', '#1e293b', '#38bdf8'],
  },
  {
    id: 'asset-kra-1',
    name: 'Cyberpunk_NeoPrague_Concept_Art.kra',
    folder: '/commercial',
    fullPath: 'Paintings/Cyberpunk_NeoPrague_Concept_Art.kra',
    url: "data:image/svg+xml;charset=utf-8," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800">
      <defs>
        <linearGradient id="sky" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#0a0518"/>
          <stop offset="40%" stop-color="#190e38"/>
          <stop offset="70%" stop-color="#2a165c"/>
          <stop offset="100%" stop-color="#4c1d95"/>
        </linearGradient>
        <linearGradient id="neon" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#00f0ff"/>
          <stop offset="50%" stop-color="#f43f5e"/>
          <stop offset="100%" stop-color="#ff007f"/>
        </linearGradient>
      </defs>
      <rect width="1200" height="800" fill="url(#sky)"/>
      <circle cx="850" cy="240" r="140" fill="#f43f5e" opacity="0.35"/>
      <circle cx="850" cy="240" r="110" fill="#00f0ff" opacity="0.45"/>
      <polygon points="100,800 160,320 280,320 320,800" fill="#0f0c24"/>
      <polygon points="260,800 300,260 480,260 520,800" fill="#14102e"/>
      <polygon points="460,800 500,380 620,380 680,800" fill="#0b081a"/>
      <polygon points="620,800 700,180 860,180 940,800" fill="#1b123d"/>
      <polygon points="880,800 920,290 1060,290 1140,800" fill="#100b26"/>
      <rect x="330" y="320" width="120" height="12" fill="url(#neon)" opacity="0.85"/>
      <rect x="740" y="240" width="80" height="180" fill="#00f0ff" opacity="0.15"/>
      <rect x="760" y="260" width="40" height="140" fill="#ff007f" opacity="0.25"/>
      <rect x="0" y="680" width="1200" height="120" fill="#05030a"/>
      <ellipse cx="600" cy="720" rx="500" ry="40" fill="#00f0ff" opacity="0.12"/>
      <ellipse cx="780" cy="740" rx="350" ry="30" fill="#f43f5e" opacity="0.18"/>
      <!-- Krita Badge Overlay -->
      <g transform="translate(40, 40)">
        <rect width="220" height="52" rx="10" fill="#0d1117" opacity="0.9" stroke="#3daee9" stroke-width="1.5"/>
        <circle cx="32" cy="26" r="14" fill="#3daee9"/>
        <text x="32" y="31" fill="#ffffff" font-family="-apple-system, sans-serif" font-size="11" font-weight="bold" text-anchor="middle">KRA</text>
        <text x="58" y="24" fill="#f8fafc" font-family="-apple-system, sans-serif" font-size="13" font-weight="bold">Krita Canvas 4K</text>
        <text x="58" y="40" fill="#3daee9" font-family="-apple-system, sans-serif" font-size="10" font-weight="medium">16-bit RGB Float Painting</text>
      </g>
    </svg>`),
    type: 'krita',
    category: 'krita',
    format: 'Krita Document',
    extension: 'KRA',
    colorBadge: '#3daee9',
    size: 142589000, // ~142 MB
    dimensions: { width: 3840, height: 2160 },
    dateModified: '2026-10-16 23:25:00',
    dateCreated: '2026-10-14 11:00:00',
    rating: 5,
    label: 'blue',
    flag: 'pick',
    exif: {
      software: 'Krita Digital Painting 5.2 (OpenRaster / KRA Standard)',
      colorProfile: 'Display P3 Wide Gamut RGB',
      bitDepth: '16-bit Floating Point / Layered Canvas',
      resolutionDpi: 300,
    },
    iptc: {
      title: 'Cyberpunk Neo-Prague Digital Matte Painting',
      caption: 'High-resolution multi-layer Krita matte painting with volumetric lighting and neon reflections.',
      creator: 'Meraki Creative Lab',
      copyright: '© 2026 Merakiolab Cyber',
      keywords: ['krita', 'painting', 'concept-art', 'cyberpunk', 'matte-painting', 'kra'],
    },
    colorPalette: ['#3daee9', '#4c1d95', '#00f0ff', '#f43f5e'],
  },
  {
    id: 'asset-webp-1',
    name: 'Modern_Architecture_Geometric_Facade.webp',
    folder: '/commercial',
    fullPath: 'Photos/Modern_Architecture_Geometric_Facade.webp',
    url: "data:image/svg+xml;charset=utf-8," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800">
      <defs>
        <linearGradient id="skyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#042f2e"/>
          <stop offset="50%" stop-color="#0f172a"/>
          <stop offset="100%" stop-color="#020617"/>
        </linearGradient>
        <linearGradient id="tealGlow" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#00c49f"/>
          <stop offset="100%" stop-color="#38bdf8"/>
        </linearGradient>
        <linearGradient id="glassGrad" x1="20%" y1="0%" x2="80%" y2="100%">
          <stop offset="0%" stop-color="#14b8a6" stop-opacity="0.35"/>
          <stop offset="100%" stop-color="#0f766e" stop-opacity="0.1"/>
        </linearGradient>
      </defs>
      <rect width="1200" height="800" fill="url(#skyGrad)"/>
      <!-- Modern Architectural Facade Lattice -->
      <g stroke="#00c49f" stroke-opacity="0.2" stroke-width="1.5">
        <line x1="0" y1="100" x2="1200" y2="700"/>
        <line x1="0" y1="200" x2="1200" y2="800"/>
        <line x1="0" y1="300" x2="1200" y2="900"/>
        <line x1="1200" y1="100" x2="0" y2="700"/>
        <line x1="1200" y1="200" x2="0" y2="800"/>
      </g>
      <!-- Glass Curtain Wall Panels -->
      <polygon points="200,650 350,180 520,240 400,700" fill="url(#glassGrad)" stroke="#00c49f" stroke-width="2"/>
      <polygon points="400,700 520,240 720,200 620,720" fill="url(#glassGrad)" stroke="#38bdf8" stroke-width="2"/>
      <polygon points="620,720 720,200 900,280 820,750" fill="url(#glassGrad)" stroke="#00c49f" stroke-width="2"/>
      <polygon points="820,750 900,280 1060,340 1000,780" fill="url(#glassGrad)" stroke="#2dd4bf" stroke-width="2"/>
      <!-- Sun/Horizon highlight -->
      <circle cx="950" cy="220" r="120" fill="#00c49f" opacity="0.15"/>
      <circle cx="950" cy="220" r="60" fill="#38bdf8" opacity="0.25"/>
      <!-- Floor reflection -->
      <rect x="0" y="700" width="1200" height="100" fill="#020617" opacity="0.8"/>
      <line x1="0" y1="700" x2="1200" y2="700" stroke="#00c49f" stroke-width="3" opacity="0.6"/>
      <!-- WebP Format Overlay Badge -->
      <g transform="translate(48, 48)">
        <rect width="210" height="54" rx="12" fill="#031b18" opacity="0.92" stroke="#00c49f" stroke-width="1.8"/>
        <circle cx="34" cy="27" r="15" fill="#00c49f"/>
        <text x="34" y="32" fill="#022c22" font-family="-apple-system, sans-serif" font-size="10" font-weight="900" text-anchor="middle">WEBP</text>
        <text x="62" y="25" fill="#f0fdfa" font-family="-apple-system, sans-serif" font-size="13" font-weight="bold">WebP Architecture</text>
        <text x="62" y="42" fill="#2dd4bf" font-family="-apple-system, sans-serif" font-size="10" font-weight="medium">VP8X Lossless High-Res</text>
      </g>
    </svg>`),
    type: 'image',
    category: 'image',
    format: 'WebP Image',
    extension: 'WEBP',
    colorBadge: '#00c49f',
    size: 1845200, // ~1.8 MB
    dimensions: { width: 3840, height: 2160 },
    dateModified: '2026-10-17 08:30:00',
    dateCreated: '2026-10-15 14:10:00',
    rating: 5,
    label: 'green',
    flag: 'pick',
    exif: {
      camera: 'Sony Alpha 1',
      lens: 'FE 24-70mm F2.8 GM II',
      focalLength: '35mm',
      aperture: 'f/5.6',
      shutterSpeed: '1/500s',
      iso: 100,
      colorProfile: 'Display P3 Wide Gamut RGB',
      bitDepth: '24-bit RGB / VP8X Lossless',
      resolutionDpi: 300,
      software: 'Google WebP Encoder v1.4.0',
    },
    iptc: {
      title: 'Geometric Concrete & Glass Architecture',
      caption: 'Ultra-high resolution WebP lossless architectural study with specular glass reflections and teal ambient light.',
      creator: 'Meraki Architectural Lab',
      copyright: '© 2026 Merakiolab Cyber',
      keywords: ['webp', 'architecture', 'glass', 'facade', 'modern', 'geometry'],
    },
    colorPalette: ['#00c49f', '#0f172a', '#38bdf8', '#2dd4bf'],
  },
];



