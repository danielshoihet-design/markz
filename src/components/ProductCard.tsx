import Image from "next/image";
import Link from "next/link";
import { formatMoney } from "@/lib/format";
import { productName, type Locale, type Product } from "@/lib/types";

type Props = {
  product: Product;
  locale: Locale;
  href: string;
  price: number;
  priceLabel: string;
  index?: number;
};

export function ProductCard({
  product,
  locale,
  href,
  price,
  priceLabel,
  index = 0,
}: Props) {
  return (
    <Link
      href={href}
      className="card animate-rise group overflow-hidden transition hover:-translate-y-0.5"
      style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
    >
      <div className="relative aspect-square bg-cream-deep">
        <Image
          src={product.image_path}
          alt={productName(product, locale)}
          fill
          className="object-cover transition duration-300 group-hover:scale-[1.03]"
          sizes="(max-width: 480px) 50vw, 220px"
        />
      </div>
      <div className="space-y-1 p-3.5">
        <h3 className="font-display text-lg font-bold leading-tight">
          {productName(product, locale)}
        </h3>
        <p className="text-sm font-semibold text-accent">
          {formatMoney(price, locale)}{" "}
          <span className="font-medium text-ink-soft">{priceLabel}</span>
        </p>
      </div>
    </Link>
  );
}
