/** Google Material Symbols (Outlined), linked in index.html */
export default function MsIcon({ name, className = "" }) {
  return <span className={`material-symbols-outlined ${className}`.trim()}>{name}</span>;
}
