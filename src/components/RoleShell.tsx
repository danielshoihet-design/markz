"use client";

import { AppHeader } from "@/components/AppHeader";
import { BottomNav } from "@/components/BottomNav";
import { CartProvider, useCart, type CartMode } from "@/lib/cart/store";
import { I18nProvider, useI18n } from "@/lib/i18n/provider";
import type { Locale, Profile } from "@/lib/types";

type NavLabelKey =
  | "catalog"
  | "cart"
  | "orders"
  | "supplies"
  | "inbox"
  | "clients"
  | "sellers"
  | "products"
  | "report";

type NavItem = {
  href: string;
  labelKey: NavLabelKey;
  icon: string;
  badge?: number;
  cartBadge?: boolean;
};

export function RoleShell({
  profile,
  titleKey,
  subtitle,
  showBalance,
  nav,
  cartMode,
  children,
}: {
  profile: Profile;
  titleKey: NavLabelKey | "welcome";
  subtitle?: string;
  showBalance?: boolean;
  nav: NavItem[];
  cartMode?: CartMode;
  children: React.ReactNode;
}) {
  const content = (
    <I18nProvider initialLocale={(profile.locale as Locale) || "he"} userId={profile.id}>
      {cartMode ? (
        <CartProvider mode={cartMode}>
          <ShellWithCart
            profile={profile}
            titleKey={titleKey}
            subtitle={subtitle}
            showBalance={showBalance}
            nav={nav}
          >
            {children}
          </ShellWithCart>
        </CartProvider>
      ) : (
        <ShellBase
          profile={profile}
          titleKey={titleKey}
          subtitle={subtitle}
          showBalance={showBalance}
          nav={nav}
        >
          {children}
        </ShellBase>
      )}
    </I18nProvider>
  );

  return content;
}

function ShellBase({
  profile,
  titleKey,
  subtitle,
  showBalance,
  nav,
  children,
  cartCount = 0,
}: {
  profile: Profile;
  titleKey: NavLabelKey | "welcome";
  subtitle?: string;
  showBalance?: boolean;
  nav: NavItem[];
  children: React.ReactNode;
  cartCount?: number;
}) {
  const { t, dir } = useI18n();
  const title = titleKey === "welcome" ? `${t.welcome}, ${profile.full_name}` : t[titleKey];

  return (
    <div className="app-shell flex min-h-dvh flex-col" dir={dir}>
      <AppHeader
        title={title}
        subtitle={subtitle}
        balance={showBalance ? Number(profile.credit_balance) : null}
      />
      <main className="flex-1 px-4 py-4">{children}</main>
      <BottomNav
        items={nav.map((item) => ({
          href: item.href,
          label: t[item.labelKey],
          icon: item.icon,
          badge: item.cartBadge ? cartCount : item.badge,
        }))}
      />
    </div>
  );
}

function ShellWithCart({
  profile,
  titleKey,
  subtitle,
  showBalance,
  nav,
  children,
}: {
  profile: Profile;
  titleKey: NavLabelKey | "welcome";
  subtitle?: string;
  showBalance?: boolean;
  nav: NavItem[];
  children: React.ReactNode;
}) {
  const cart = useCart();
  return (
    <ShellBase
      profile={profile}
      titleKey={titleKey}
      subtitle={subtitle}
      showBalance={showBalance}
      nav={nav}
      cartCount={cart.count}
    >
      {children}
    </ShellBase>
  );
}
