export default function EncryptedRouteVisual() {
  return (
    <svg className="route-visual" viewBox="0 0 360 220" fill="none" aria-hidden="true">
      <circle cx="40" cy="110" r="8" className="route-node" />
      <circle cx="180" cy="60" r="14" className="route-node route-node--shield" />
      <circle cx="320" cy="110" r="8" className="route-node" />

      <path d="M40 110 C 100 110, 120 70, 180 60" className="route-path" />
      <path d="M180 60 C 240 70, 260 110, 320 110" className="route-path route-path--delayed" />

      <path
        d="M170 48 L190 48 L190 60 L196 60 L180 78 L164 60 L170 60 Z"
        className="route-shield-mark"
      />

      <circle r="3" className="route-pulse" />
    </svg>
  );
}