'use client';

/** A submit button that asks for confirmation before the form is sent.
 *  Used for irreversible admin actions such as refunds. */
export default function ConfirmSubmit({
  message,
  className,
  name,
  value,
  children,
}: {
  message: string;
  className?: string;
  name?: string;
  value?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="submit"
      className={className}
      name={name}
      value={value}
      onClick={(event) => {
        if (!window.confirm(message)) event.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
