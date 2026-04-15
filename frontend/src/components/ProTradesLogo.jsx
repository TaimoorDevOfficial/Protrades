export default function ProTradesLogo({ className = "h-10 w-10" }) {
  return (
    <svg className={className} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <rect width="64" height="64" rx="14" className="fill-navy-850" />
      <path
        d="M18 42V22l8 8 10-18 10 30"
        className="stroke-gold-500"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M32 20v24M26 32h12" className="stroke-gold-400 opacity-40" strokeWidth="1.5" />
      <circle cx="46" cy="14" r="3" className="fill-gold-400" />
    </svg>
  );
}
