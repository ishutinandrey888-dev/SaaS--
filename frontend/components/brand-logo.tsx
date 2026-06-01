type BrandLogoProps = {
  compact?: boolean;
};

export function BrandLogo({ compact = false }: BrandLogoProps) {
  return (
    <div className={compact ? "brand-logo brand-logo-compact" : "brand-logo"}>
      <div className="brand-logo-mark" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
      </div>
      {!compact ? (
        <strong>
          ДОЖИМ-<span>АЙ</span>
        </strong>
      ) : null}
    </div>
  );
}
