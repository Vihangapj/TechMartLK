export interface Review {
  id: string;
  userId: string;
  userName: string;
  rating: number;
  comment: string;
  date: number;
}

export interface Product {
  id: string;
  name: string;
  description: string; // Long Description
  shortDescription?: string; // Short Description
  price: number;
  offerPrice?: number; // Discounted price
  category: string;
  imageUrl: string; // Main image
  images: string[]; // Gallery images
  videoUrl?: string; // Optional YouTube/Video link
  stock: number;
  rating: number;
  reviews: Review[];
}

export interface Category {
  id: string;
  name: string;
  imageUrl: string;
}

export interface Popup {
  id: string;
  message: string;
  type: 'info' | 'warning' | 'success';
  isActive: boolean;
}

export interface Address {
  id: string;
  label: string; // e.g. "Home", "Office"
  name: string;
  address: string;
  city: string;
  district: string;
  phone: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  phone: string;
  role: 'admin' | 'customer';
  addresses: Address[];
  wishlist: string[];
}

export interface CartItem extends Product {
  quantity: number;
}

export interface OrderStatusUpdate {
  status: string;
  comment?: string;
  timestamp: number;
}

export interface Order {
  id: string;
  userId: string;
  items: CartItem[];
  totalAmount: number;
  status: 'Pending' | 'Shipped' | 'Delivered' | 'Cancelled';
  statusHistory: OrderStatusUpdate[]; // For timeline
  adminComment?: string; // Legacy/Current comment
  createdAt: number;
  shippingDetails: Address;
  paymentMethod: 'Card' | 'COD';
  customerEmail?: string;
  customerPhone?: string;
}

export interface ChatMessage {
  id: string;
  userId: string; // The customer ID
  sender: 'user' | 'admin';
  text: string;
  timestamp: number;
  read: boolean;
  readAt?: number;
}

export interface ShopSettings {
  shopName: string;
  address: string;
  phone: string;
  whatsapp: string;
  homeBannerUrl: string;
  bannerImages?: string[]; // Multiple banner images for carousel
}

export type FilterState = {
  category: string;
  minPrice: number;
  maxPrice: number;
  searchQuery: string;
  minRating: number;
};