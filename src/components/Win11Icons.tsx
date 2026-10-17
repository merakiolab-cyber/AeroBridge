import React from 'react';

/**
 * Authentic Windows 11 Fluent Design Icons
 * Pixel-perfect SVG vector icons matching Windows 11 File Explorer.
 */

interface IconProps {
  className?: string;
  isOpen?: boolean;
}

/** Windows 11 Yellow Fluent Folder (Closed & Open) */
export const Win11Folder: React.FC<IconProps> = ({ className = 'w-4 h-4', isOpen = false }) => {
  if (isOpen) {
    return (
      <svg className={`${className} shrink-0`} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="w11_f_tab" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#df941a" />
            <stop offset="100%" stopColor="#b67107" />
          </linearGradient>
          <linearGradient id="w11_f_back" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f3a925" />
            <stop offset="100%" stopColor="#cb7804" />
          </linearGradient>
          <linearGradient id="w11_f_front" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffd95b" />
            <stop offset="100%" stopColor="#e59812" />
          </linearGradient>
          <linearGradient id="w11_f_paper" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#e2e8f0" />
          </linearGradient>
          <filter id="w11_f_shadow" x="0.5" y="6" width="19" height="12" filterUnits="userSpaceOnUse">
            <feDropShadow dx="0" dy="1" stdDeviation="0.6" floodOpacity="0.3" />
          </filter>
        </defs>
        {/* Back folder body */}
        <path
          d="M2.5 4.5C2.5 3.67 3.17 3 4 3H7.8C8.3 3 8.78 3.25 9.07 3.66L9.85 4.75C10.05 5.03 10.37 5.2 10.71 5.2H16C16.83 5.2 17.5 5.87 17.5 6.7V14C17.5 14.83 16.83 15.5 16 15.5H4C3.17 15.5 2.5 14.83 2.5 14V4.5Z"
          fill="url(#w11_f_back)"
        />
        {/* White document inside peeking out */}
        <rect x="4.5" y="4" width="11" height="9.5" rx="1" fill="url(#w11_f_paper)" />
        <rect x="6" y="6.2" width="5" height="1" rx="0.5" fill="#3b82f6" opacity="0.8" />
        <rect x="6" y="8.2" width="8" height="0.8" rx="0.4" fill="#64748b" opacity="0.6" />
        <rect x="6" y="9.8" width="6.5" height="0.8" rx="0.4" fill="#94a3b8" opacity="0.6" />
        {/* Front flap open angled */}
        <g filter="url(#w11_f_shadow)">
          <path
            d="M1.5 8.2C1.5 7.6 1.95 7.1 2.55 7.05L16.2 6.05C16.85 6 17.45 6.45 17.5 7.1L18.5 14.2C18.55 14.9 18 15.5 17.3 15.5H2.7C2.04 15.5 1.5 14.96 1.5 14.3V8.2Z"
            fill="url(#w11_f_front)"
          />
        </g>
        {/* Subtle highlight rim */}
        <path d="M2.55 7.05L16.2 6.05" stroke="rgba(255,255,255,0.7)" strokeWidth="0.8" strokeLinecap="round" />
      </svg>
    );
  }

  return (
    <svg className={`${className} shrink-0`} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="w11_c_tab" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#e39a1d" />
          <stop offset="100%" stopColor="#b56f08" />
        </linearGradient>
        <linearGradient id="w11_c_body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffda62" />
          <stop offset="50%" stopColor="#f7b726" />
          <stop offset="100%" stopColor="#e8950d" />
        </linearGradient>
        <filter id="w11_c_shadow" x="1" y="5.5" width="18" height="12.5" filterUnits="userSpaceOnUse">
          <feDropShadow dx="0" dy="0.8" stdDeviation="0.5" floodOpacity="0.25" />
        </filter>
      </defs>
      {/* Back tab */}
      <path
        d="M2.5 4.5C2.5 3.67 3.17 3 4 3H7.8C8.3 3 8.78 3.25 9.07 3.66L9.85 4.75C10.05 5.03 10.37 5.2 10.71 5.2H16C16.83 5.2 17.5 5.87 17.5 6.7V9H2.5V4.5Z"
        fill="url(#w11_c_tab)"
      />
      {/* Front folder body */}
      <g filter="url(#w11_c_shadow)">
        <rect x="2" y="6" width="16" height="9.8" rx="2" fill="url(#w11_c_body)" />
      </g>
      {/* Top glossy rim highlight */}
      <path d="M3.5 6.5H16.5" stroke="rgba(255,255,255,0.75)" strokeWidth="0.75" strokeLinecap="round" />
    </svg>
  );
};

/** Windows 11 Desktop (Plocha) Icon */
export const Win11Desktop: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg className={`${className} shrink-0`} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="w11_screen_bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#0078d4" />
        <stop offset="100%" stopColor="#60cdff" />
      </linearGradient>
      <linearGradient id="w11_screen_bloom" x1="0.5" y1="0" x2="0.5" y2="1">
        <stop offset="0%" stopColor="#ffffff" stopOpacity="0.5" />
        <stop offset="100%" stopColor="#005a9e" stopOpacity="0.2" />
      </linearGradient>
    </defs>
    {/* Monitor frame */}
    <rect x="2" y="2.5" width="16" height="11.5" rx="1.5" fill="#1e2229" stroke="#333842" strokeWidth="0.8" />
    {/* Screen displaying Windows 11 wallpaper */}
    <rect x="3" y="3.5" width="14" height="9.5" rx="0.8" fill="url(#w11_screen_bg)" />
    {/* Win11 Bloom flower silhouette */}
    <path
      d="M10 6C9 7.2 8 8 7 9.5C8.5 9 10 9.2 10 9.2C10 9.2 11.5 9 13 9.5C12 8 11 7.2 10 6Z"
      fill="url(#w11_screen_bloom)"
    />
    {/* Monitor Stand */}
    <path d="M9 14H11V16H9V14Z" fill="#64748b" />
    <rect x="6.5" y="16" width="7" height="1.2" rx="0.6" fill="#94a3b8" />
  </svg>
);

/** Windows 11 Downloads (Stažené soubory) Icon */
export const Win11Downloads: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg className={`${className} shrink-0`} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="w11_dl_bg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#2397f3" />
        <stop offset="100%" stopColor="#006cd4" />
      </linearGradient>
    </defs>
    {/* Circle badge */}
    <circle cx="10" cy="10" r="8" fill="url(#w11_dl_bg)" />
    {/* White tray container */}
    <path d="M6 13.5H14" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" />
    {/* White downward arrow */}
    <path d="M10 5.5V11.5M10 11.5L7.5 9M10 11.5L12.5 9" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** Windows 11 Documents (Dokumenty) Icon */
export const Win11Documents: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg className={`${className} shrink-0`} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="w11_doc_bg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#ffffff" />
        <stop offset="100%" stopColor="#eef2f6" />
      </linearGradient>
      <linearGradient id="w11_doc_fold" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#0078d4" />
        <stop offset="100%" stopColor="#005a9e" />
      </linearGradient>
    </defs>
    {/* Document sheet */}
    <path
      d="M4.5 3C4.5 2.45 4.95 2 5.5 2H11.5L16 6.5V16.5C16 17.05 15.55 17.5 15 17.5H5.5C4.95 17.5 4.5 17.05 4.5 16.5V3Z"
      fill="url(#w11_doc_bg)"
      stroke="#cbd5e1"
      strokeWidth="0.8"
    />
    {/* Folded corner */}
    <path d="M11.5 2V5.5C11.5 6.05 11.95 6.5 12.5 6.5H16L11.5 2Z" fill="url(#w11_doc_fold)" />
    {/* Blue & grey text lines */}
    <rect x="6.5" y="8" width="7" height="1.2" rx="0.6" fill="#0078d4" />
    <rect x="6.5" y="10.5" width="7" height="1" rx="0.5" fill="#64748b" />
    <rect x="6.5" y="12.5" width="5" height="1" rx="0.5" fill="#94a3b8" />
  </svg>
);

/** Windows 11 Pictures (Obrázky) Icon */
export const Win11Pictures: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg className={`${className} shrink-0`} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="w11_pic_sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#0078d4" />
        <stop offset="100%" stopColor="#00b4d8" />
      </linearGradient>
      <linearGradient id="w11_pic_mtn" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#e2e8f0" />
        <stop offset="100%" stopColor="#94a3b8" />
      </linearGradient>
    </defs>
    {/* Frame container */}
    <rect x="2.5" y="3" width="15" height="14" rx="2" fill="url(#w11_pic_sky)" stroke="#0284c7" strokeWidth="0.6" />
    {/* Golden Sun */}
    <circle cx="6" cy="6.5" r="1.8" fill="#fbbf24" />
    {/* Mountain peaks */}
    <path d="M2.5 14.5L7 9.5L10 12.5L13.5 8L17.5 13.5V15C17.5 16.1 16.6 17 15.5 17H4.5C3.4 17 2.5 16.1 2.5 15V14.5Z" fill="url(#w11_pic_mtn)" />
    <path d="M8.5 14L11 11L14.5 15.5L17.5 15.5V15C17.5 16.1 16.6 17 15.5 17H10.5L8.5 14Z" fill="#64748b" opacity="0.6" />
  </svg>
);

/** Windows 11 Music (Hudba) Icon */
export const Win11Music: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg className={`${className} shrink-0`} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="w11_mus_bg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#ff7043" />
        <stop offset="100%" stopColor="#f4511e" />
      </linearGradient>
    </defs>
    <circle cx="10" cy="10" r="8" fill="url(#w11_mus_bg)" />
    {/* Crisp double eighth note */}
    <path
      d="M7 13.5C5.9 13.5 5 12.6 5 11.5C5 10.4 5.9 9.5 7 9.5C7.6 9.5 8.1 9.7 8.5 10.1V6.5L14 5V10.1C13.6 9.7 13.1 9.5 12.5 9.5C11.4 9.5 10.5 10.4 10.5 11.5C10.5 12.6 11.4 13.5 12.5 13.5C13.6 13.5 14.5 12.6 14.5 11.5V7.2L8.5 8.7V11.5C8.5 12.6 7.6 13.5 7 13.5Z"
      fill="#ffffff"
    />
  </svg>
);

/** Windows 11 Videos (Videa) Icon */
export const Win11Videos: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg className={`${className} shrink-0`} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="w11_vid_bg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#a855f7" />
        <stop offset="100%" stopColor="#7c3aed" />
      </linearGradient>
    </defs>
    <rect x="2.5" y="3" width="15" height="14" rx="2.5" fill="url(#w11_vid_bg)" />
    {/* Clapperboard chevron top stripe */}
    <path d="M2.5 6.5H17.5" stroke="#ffffff" strokeWidth="0.8" strokeOpacity="0.4" />
    <path d="M5 3L7.5 6.5M10 3L12.5 6.5M15 3L17.5 6.5" stroke="#ffffff" strokeWidth="1" strokeOpacity="0.8" />
    {/* Play triangle */}
    <path d="M8.5 9.2L13 11.5L8.5 13.8V9.2Z" fill="#ffffff" />
  </svg>
);

/** Windows 11 This PC (Tento počítač) Icon */
export const Win11ThisPC: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg className={`${className} shrink-0`} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="w11_pc_screen" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#0078d4" />
        <stop offset="100%" stopColor="#00b4d8" />
      </linearGradient>
      <linearGradient id="w11_pc_case" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#334155" />
        <stop offset="100%" stopColor="#0f172a" />
      </linearGradient>
    </defs>
    {/* Monitor */}
    <rect x="2" y="3" width="12" height="9.5" rx="1.2" fill="#1e2229" stroke="#475569" strokeWidth="0.6" />
    <rect x="2.8" y="3.8" width="10.4" height="7.8" rx="0.6" fill="url(#w11_pc_screen)" />
    {/* Monitor Stand */}
    <path d="M7 12.5H9V14.5H7V12.5Z" fill="#64748b" />
    <rect x="5.5" y="14.5" width="5" height="1" rx="0.5" fill="#94a3b8" />
    {/* Desktop PC Tower chassis beside monitor */}
    <rect x="15" y="4" width="3.5" height="11.5" rx="0.8" fill="url(#w11_pc_case)" stroke="#64748b" strokeWidth="0.6" />
    {/* Blue Power LED & USB ports */}
    <circle cx="16.7" cy="6" r="0.6" fill="#38bdf8" />
    <rect x="16" y="8" width="1.5" height="0.6" rx="0.2" fill="#94a3b8" />
    <rect x="16" y="9.5" width="1.5" height="0.6" rx="0.2" fill="#94a3b8" />
  </svg>
);

/** Windows 11 Local Drive (Disk C:, D:, etc.) Icon */
export const Win11Drive: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg className={`${className} shrink-0`} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="w11_drv_chassis" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#475569" />
        <stop offset="100%" stopColor="#1e293b" />
      </linearGradient>
      <linearGradient id="w11_drv_plate" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#94a3b8" />
        <stop offset="100%" stopColor="#64748b" />
      </linearGradient>
    </defs>
    {/* Drive enclosure */}
    <rect x="2" y="5.5" width="16" height="9" rx="1.5" fill="url(#w11_drv_chassis)" stroke="#64748b" strokeWidth="0.8" />
    {/* Drive top plate */}
    <rect x="3.5" y="7" width="13" height="4.5" rx="0.8" fill="url(#w11_drv_plate)" />
    {/* Windows blue capacity / status bar */}
    <rect x="4" y="9.5" width="8" height="1.2" rx="0.6" fill="#0078d4" />
    {/* Drive activity LED */}
    <circle cx="15" cy="12.5" r="0.75" fill="#22c55e" />
  </svg>
);

/** Windows 11 Star / Favorites Icon */
export const Win11Star: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg className={`${className} shrink-0`} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M10 2.5L12.3 7.2L17.5 7.9L13.8 11.5L14.7 16.6L10 14.1L5.3 16.6L6.2 11.5L2.5 7.9L7.7 7.2L10 2.5Z"
      fill="#f59e0b"
      stroke="#d97706"
      strokeWidth="0.8"
      strokeLinejoin="round"
    />
  </svg>
);
