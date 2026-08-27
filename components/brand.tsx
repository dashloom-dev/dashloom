import Image from 'next/image';

type BrandProps = {
  compact?: boolean;
  priority?: boolean;
};

export function BrandMark({ compact = false, priority = false }: BrandProps) {
  const size = compact ? 26 : 34;
  return <Image className="brand-mark" src="/brand/logo-mark.png" alt="" width={size} height={size} priority={priority} aria-hidden="true" />;
}

export function Brand({ compact = false, priority = false }: BrandProps) {
  return <><BrandMark compact={compact} priority={priority} /><span>Dashloom</span></>;
}
