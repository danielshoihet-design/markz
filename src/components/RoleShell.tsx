"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { BottomNav } from "@/components/BottomNav";
import { ShellDockContext } from "@/components/ShellDock";
import { useChatUnread } from "@/components/useChatUnread";
import { CartProvider, useCart, type CartMode } from "@/lib/cart/store";
import { chatHomeForRole } from "@/lib/chat";
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
  | "report"
  | "chat";

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
  const pathname = usePathname();
  const chatUnread = useChatUnread(profile.role);
  const chatHref = chatHomeForRole(profile.role);
  // A client or supplier looking at their conversation is reading it, so the
  // badge would only flash there. The manager has many conversations.
  const readingChat = profile.role !== "manager" && pathname === chatHref;
  const [dock, setDock] = useState<HTMLDivElement | null>(null);
  const title = titleKey === "welcome" ? `${t.welcome}, ${profile.full_name}` : t[titleKey];

  // Every role gets the chat tab, so it is added here instead of in each page.
  const items = [
    ...nav.map((item) => ({
      href: item.href,
      label: t[item.labelKey],
      icon: item.icon,
      badge: item.cartBadge ? cartCount : item.badge,
    })),
    { href: chatHref, label: t.chat, icon: "💬", badge: readingChat ? 0 : chatUnread },
  ];

  return (
    <ShellDockContext.Provider value={dock}>
      <div className="app-shell flex min-h-dvh flex-col" dir={dir}>
        <AppHeader
          title={title}
          subtitle={subtitle}
          balance={showBalance ? Number(profile.credit_balance) : null}
        />
        <main className="flex-1 px-4 py-4">{children}</main>
        <div className="sticky bottom-0 z-40">
          <div ref={setDock} />
          <BottomNav items={items} />
        </div>
      </div>
    </ShellDockContext.Provider>
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
