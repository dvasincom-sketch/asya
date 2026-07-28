// «Дышащий» образ Асей. Все стили — в globals.css (класс .orb), как в прототипе v3.
export function Orb({ className = "" }: { className?: string }) {
  return <div className={`orb ${className}`.trim()} aria-hidden="true" />;
}
