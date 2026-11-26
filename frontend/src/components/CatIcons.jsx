// Gato rajado (tema claro): pelo amarronzado, listras escuras, olhos esverdeados
export function TabbyCat({ className = "w-5 h-5" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      {/* orelhas */}
      <polygon points="4,11 4.5,3 10,6.5" fill="#8b7355" stroke="#4a3f33" strokeWidth="0.8" strokeLinejoin="round" />
      <polygon points="20,11 19.5,3 14,6.5" fill="#8b7355" stroke="#4a3f33" strokeWidth="0.8" strokeLinejoin="round" />
      <polygon points="5.6,8.6 5.8,5.4 8,7" fill="#d9a3a0" />
      <polygon points="18.4,8.6 18.2,5.4 16,7" fill="#d9a3a0" />

      {/* cabeça */}
      <ellipse cx="12" cy="13.5" rx="8" ry="7" fill="#8b7355" stroke="#4a3f33" strokeWidth="0.8" />

      {/* listras */}
      <g stroke="#3b342c" strokeWidth="1" strokeLinecap="round">
        <line x1="12" y1="7" x2="12" y2="9.5" />
        <line x1="9.5" y1="7.6" x2="10" y2="9.4" />
        <line x1="14.5" y1="7.6" x2="14" y2="9.4" />
        <line x1="4.6" y1="13" x2="6.6" y2="13.4" />
        <line x1="4.9" y1="15.2" x2="6.8" y2="15" />
        <line x1="19.4" y1="13" x2="17.4" y2="13.4" />
        <line x1="19.1" y1="15.2" x2="17.2" y2="15" />
      </g>

      {/* focinho claro */}
      <ellipse cx="12" cy="16.4" rx="3" ry="2.2" fill="#d9cfbd" />

      {/* olhos esverdeados */}
      <circle cx="9" cy="12.6" r="1.3" fill="#b5ad5c" />
      <circle cx="15" cy="12.6" r="1.3" fill="#b5ad5c" />
      <circle cx="9" cy="12.6" r="0.6" fill="#1e1b16" />
      <circle cx="15" cy="12.6" r="0.6" fill="#1e1b16" />

      {/* nariz */}
      <polygon points="11,15.4 13,15.4 12,16.5" fill="#e59a9a" />
    </svg>
  );
}

// Gato frajola / tuxedo (tema escuro)
export function TuxedoCat({ className = "w-5 h-5" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <polygon points="4,11 4.5,3 10,6.5" fill="#1f2937" stroke="#94a3b8" strokeWidth="0.8" strokeLinejoin="round" />
      <polygon points="20,11 19.5,3 14,6.5" fill="#1f2937" stroke="#94a3b8" strokeWidth="0.8" strokeLinejoin="round" />
      <polygon points="5.6,8.6 5.8,5.4 8,7" fill="#f9a8d4" />
      <polygon points="18.4,8.6 18.2,5.4 16,7" fill="#f9a8d4" />
      <ellipse cx="12" cy="13.5" rx="8" ry="7" fill="#1f2937" stroke="#94a3b8" strokeWidth="0.8" />
      {/* focinho e peito branco */}
      <path d="M12 9.5 C10.2 12 8.8 14 8.8 16 C8.8 18 10.2 19 12 19 C13.8 19 15.2 18 15.2 16 C15.2 14 13.8 12 12 9.5 Z" fill="#f8fafc" />
      <circle cx="9" cy="12.6" r="1.1" fill="#fde047" />
      <circle cx="15" cy="12.6" r="1.1" fill="#fde047" />
      <circle cx="9" cy="12.6" r="0.45" fill="#0f172a" />
      <circle cx="15" cy="12.6" r="0.45" fill="#0f172a" />
      <polygon points="11,15.6 13,15.6 12,16.7" fill="#f472b6" />
    </svg>
  );
}