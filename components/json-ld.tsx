/** Renders one or more JSON-LD objects in a single script element. */
export default function JsonLd({ data }: { data: object | object[] }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replaceAll('<', '\u003c'),
      }}
    />
  );
}
