// icons.jsx — line icons used throughout the app
// All icons take size + color props; default to currentColor

const Ic = {
  Play: ({ s = 22, c = 'currentColor' }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill={c}>
      <path d="M7 4.5v15c0 .6.7 1 1.2.6l12-7.5a.8.8 0 0 0 0-1.3l-12-7.5C7.7 3.5 7 3.9 7 4.5z"/>
    </svg>
  ),
  Pill: ({ s = 22, c = 'currentColor' }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="9" width="18" height="6" rx="3" transform="rotate(-30 12 12)" />
      <path d="M8.5 7.5l7 9" />
    </svg>
  ),
  Bolt: ({ s = 22, c = 'currentColor' }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill={c}>
      <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8z"/>
    </svg>
  ),
  Heart: ({ s = 22, c = 'currentColor' }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round">
      <path d="M3 12h3l2-4 3 8 2-6 2 2h6"/>
    </svg>
  ),
  Lungs: ({ s = 22, c = 'currentColor' }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round">
      <path d="M12 3v10"/>
      <path d="M8 7c0 2-4 3-4 8 0 3 2 5 4 5s2-2 2-4V7c0-1.5-2-1.5-2 0z"/>
      <path d="M16 7c0 2 4 3 4 8 0 3-2 5-4 5s-2-2-2-4V7c0-1.5 2-1.5 2 0z"/>
    </svg>
  ),
  Check: ({ s = 18, c = 'currentColor' }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12l5 5 9-11"/>
    </svg>
  ),
  ChevR: ({ s = 16, c = 'currentColor' }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 6l6 6-6 6"/>
    </svg>
  ),
  Plus: ({ s = 18, c = 'currentColor' }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.5" strokeLinecap="round">
      <path d="M12 5v14M5 12h14"/>
    </svg>
  ),
  Warn: ({ s = 16, c = 'currentColor' }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill={c}>
      <path d="M12 2 1 21h22L12 2zm0 6 7.5 13h-15L12 8zm-1 4v4h2v-4h-2zm0 5v2h2v-2h-2z"/>
    </svg>
  ),
  Copy: ({ s = 18, c = 'currentColor' }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="8" y="8" width="13" height="13" rx="2"/>
      <path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>
    </svg>
  ),
  File: ({ s = 18, c = 'currentColor' }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/>
      <path d="M14 3v6h6"/>
    </svg>
  ),
  Chat: ({ s = 18, c = 'currentColor' }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12a8 8 0 0 1-12.4 6.7L3 20l1.4-5A8 8 0 1 1 21 12z"/>
    </svg>
  ),
  Lock: ({ s = 14, c = 'currentColor' }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="11" width="16" height="10" rx="2"/>
      <path d="M8 11V7a4 4 0 0 1 8 0v4"/>
    </svg>
  ),
  Rotate: ({ s = 22, c = 'currentColor' }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 0 1 15-6.7L21 8"/>
      <path d="M21 3v5h-5"/>
      <path d="M21 12a9 9 0 0 1-15 6.7L3 16"/>
      <path d="M3 21v-5h5"/>
    </svg>
  ),
  Drop: ({ s = 22, c = 'currentColor' }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2.5s6 7.2 6 11.5a6 6 0 0 1-12 0c0-4.3 6-11.5 6-11.5z"/>
      <path d="M9 14.5a3 3 0 0 0 3 3" />
    </svg>
  ),
  Hospital: ({ s = 22, c = 'currentColor' }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 21V8l9-5 9 5v13"/>
      <path d="M3 21h18"/>
      <path d="M12 11v6"/>
      <path d="M9 14h6"/>
      <path d="M9 21v-4h6v4"/>
    </svg>
  ),
  Expand: ({ s = 18, c = 'currentColor' }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 3H5a2 2 0 0 0-2 2v3"/>
      <path d="M16 3h3a2 2 0 0 1 2 2v3"/>
      <path d="M8 21H5a2 2 0 0 1-2-2v-3"/>
      <path d="M16 21h3a2 2 0 0 0 2-2v-3"/>
    </svg>
  ),
  Collapse: ({ s = 18, c = 'currentColor' }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 8h3a2 2 0 0 0 2-2V3"/>
      <path d="M21 8h-3a2 2 0 0 1-2-2V3"/>
      <path d="M3 16h3a2 2 0 0 1 2 2v3"/>
      <path d="M21 16h-3a2 2 0 0 0-2 2v3"/>
    </svg>
  ),
  Truck: ({ s = 20, c = 'currentColor' }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="6" width="14" height="10" rx="1"/>
      <path d="M15 9h4l3 3v4h-7"/>
      <circle cx="6" cy="18" r="2"/>
      <circle cx="18" cy="18" r="2"/>
    </svg>
  ),
  X: ({ s = 16, c = 'currentColor' }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.5" strokeLinecap="round">
      <path d="M6 6l12 12M18 6 6 18"/>
    </svg>
  ),
};

Object.assign(window, { Ic });
