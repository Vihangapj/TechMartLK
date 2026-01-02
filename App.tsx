import React, { createContext, useContext, useEffect, useState, useMemo, useRef } from 'react';
import { HashRouter, Routes, Route, Navigate, Link, useNavigate, useParams, useLocation } from 'react-router-dom';
import { ShoppingCart, User as UserIcon, LogOut, Package, Home as HomeIcon, Search, Menu, X, ChevronRight, Plus, Minus, Trash2, Heart, Instagram, Facebook, Twitter, Smartphone, Mail, MapPin, Send, MessageCircle, Settings, Camera, Upload, LayoutDashboard, SlidersHorizontal, CreditCard, Banknote, Star, CheckCircle, Clock, UserCog, Printer, FileText, QrCode, Grid, Layers, Bell, ImageIcon, History, Edit, Filter, ArrowLeft, Truck, PlayCircle, AlertCircle, DollarSign, ShoppingBag, TrendingUp } from 'lucide-react';
import { Product, CartItem, User, Order, FilterState, Address, ChatMessage, ShopSettings, Category, Popup, OrderStatusUpdate } from './types';
import { db } from './services/mockFirebase';
import jsQR from 'jsqr';

// --- UTILS ---
const formatLKR = (amount: number) => {
  return new Intl.NumberFormat('en-LK', {
    style: 'currency',
    currency: 'LKR',
    maximumFractionDigits: 0
  }).format(amount);
};

// --- CONTEXT ---

interface AuthContextType {
  user: User | null;
  login: (email: string, password?: string) => Promise<void>;
  register: (name: string, email: string, phone: string, password?: string) => Promise<void>;
  logout: () => void;
  toggleWishlist: (productId: string) => void;
  addAddress: (address: Omit<Address, 'id'>) => Promise<void>;
  removeAddress: (id: string) => Promise<void>;
}

interface ShopContextType {
  cart: CartItem[];
  addToCart: (product: Product) => void;
  removeFromCart: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  cartTotal: number;
  isCartOpen: boolean;
  setIsCartOpen: (open: boolean) => void;
  products: Product[];
  refreshProducts: () => void;
  settings: ShopSettings;
  updateShopSettings: (settings: ShopSettings) => Promise<void>;
  categories: Category[];
  refreshCategories: () => void;
  popups: Popup[];
  refreshPopups: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const ShopContext = createContext<ShopContextType | undefined>(undefined);

// --- PROVIDERS ---

const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(db.getCurrentUser());

  const login = async (email: string, password?: string) => {
    const userData = await db.login(email, password);
    setUser(userData);
  };

  const register = async (name: string, email: string, phone: string, password?: string) => {
    const userData = await db.register(name, email, phone, password);
    setUser(userData);
  };

  const logout = () => {
    db.logout();
    setUser(null);
  };

  const toggleWishlist = (productId: string) => {
    if (!user) return;
    const isLiked = user.wishlist.includes(productId);
    const newWishlist = isLiked
      ? user.wishlist.filter(id => id !== productId)
      : [...user.wishlist, productId];

    const updatedUser = { ...user, wishlist: newWishlist };
    setUser(updatedUser);
    localStorage.setItem('techstore_user', JSON.stringify(updatedUser));
  };

  const addAddress = async (address: Omit<Address, 'id'>) => {
    if (!user) return;
    const updatedUser = await db.saveAddress(user, address);
    setUser(updatedUser);
  };

  const removeAddress = async (id: string) => {
    if (!user) return;
    const updatedUser = await db.deleteAddress(user, id);
    setUser(updatedUser);
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, toggleWishlist, addAddress, removeAddress }}>
      {children}
    </AuthContext.Provider>
  );
};

const ShopProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [popups, setPopups] = useState<Popup[]>([]);

  const [settings, setSettings] = useState<ShopSettings>({
    shopName: 'TechMart LK',
    address: 'Loading...',
    phone: '',
    whatsapp: '',
    homeBannerUrl: ''
  });

  const refreshProducts = () => db.getProducts().then(setProducts);
  const refreshCategories = () => db.getCategories().then(setCategories);
  const refreshPopups = () => db.getPopups().then(setPopups);

  useEffect(() => {
    refreshProducts();
    refreshCategories();
    refreshPopups();
    db.getSettings().then(setSettings);
  }, []);

  const addToCart = (product: Product) => {
    const user = db.getCurrentUser();
    if (user && user.role === 'admin') {
      alert("Admins cannot create orders.");
      return;
    }

    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { ...product, quantity: 1 }];
    });
    setIsCartOpen(true);
  };

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const updateQuantity = (id: string, qty: number) => {
    if (qty < 1) return removeFromCart(id);
    setCart(prev => prev.map(item => item.id === id ? { ...item, quantity: qty } : item));
  };

  const clearCart = () => setCart([]);

  const updateShopSettings = async (newSettings: ShopSettings) => {
    const updated = await db.updateSettings(newSettings);
    setSettings(updated);
  };

  const cartTotal = useMemo(() => cart.reduce((sum, item) => {
    const price = item.offerPrice || item.price;
    return sum + (price * item.quantity);
  }, 0), [cart]);

  return (
    <ShopContext.Provider value={{
      cart, addToCart, removeFromCart, updateQuantity, clearCart, cartTotal, isCartOpen, setIsCartOpen,
      products, refreshProducts,
      settings, updateShopSettings,
      categories, refreshCategories,
      popups, refreshPopups
    }}>
      {children}
    </ShopContext.Provider>
  );
};

const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};

const useShop = () => {
  const context = useContext(ShopContext);
  if (!context) throw new Error("useShop must be used within ShopProvider");
  return context;
};

// --- CHAT COMPONENT ---
const ChatWidget: React.FC = () => {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && user) {
      const interval = setInterval(() => {
        db.getMessages(user.id).then(setMessages);
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [isOpen, user]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || !user) return;
    await db.sendMessage(user.id, input, 'user');
    setInput('');
    db.getMessages(user.id).then(setMessages);
  };

  useEffect(() => {
    const toggleHandler = () => setIsOpen(prev => !prev);
    document.addEventListener('toggle-support-chat', toggleHandler);
    return () => document.removeEventListener('toggle-support-chat', toggleHandler);
  }, []);

  if (!user || user.role === 'admin') return null;

  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-50 p-4 bg-indigo-600 text-white rounded-full shadow-lg hover:bg-indigo-700 transition-all hover:scale-105 hidden md:block" // Hidden on mobile
      >
        <MessageCircle className="w-6 h-6" />
      </button>

      {isOpen && (
        <div className="fixed bottom-24 right-6 z-50 w-80 md:w-96 bg-white rounded-2xl shadow-2xl border border-gray-100 flex flex-col overflow-hidden h-[500px] animate-slideUp">
          <div className="bg-indigo-600 p-4 text-white flex justify-between items-center">
            <div className="font-bold flex items-center gap-2"><UserCog className="w-5 h-5" /> Tech Support</div>
            <button onClick={() => setIsOpen(false)}><X className="w-5 h-5" /></button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
            {messages.length === 0 && <p className="text-center text-gray-500 text-sm mt-10">Start a conversation with our support team.</p>}
            {messages.map((m) => (
              <div key={m.id} className={`flex ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] p-3 rounded-2xl text-sm ${m.sender === 'user' ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-white border text-gray-800 rounded-bl-none'}`}>
                  {m.text}
                </div>
              </div>
            ))}
            <div ref={endRef} />
          </div>
          <div className="p-3 bg-white border-t flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Type a message..."
              className="flex-1 px-4 py-2 bg-gray-100 rounded-full focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
            />
            <button onClick={handleSend} className="p-2 bg-indigo-600 text-white rounded-full"><Send className="w-5 h-5" /></button>
          </div>
        </div>
      )}
    </>
  );
};

// --- COMPONENTS ---

const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const { cart, setIsCartOpen, settings } = useShop();
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <nav className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-gray-100 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <Link to="/" className="text-2xl font-bold text-gray-900 tracking-tighter">
            {settings.shopName.split(' ')[0]}<span className="text-indigo-600">{settings.shopName.split(' ')[1] || 'Mart'}</span>
            <span className="text-xs text-gray-500 font-normal ml-1">LK</span>
          </Link>

          <div className="flex items-center space-x-2 sm:space-x-6">
            <Link to="/" className="hidden md:flex p-2 text-gray-600 hover:text-indigo-600 transition-colors items-center gap-1">
              <HomeIcon className="w-5 h-5" />
              <span className="text-sm font-medium">Home</span>
            </Link>

            <Link to="/profile" className="p-2 text-gray-600 hover:text-indigo-600 transition-colors relative group flex items-center gap-2">
              <UserIcon className="w-6 h-6" />
              {user && <span className="hidden md:inline text-sm font-medium">{user.name}</span>}
              {user && <span className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full"></span>}
            </Link>

            {/* Hide Cart for Admin */}
            {user?.role !== 'admin' && (
              <button onClick={() => setIsCartOpen(true)} className="p-2 text-gray-600 hover:text-indigo-600 transition-colors relative">
                <ShoppingCart className="w-6 h-6" />
                {cartCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-indigo-600 text-white text-xs w-5 h-5 flex items-center justify-center rounded-full font-bold animate-pulse">
                    {cartCount}
                  </span>
                )}
              </button>
            )}

            {user ? (
              <div className="flex items-center gap-2">
                {user.role === 'admin' && (
                  <Link to="/admin" className="hidden md:inline-flex px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-semibold hover:bg-gray-200">
                    Dashboard
                  </Link>
                )}
                <button onClick={logout} className="p-2 text-gray-400 hover:text-red-500 transition-colors" title="Logout">
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <Link to="/login" className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-all shadow-sm">
                Login
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

const ProductCard: React.FC<{ product: Product; viewMode?: 'grid' | 'list' }> = ({ product, viewMode = 'grid' }) => {
  const { addToCart } = useShop();
  const { user, toggleWishlist } = useAuth();
  const isWishlisted = user?.wishlist.includes(product.id);
  const navigate = useNavigate();

  // Calculate discount
  const discount = product.offerPrice ? Math.round(((product.price - product.offerPrice) / product.price) * 100) : 0;

  if (viewMode === 'list') {
    return (
      <div className="group bg-white rounded-2xl p-4 shadow-sm border border-gray-100 hover:shadow-xl transition-all duration-300 relative flex gap-6 hover:border-indigo-100">
        <div
          onClick={() => navigate(`/product/${product.id}`)}
          className="relative w-48 h-48 flex-shrink-0 rounded-xl overflow-hidden bg-gray-100 cursor-pointer"
        >
          {product.offerPrice && (
            <div className="absolute top-3 left-3 bg-red-600 text-white text-xs font-bold px-2 py-1 rounded shadow z-10 flex flex-col items-center">
              <span>{discount}%</span>
              <span>OFF</span>
            </div>
          )}
          <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        </div>

        <div className="flex-1 flex flex-col py-2">
          <div className="flex justify-between items-start">
            <div>
              <div className="text-xs text-indigo-600 font-semibold uppercase tracking-wider mb-1">{product.category}</div>
              <h3 onClick={() => navigate(`/product/${product.id}`)} className="text-xl font-bold text-gray-900 cursor-pointer hover:text-indigo-600 mb-2">{product.name}</h3>
              <div className="flex items-center mb-4">
                <div className="flex text-yellow-400 gap-0.5">
                  {[...Array(5)].map((_, i) => (<Star key={i} className={`w-4 h-4 ${i < Math.floor(product.rating) ? 'fill-current' : 'text-gray-200'}`} />))}
                </div>
                <span className="text-xs text-gray-500 ml-2">({product.reviews.length} reviews)</span>
              </div>
            </div>
            <button onClick={(e) => { e.stopPropagation(); toggleWishlist(product.id); }} className={`p-2 rounded-full transition-colors ${isWishlisted ? 'bg-pink-50 text-pink-500' : 'text-gray-400 hover:bg-gray-50'}`}>
              <Heart className={`w-6 h-6 ${isWishlisted ? 'fill-current' : ''}`} />
            </button>
          </div>

          <p className="text-gray-500 text-sm line-clamp-2 mb-4">{product.description}</p>

          <div className="mt-auto flex items-center justify-between">
            <div className="flex items-baseline gap-2">
              {product.offerPrice ? (
                <>
                  <span className="text-2xl font-bold text-red-600">{formatLKR(product.offerPrice)}</span>
                  <span className="text-sm text-gray-400 line-through">{formatLKR(product.price)}</span>
                </>
              ) : (
                <span className="text-2xl font-bold text-gray-900">{formatLKR(product.price)}</span>
              )}
            </div>

            {user?.role !== 'admin' && (
              <button onClick={() => addToCart(product)} className="px-6 py-3 bg-gray-900 text-white rounded-xl font-bold hover:bg-indigo-600 transition-all flex items-center gap-2">
                <ShoppingCart className="w-5 h-5" /> Add to Cart
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // GRID VIEW (Default)
  return (
    <div className="group bg-white rounded-2xl p-4 shadow-sm border border-gray-100 hover:shadow-xl transition-all duration-300 relative flex flex-col h-full hover:border-indigo-100">
      <div
        onClick={() => navigate(`/product/${product.id}`)}
        className="relative aspect-[4/3] overflow-hidden rounded-xl bg-gray-100 mb-4 cursor-pointer"
      >
        {product.offerPrice && (
          <div className="absolute top-3 left-3 bg-red-600 text-white text-xs font-bold px-2 py-1 rounded shadow z-10">
            {discount}% OFF
          </div>
        )}
        <img
          src={product.imageUrl}
          alt={product.name}
          className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
        />
        <button
          onClick={(e) => { e.stopPropagation(); toggleWishlist(product.id); }}
          className={`absolute top-3 right-3 p-2 rounded-full backdrop-blur-sm transition-colors ${isWishlisted ? 'bg-pink-50 text-pink-500' : 'bg-white/70 text-gray-600 hover:bg-white hover:text-pink-500'}`}
        >
          <Heart className={`w-5 h-5 ${isWishlisted ? 'fill-current' : ''}`} />
        </button>
      </div>

      <div className="flex-1 flex flex-col">
        <div className="text-xs text-indigo-600 font-semibold uppercase tracking-wider mb-1">{product.category}</div>
        <h3
          onClick={() => navigate(`/product/${product.id}`)}
          className="text-gray-900 font-bold text-lg leading-tight mb-2 line-clamp-2 cursor-pointer hover:text-indigo-600"
        >
          {product.name}
        </h3>

        <div className="flex items-center mb-4">
          <div className="flex text-yellow-400">
            {[...Array(5)].map((_, i) => (
              <Star key={i} className={`w-4 h-4 ${i < Math.floor(product.rating) ? 'fill-current' : 'text-gray-200'}`} />
            ))}
          </div>
          <span className="text-xs text-gray-500 ml-2">({product.reviews.length})</span>
        </div>

        <div className="mt-auto flex items-center justify-between">
          <div className="flex flex-col">
            {product.offerPrice ? (
              <>
                <span className="text-xs text-gray-400 line-through">{formatLKR(product.price)}</span>
                <span className="text-xl font-bold text-red-600">{formatLKR(product.offerPrice)}</span>
              </>
            ) : (
              <span className="text-xl font-bold text-gray-900">{formatLKR(product.price)}</span>
            )}
          </div>
          {/* Hide Add to Cart for Admin */}
          {user?.role !== 'admin' && (
            <button
              onClick={() => addToCart(product)}
              className="p-3 bg-gray-900 text-white rounded-xl hover:bg-indigo-600 active:scale-95 transition-all shadow-lg shadow-gray-200"
            >
              <ShoppingCart className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

const CartSidebar: React.FC = () => {
  const { cart, removeFromCart, updateQuantity, cartTotal, isCartOpen, setIsCartOpen } = useShop();
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleCheckoutClick = () => {
    if (user?.role === 'admin') {
      alert("Admin accounts cannot checkout.");
      return;
    }
    setIsCartOpen(false);
    navigate('/checkout');
  };

  if (!isCartOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] overflow-hidden">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setIsCartOpen(false)} />
      <div className="absolute inset-y-0 right-0 max-w-full flex">
        <div className="w-screen max-w-md bg-white shadow-2xl flex flex-col h-full animate-slideInRight">
          <div className="flex items-center justify-between p-6 border-b">
            <h2 className="text-xl font-bold text-gray-900">Shopping Cart</h2>
            <button onClick={() => setIsCartOpen(false)} className="p-2 text-gray-500 hover:text-gray-900">
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {cart.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <ShoppingCart className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <p>Your cart is empty.</p>
                <button onClick={() => setIsCartOpen(false)} className="mt-4 text-indigo-600 font-medium hover:underline">Start Shopping</button>
              </div>
            ) : (
              <div className="space-y-6">
                {cart.map(item => (
                  <div key={item.id} className="flex gap-4">
                    <div className="w-20 h-20 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0">
                      <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 flex flex-col justify-between">
                      <div>
                        <h3 className="font-medium text-gray-900 line-clamp-1">{item.name}</h3>
                        <p className="text-sm text-gray-500">
                          {item.offerPrice ? formatLKR(item.offerPrice) : formatLKR(item.price)}
                        </p>
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center border rounded-lg">
                          <button onClick={() => updateQuantity(item.id, item.quantity - 1)} className="px-2 py-1 text-gray-600 hover:bg-gray-50">-</button>
                          <span className="px-2 text-sm font-medium">{item.quantity}</span>
                          <button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="px-2 py-1 text-gray-600 hover:bg-gray-50">+</button>
                        </div>
                        <button onClick={() => removeFromCart(item.id)} className="text-red-400 hover:text-red-600 text-sm">Remove</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {cart.length > 0 && (
            <div className="p-6 border-t bg-gray-50">
              <div className="flex justify-between mb-4">
                <span className="text-gray-600">Subtotal</span>
                <span className="text-xl font-bold text-gray-900">{formatLKR(cartTotal)}</span>
              </div>
              <button
                onClick={handleCheckoutClick}
                className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 active:scale-[0.98] transition-all flex justify-center items-center"
              >
                Checkout Now
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const AdminDashboard: React.FC = () => {
  const { user } = useAuth();
  const { settings, updateShopSettings, categories, refreshCategories, popups, refreshPopups } = useShop();
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [activeTab, setActiveTab] = useState<'analytics' | 'products' | 'categories' | 'orders' | 'support' | 'settings' | 'popups'>('analytics');
  const [isEditing, setIsEditing] = useState<string | null>(null);

  // Product Form
  const [formData, setFormData] = useState<Partial<Product>>({});
  const [imageInputs, setImageInputs] = useState<string[]>(['']);

  // Categories
  const [catName, setCatName] = useState('');
  const [catImg, setCatImg] = useState('');

  // Popups
  const [popupMsg, setPopupMsg] = useState('');

  // Settings Form
  const [settingsForm, setSettingsForm] = useState<ShopSettings>(settings);

  // Orders
  const [editingOrder, setEditingOrder] = useState<string | null>(null);
  const [statusComment, setStatusComment] = useState('');

  // Scanner
  const [orderSearchQuery, setOrderSearchQuery] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isScanning, setIsScanning] = useState(false);

  // Chat
  const [chats, setChats] = useState<{ userId: string, lastMessage: ChatMessage }[]>([]);
  const [activeChatUser, setActiveChatUser] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [adminReply, setAdminReply] = useState('');

  useEffect(() => {
    if (!user || user.role !== 'admin') {
      navigate('/');
      return;
    }
    fetchData();
  }, [user, navigate]);

  useEffect(() => {
    setSettingsForm(settings);
  }, [settings]);

  // Poll chats
  // Subscribe to chats
  useEffect(() => {
    if (activeTab === 'support') {
      const unsub = db.subscribeToAllChats(setChats);
      return () => unsub();
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'support' && activeChatUser) {
      const unsub = db.subscribeToChat(activeChatUser, setChatMessages);
      return () => unsub();
    }
  }, [activeTab, activeChatUser]);

  useEffect(() => {
    if (activeTab === 'support' && activeChatUser && chatMessages.length > 0) {
      chatMessages.forEach(m => {
        if (m.sender === 'user' && !m.read) {
          db.markAsRead(m.id);
        }
      });
    }
  }, [chatMessages, activeTab, activeChatUser]);


  // Analytics Logic
  const analyticsData = useMemo(() => {
    const totalSales = orders.reduce((sum, o) => sum + o.totalAmount, 0);
    const totalOrders = orders.length;
    const avgOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0;

    // Top Products
    const productSales: { [key: string]: { name: string, qty: number, revenue: number } } = {};
    orders.forEach(o => {
      o.items.forEach((item: any) => {
        if (!productSales[item.id]) {
          productSales[item.id] = { name: item.name, qty: 0, revenue: 0 };
        }
        productSales[item.id].qty += item.quantity;
        productSales[item.id].revenue += (item.offerPrice || item.price) * item.quantity;
      });
    });
    const topProducts = Object.values(productSales).sort((a, b) => b.qty - a.qty).slice(0, 5);

    return { totalSales, totalOrders, avgOrderValue, topProducts };
  }, [orders]);

  const fetchData = async () => {
    const [p, o] = await Promise.all([db.getProducts(), db.getOrders()]);
    setProducts(p);
    setOrders(o);
  };

  const handleUpdateStatus = async (orderId: string, status: Order['status']) => {
    await db.updateOrderStatus(orderId, status, statusComment);
    setEditingOrder(null);
    setStatusComment('');
    fetchData();
  };

  // --- Settings Logic ---
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateShopSettings(settingsForm);
    alert('Settings saved successfully!');
  };

  // --- Scanner Logic ---
  const startScanner = async () => {
    setIsScanning(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        requestAnimationFrame(tick);
      }
    } catch (err) {
      console.error(err);
      alert("Camera access failed");
      setIsScanning(false);
    }
  };

  const stopScanner = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
    }
    setIsScanning(false);
  };

  const tick = () => {
    if (!videoRef.current || !canvasRef.current || !isScanning) return;
    if (videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      canvas.height = video.videoHeight;
      canvas.width = video.videoWidth;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: "dontInvert" });
        if (code) {
          console.log("Found QR code", code.data);
          setOrderSearchQuery(code.data);
          stopScanner();
          // Optional: Beep or visual feedback
          setActiveTab('orders');
          return;
        }
      }
    }
    if (isScanning) requestAnimationFrame(tick);
  };

  // --- Product Form Logic ---
  const handleAddImageField = () => setImageInputs([...imageInputs, '']);
  const handleRemoveImageField = (idx: number) => setImageInputs(imageInputs.filter((_, i) => i !== idx));
  const handleImageChange = (idx: number, val: string) => {
    const newImages = [...imageInputs];
    newImages[idx] = val;
    setImageInputs(newImages);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    const validImages = imageInputs.filter(img => img.trim() !== '');
    const productData = {
      ...formData,
      images: validImages,
      imageUrl: validImages[0] || ''
    };

    if (isEditing === 'new') {
      await db.addProduct(productData as Product);
    } else if (isEditing) {
      await db.updateProduct(isEditing, productData);
    }
    setIsEditing(null);
    setFormData({});
    setImageInputs(['']);
    fetchData();
  };

  const handleDeleteProduct = async (id: string) => {
    if (confirm('Delete this product?')) {
      await db.deleteProduct(id);
      fetchData();
    }
  };

  // --- Support Logic ---
  const handleSendAdminReply = async () => {
    if (!activeChatUser || !adminReply.trim()) return;
    await db.sendMessage(activeChatUser, adminReply, 'admin');
    setAdminReply('');
    db.getMessages(activeChatUser).then(setChatMessages);
  };

  // --- Receipt Logic ---
  const handlePrintReceipt = (order: Order) => {
    const receiptWindow = window.open('', '', 'width=800,height=600');
    if (!receiptWindow) return;

    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${order.id}`;

    const receiptHtml = `
      <html>
        <head>
          <title>Receipt #${order.id}</title>
          <style>
            body { font-family: 'Courier New', monospace; padding: 40px; max-width: 400px; margin: 0 auto; }
            .header { text-align: center; border-bottom: 2px dashed #000; padding-bottom: 20px; margin-bottom: 20px; }
            .logo { font-size: 24px; font-weight: bold; margin-bottom: 5px;}
            .info-row { display: flex; justify-content: space-between; margin-bottom: 5px; font-size: 14px; }
            .table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 14px; }
            .table th { text-align: left; border-bottom: 1px solid #000; padding: 5px 0; }
            .table td { padding: 5px 0; }
            .total { text-align: right; font-size: 18px; font-weight: bold; margin-top: 20px; border-top: 1px solid #000; padding-top: 10px; }
            .barcode-container { margin-top: 30px; text-align: center; }
            .qr-code { width: 120px; height: 120px; }
            .footer { margin-top: 20px; text-align: center; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="logo">${settings.shopName}</div>
            <div>${settings.address}</div>
            <div>Hotline: ${settings.phone}</div>
          </div>
          
          <div class="info-row"><span>Order ID:</span> <strong>#${order.id}</strong></div>
          <div class="info-row"><span>Date:</span> ${new Date(order.createdAt).toLocaleString()}</div>
          <div style="border-bottom: 2px solid #eee; margin: 10px 0;"></div>
          <div class="info-row"><span>Customer:</span> ${order.shippingDetails?.name || order.userId}</div>
          <div class="info-row"><span>Phone:</span> ${order.customerPhone || order.shippingDetails?.phone || 'N/A'}</div>
          <div class="info-row"><span>Email:</span> ${order.customerEmail || 'N/A'}</div>
          <div class="info-row"><span>Address:</span> ${order.shippingDetails?.address || ''}, ${order.shippingDetails?.city || ''}</div>
          
          <table class="table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Qty</th>
                <th style="text-align:right">Price</th>
              </tr>
            </thead>
            <tbody>
              ${order.items.map(item => `
                <tr>
                  <td>${item.name}</td>
                  <td>${item.quantity}</td>
                  <td style="text-align:right">${formatLKR((item.offerPrice || item.price) * item.quantity)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          
          <div class="total">
            Total: ${formatLKR(order.totalAmount)}
          </div>
          
          <div class="barcode-container">
             <img src="${qrUrl}" class="qr-code" />
             <div style="font-size: 12px; margin-top: 5px;">${order.id}</div>
          </div>
          
          <div class="footer">
            THANK YOU FOR SHOPPING!<br/>
            © 2025 ${settings.shopName}
          </div>

          <script>
            window.onload = function() { window.print(); }
          </script>
        </body>
      </html>
    `;
    receiptWindow.document.write(receiptHtml);
    receiptWindow.document.close();
  };

  // --- Category Logic ---
  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    await db.addCategory({ name: catName, imageUrl: catImg });
    setCatName(''); setCatImg('');
    refreshCategories();
  };
  const handleDeleteCategory = async (id: string) => {
    await db.deleteCategory(id);
    refreshCategories();
  };

  // --- Popup Logic ---
  const handleAddPopup = async (e: React.FormEvent) => {
    e.preventDefault();
    await db.addPopup({ message: popupMsg, type: 'info', isActive: true });
    setPopupMsg('');
    refreshPopups();
  };
  const handleTogglePopup = async (id: string) => {
    await db.togglePopup(id);
    refreshPopups();
  };
  const handleDeletePopup = async (id: string) => {
    await db.deletePopup(id);
    refreshPopups();
  };


  return (
    <div className="max-w-7xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold mb-8">Admin Dashboard</h1>
      <div className="flex gap-2 mb-8 overflow-x-auto pb-2 custom-scrollbar">
        {['analytics', 'products', 'categories', 'orders', 'support', 'settings', 'popups'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab as any)} className={`px-4 py-2 rounded-lg font-bold whitespace-nowrap capitalize transition-all ${activeTab === tab ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-100'}`}>{tab}</button>
        ))}
      </div>

      {/* --- ANALYTICS TAB --- */}
      {activeTab === 'analytics' && (
        <div className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-indigo-100">
              <div className="flex items-center gap-4 mb-2">
                <div className="p-3 bg-green-100 text-green-600 rounded-xl"><DollarSign className="w-6 h-6" /></div>
                <div className="text-sm font-bold text-gray-500 uppercase tracking-wider">Total Sales</div>
              </div>
              <div className="text-3xl font-bold text-gray-900">{formatLKR(analyticsData.totalSales)}</div>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-indigo-100">
              <div className="flex items-center gap-4 mb-2">
                <div className="p-3 bg-blue-100 text-blue-600 rounded-xl"><ShoppingBag className="w-6 h-6" /></div>
                <div className="text-sm font-bold text-gray-500 uppercase tracking-wider">Total Orders</div>
              </div>
              <div className="text-3xl font-bold text-gray-900">{analyticsData.totalOrders}</div>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-indigo-100">
              <div className="flex items-center gap-4 mb-2">
                <div className="p-3 bg-purple-100 text-purple-600 rounded-xl"><TrendingUp className="w-6 h-6" /></div>
                <div className="text-sm font-bold text-gray-500 uppercase tracking-wider">Avg. Order Value</div>
              </div>
              <div className="text-3xl font-bold text-gray-900">{formatLKR(analyticsData.avgOrderValue)}</div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-6">Top Selling Products</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-gray-100 text-xs font-bold text-gray-500 uppercase tracking-wider">
                    <th className="pb-3 pl-4">Product Name</th>
                    <th className="pb-3">Units Sold</th>
                    <th className="pb-3 text-right pr-4">Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {analyticsData.topProducts.map((p, i) => (
                    <tr key={i} className="hover:bg-gray-50 transition-colors">
                      <td className="py-3 pl-4 font-medium text-gray-900">{p.name}</td>
                      <td className="py-3">{p.qty}</td>
                      <td className="py-3 text-right pr-4 font-bold text-gray-900">{formatLKR(p.revenue)}</td>
                    </tr>
                  ))}
                  {analyticsData.topProducts.length === 0 && (
                    <tr><td colSpan={3} className="py-8 text-center text-gray-500 italic">No sales data available yet</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* --- PRODUCTS TAB --- */}
      {activeTab === 'products' && (
        <div>
          {isEditing ? (
            <div className="bg-white p-6 rounded-xl shadow border">
              <h2 className="text-xl font-bold mb-4">{isEditing === 'new' ? 'New Product' : 'Edit Product'}</h2>
              <form onSubmit={handleSaveProduct} className="space-y-4">
                <input required placeholder="Name" className="w-full p-2 border rounded" value={formData.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                <textarea placeholder="Short Description (Summary)" rows={2} className="w-full p-2 border rounded" value={formData.shortDescription || ''} onChange={e => setFormData({ ...formData, shortDescription: e.target.value })} />
                <textarea required placeholder="Long Description (Detailed)" rows={6} className="w-full p-2 border rounded" value={formData.description || ''} onChange={e => setFormData({ ...formData, description: e.target.value })} />

                <div className="grid grid-cols-3 gap-4">
                  <input required type="number" placeholder="Price" className="w-full p-2 border rounded" value={formData.price || ''} onChange={e => setFormData({ ...formData, price: parseFloat(e.target.value) })} />
                  <input type="number" placeholder="Offer Price (Optional)" className="w-full p-2 border rounded" value={formData.offerPrice || ''} onChange={e => setFormData({ ...formData, offerPrice: parseFloat(e.target.value) })} />
                  <input required type="number" placeholder="Stock" className="w-full p-2 border rounded" value={formData.stock || ''} onChange={e => setFormData({ ...formData, stock: parseInt(e.target.value) })} />
                </div>
                <div className="pt-2">
                  <input type="number" placeholder="Delivery Fee (Optional)" className="w-full p-2 border rounded" value={formData.deliveryFee || ''} onChange={e => setFormData({ ...formData, deliveryFee: parseFloat(e.target.value) })} />
                </div>
                <select className="w-full p-2 border rounded" value={formData.category || ''} onChange={e => setFormData({ ...formData, category: e.target.value })}>
                  <option value="">Select Category</option>
                  {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>

                {/* Multi Image Input */}
                <div className="space-y-2">
                  <label className="font-medium">Product Images</label>
                  {imageInputs.map((img, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <input
                        placeholder="Image URL"
                        className="flex-1 p-2 border rounded"
                        value={img}
                        onChange={e => handleImageChange(idx, e.target.value)}
                      />
                      {img && <img src={img} alt="preview" className="w-10 h-10 object-cover rounded border" />}
                      <button type="button" onClick={() => handleRemoveImageField(idx)} className="text-red-500"><X className="w-5 h-5" /></button>
                    </div>
                  ))}
                  <button type="button" onClick={handleAddImageField} className="text-sm text-indigo-600 flex items-center gap-1"><Plus className="w-4 h-4" /> Add Image URL</button>
                </div>

                <input placeholder="Video URL (YouTube)" className="w-full p-2 border rounded" value={formData.videoUrl || ''} onChange={e => setFormData({ ...formData, videoUrl: e.target.value })} />

                <div className="flex gap-2 pt-4">
                  <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded">Save Product</button>
                  <button type="button" onClick={() => setIsEditing(null)} className="bg-gray-300 px-4 py-2 rounded">Cancel</button>
                </div>
              </form>
            </div>
          ) : (
            <>
              <button onClick={() => { setIsEditing('new'); setFormData({}); setImageInputs(['']); }} className="bg-green-600 text-white px-4 py-2 rounded mb-4 flex items-center gap-2"><Plus className="w-4 h-4" /> Add Product</button>
              <div className="space-y-2">
                {products.map(p => (
                  <div key={p.id} className="flex justify-between items-center bg-white p-4 rounded shadow-sm border">
                    <div className="flex items-center gap-4">
                      <img src={p.imageUrl} className="w-12 h-12 object-cover rounded" />
                      <div>
                        <div className="font-bold">{p.name}</div>
                        <div className="text-sm text-gray-500">
                          {p.offerPrice ? <><span className="line-through text-gray-400">{formatLKR(p.price)}</span> <span className="text-red-600 font-bold">{formatLKR(p.offerPrice)}</span></> : formatLKR(p.price)}
                          {' | '}Stock: {p.stock}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => { setIsEditing(p.id); setFormData(p); setImageInputs(p.images); }} className="text-blue-600"><Edit className="w-5 h-5" /></button>
                      <button onClick={() => handleDeleteProduct(p.id)} className="text-red-600"><Trash2 className="w-5 h-5" /></button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* --- ORDERS TAB --- */}
      {activeTab === 'orders' && (
        <div className="space-y-6">
          <div className="bg-white p-4 rounded-lg shadow-sm border border-indigo-100">
            <div className="flex items-center gap-4 mb-4">
              <QrCode className="w-8 h-8 text-indigo-600" />
              <div className="flex-1">
                <label className="block text-xs font-bold text-indigo-600 uppercase mb-1">Scanner / Search</label>
                <input
                  type="text"
                  placeholder="Scan QR or Type Order ID..."
                  className="w-full text-lg p-2 border-b-2 border-indigo-200 focus:border-indigo-600 outline-none bg-transparent"
                  value={orderSearchQuery}
                  onChange={e => setOrderSearchQuery(e.target.value)}
                />
              </div>
              <button onClick={isScanning ? stopScanner : startScanner} className={`p-2 rounded-full text-white ${isScanning ? 'bg-red-500' : 'bg-indigo-600'}`}>
                <Camera className="w-6 h-6" />
              </button>
            </div>
            {isScanning && (
              <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden mb-4">
                <video ref={videoRef} className="w-full h-full object-cover" muted></video>
                <canvas ref={canvasRef} className="hidden"></canvas>
                <div className="absolute inset-0 border-2 border-red-500 opacity-50 m-10"></div>
              </div>
            )}
          </div>

          <div className="space-y-4">
            {orders.filter(o => o.id.toLowerCase().includes(orderSearchQuery.toLowerCase())).map(o => (
              <div key={o.id} className="bg-white p-4 rounded shadow border">
                <div className="flex justify-between font-bold mb-2">
                  <span>#{o.id}</span>
                  <div className="flex gap-2">
                    <button onClick={() => handlePrintReceipt(o)} className="text-xs bg-gray-100 px-2 py-1 rounded flex items-center gap-1 hover:bg-gray-200"><Printer className="w-3 h-3" /> Receipt</button>
                    <span className={`px-2 py-1 rounded text-sm ${o.status === 'Cancelled' ? 'bg-red-100 text-red-800' : 'bg-gray-100'}`}>{o.status}</span>
                  </div>
                </div>
                <div className="text-sm text-gray-600 mb-2">
                  <div>Customer: {o.shippingDetails?.name || o.userId}</div>
                  <div>Total: {formatLKR(o.totalAmount)}</div>
                </div>

                {editingOrder === o.id ? (
                  <div className="bg-gray-50 p-3 rounded mt-2">
                    <h4 className="font-bold text-xs mb-2">Update Status & Tracking</h4>
                    <select id={`status-${o.id}`} className="w-full p-2 border rounded mb-2 text-sm" defaultValue={o.status}>
                      <option value="Pending">Pending</option>
                      <option value="Shipped">Shipped</option>
                      <option value="Delivered">Delivered</option>
                      <option value="Cancelled">Cancelled</option>
                    </select>
                    <textarea
                      placeholder="Add tracking info or comment..."
                      className="w-full p-2 border rounded mb-2 text-sm"
                      value={statusComment}
                      onChange={(e) => setStatusComment(e.target.value)}
                    ></textarea>
                    <div className="flex gap-2">
                      <button onClick={() => {
                        const select = document.getElementById(`status-${o.id}`) as HTMLSelectElement;
                        handleUpdateStatus(o.id, select.value as any);
                      }} className="bg-indigo-600 text-white px-3 py-1 rounded text-xs">Save</button>
                      <button onClick={() => setEditingOrder(null)} className="text-gray-500 text-xs">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setEditingOrder(o.id)} className="text-sm text-indigo-600 underline">Update Status</button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* --- SUPPORT TAB --- */}
      {activeTab === 'support' && (
        <div className="grid grid-cols-3 gap-6 h-[600px] bg-white rounded-xl shadow border overflow-hidden">
          <div className="col-span-1 border-r bg-gray-50 p-4 overflow-y-auto">
            <h3 className="font-bold mb-4">Active Chats</h3>
            {chats.map(chat => (
              <div
                key={chat.userId}
                onClick={() => setActiveChatUser(chat.userId)}
                className={`p-3 rounded-lg mb-2 cursor-pointer hover:bg-white transition-colors ${activeChatUser === chat.userId ? 'bg-white shadow border' : ''}`}
              >
                <div className="font-bold text-sm truncate">{chat.userId}</div>
                <div className="text-xs text-gray-500 truncate">{chat.lastMessage.text}</div>
                <div className="text-[10px] text-gray-400 text-right">{new Date(chat.lastMessage.timestamp).toLocaleTimeString()}</div>
              </div>
            ))}
          </div>
          <div className="col-span-2 p-4 flex flex-col">
            {activeChatUser ? (
              <>
                <div className="border-b pb-2 mb-4 font-bold flex justify-between items-center">
                  <span>Chat with {activeChatUser}</span>
                  <button onClick={() => activeChatUser && db.getMessages(activeChatUser).then(setChatMessages)} className="p-1 hover:bg-gray-100 rounded-full" title="Refresh">
                    <History className="w-4 h-4 text-gray-500" />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto space-y-3 mb-4">
                  {chatMessages.map(m => (
                    <div key={m.id} className={`flex ${m.sender === 'admin' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[70%] p-3 rounded-lg text-sm ${m.sender === 'admin' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-800'}`}>
                        {m.text}
                        <div className={`text-[10px] mt-1 flex justify-end gap-1 ${m.sender === 'admin' ? 'text-indigo-200' : 'text-gray-400'}`}>
                          {new Date(m.timestamp).toLocaleTimeString()}
                          {m.sender === 'admin' && (
                            m.read ? <span title={`Read at ${new Date(m.readAt || 0).toLocaleString()}`}><CheckCircle className="w-3 h-3" /></span> : <CheckCircle className="w-3 h-3 opacity-50" />
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    value={adminReply}
                    onChange={(e) => setAdminReply(e.target.value)}
                    className="flex-1 p-2 border rounded-lg"
                    placeholder="Type reply..."
                    onKeyDown={(e) => e.key === 'Enter' && handleSendAdminReply()}
                  />
                  <button onClick={handleSendAdminReply} className="bg-indigo-600 text-white p-2 rounded-lg"><Send className="w-5 h-5" /></button>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400">Select a chat to view</div>
            )}
          </div>
        </div>
      )}

      {/* --- CATEGORIES, POPUPS, SETTINGS TABS (Already implemented above or unchanged logic) --- */}
      {/* ... keeping simplified for brevity, logic exists in previous blocks ... */}
      {activeTab === 'categories' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-white p-6 rounded-xl shadow border h-fit">
            <h3 className="font-bold mb-4">Add Category</h3>
            <form onSubmit={handleAddCategory} className="space-y-4">
              <input required placeholder="Category Name" className="w-full p-2 border rounded" value={catName} onChange={e => setCatName(e.target.value)} />
              <input required placeholder="Image URL" className="w-full p-2 border rounded" value={catImg} onChange={e => setCatImg(e.target.value)} />
              {catImg && <img src={catImg} className="w-full h-32 object-cover rounded" />}
              <button type="submit" className="w-full bg-indigo-600 text-white py-2 rounded">Add</button>
            </form>
          </div>
          <div className="space-y-4">
            {categories.map(c => (
              <div key={c.id} className="bg-white p-4 rounded shadow border flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <img src={c.imageUrl} className="w-16 h-16 object-cover rounded" />
                  <span className="font-bold">{c.name}</span>
                </div>
                <button onClick={() => handleDeleteCategory(c.id)} className="text-red-500"><Trash2 className="w-5 h-5" /></button>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'popups' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-xl shadow border">
            <h3 className="font-bold mb-4">Create Announcement</h3>
            <form onSubmit={handleAddPopup} className="flex gap-4">
              <input required placeholder="Message text..." className="flex-1 p-2 border rounded" value={popupMsg} onChange={e => setPopupMsg(e.target.value)} />
              <button type="submit" className="bg-indigo-600 text-white px-6 rounded">Push</button>
            </form>
          </div>
          <div className="space-y-2">
            {popups.map(p => (
              <div key={p.id} className="bg-white p-4 rounded shadow border flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <button onClick={() => handleTogglePopup(p.id)} className={`w-10 h-6 rounded-full transition-colors ${p.isActive ? 'bg-green-500' : 'bg-gray-300'}`}>
                    <div className={`w-4 h-4 bg-white rounded-full transition-transform ${p.isActive ? 'translate-x-5' : 'translate-x-1'}`}></div>
                  </button>
                  <span>{p.message}</span>
                </div>
                <button onClick={() => handleDeletePopup(p.id)} className="text-red-500"><Trash2 className="w-5 h-5" /></button>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="bg-white p-6 rounded-xl shadow border max-w-2xl mx-auto">
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2"><Settings className="w-6 h-6" /> Shop Settings</h2>
          <form onSubmit={handleSaveSettings} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Shop Name</label>
              <input required className="w-full p-2 border rounded" value={settingsForm.shopName} onChange={e => setSettingsForm({ ...settingsForm, shopName: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
              <input required className="w-full p-2 border rounded" value={settingsForm.address} onChange={e => setSettingsForm({ ...settingsForm, address: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                <input required className="w-full p-2 border rounded" value={settingsForm.phone} onChange={e => setSettingsForm({ ...settingsForm, phone: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp Number</label>
                <input required className="w-full p-2 border rounded" value={settingsForm.whatsapp} onChange={e => setSettingsForm({ ...settingsForm, whatsapp: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Home Page Banner Image URL (Main / Fallback)</label>
              <input className="w-full p-2 border rounded" placeholder="https://..." value={settingsForm.homeBannerUrl} onChange={e => setSettingsForm({ ...settingsForm, homeBannerUrl: e.target.value })} />
              {settingsForm.homeBannerUrl && <img src={settingsForm.homeBannerUrl} className="mt-2 w-full h-32 object-cover rounded border" alt="Banner Preview" />}
            </div>

            <div className="border-t pt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Banner Carousel Images</label>
              <div className="space-y-2">
                {(settingsForm.bannerImages || []).map((url, idx) => (
                  <div key={idx} className="flex gap-2">
                    <input
                      className="flex-1 p-2 border rounded"
                      placeholder="https://..."
                      value={url}
                      onChange={e => {
                        const newImages = [...(settingsForm.bannerImages || [])];
                        newImages[idx] = e.target.value;
                        setSettingsForm({ ...settingsForm, bannerImages: newImages });
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const newImages = [...(settingsForm.bannerImages || [])];
                        newImages.splice(idx, 1);
                        setSettingsForm({ ...settingsForm, bannerImages: newImages });
                      }}
                      className="text-red-500 hover:bg-red-50 p-2 rounded"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setSettingsForm({ ...settingsForm, bannerImages: [...(settingsForm.bannerImages || []), ''] })}
                className="mt-2 text-sm text-indigo-600 font-bold hover:underline flex items-center gap-1"
              >
                <Plus className="w-4 h-4" /> Add Slide
              </button>
            </div>
            <button type="submit" className="bg-indigo-600 text-white px-6 py-2 rounded font-medium">Save Changes</button>
          </form>
        </div>
      )}
    </div>
  );
};

// UserProfile
const UserProfile: React.FC = () => {
  const { user, logout, addAddress, removeAddress } = useAuth();
  const { products } = useShop();
  const [orders, setOrders] = useState<Order[]>([]);
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'orders' | 'wishlist' | 'addresses' | 'chats'>('orders');

  const [newAddress, setNewAddress] = useState({ label: 'Home', name: '', address: '', city: '', district: 'Colombo', phone: '' });
  const [showAddressForm, setShowAddressForm] = useState(false);

  // Chat State
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    db.getOrders(user.id).then(setOrders);
  }, [user, navigate]);

  useEffect(() => {
    if (activeTab === 'chats' && user) {
      const unsubscribe = db.subscribeToChat(user.id, setChatMessages);
      return () => unsubscribe();
    }
  }, [activeTab, user]);

  useEffect(() => {
    if (activeTab === 'chats' && chatMessages.length > 0) {
      chatMessages.forEach(m => {
        if (m.sender === 'admin' && !m.read) {
          db.markAsRead(m.id);
        }
      });
    }
  }, [chatMessages, activeTab]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  if (!user) return null;

  // Admin View
  if (user.role === 'admin') {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <div className="w-24 h-24 bg-indigo-600 text-white rounded-full flex items-center justify-center text-4xl font-bold mx-auto mb-6">
          {user.name[0].toUpperCase()}
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Administrator</h1>
        <p className="text-gray-500 mb-8">{user.email}</p>

        <div className="grid gap-4 max-w-sm mx-auto">
          <button onClick={() => navigate('/admin')} className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2">
            <LayoutDashboard className="w-5 h-5" /> Go to Dashboard
          </button>
          <button onClick={logout} className="w-full py-3 border border-red-200 text-red-600 rounded-xl font-bold hover:bg-red-50 transition-colors flex items-center justify-center gap-2">
            <LogOut className="w-5 h-5" /> Sign Out
          </button>
        </div>
      </div>
    );
  }

  const handleAddAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    await addAddress(newAddress);
    setShowAddressForm(false);
    setNewAddress({ label: 'Home', name: '', address: '', city: '', district: 'Colombo', phone: '' });
  };

  const handleSendChat = async () => {
    if (!chatInput.trim()) return;
    await db.sendMessage(user.id, chatInput, 'user');
    setChatInput('');
    db.getMessages(user.id).then(setChatMessages);
  };

  const wishlistProducts = products.filter(p => user.wishlist.includes(p.id));

  return (
    <div className="max-w-7xl mx-auto px-4 py-10">
      <div className="flex flex-col lg:flex-row gap-8">
        {/* Sidebar */}
        <div className="w-full lg:w-72 space-y-4">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 text-center">
            <div className="w-24 h-24 bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-full flex items-center justify-center text-4xl font-bold mx-auto mb-4 shadow-lg">
              {user.name[0].toUpperCase()}
            </div>
            <h2 className="font-bold text-xl text-gray-900">{user.name}</h2>
            <p className="text-sm text-gray-500 mb-6">{user.email}</p>
            <button onClick={logout} className="w-full py-2 px-4 rounded-xl border border-red-100 text-red-600 text-sm font-medium hover:bg-red-50 transition-colors flex items-center justify-center gap-2">
              <LogOut className="w-4 h-4" /> Sign Out
            </button>
          </div>

          <nav className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <button onClick={() => setActiveTab('orders')} className={`w-full text-left px-6 py-4 flex items-center gap-3 transition-colors ${activeTab === 'orders' ? 'bg-indigo-50 text-indigo-600 font-bold border-l-4 border-indigo-600' : 'text-gray-600 hover:bg-gray-50'}`}>
              <Package className="w-5 h-5" /> My Orders
            </button>
            <button onClick={() => setActiveTab('chats')} className={`w-full text-left px-6 py-4 flex items-center gap-3 transition-colors ${activeTab === 'chats' ? 'bg-indigo-50 text-indigo-600 font-bold border-l-4 border-indigo-600' : 'text-gray-600 hover:bg-gray-50'}`}>
              <MessageCircle className="w-5 h-5" /> Support Chats
            </button>
            <button onClick={() => setActiveTab('wishlist')} className={`w-full text-left px-6 py-4 flex items-center gap-3 transition-colors ${activeTab === 'wishlist' ? 'bg-indigo-50 text-indigo-600 font-bold border-l-4 border-indigo-600' : 'text-gray-600 hover:bg-gray-50'}`}>
              <Heart className="w-5 h-5" /> Wishlist
            </button>
            <button onClick={() => setActiveTab('addresses')} className={`w-full text-left px-6 py-4 flex items-center gap-3 transition-colors ${activeTab === 'addresses' ? 'bg-indigo-50 text-indigo-600 font-bold border-l-4 border-indigo-600' : 'text-gray-600 hover:bg-gray-50'}`}>
              <MapPin className="w-5 h-5" /> Addresses
            </button>
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1">
          {activeTab === 'orders' && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-gray-900">Order History</h2>
              {orders.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-2xl border border-gray-100">
                  <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">You haven't placed any orders yet.</p>
                </div>
              ) : (
                orders.map(order => (
                  <div key={order.id} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 transition-all hover:shadow-md">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 border-b border-gray-50 pb-4 gap-4">
                      <div>
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-lg text-gray-900">#{order.id}</span>
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${order.status === 'Delivered' ? 'bg-green-100 text-green-700' :
                            order.status === 'Cancelled' ? 'bg-red-100 text-red-700' :
                              'bg-amber-100 text-amber-700'
                            }`}>{order.status}</span>
                        </div>
                        <div className="text-sm text-gray-500 mt-1 flex items-center gap-2">
                          <Clock className="w-3 h-3" /> {new Date(order.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-indigo-600">{formatLKR(order.totalAmount)}</div>
                        <div className="text-xs text-gray-400">{order.items.length} items</div>
                      </div>
                    </div>

                    <div className="flex flex-col md:flex-row gap-6">
                      <div className="flex-1 space-y-3">
                        {order.items.map((item, idx) => (
                          <div key={idx} className="flex items-center gap-4 text-sm bg-gray-50 p-3 rounded-lg">
                            <div className="w-12 h-12 bg-white rounded-md overflow-hidden flex-shrink-0 border border-gray-200">
                              <img src={item.imageUrl} className="w-full h-full object-cover" alt={item.name} />
                            </div>
                            <div className="flex-1">
                              <div className="font-semibold text-gray-900">{item.name}</div>
                              <div className="text-gray-500">Qty: {item.quantity} × {formatLKR(item.offerPrice || item.price)}</div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Timeline Tracking */}
                      <div className="w-full md:w-64 border-l-2 border-gray-100 pl-6 space-y-6">
                        <h4 className="font-bold text-sm text-gray-900">Tracking Timeline</h4>
                        {order.statusHistory ? (
                          order.statusHistory.map((status, i) => (
                            <div key={i} className="relative">
                              <div className={`absolute -left-[31px] top-1 w-3 h-3 rounded-full border-2 border-white ${i === order.statusHistory.length - 1 ? 'bg-indigo-600' : 'bg-gray-300'}`}></div>
                              <div className="text-sm font-semibold text-gray-900">{status.status}</div>
                              <div className="text-xs text-gray-500">{new Date(status.timestamp).toLocaleString()}</div>
                              {status.comment && <div className="text-xs text-gray-600 mt-1 bg-gray-50 p-2 rounded">{status.comment}</div>}
                            </div>
                          ))
                        ) : (
                          <div className="text-xs text-gray-400">No tracking details available.</div>
                        )}
                      </div>
                    </div>

                    {order.status === 'Pending' && (
                      <div className="flex justify-end mt-6 pt-4 border-t border-gray-100">
                        <button
                          onClick={() => { if (confirm('Are you sure you want to cancel this order?')) db.cancelOrder(order.id).then(success => { if (success) db.getOrders(user.id).then(setOrders); else alert('Cannot cancel order older than 24h') }) }}
                          className="text-red-500 text-sm font-medium hover:bg-red-50 px-4 py-2 rounded-lg transition-colors border border-transparent hover:border-red-100"
                        >
                          Cancel Order
                        </button>
                      </div>
                    )}
                  </div>
                )))}
            </div>
          )}

          {activeTab === 'chats' && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 h-[600px] flex flex-col">
              <div className="p-4 border-b font-bold flex items-center justify-between">
                <div className="flex items-center gap-2"><MessageCircle className="w-5 h-5" /> Support History</div>
                <button onClick={() => db.getMessages(user.id).then(setChatMessages)} className="p-2 hover:bg-gray-100 rounded-full" title="Refresh Chat">
                  <History className="w-4 h-4 text-gray-500" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
                {chatMessages.length === 0 && <p className="text-center text-gray-400 mt-10">Start a new chat to contact support.</p>}
                {chatMessages.map(m => (
                  <div key={m.id} className={`flex ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[75%] p-3 rounded-xl text-sm ${m.sender === 'user' ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-white border text-gray-800 rounded-bl-none'}`}>
                      {m.text}
                      <div className={`text-[10px] mt-1 flex justify-end gap-1 ${m.sender === 'user' ? 'text-indigo-200' : 'text-gray-400'}`}>
                        {new Date(m.timestamp).toLocaleTimeString()}
                        {m.sender === 'user' && (
                          m.read ? <span title={`Read at ${new Date(m.readAt || 0).toLocaleString()}`}><CheckCircle className="w-3 h-3" /></span> : <span title="Sent"><CheckCircle className="w-3 h-3 opacity-50" /></span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>
              <div className="p-4 bg-white border-t flex gap-2">
                <input
                  className="flex-1 p-3 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Type your message..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendChat()}
                />
                <button onClick={handleSendChat} className="bg-indigo-600 text-white p-3 rounded-xl hover:bg-indigo-700"><Send className="w-5 h-5" /></button>
              </div>
            </div>
          )}

          {activeTab === 'wishlist' && (
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-6">My Wishlist</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                {wishlistProducts.map(p => <ProductCard key={p.id} product={p} />)}
              </div>
              {wishlistProducts.length === 0 && (
                <div className="text-center py-12 bg-white rounded-2xl border border-gray-100">
                  <Heart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">Your wishlist is empty.</p>
                  <Link to="/" className="text-indigo-600 font-medium hover:underline mt-2 inline-block">Explore Products</Link>
                </div>
              )}
            </div>
          )}

          {activeTab === 'addresses' && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Saved Addresses</h2>
                <button onClick={() => setShowAddressForm(!showAddressForm)} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all">
                  {showAddressForm ? 'Cancel' : '+ Add New Address'}
                </button>
              </div>

              {showAddressForm && (
                <div className="bg-white p-6 rounded-2xl shadow-lg border border-indigo-100 mb-8 animate-slideDown">
                  <h3 className="font-bold mb-4 text-gray-800">New Address Details</h3>
                  <form onSubmit={handleAddAddress} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <input required placeholder="Label (e.g. Home, Office)" className="p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" value={newAddress.label} onChange={e => setNewAddress({ ...newAddress, label: e.target.value })} />
                      <input required placeholder="Contact Person Name" className="p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" value={newAddress.name} onChange={e => setNewAddress({ ...newAddress, name: e.target.value })} />
                    </div>
                    <input required placeholder="Street Address" className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" value={newAddress.address} onChange={e => setNewAddress({ ...newAddress, address: e.target.value })} />
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <input required placeholder="City" className="p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" value={newAddress.city} onChange={e => setNewAddress({ ...newAddress, city: e.target.value })} />
                      <input required placeholder="District" className="p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" value={newAddress.district} onChange={e => setNewAddress({ ...newAddress, district: e.target.value })} />
                      <input required placeholder="Phone Number" className="p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" value={newAddress.phone} onChange={e => setNewAddress({ ...newAddress, phone: e.target.value })} />
                    </div>
                    <div className="flex justify-end pt-2">
                      <button type="submit" className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700">Save Address</button>
                    </div>
                  </form>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {user.addresses.map(addr => (
                  <div key={addr.id} className="bg-white p-5 rounded-xl border border-gray-200 relative group hover:border-indigo-300 hover:shadow-md transition-all">
                    <div className="flex justify-between items-start mb-2">
                      <div className="font-bold text-gray-900 flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-indigo-500" /> {addr.label}
                      </div>
                      <button onClick={() => removeAddress(addr.id)} className="text-gray-300 hover:text-red-500 transition-colors p-1">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="text-sm text-gray-600 space-y-1">
                      <div className="font-medium">{addr.name}</div>
                      <div>{addr.address}</div>
                      <div>{addr.city}, {addr.district}</div>
                      <div className="text-indigo-600">{addr.phone}</div>
                    </div>
                  </div>
                ))}
              </div>
              {user.addresses.length === 0 && !showAddressForm && (
                <p className="text-center text-gray-500 py-8">No addresses saved. Add one for faster checkout.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const Home: React.FC = () => {
  const { products, refreshProducts, popups, settings, categories } = useShop();
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'recommended' | 'price-low' | 'price-high' | 'popular'>('recommended');

  useEffect(() => {
    refreshProducts();
  }, []);

  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [priceRange, setPriceRange] = useState<{ min: number, max: number }>({ min: 0, max: 1000000 });

  // Banner Carousel Logic
  const bannerImages = useMemo(() => {
    const validImages = (settings.bannerImages || []).filter(url => url.trim() !== '');
    if (validImages.length > 0) return validImages;
    return settings.homeBannerUrl ? [settings.homeBannerUrl] : [];
  }, [settings]);

  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    if (bannerImages.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentSlide(curr => (curr + 1) % bannerImages.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [bannerImages.length]);

  const filteredProducts = useMemo(() => {
    let result = products.filter(p => {
      const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;
      const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.description.toLowerCase().includes(searchQuery.toLowerCase());
      const price = p.offerPrice || p.price;
      const matchesPrice = price >= priceRange.min && price <= priceRange.max;
      return matchesCategory && matchesSearch && matchesPrice;
    });

    switch (sortBy) {
      case 'price-low':
        result.sort((a, b) => (a.offerPrice || a.price) - (b.offerPrice || b.price));
        break;
      case 'price-high':
        result.sort((a, b) => (b.offerPrice || b.price) - (a.offerPrice || a.price));
        break;
      case 'popular':
        result.sort((a, b) => b.reviews.length - a.reviews.length);
        break;
      default:
        break;
    }
    return result;
  }, [products, selectedCategory, searchQuery, sortBy, priceRange]);

  const flashSaleProducts = useMemo(() => {
    return products.filter(p => p.offerPrice && p.offerPrice < p.price);
  }, [products]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      {/* Banner */}
      {/* Banner Carousel */}
      <div className="w-full h-48 md:h-72 rounded-2xl shadow-xl relative overflow-hidden group bg-gray-900">
        {bannerImages.length > 0 ? (
          bannerImages.map((img, idx) => (
            <div
              key={idx}
              className={`absolute inset-0 bg-cover bg-center transition-opacity duration-1000 ${idx === currentSlide ? 'opacity-100' : 'opacity-0'}`}
              style={{ backgroundImage: `url(${img})` }}
            />
          ))
        ) : (
          <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-purple-600 flex items-center justify-center"></div>
        )}

        <div className="absolute inset-0 bg-black/30"></div>

        {/* Default Text if no banner or just fallback color */}
        {bannerImages.length === 0 && !settings.homeBannerUrl && (
          <div className="absolute inset-0 flex items-center justify-center z-10 text-center text-white">
            <div>
              <h1 className="text-4xl md:text-6xl font-extrabold mb-2 drop-shadow-lg">{settings.shopName}</h1>
              <p className="text-lg md:text-xl opacity-90">Experience the Future of Shopping</p>
            </div>
          </div>
        )}

        {/* Carousel Indicators */}
        {bannerImages.length > 1 && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-20">
            {bannerImages.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentSlide(idx)}
                className={`h-2 rounded-full transition-all duration-300 ${idx === currentSlide ? 'bg-white w-8' : 'bg-white/50 w-2 hover:bg-white/80'}`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Popups */}
      {popups.filter(p => p.isActive).map(p => (
        <div key={p.id} className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white p-4 rounded-xl shadow-lg flex justify-between items-center animate-pulse">
          <span className="font-bold flex items-center gap-2"><Star className="fill-current" /> {p.message}</span>
        </div>
      ))}

      {/* Flash Sale Section */}
      {flashSaleProducts.length > 0 && (
        <div className="bg-white p-6 rounded-2xl border border-orange-100 shadow-sm">
          <div className="flex justify-between items-center mb-6 border-b border-orange-100 pb-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-800">Flash Sale</h2>
              <div className="text-orange-500 font-bold text-sm tracking-widest uppercase mt-1">On Sale Now</div>
            </div>
            <button
              onClick={() => {
                setSelectedCategory('All');
                setSearchQuery('');
                document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="hidden md:block px-6 py-2 border border-orange-500 text-orange-500 font-bold rounded-full hover:bg-orange-50 transition-colors"
            >
              SHOP ALL PRODUCTS
            </button>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar snap-x">
            {flashSaleProducts.map(p => (
              <div key={p.id} className="min-w-[220px] max-w-[220px] snap-center">
                <ProductCard product={p} viewMode="grid" />
              </div>
            ))}
          </div>
        </div>
      )}

      <div id="products" className="space-y-6">
        <div className="flex flex-col gap-6 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          {/* Search & Sort */}
          {/* Top: Search Bar */}
          <div className="relative w-full group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-indigo-600 transition-colors" />
            <input
              className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all shadow-sm group-hover:shadow-md text-lg"
              placeholder="Search products..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="border-b border-gray-100"></div>

          {/* Bottom: Filters & Sort */}
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">

            {/* Sort & View */}
            <div className="flex gap-4 items-center w-full md:w-auto">
              <div className="relative min-w-[200px] flex-1 md:flex-none">
                <Filter className="absolute left-3 top-3 w-4 h-4 text-gray-500" />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="w-full pl-9 pr-8 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 appearance-none cursor-pointer text-sm font-medium text-gray-700"
                >
                  <option value="recommended">Recommended</option>
                  <option value="price-low">Price: Low to High</option>
                  <option value="price-high">Price: High to Low</option>
                  <option value="popular">Most Popular</option>
                </select>
                <ChevronRight className="absolute right-3 top-3 w-4 h-4 text-gray-400 rotate-90 pointer-events-none" />
              </div>

              {/* View Mode Toggle */}
              <div className="flex bg-gray-100 rounded-xl p-1 border border-gray-200 shrink-0">
                <button onClick={() => setViewMode('grid')} className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white shadow text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}>
                  <Grid className="w-5 h-5" />
                </button>
                <button onClick={() => setViewMode('list')} className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white shadow text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}>
                  <Layers className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Price Range */}
            <div className="flex items-center gap-2 bg-gray-50 p-2 rounded-xl border border-gray-200 w-full md:w-auto">
              <span className="text-xs font-bold text-gray-500 px-2 text-nowrap">Price Range</span>
              <input type="number" placeholder="Min" className="w-20 p-1 border rounded text-sm min-w-0" value={priceRange.min} onChange={e => setPriceRange({ ...priceRange, min: Number(e.target.value) })} />
              <span className="text-gray-400">-</span>
              <input type="number" placeholder="Max" className="w-20 p-1 border rounded text-sm min-w-0" value={priceRange.max} onChange={e => setPriceRange({ ...priceRange, max: Number(e.target.value) })} />
            </div>

          </div>

          {/* Categories Grid */}
          <div className="w-full">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Categories</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {/* All Category */}
              <button
                onClick={() => setSelectedCategory('All')}
                className={`flex flex-col items-center justify-center p-4 rounded-xl border transition-all hover:shadow-md ${selectedCategory === 'All'
                  ? 'bg-indigo-600 border-indigo-600 text-white'
                  : 'bg-white border-gray-200 text-gray-700 hover:border-indigo-300'
                  }`}
              >
                <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-2 ${selectedCategory === 'All' ? 'bg-indigo-500 text-white' : 'bg-gray-100 text-gray-500'}`}>
                  <Layers className="w-6 h-6" />
                </div>
                <span className="text-sm font-bold">All</span>
              </button>

              {/* Dynamic Categories */}
              {categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.name)}
                  className={`flex flex-col items-center justify-center p-4 rounded-xl border transition-all hover:shadow-md ${selectedCategory === cat.name
                    ? 'bg-indigo-600 border-indigo-600 text-white'
                    : 'bg-white border-gray-200 text-gray-700 hover:border-indigo-300'
                    }`}
                >
                  <div className="w-12 h-12 mb-2 flex items-center justify-center bg-white rounded-full overflow-hidden">
                    {cat.imageUrl ? (
                      <img src={cat.imageUrl} alt={cat.name} className="w-full h-full object-cover" />
                    ) : (
                      <Grid className="w-6 h-6 text-gray-400" />
                    )}
                  </div>
                  <span className="text-sm font-bold text-center line-clamp-2">{cat.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          {selectedCategory === 'All' ? 'Featured Products' : `${selectedCategory}`}
          <span className="text-sm font-normal text-gray-500 bg-gray-100 px-2 py-1 rounded-full">{filteredProducts.length} items</span>
        </h2>

        {filteredProducts.length > 0 ? (
          <div className={`grid gap-6 ${viewMode === 'grid' ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4' : 'grid-cols-1'}`}>
            {filteredProducts.map(p => <ProductCard key={p.id} product={p} viewMode={viewMode} />)}
          </div>
        ) : (
          <div className="text-center py-20 bg-white rounded-2xl border border-gray-100">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Search className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-xl font-bold text-gray-900">No products found</h3>
            <p className="text-gray-500">Try adjusting your search or category filter.</p>
            <button onClick={() => { setSelectedCategory('All'); setSearchQuery(''); }} className="mt-4 text-indigo-600 font-bold hover:underline">Clear Filters</button>
          </div>
        )}
      </div>
    </div>
  );
};

const Login: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      // Check if user is admin after login to redirect correctly?
      // Since login returns void here, we rely on default nav or user state in updated render.
      // But standard login goes to /. Admin login goes to /admin/login then /admin.
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-xl border border-gray-100">
        <h2 className="text-3xl font-bold text-gray-900 mb-2 text-center">Welcome Back</h2>
        <p className="text-gray-500 text-center mb-8">Sign in to your account</p>

        {error && <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg text-sm text-center">{error}</div>}

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3 top-3.5 w-5 h-5 text-gray-400" />
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                placeholder="name@example.com"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
            <div className="relative">
              <input
                type="password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full pl-4 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                placeholder="••••••••"
              />
            </div>
          </div>
          <button disabled={loading} type="submit" className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 flex justify-center">
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
          <div className="text-center text-sm text-gray-500">
            Don't have an account? <Link to="/register" className="text-indigo-600 font-semibold hover:underline">Register here</Link>
          </div>
          {/* Removed legacy admin hint */}
        </form>
      </div>
    </div>
  );
};

const Register: React.FC = () => {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (formData.password.length < 6) throw new Error("Password must be at least 6 characters");
      await register(formData.name, formData.email, formData.phone, formData.password);
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-xl border border-gray-100">
        <h2 className="text-3xl font-bold text-gray-900 mb-2 text-center">Create Account</h2>
        <p className="text-gray-500 text-center mb-8">Join TechMart LK today</p>

        {error && <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg text-sm text-center">{error}</div>}

        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
            <div className="relative">
              <UserIcon className="absolute left-3 top-3.5 w-5 h-5 text-gray-400" />
              <input
                required
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                placeholder="John Doe"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3 top-3.5 w-5 h-5 text-gray-400" />
              <input
                type="email"
                required
                value={formData.email}
                onChange={e => setFormData({ ...formData, email: e.target.value })}
                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                placeholder="name@example.com"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
            <div className="relative">
              <Smartphone className="absolute left-3 top-3.5 w-5 h-5 text-gray-400" />
              <input
                type="tel"
                required
                value={formData.phone}
                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                placeholder="077 123 4567"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <div className="relative">
              <input
                type="password"
                required
                value={formData.password}
                onChange={e => setFormData({ ...formData, password: e.target.value })}
                className="w-full pl-4 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                placeholder="••••••••"
              />
            </div>
          </div>

          <button disabled={loading} type="submit" className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 flex justify-center mt-4">
            {loading ? 'Creating Account...' : 'Register'}
          </button>

          <div className="text-center text-sm text-gray-500 mt-4">
            Already have an account? <Link to="/login" className="text-indigo-600 font-semibold hover:underline">Sign In</Link>
          </div>
        </form>
      </div>
    </div>
  );
};

const ProductDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { products, addToCart, refreshProducts } = useShop();
  const { user } = useAuth();
  const product = products.find(p => p.id === id);

  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'video' | 'reviews'>('details');
  const [activeImage, setActiveImage] = useState('');

  useEffect(() => {
    if (product) {
      setActiveImage(product.imageUrl);
      setActiveTab('details');
    }
  }, [product]);

  const getYouTubeId = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product || !user) return;
    setSubmitting(true);
    try {
      await db.addReview(product.id, {
        userId: user.id,
        userName: user.name,
        rating,
        comment
      });
      setComment('');
      setRating(5);
      refreshProducts(); // Refresh to show new review
    } catch (error) {
      console.error("Failed to submit review", error);
      alert("Failed to submit review");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteReview = async (reviewId: string) => {
    if (!product || !confirm('Are you sure you want to delete this review?')) return;
    try {
      await db.deleteReview(product.id, reviewId);
      refreshProducts();
    } catch (error) {
      console.error(error);
      alert('Failed to delete review');
    }
  };

  if (!product) return <div className="p-20 text-center text-gray-500">Product not found</div>;

  return (
    <div className="max-w-7xl mx-auto px-4 py-10">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-gray-500 hover:text-indigo-600 font-medium mb-6 transition-colors group"
      >
        <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
        Back
      </button>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-10">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          <div className="space-y-4">
            <div className="rounded-xl overflow-hidden bg-gray-50 flex items-center justify-center p-4 border border-gray-100 h-[500px]">
              <img src={activeImage || product.imageUrl} alt={product.name} className="w-full h-full object-contain" />
            </div>
            {/* Gallery Thumbnails */}
            <div className="flex gap-4 overflow-x-auto pb-2 custom-scrollbar">
              {[product.imageUrl, ...(product.images || [])].filter((img, i, arr) => img && arr.indexOf(img) === i).map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => setActiveImage(img)}
                  className={`w-24 h-24 flex-shrink-0 rounded-xl border-2 overflow-hidden transition-all ${activeImage === img ? 'border-indigo-600 shadow-md transform scale-105' : 'border-gray-200 opacity-70 hover:opacity-100'}`}
                >
                  <img src={img} alt={`View ${idx}`} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-6">
            <div>
              <span className="text-indigo-600 font-bold uppercase tracking-wider text-sm">{product.category}</span>
              <h1 className="text-4xl font-bold text-gray-900 mt-2">{product.name}</h1>
              <div className="flex items-center gap-2 mt-4">
                <div className="flex text-yellow-400">
                  {[...Array(5)].map((_, i) => <Star key={i} className={`w-5 h-5 ${i < Math.floor(product.rating) ? 'fill-current' : 'text-gray-200'}`} />)}
                </div>
                <span className="text-gray-500">({product.reviews.length} reviews)</span>
              </div>



              <div className="text-3xl font-bold text-gray-900">{formatLKR(product.offerPrice || product.price)}</div>

              {/* Short Description */}
              <p className="text-gray-600 leading-relaxed text-lg">{product.shortDescription || product.description.substring(0, 150) + '...'}</p>

              <div className="pt-6 border-t border-gray-100">
                <button
                  onClick={() => addToCart(product)}
                  className="w-full md:w-auto px-10 py-4 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 flex items-center justify-center gap-2"
                >
                  <ShoppingCart className="w-5 h-5" /> Add to Cart
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs Headers */}
        <div className="flex items-center gap-8 border-b border-gray-100 mt-12 mb-8 overflow-x-auto">
          <button
            onClick={() => setActiveTab('details')}
            className={`pb-4 text-sm font-bold uppercase tracking-wider border-b-2 transition-all whitespace-nowrap ${activeTab === 'details' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
          >
            Description
          </button>
          <button
            onClick={() => setActiveTab('video')}
            className={`pb-4 text-sm font-bold uppercase tracking-wider border-b-2 transition-all whitespace-nowrap ${activeTab === 'video' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
          >
            Video Demo
          </button>
          <button
            onClick={() => setActiveTab('reviews')}
            className={`pb-4 text-sm font-bold uppercase tracking-wider border-b-2 transition-all whitespace-nowrap ${activeTab === 'reviews' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
          >
            Reviews ({product.reviews.length})
          </button>
        </div>

        {/* Tab Content */}
        <div className="min-h-[300px] animate-fadeIn">
          {activeTab === 'details' && (
            <div className="prose prose-lg text-gray-600 max-w-none whitespace-pre-line">
              {product.description}
            </div>
          )}

          {activeTab === 'video' && (
            <div className="max-w-4xl mx-auto">
              {product.videoUrl ? (
                <div className="aspect-video rounded-2xl overflow-hidden bg-black shadow-lg">
                  <iframe
                    className="w-full h-full"
                    src={`https://www.youtube.com/embed/${getYouTubeId(product.videoUrl)}`}
                    title={product.name}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              ) : (
                <div className="aspect-video rounded-2xl bg-gray-50 border border-gray-100 flex flex-col items-center justify-center text-gray-400">
                  <PlayCircle className="w-16 h-16 mb-4 opacity-20" />
                  <p>No video demonstration available for this product.</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'reviews' && (
            <div className="max-w-3xl">
              <div className="flex items-center gap-4 mb-8 bg-gray-50 p-6 rounded-xl">
                <div className="text-4xl font-bold text-gray-900">{product.rating.toFixed(1)}</div>
                <div>
                  <div className="flex text-yellow-400 mb-1">
                    {[...Array(5)].map((_, i) => <Star key={i} className={`w-5 h-5 ${i < Math.round(product.rating) ? 'fill-current' : 'text-gray-300'}`} />)}
                  </div>
                  <div className="text-sm text-gray-500">Based on {product.reviews.length} reviews</div>
                </div>
              </div>

              <div className="space-y-6 mb-10">
                {product.reviews && product.reviews.length > 0 ? (
                  product.reviews.map((review, idx) => (
                    <div key={idx} className="bg-white border border-gray-100 p-6 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-700 font-bold">
                            {review.userName.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold text-gray-900">{review.userName}</div>
                            <div className="flex text-yellow-400 text-xs mt-0.5">
                              {[...Array(5)].map((_, i) => <Star key={i} className={`w-3 h-3 ${i < review.rating ? 'fill-current' : 'text-gray-300'}`} />)}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-gray-400">{new Date(review.date).toLocaleDateString()}</span>
                          {user?.role === 'admin' && (
                            <button
                              onClick={() => handleDeleteReview(review.id)}
                              className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Delete Review"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                      <p className="text-gray-600 leading-relaxed">"{review.comment}"</p>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-12 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                    <MessageCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500">No reviews yet. Be the first to share your experience!</p>
                  </div>
                )}
              </div>

              {/* Add Review Form */}
              {user ? (
                <div className="bg-gradient-to-br from-indigo-50 to-white p-6 rounded-2xl border border-indigo-100">
                  <h3 className="font-bold text-lg mb-4 text-gray-900">Write a Review</h3>
                  <form onSubmit={handleSubmitReview} className="space-y-4">
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">Rating</label>
                      <div className="flex gap-2">
                        {[1, 2, 3, 4, 5].map(star => (
                          <button
                            key={star}
                            type="button"
                            onClick={() => setRating(star)}
                            className={`text-2xl transition-all hover:scale-110 active:scale-95 ${rating >= star ? 'text-yellow-400' : 'text-gray-200'}`}
                          >
                            ★
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">Your Review</label>
                      <textarea
                        required
                        rows={4}
                        className="w-full p-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white transition-all shadow-sm"
                        placeholder="What did you like or dislike?"
                        value={comment}
                        onChange={e => setComment(e.target.value)}
                      />
                    </div>
                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={submitting}
                        className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 disabled:opacity-70 flex items-center gap-2"
                      >
                        {submitting ? 'Submitting...' : 'Submit Review'}
                        <Send className="w-4 h-4" />
                      </button>
                    </div>
                  </form>
                </div>
              ) : (
                <div className="bg-gray-900 text-white p-8 rounded-2xl text-center shadow-xl">
                  <h3 className="text-xl font-bold mb-2">Own this product?</h3>
                  <p className="text-gray-400 mb-6">Log in to share your thoughts with other customers.</p>
                  <Link to="/login" className="inline-block bg-white text-gray-900 px-8 py-3 rounded-xl font-bold hover:bg-gray-100 transition-colors">Sign In to Review</Link>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const CheckoutPage: React.FC = () => {
  const { cart, cartTotal, clearCart } = useShop();
  const { user, addAddress } = useAuth();
  const navigate = useNavigate();

  const [selectedAddressId, setSelectedAddressId] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<'COD' | 'Card'>('COD');
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [newAddress, setNewAddress] = useState({ label: 'Home', name: '', address: '', city: '', district: 'Colombo', phone: '' });

  // Payment Gateway State
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'processing' | 'success'>('idle');

  // Delivery Fee Calculation
  const totalDeliveryFee = cart.reduce((sum, item) => sum + ((item.deliveryFee || 0) * item.quantity), 0);
  const grandTotal = cartTotal + totalDeliveryFee;

  useEffect(() => {
    if (user && user.addresses.length > 0 && !selectedAddressId) {
      setSelectedAddressId(user.addresses[0].id);
    }
  }, [user]);

  const handleAddAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    try {
      await addAddress(newAddress);
      setShowAddressForm(false);
      // Select the newly added address (it will be the last one)
      // Since addAddress updates the user context, we might need to wait for that or predict the ID. 
      // For simplicity in this mock, we let the user select it or useEffect handles it if list was empty.
      setNewAddress({ label: 'Home', name: '', address: '', city: '', district: 'Colombo', phone: '' });
      // Force refresh or notification could be added here
    } catch (error) {
      console.error("Failed to add address", error);
      alert("Failed to save address. Please try again.");
    }
  };

  const handleOrder = async () => {
    if (!user) return navigate('/login');
    if (cart.length === 0) return;

    if (!selectedAddressId) {
      alert('Please select a delivery address.');
      return;
    }

    const address = user.addresses.find(a => a.id === selectedAddressId);
    if (!address) return;

    if (paymentMethod === 'Card') {
      setIsProcessing(true);
      setPaymentStatus('processing');
      // Simulate Payment Gateway
      setTimeout(async () => {
        setPaymentStatus('success');
        setTimeout(async () => {
          await createOrderInDb(address, 'Card');
        }, 1000); // Wait a bit to show success message
      }, 2000);
    } else {
      await createOrderInDb(address, 'COD');
    }
  };

  const createOrderInDb = async (address: Address, method: 'Card' | 'COD') => {
    if (!user) return;
    await db.createOrder(
      user.id,
      cart,
      grandTotal,
      address,
      method,
      totalDeliveryFee,
      user.email, // Pass email
      address.phone // Pass phone from selected address
    );
    clearCart();
    setIsProcessing(false);
    setPaymentStatus('idle');
    // Navigate to profile/orders to see the new order
    navigate('/profile');
  };

  if (cart.length === 0) return <Navigate to="/" />;

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Checkout</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Left Column: Details */}
        <div className="space-y-6">

          {/* Address Section */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2"><MapPin className="w-5 h-5 text-indigo-600" /> Delivery Address</h2>
              <button onClick={() => setShowAddressForm(!showAddressForm)} className="text-sm text-indigo-600 font-bold hover:underline">
                {showAddressForm ? 'Cancel' : '+ Add New'}
              </button>
            </div>

            {showAddressForm && (
              <form onSubmit={handleAddAddress} className="mb-6 bg-gray-50 p-4 rounded-xl space-y-3 border border-indigo-100">
                <div className="grid grid-cols-2 gap-3">
                  <input required placeholder="Label (Home)" className="p-2 border rounded w-full" value={newAddress.label} onChange={e => setNewAddress({ ...newAddress, label: e.target.value })} />
                  <input required placeholder="Contact Name" className="p-2 border rounded w-full" value={newAddress.name} onChange={e => setNewAddress({ ...newAddress, name: e.target.value })} />
                </div>
                <input required placeholder="Full Address" className="p-2 border rounded w-full" value={newAddress.address} onChange={e => setNewAddress({ ...newAddress, address: e.target.value })} />
                <div className="grid grid-cols-3 gap-3">
                  <input required placeholder="City" className="p-2 border rounded w-full" value={newAddress.city} onChange={e => setNewAddress({ ...newAddress, city: e.target.value })} />
                  <input required placeholder="District" className="p-2 border rounded w-full" value={newAddress.district} onChange={e => setNewAddress({ ...newAddress, district: e.target.value })} />
                  <input required placeholder="Phone" className="p-2 border rounded w-full" value={newAddress.phone} onChange={e => setNewAddress({ ...newAddress, phone: e.target.value })} />
                </div>
                <button type="submit" className="w-full py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700">Save Address</button>
              </form>
            )}

            <div className="space-y-3">
              {user && user.addresses.length > 0 ? (
                user.addresses.map(addr => (
                  <label key={addr.id} className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${selectedAddressId === addr.id ? 'border-indigo-600 bg-indigo-50' : 'border-gray-200 hover:border-indigo-300'}`}>
                    <input
                      type="radio"
                      name="address"
                      className="mt-1"
                      checked={selectedAddressId === addr.id}
                      onChange={() => setSelectedAddressId(addr.id)}
                    />
                    <div className="text-sm">
                      <div className="font-bold text-gray-900">{addr.label} <span className="font-normal text-gray-500">({addr.name})</span></div>
                      <div>{addr.address}, {addr.city}</div>
                      <div className="text-gray-500">{addr.phone}</div>
                    </div>
                  </label>
                ))
              ) : (
                <p className="text-gray-500 italic text-center py-2">No addresses found. Please add one.</p>
              )}
            </div>
          </div>

          {/* Payment Method */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2"><CreditCard className="w-5 h-5 text-indigo-600" /> Payment Method</h2>
            <div className="grid grid-cols-2 gap-4">
              <label className={`cursor-pointer border p-4 rounded-xl flex flex-col items-center gap-2 transition-all ${paymentMethod === 'Card' ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'hover:bg-gray-50'}`}>
                <input type="radio" name="payment" className="hidden" checked={paymentMethod === 'Card'} onChange={() => setPaymentMethod('Card')} />
                <CreditCard className="w-8 h-8" />
                <span className="font-bold">Card Payment</span>
              </label>
              <label className={`cursor-pointer border p-4 rounded-xl flex flex-col items-center gap-2 transition-all ${paymentMethod === 'COD' ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'hover:bg-gray-50'}`}>
                <input type="radio" name="payment" className="hidden" checked={paymentMethod === 'COD'} onChange={() => setPaymentMethod('COD')} />
                <Banknote className="w-8 h-8" />
                <span className="font-bold">Cash On Delivery</span>
              </label>
            </div>
          </div>
        </div>

        {/* Right Column: Order Summary */}
        <div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 sticky top-6">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Order Summary</h2>
            <div className="space-y-4 mb-6 max-h-80 overflow-y-auto pr-2 custom-scrollbar">
              {cart.map(item => (
                <div key={item.id} className="flex justify-between items-center py-2 border-b border-gray-50">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gray-100 rounded-lg overflow-hidden">
                      <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                    </div>
                    <div>
                      <div className="font-medium text-gray-900 line-clamp-1 max-w-[120px]">{item.name}</div>
                      <div className="text-sm text-gray-500">Qty: {item.quantity}</div>
                    </div>
                  </div>
                  <div className="font-medium">{formatLKR((item.offerPrice || item.price) * item.quantity)}</div>
                </div>
              ))}
            </div>

            <div className="space-y-2 text-sm text-gray-600 py-4 border-t border-gray-100">
              <div className="flex justify-between"><span>Subtotal</span><span>{formatLKR(cartTotal)}</span></div>
              <div className="flex justify-between">
                <span>Delivery Fee</span>
                <span className="text-indigo-600 font-bold">{totalDeliveryFee > 0 ? formatLKR(totalDeliveryFee) : 'Free'}</span>
              </div>
            </div>

            <div className="flex justify-between items-center py-4 border-t border-gray-100 text-xl font-bold text-gray-900 mb-6">
              <span>Total</span>
              <span>{formatLKR(grandTotal)}</span>
            </div>

            <button
              onClick={handleOrder}
              disabled={cart.length === 0 || !selectedAddressId || isProcessing}
              className={`w-full py-4 text-white rounded-xl font-bold transition-all shadow-lg flex justify-center items-center gap-2 ${cart.length === 0 || !selectedAddressId || isProcessing
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200'
                }`}
            >
              {isProcessing ? 'Processing...' : `Pay ${formatLKR(grandTotal)}`}
            </button>
          </div>
        </div>
      </div>

      {/* Payment Processing Modal */}
      {isProcessing && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center backdrop-blur-sm">
          <div className="bg-white p-8 rounded-2xl shadow-2xl max-w-sm w-full text-center animate-scaleIn">
            {paymentStatus === 'processing' ? (
              <>
                <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-6"></div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Processing Payment</h3>
                <p className="text-gray-500">Please verify the transaction on your bank app if prompted.</p>
              </>
            ) : (
              <>
                <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6 animate-bounce">
                  <CheckCircle className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Payment Successful!</h3>
                <p className="text-gray-500">Your order has been confirmed.</p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const AdminLogin: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/admin');
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-2xl border border-gray-800">
        <div className="flex justify-center mb-6">
          <LayoutDashboard className="w-16 h-16 text-indigo-600" />
        </div>
        <h2 className="text-3xl font-bold text-gray-900 mb-2 text-center">Admin Portal</h2>
        <p className="text-gray-500 text-center mb-8">Authorized personnel only</p>

        {error && <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg text-sm text-center">{error}</div>}

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3 top-3.5 w-5 h-5 text-gray-400" />
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-600 outline-none transition-all"
                placeholder="admin@techmart.lk"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
            <div className="relative">
              <input
                type="password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full pl-4 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-600 outline-none transition-all"
                placeholder="••••••••"
              />
            </div>
          </div>
          <button disabled={loading} type="submit" className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-900/50 flex justify-center">
            {loading ? 'Verifying...' : 'Access Dashboard'}
          </button>

          <div className="text-center mt-6">
            <Link to="/" className="text-gray-400 hover:text-gray-600 text-sm">Return to Shop</Link>
          </div>
        </form>
      </div>
    </div>
  );
};

const MobileBottomNav: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { cart, isCartOpen, setIsCartOpen } = useShop();

  const isHome = location.pathname === '/';
  const isWishlist = location.search.includes('tab=wishlist'); // More specific check
  const isProfile = location.pathname === '/profile' && !isWishlist;

  // Don't show on Admin dashboard or if cart is open (optional, but good for focus)
  if (location.pathname.startsWith('/admin')) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-lg border-t border-gray-100 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)] px-6 py-2 md:hidden z-40 flex justify-between items-center safe-area-bottom">
      <button
        onClick={() => navigate('/')}
        className={`relative flex flex-col items-center gap-1 transition-all duration-300 ${isHome ? 'text-indigo-600 -translate-y-1' : 'text-gray-400 hover:text-gray-600'}`}
      >
        <div className={`p-2 rounded-2xl transition-all duration-300 ${isHome ? 'bg-indigo-50 shadow-sm' : ''}`}>
          <HomeIcon className={`w-6 h-6 transition-all duration-300 ${isHome ? 'fill-indigo-600' : ''}`} />
        </div>
        <span className={`text-[10px] font-bold transition-all duration-300 ${isHome ? 'opacity-100' : 'opacity-70'}`}>Home</span>
        {isHome && <span className="absolute -bottom-2 w-1 h-1 bg-indigo-600 rounded-full" />}
      </button>

      <button
        onClick={() => navigate('/profile?tab=wishlist')}
        className={`relative flex flex-col items-center gap-1 transition-all duration-300 ${isWishlist ? 'text-indigo-600 -translate-y-1' : 'text-gray-400 hover:text-gray-600'}`}
      >
        <div className={`p-2 rounded-2xl transition-all duration-300 ${isWishlist ? 'bg-indigo-50 shadow-sm' : ''}`}>
          <Heart className={`w-6 h-6 transition-all duration-300 ${isWishlist ? 'fill-indigo-600' : ''}`} />
        </div>
        <span className={`text-[10px] font-bold transition-all duration-300 ${isWishlist ? 'opacity-100' : 'opacity-70'}`}>Wishlist</span>
        {isWishlist && <span className="absolute -bottom-2 w-1 h-1 bg-indigo-600 rounded-full" />}
      </button>

      {/* Cart Center Button */}
      <div className="relative -top-8">
        <button
          onClick={() => setIsCartOpen(!isCartOpen)}
          className={`relative group p-4 rounded-full shadow-lg transform transition-all duration-300 hover:scale-105 active:scale-95 ${isCartOpen
            ? 'bg-gray-900 text-white ring-4 ring-gray-100 shadow-gray-200'
            : 'bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-indigo-200 ring-4 ring-white'
            }`}
        >
          <ShoppingCart className={`w-7 h-7 transition-transform duration-500 ${isCartOpen ? 'rotate-12' : ''}`} />
          {cart.length > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center border-2 border-white shadow-sm scale-100 animate-bounce-short">
              {cart.length}
            </span>
          )}
        </button>
      </div>

      {/* Support Button */}
      <button
        onClick={() => document.dispatchEvent(new CustomEvent('toggle-support-chat'))}
        className="relative flex flex-col items-center gap-1 transition-all duration-300 text-gray-400 hover:text-gray-600"
      >
        <div className="p-2 rounded-2xl transition-all duration-300">
          <MessageCircle className="w-6 h-6" />
        </div>
        <span className="text-[10px] font-bold opacity-70">Support</span>
      </button>

      {user ? (
        <button
          onClick={() => navigate('/profile')}
          className={`relative flex flex-col items-center gap-1 transition-all duration-300 ${isProfile ? 'text-indigo-600 -translate-y-1' : 'text-gray-400 hover:text-gray-600'}`}
        >
          <div className={`p-2 rounded-2xl transition-all duration-300 ${isProfile ? 'bg-indigo-50 shadow-sm' : ''}`}>
            <UserIcon className={`w-6 h-6 transition-all duration-300 ${isProfile ? 'fill-indigo-600' : ''}`} />
          </div>
          <span className={`text-[10px] font-bold transition-all duration-300 ${isProfile ? 'opacity-100' : 'opacity-70'}`}>Profile</span>
          {isProfile && <span className="absolute -bottom-2 w-1 h-1 bg-indigo-600 rounded-full" />}
        </button>
      ) : (
        <button
          onClick={() => navigate('/login')}
          className={`relative flex flex-col items-center gap-1 transition-all duration-300 ${location.pathname === '/login' ? 'text-indigo-600 -translate-y-1' : 'text-gray-400 hover:text-gray-600'}`}
        >
          <div className={`p-2 rounded-2xl transition-all duration-300 ${location.pathname === '/login' ? 'bg-indigo-50 shadow-sm' : ''}`}>
            <UserIcon className="w-6 h-6" />
          </div>
          <span className={`text-[10px] font-bold transition-all duration-300 ${location.pathname === '/login' ? 'opacity-100' : 'opacity-70'}`}>Login</span>
          {location.pathname === '/login' && <span className="absolute -bottom-2 w-1 h-1 bg-indigo-600 rounded-full" />}
        </button>
      )}
    </div>
  );
};

const Layout: React.FC = () => {
  const location = useLocation();
  const isSpecialPage = location.pathname === '/admin/login';

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900 pb-20">
      {!isSpecialPage && <Navbar />}
      {!isSpecialPage && <CartSidebar />}
      {!isSpecialPage && <ChatWidget />}
      {!isSpecialPage && <MobileBottomNav />}
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/product/:id" element={<ProductDetailsPage />} />
        <Route path="/checkout" element={<CheckoutPage />} />
        <Route path="/profile" element={<UserProfile />} />
        <Route path="/admin" element={<AdminDashboard />} />
      </Routes>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <HashRouter>
      <AuthProvider>
        <ShopProvider>
          <Layout />
        </ShopProvider>
      </AuthProvider>
    </HashRouter>
  );
};

export default App;