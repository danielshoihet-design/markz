export type UserRole = "manager" | "client" | "seller";
export type Locale = "he" | "en";
export type OrderStatus = "pending" | "approved" | "fulfilled" | "rejected";
export type PaymentStatus = "unpaid" | "partial" | "paid";
export type SupplyStatus = "pending" | "accepted" | "rejected";

export type Profile = {
  id: string;
  role: UserRole;
  full_name: string;
  username: string | null;
  email: string | null;
  locale: Locale;
  credit_balance: number;
  created_at: string;
};

export type Product = {
  id: string;
  slug: string;
  name_he: string;
  name_en: string;
  image_path: string;
  sell_price: number;
  buy_price: number;
  unit: string;
  qty_step: number;
  active: boolean;
  sort_order: number;
};

export type Order = {
  id: string;
  client_id: string;
  status: OrderStatus;
  payment_status: PaymentStatus | null;
  amount_paid: number;
  total: number;
  note: string | null;
  created_at: string;
  updated_at: string;
  profiles?: Profile | null;
  order_items?: OrderItem[];
};

export type OrderItem = {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  products?: Product | null;
};

export type Supply = {
  id: string;
  seller_id: string;
  status: SupplyStatus;
  total: number;
  note: string | null;
  created_at: string;
  updated_at: string;
  profiles?: Profile | null;
  supply_items?: SupplyItem[];
};

export type SupplyItem = {
  id: string;
  supply_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  products?: Product | null;
};

export type AppNotification = {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  ref_id: string | null;
  created_at: string;
};

export type ChatMessage = {
  id: string;
  /** The client or supplier whose conversation with the manager this is. */
  thread_user_id: string;
  sender_id: string | null;
  from_manager: boolean;
  body: string;
  read_at: string | null;
  created_at: string;
};

export type ChatThreadSummary = {
  user_id: string;
  full_name: string;
  username: string | null;
  role: UserRole;
  last_body: string | null;
  last_at: string | null;
  last_from_manager: boolean | null;
  unread: number;
};

export function productName(product: Product, locale: Locale): string {
  if (locale === "he") return product.name_he;
  return product.name_en;
}
