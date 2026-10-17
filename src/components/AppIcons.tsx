import React from 'react';

/**
 * Pixel-perfect SVG brand icons for creative software formats:
 * - Adobe: Photoshop (PSD), Illustrator (AI), InDesign (INDD), After Effects (AEP), Premiere Pro (PRPROJ), Acrobat (PDF), Lightroom (LR), Audition (AU), XD
 * - 3D / VFX: Blender (BLEND), ZBrush (ZPR / ZTL), Cinema 4D (C4D), Maya (MB / MA), 3ds Max (MAX)
 * - Music / Audio: Ableton Live (ALS), FL Studio (FLP), Cubase (CPR), Logic Pro, Pro Tools
 * - Design / Vector: Figma (FIG), Sketch, CorelDRAW (CDR), Corel Painter (RIF), Krita (KRA)
 */

interface AppIconProps {
  className?: string;
  size?: number;
}

export function getAppIcon(ext: string): React.ComponentType<AppIconProps> | null {
  if (!ext) return null;
  const clean = ext.toLowerCase().replace(/^\./, '').trim();

  switch (clean) {
    // Adobe Creative Cloud
    case 'psd':
    case 'psb':
      return PhotoshopIcon;
    case 'ai':
    case 'ait':
      return IllustratorIcon;
    case 'indd':
    case 'indt':
    case 'idml':
      return InDesignIcon;
    case 'aep':
    case 'aet':
      return AfterEffectsIcon;
    case 'prproj':
      return PremiereIcon;
    case 'pdf':
      return AcrobatIcon;
    case 'lrcat':
    case 'dng':
      return LightroomIcon;
    case 'xd':
      return XdIcon;

    // Design / Vector
    case 'fig':
      return FigmaIcon;
    case 'sketch':
      return SketchIcon;
    case 'kra':
      return KritaIcon;
    case 'cdr':
      return CorelDrawIcon;
    case 'rif':
    case 'riff':
      return PainterIcon;

    // 3D & Animation
    case 'blend':
    case 'blend1':
      return BlenderIcon;
    case 'zpr':
    case 'ztl':
      return ZBrushIcon;
    case 'c4d':
      return Cinema4DIcon;
    case 'ma':
    case 'mb':
      return MayaIcon;
    case 'max':
      return Max3dsIcon;

    // Audio & DAW
    case 'als':
    case 'alc':
    case 'alp':
      return AbletonIcon;
    case 'flp':
    case 'fst':
      return FLStudioIcon;
    case 'cpr':
    case 'npr':
      return CubaseIcon;

    default:
      return null;
  }
}

/** 1. Adobe Photoshop (Ps) */
export const PhotoshopIcon: React.FC<AppIconProps> = ({ className = 'w-4 h-4', size = 16 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`${className} shrink-0 drop-shadow-sm`}
  >
    <rect width="24" height="24" rx="4.5" fill="#001E36" />
    <text
      x="12"
      y="16.5"
      fill="#31A8FF"
      fontSize="12"
      fontWeight="900"
      fontFamily="system-ui, -apple-system, sans-serif"
      textAnchor="middle"
      letterSpacing="-0.5px"
    >
      Ps
    </text>
  </svg>
);

/** 2. Adobe Illustrator (Ai) */
export const IllustratorIcon: React.FC<AppIconProps> = ({ className = 'w-4 h-4', size = 16 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`${className} shrink-0 drop-shadow-sm`}
  >
    <rect width="24" height="24" rx="4.5" fill="#330000" />
    <text
      x="12"
      y="16.5"
      fill="#FF9A00"
      fontSize="12"
      fontWeight="900"
      fontFamily="system-ui, -apple-system, sans-serif"
      textAnchor="middle"
      letterSpacing="-0.5px"
    >
      Ai
    </text>
  </svg>
);

/** 3. Adobe InDesign (Id) */
export const InDesignIcon: React.FC<AppIconProps> = ({ className = 'w-4 h-4', size = 16 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`${className} shrink-0 drop-shadow-sm`}
  >
    <rect width="24" height="24" rx="4.5" fill="#49021F" />
    <text
      x="12"
      y="16.5"
      fill="#FF3366"
      fontSize="12"
      fontWeight="900"
      fontFamily="system-ui, -apple-system, sans-serif"
      textAnchor="middle"
      letterSpacing="-0.5px"
    >
      Id
    </text>
  </svg>
);

/** 4. Adobe After Effects (Ae) */
export const AfterEffectsIcon: React.FC<AppIconProps> = ({ className = 'w-4 h-4', size = 16 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`${className} shrink-0 drop-shadow-sm`}
  >
    <rect width="24" height="24" rx="4.5" fill="#00005B" />
    <text
      x="12"
      y="16.5"
      fill="#9999FF"
      fontSize="12"
      fontWeight="900"
      fontFamily="system-ui, -apple-system, sans-serif"
      textAnchor="middle"
      letterSpacing="-0.5px"
    >
      Ae
    </text>
  </svg>
);

/** 5. Adobe Premiere Pro (Pr) */
export const PremiereIcon: React.FC<AppIconProps> = ({ className = 'w-4 h-4', size = 16 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`${className} shrink-0 drop-shadow-sm`}
  >
    <rect width="24" height="24" rx="4.5" fill="#00005B" />
    <text
      x="12"
      y="16.5"
      fill="#EA77FF"
      fontSize="12"
      fontWeight="900"
      fontFamily="system-ui, -apple-system, sans-serif"
      textAnchor="middle"
      letterSpacing="-0.5px"
    >
      Pr
    </text>
  </svg>
);

/** 6. Adobe Acrobat / PDF */
export const AcrobatIcon: React.FC<AppIconProps> = ({ className = 'w-4 h-4', size = 16 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`${className} shrink-0 drop-shadow-sm`}
  >
    <rect width="24" height="24" rx="4.5" fill="#E81123" />
    {/* Acrobat Ribbon Curves */}
    <path
      d="M17.5 15.5C16.2 15.5 14.8 14.9 13.5 13.9C11.5 14.7 9.8 15.8 8.8 16.5C7.2 17.6 6 17.2 5.6 16.5C5.2 15.8 5.6 14.5 7.1 13.5C8.3 12.7 10.4 12 11.8 10.8C12.4 9.1 12.8 7.5 12.8 6.4C12.8 5.2 13.4 4.5 14.2 4.5C15 4.5 15.4 5.3 15.1 6.8C14.7 8.5 13.8 10.6 12.8 12.2C14.2 13.1 16 13.7 17.4 13.7C18.6 13.7 19.2 14.3 19.1 15C19 15.4 18.5 15.5 17.5 15.5Z"
      fill="white"
    />
  </svg>
);

/** 7. Adobe Lightroom (Lr) */
export const LightroomIcon: React.FC<AppIconProps> = ({ className = 'w-4 h-4', size = 16 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`${className} shrink-0 drop-shadow-sm`}
  >
    <rect width="24" height="24" rx="4.5" fill="#001E36" />
    <text
      x="12"
      y="16.5"
      fill="#31A8FF"
      fontSize="12"
      fontWeight="900"
      fontFamily="system-ui, -apple-system, sans-serif"
      textAnchor="middle"
      letterSpacing="-0.5px"
    >
      Lr
    </text>
  </svg>
);

/** 8. Adobe XD (Xd) */
export const XdIcon: React.FC<AppIconProps> = ({ className = 'w-4 h-4', size = 16 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`${className} shrink-0 drop-shadow-sm`}
  >
    <rect width="24" height="24" rx="4.5" fill="#470137" />
    <text
      x="12"
      y="16.5"
      fill="#FF61F6"
      fontSize="12"
      fontWeight="900"
      fontFamily="system-ui, -apple-system, sans-serif"
      textAnchor="middle"
      letterSpacing="-0.5px"
    >
      Xd
    </text>
  </svg>
);

/** 9. Figma Official 5-Color Logo */
export const FigmaIcon: React.FC<AppIconProps> = ({ className = 'w-4 h-4', size = 16 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`${className} shrink-0 drop-shadow-sm`}
  >
    <rect width="24" height="24" rx="4.5" fill="#1E1E1E" />
    <g transform="translate(4, 2) scale(0.667)">
      {/* Red */}
      <path d="M6 0H12V6H6C2.686 0 0 2.686 0 6C0 9.314 2.686 12 6 12V0Z" fill="#F24E1E" />
      {/* Orange */}
      <path d="M12 0H18C21.314 0 24 2.686 24 6C24 9.314 21.314 12 18 12H12V0Z" fill="#FF7262" />
      {/* Purple */}
      <path d="M12 12H18C21.314 12 24 14.686 24 18C24 21.314 21.314 24 18 24H12V12Z" fill="#A259FF" />
      {/* Blue */}
      <circle cx="6" cy="18" r="6" fill="#1ABCFE" />
      {/* Green */}
      <path d="M0 30C0 26.686 2.686 24 6 24H12V30C12 33.314 9.314 36 6 36C2.686 36 0 33.314 0 30Z" fill="#0ACF83" />
    </g>
  </svg>
);

/** 10. Blender Official Logo */
export const BlenderIcon: React.FC<AppIconProps> = ({ className = 'w-4 h-4', size = 16 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`${className} shrink-0 drop-shadow-sm`}
  >
    <rect width="24" height="24" rx="4.5" fill="#22252C" />
    <g transform="translate(2, 2)">
      {/* 3 Radiating Orange Blades */}
      <path
        d="M10 2.5C10 2.5 13.5 6 13.8 8.8C12.8 8.4 11.5 8.3 10.2 8.6L6.5 4.5C6.5 4.5 9 2.5 10 2.5Z"
        fill="#E87D0D"
      />
      <path
        d="M4.5 8.2C5.5 8.8 8.2 10 9 11.2C8.5 12 8.4 13.2 8.6 14.3L4 14C4 14 3.5 9.5 4.5 8.2Z"
        fill="#E87D0D"
      />
      <path
        d="M15.5 8.5C15.5 8.5 16 12.8 14.8 14.2C14 13.5 12.8 13.2 11.5 13.3L12 8.5C13.2 8.3 14.5 8.3 15.5 8.5Z"
        fill="#E87D0D"
      />
      {/* Main Orange Circle */}
      <circle cx="11.5" cy="11.5" r="5.5" fill="#EA7600" />
      {/* Inner Blue Eye */}
      <circle cx="11.5" cy="11.5" r="2.6" fill="#265787" />
      <circle cx="11.5" cy="11.5" r="1.4" fill="#FFFFFF" />
    </g>
  </svg>
);

/** 11. Pixologic ZBrush (ZB) */
export const ZBrushIcon: React.FC<AppIconProps> = ({ className = 'w-4 h-4', size = 16 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`${className} shrink-0 drop-shadow-sm`}
  >
    <rect width="24" height="24" rx="4.5" fill="#1C1E24" />
    {/* Metallic Z shape */}
    <path
      d="M5 6H18.5L9.5 17.5H19V19.5H5.5L14.5 8H5V6Z"
      fill="url(#zb_grad)"
    />
    <defs>
      <linearGradient id="zb_grad" x1="5" y1="6" x2="19" y2="19.5" gradientUnits="userSpaceOnUse">
        <stop stopColor="#F5A623" />
        <stop offset="0.5" stopColor="#E25D1D" />
        <stop offset="1" stopColor="#B32B10" />
      </linearGradient>
    </defs>
  </svg>
);

/** 12. Ableton Live (Four Bars & Two Lines) */
export const AbletonIcon: React.FC<AppIconProps> = ({ className = 'w-4 h-4', size = 16 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`${className} shrink-0 drop-shadow-sm`}
  >
    <rect width="24" height="24" rx="4.5" fill="#141414" />
    {/* 4 Vertical Bars */}
    <rect x="5" y="7" width="1.5" height="10" fill="#00D285" />
    <rect x="7.5" y="7" width="1.5" height="10" fill="#00D285" />
    <rect x="10" y="7" width="1.5" height="10" fill="#00D285" />
    <rect x="12.5" y="7" width="1.5" height="10" fill="#00D285" />
    {/* 4 Horizontal Lines */}
    <rect x="15.5" y="8" width="4.5" height="1.5" fill="#00D285" />
    <rect x="15.5" y="11" width="4.5" height="1.5" fill="#00D285" />
    <rect x="15.5" y="14" width="4.5" height="1.5" fill="#00D285" />
  </svg>
);

/** 13. FL Studio (Fruity Loops Pepper) */
export const FLStudioIcon: React.FC<AppIconProps> = ({ className = 'w-4 h-4', size = 16 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`${className} shrink-0 drop-shadow-sm`}
  >
    <rect width="24" height="24" rx="4.5" fill="#1A1C22" />
    {/* Pepper body */}
    <path
      d="M13.5 6C12.5 4.5 10.5 4 8.5 5C6.5 6 6 8.5 6.5 11C7.2 14.5 10 18.5 14 19.5C17.5 17 18.5 12 17 8.5C16 6.5 14.5 5.5 13.5 6Z"
      fill="#FF6A00"
    />
    {/* Green leaf */}
    <path
      d="M13.5 6C15 4 17.5 4 18.5 4.5C19 5.5 18 7.5 16 8.5L13.5 6Z"
      fill="#28A745"
    />
  </svg>
);

/** 14. Steinberg Cubase */
export const CubaseIcon: React.FC<AppIconProps> = ({ className = 'w-4 h-4', size = 16 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`${className} shrink-0 drop-shadow-sm`}
  >
    <rect width="24" height="24" rx="4.5" fill="#8B0000" />
    {/* Geometric stylized C */}
    <path
      d="M6 7H18V10H9V14H18V17H6V7Z"
      fill="#FFFFFF"
    />
  </svg>
);

/** 15. Maxon Cinema 4D (C4D) */
export const Cinema4DIcon: React.FC<AppIconProps> = ({ className = 'w-4 h-4', size = 16 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`${className} shrink-0 drop-shadow-sm`}
  >
    <rect width="24" height="24" rx="4.5" fill="#001844" />
    <text
      x="12"
      y="16.5"
      fill="#228BE6"
      fontSize="10"
      fontWeight="900"
      fontFamily="system-ui, -apple-system, sans-serif"
      textAnchor="middle"
    >
      C4D
    </text>
  </svg>
);

/** 16. Autodesk Maya */
export const MayaIcon: React.FC<AppIconProps> = ({ className = 'w-4 h-4', size = 16 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`${className} shrink-0 drop-shadow-sm`}
  >
    <rect width="24" height="24" rx="4.5" fill="#063E48" />
    <text
      x="12"
      y="16.5"
      fill="#00B4D8"
      fontSize="12"
      fontWeight="900"
      fontFamily="system-ui, -apple-system, sans-serif"
      textAnchor="middle"
    >
      M
    </text>
  </svg>
);

/** 17. Autodesk 3ds Max */
export const Max3dsIcon: React.FC<AppIconProps> = ({ className = 'w-4 h-4', size = 16 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`${className} shrink-0 drop-shadow-sm`}
  >
    <rect width="24" height="24" rx="4.5" fill="#1C3F3B" />
    <text
      x="12"
      y="16.5"
      fill="#20C997"
      fontSize="10"
      fontWeight="900"
      fontFamily="system-ui, -apple-system, sans-serif"
      textAnchor="middle"
    >
      3ds
    </text>
  </svg>
);

/** 18. Sketch */
export const SketchIcon: React.FC<AppIconProps> = ({ className = 'w-4 h-4', size = 16 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`${className} shrink-0 drop-shadow-sm`}
  >
    <rect width="24" height="24" rx="4.5" fill="#241B08" />
    {/* Diamond shape */}
    <path
      d="M7 6L4 10.5L12 19L20 10.5L17 6H7Z"
      fill="#FDB300"
    />
    <path
      d="M7 6L12 19L17 6H7Z"
      fill="#FDD33B"
    />
  </svg>
);

/** 19. Krita */
export const KritaIcon: React.FC<AppIconProps> = ({ className = 'w-4 h-4', size = 16 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`${className} shrink-0 drop-shadow-sm`}
  >
    <rect width="24" height="24" rx="4.5" fill="#19232D" />
    {/* Color wheel splash */}
    <circle cx="10" cy="11" r="5" fill="#3DAEE9" />
    <path
      d="M12 7C14 7 17 9 17 12C17 14 15 16 13 16L17 18"
      stroke="#FF4081"
      strokeWidth="2"
      strokeLinecap="round"
    />
  </svg>
);

/** 20. CorelDRAW (CDR) */
export const CorelDrawIcon: React.FC<AppIconProps> = ({ className = 'w-4 h-4', size = 16 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`${className} shrink-0 drop-shadow-sm`}
  >
    <rect width="24" height="24" rx="4.5" fill="#1C2E1A" />
    {/* Hot air balloon balloon shape */}
    <ellipse cx="12" cy="10" rx="6" ry="6.5" fill="#50B848" />
    <path d="M9 16.5H15L13.5 19H10.5L9 16.5Z" fill="#88D982" />
  </svg>
);

/** 21. Corel Painter (RIF / RIFF) */
export const PainterIcon: React.FC<AppIconProps> = ({ className = 'w-4 h-4', size = 16 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`${className} shrink-0 drop-shadow-sm`}
  >
    <rect width="24" height="24" rx="4.5" fill="#2D1C12" />
    {/* Paint brush stroke */}
    <path
      d="M6 17C9 14 15 8 18 6C18 6 16.5 11 13 14C10.5 16.2 7 18 6 17Z"
      fill="#F97316"
    />
    <circle cx="7" cy="17" r="2" fill="#FDBA74" />
  </svg>
);

/**
 * Universal component that renders the official software icon for creative formats
 * or falls back to a clean text badge.
 */
interface FileTypeBadgeProps {
  extension: string;
  className?: string;
  badgeClassName?: string;
  size?: number;
  showTextFallback?: boolean;
}

export const FileTypeBadge: React.FC<FileTypeBadgeProps> = ({
  extension,
  className = '',
  badgeClassName = 'px-2 py-0.5 text-[10px] font-mono font-bold tracking-wide text-white/90 rounded-md bg-black/70 backdrop-blur-md shadow-sm',
  size = 18,
  showTextFallback = true,
}) => {
  const IconComponent = getAppIcon(extension);

  if (IconComponent) {
    return (
      <div
        className={`inline-flex items-center justify-center shrink-0 ${className}`}
        title={`${extension.toUpperCase()} soubor`}
      >
        <IconComponent size={size} />
      </div>
    );
  }

  if (!showTextFallback) return null;

  return (
    <span className={badgeClassName}>
      {extension}
    </span>
  );
};
