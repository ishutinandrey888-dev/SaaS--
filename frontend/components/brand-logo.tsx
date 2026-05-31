import Link from "next/link";

export function BrandLogo({
  className,
  href = "/",
  width = 188,
  priority = false,
}: {
  className?: string;
  href?: string;
  width?: number;
  priority?: boolean;
}) {
  return (
    <Link
      href={href}
      aria-label="ДОЖИМ-АЙ"
      className={className}
      style={{ display: "inline-flex", alignItems: "center", textDecoration: "none" }}
    >
      <img
        src="/brand/dozim-logo-16-9.png"
        alt="ДОЖИМ-АЙ"
        loading={priority ? "eager" : "lazy"}
        style={{ width, height: "auto", objectFit: "contain", objectPosition: "left center" }}
      />
    </Link>
  );
}
