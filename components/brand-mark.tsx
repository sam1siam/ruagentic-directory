/** The {A} mark: two braces around a capital A, drawn as strokes so it scales
 *  cleanly beside the wordmark. Colour comes from the surrounding text. */
export default function BrandMark({
  className = 'brand-symbol',
}: {
  className?: string;
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 44 40"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path
        d="M14 4H9v10l-5 6 5 6v10h5M30 4h5v10l5 6-5 6v10h-5"
        strokeWidth="3"
      />
      <path d="M16.5 33.5 22 14l5.5 19.5M18.7 27h6.6" strokeWidth="3.2" />
    </svg>
  );
}
