import { db as firestore } from './firebaseConfig';
import {
  collection, doc, getDocs, getDoc, setDoc, addDoc, updateDoc, deleteDoc,
  query, where, orderBy, serverTimestamp, getDocFromCache, onSnapshot
} from "firebase/firestore";
import { Product, User, Order, Review, Address, ChatMessage, ShopSettings, Category, Popup } from '../types';

const STORAGE_KEYS = {
  USER: 'techstore_user',
};

export class FirebaseService {

  // ... (previous methods)



  // --- Category Methods ---
  async getCategories(): Promise<Category[]> {
    const q = query(collection(firestore, 'categories'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category));
  }

  async addCategory(cat: Omit<Category, 'id'>): Promise<void> {
    await addDoc(collection(firestore, 'categories'), cat);
  }

  async deleteCategory(id: string): Promise<void> {
    await deleteDoc(doc(firestore, 'categories', id));
  }

  // --- Popup Methods ---
  async getPopups(): Promise<Popup[]> {
    const q = query(collection(firestore, 'popups'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Popup));
  }

  async addPopup(popup: Omit<Popup, 'id'>): Promise<void> {
    await addDoc(collection(firestore, 'popups'), popup);
  }

  async deletePopup(id: string): Promise<void> {
    await deleteDoc(doc(firestore, 'popups', id));
  }

  async togglePopup(id: string): Promise<void> {
    const docRef = doc(firestore, 'popups', id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data() as Popup;
      await updateDoc(docRef, { isActive: !data.isActive });
    }
  }

  // --- Product Methods ---
  async getProducts(): Promise<Product[]> {
    const q = query(collection(firestore, 'products'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
  }

  async getProductById(id: string): Promise<Product | undefined> {
    const docRef = doc(firestore, 'products', id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as Product;
    }
    return undefined;
  }

  async addProduct(product: Partial<Product>): Promise<Product> {
    const newProductData = {
      name: product.name || 'Untitled',
      description: product.description || '',
      price: product.price || 0,
      offerPrice: product.offerPrice || null,
      category: product.category || 'General',
      imageUrl: product.imageUrl || '',
      images: product.images || [product.imageUrl || ''],
      stock: product.stock || 0,
      rating: 0,
      reviews: [],
      videoUrl: product.videoUrl || ''
    };
    const docRef = await addDoc(collection(firestore, 'products'), newProductData);
    return { id: docRef.id, ...newProductData } as Product;
  }

  async updateProduct(id: string, updates: Partial<Product>): Promise<Product> {
    const docRef = doc(firestore, 'products', id);
    await updateDoc(docRef, updates);
    const updatedSnap = await getDoc(docRef);
    return { id: updatedSnap.id, ...updatedSnap.data() } as Product;
  }

  async deleteProduct(id: string): Promise<void> {
    await deleteDoc(doc(firestore, 'products', id));
  }

  async addReview(productId: string, review: Omit<Review, 'id' | 'date'>): Promise<Product> {
    const docRef = doc(firestore, 'products', productId);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) throw new Error('Product not found');

    const product = docSnap.data() as Product;
    const newReview: Review = {
      ...review,
      id: Math.random().toString(36).substr(2, 9),
      date: Date.now()
    };

    const updatedReviews = [...(product.reviews || []), newReview];
    const totalRating = updatedReviews.reduce((acc, r) => acc + r.rating, 0);
    const newRating = totalRating / updatedReviews.length;

    await updateDoc(docRef, { reviews: updatedReviews, rating: newRating });
    return { ...product, id: productId, reviews: updatedReviews, rating: newRating };
  }

  async deleteReview(productId: string, reviewId: string): Promise<Product> {
    const docRef = doc(firestore, 'products', productId);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) throw new Error('Product not found');

    const product = docSnap.data() as Product;
    const updatedReviews = (product.reviews || []).filter(r => r.id !== reviewId);

    const totalRating = updatedReviews.reduce((acc, r) => acc + r.rating, 0);
    const newRating = updatedReviews.length > 0 ? totalRating / updatedReviews.length : 0;

    await updateDoc(docRef, { reviews: updatedReviews, rating: newRating });
    return { ...product, id: productId, reviews: updatedReviews, rating: newRating };
  }

  // --- Order Methods ---
  async createOrder(
    userId: string,
    items: any[],
    total: number,
    shippingDetails: Address,
    paymentMethod: 'Card' | 'COD',
    deliveryFee: number = 0,
    customerEmail?: string,
    customerPhone?: string
  ): Promise<Order> {
    const newOrderData = {
      userId,
      items,
      totalAmount: total,
      deliveryFee,
      status: 'Pending',
      statusHistory: [{ status: 'Pending', comment: 'Order placed successfully', timestamp: Date.now() }],
      createdAt: Date.now(),
      shippingDetails,
      paymentMethod,
      customerEmail,
      customerPhone
    };
    const docRef = await addDoc(collection(firestore, 'orders'), newOrderData);

    // Also use the Doc ID as the Order ID if possible, or we can let Firestore gen ID
    // The previous implementation used a random string ID. Firestore ID is random string too.
    return { id: docRef.id, ...newOrderData } as Order;
  }

  async getOrders(userId?: string): Promise<Order[]> {
    let q;
    if (userId) {
      // Remove orderBy to avoid needing a composite index immediately. Sort client-side.
      q = query(collection(firestore, 'orders'), where('userId', '==', userId));
    } else {
      q = query(collection(firestore, 'orders'), orderBy('createdAt', 'desc'));
    }
    const snapshot = await getDocs(q);
    const orders = snapshot.docs.map(doc => {
      const data = doc.data() as any;
      return { id: doc.id, ...data } as Order;
    });
    // Client-side sort
    return orders.sort((a, b) => b.createdAt - a.createdAt);
  }

  async updateOrderStatus(orderId: string, status: Order['status'], comment?: string): Promise<void> {
    const docRef = doc(firestore, 'orders', orderId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const order = docSnap.data() as Order;
      const history = order.statusHistory || [];
      history.push({
        status,
        comment,
        timestamp: Date.now()
      });
      await updateDoc(docRef, {
        status,
        adminComment: comment,
        statusHistory: history
      });
    }
  }

  async cancelOrder(orderId: string): Promise<boolean> {
    const docRef = doc(firestore, 'orders', orderId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) return false;

    const order = docSnap.data() as Order;
    const timeDiff = Date.now() - order.createdAt;
    const hoursDiff = timeDiff / (1000 * 60 * 60);

    if (hoursDiff > 24 || order.status !== 'Pending') {
      return false;
    }

    const history = order.statusHistory || [];
    history.push({ status: 'Cancelled', comment: 'Cancelled by user', timestamp: Date.now() });

    await updateDoc(docRef, { status: 'Cancelled', statusHistory: history });
    return true;
  }

  // --- Address Book (User) Methods ---
  async saveAddress(user: User, address: Omit<Address, 'id'>): Promise<User> {
    const newAddress: Address = { ...address, id: Math.random().toString(36).substr(2, 9) };
    const updatedAddresses = [...(user.addresses || []), newAddress];

    // Update Firestore using direct document reference
    const docRef = doc(firestore, 'users', user.id);
    await updateDoc(docRef, { addresses: updatedAddresses });

    const updatedUser = { ...user, addresses: updatedAddresses };
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(updatedUser));
    return updatedUser;
  }

  async deleteAddress(user: User, addressId: string): Promise<User> {
    const updatedAddresses = user.addresses.filter(a => a.id !== addressId);

    // Update Firestore using direct document reference
    const docRef = doc(firestore, 'users', user.id);
    await updateDoc(docRef, { addresses: updatedAddresses });

    const updatedUser = { ...user, addresses: updatedAddresses };
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(updatedUser));
    return updatedUser;
  }

  // --- Chat Methods ---
  async sendMessage(userId: string, text: string, sender: 'user' | 'admin'): Promise<void> {
    await addDoc(collection(firestore, 'chats'), {
      userId,
      sender,
      text,
      timestamp: Date.now(),
      read: false
    });
  }

  // Subscribe to messages for a specific user (for UserProfile and Admin Chat view)
  subscribeToChat(userId: string, callback: (messages: ChatMessage[]) => void): () => void {
    const q = query(collection(firestore, 'chats'), where('userId', '==', userId), orderBy('timestamp', 'asc'));
    return onSnapshot(q, (snapshot) => {
      const messages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ChatMessage));
      callback(messages);
    });
  }

  // Subscribe to all chats to get the list of active users (for AdminDashboard list)
  subscribeToAllChats(callback: (chats: { userId: string, lastMessage: ChatMessage }[]) => void): () => void {
    const q = query(collection(firestore, 'chats'), orderBy('timestamp', 'desc'));
    return onSnapshot(q, (snapshot) => {
      const messages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ChatMessage));
      const uniqueUsers = Array.from(new Set(messages.map(m => m.userId)));

      const chats = uniqueUsers.map(uid => {
        const userMsgs = messages.filter(m => m.userId === uid);
        return { userId: uid, lastMessage: userMsgs[0] };
      });
      callback(chats);
    });
  }

  async getMessages(userId: string): Promise<ChatMessage[]> {
    const q = query(collection(firestore, 'chats'), where('userId', '==', userId), orderBy('timestamp', 'asc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ChatMessage));
  }

  async getAllChats(): Promise<{ userId: string, lastMessage: ChatMessage }[]> {
    const q = query(collection(firestore, 'chats'), orderBy('timestamp', 'desc'));
    const snapshot = await getDocs(q);
    const messages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ChatMessage));

    const users = Array.from(new Set(messages.map(m => m.userId)));
    return users.map(uid => {
      const userMsgs = messages.filter(m => m.userId === uid);
      return { userId: uid, lastMessage: userMsgs[0] };
    });
  }

  async markAsRead(messageId: string): Promise<void> {
    const docRef = doc(firestore, 'chats', messageId);
    await updateDoc(docRef, { read: true, readAt: Date.now() });
  }

  // --- Settings Methods ---
  async getSettings(): Promise<ShopSettings> {
    const docRef = doc(firestore, 'settings', 'main');
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data() as ShopSettings;
    }
    const defaultSettings: ShopSettings = {
      shopName: 'TechMart LK',
      address: 'No. 123, High Level Road, Colombo 06',
      phone: '+94 11 234 5678',
      whatsapp: '94771234567',
      homeBannerUrl: '',
      bannerImages: []
    };
    // Initialize if missing
    await setDoc(docRef, defaultSettings);
    return defaultSettings;
  }

  async updateSettings(settings: ShopSettings): Promise<ShopSettings> {
    await setDoc(doc(firestore, 'settings', 'main'), settings);
    return settings;
  }

  // --- Auth Methods ---
  async login(email: string, password?: string): Promise<User> {
    if (!password) throw new Error("Password is required");

    // 1. Auth with Firebase
    const { signInWithEmailAndPassword } = await import("firebase/auth");
    const { auth } = await import("./firebaseConfig");
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const { uid } = userCredential.user;

    // 2. Get User Profile from Firestore
    // We assume the Firestore Doc ID is the same as Auth UID (best practice)
    // OR we query by email if we didn't enforce UID=DocID previously.
    // For migration safety, let's query by email first, if not found try UID.

    const q = query(collection(firestore, 'users'), where('email', '==', email));
    const snapshot = await getDocs(q);

    let user: User;

    if (!snapshot.empty) {
      const userData = snapshot.docs[0].data() as User;
      user = { ...userData, id: snapshot.docs[0].id } as User;
    } else {
      // Fallback: Check by Doc ID = UID
      const docRef = doc(firestore, 'users', uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        user = { id: docSnap.id, ...docSnap.data() } as User;
      } else {
        throw new Error("User profile not found in database.");
      }
    }

    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
    return user;
  }

  async register(name: string, email: string, phone: string, password?: string): Promise<User> {
    if (!password) throw new Error("Password is required");

    // 1. Create Auth User
    const { createUserWithEmailAndPassword } = await import("firebase/auth");
    const { auth } = await import("./firebaseConfig");
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const { uid } = userCredential.user;

    // 2. Create Profile in Firestore
    // Assign role 'customer' by default. Admin must be manually updated in DB or via separate flow.
    const newUser: User = {
      id: uid, // Use Auth UID as the User ID
      email,
      name,
      role: 'customer',
      addresses: [],
      wishlist: [],
      phone // Added phone to type if needed, but strict type might not have it. 
      // The Interface User has: id, email, name, role, addresses, wishlist.
      // Phone is inside Address, but passed here? 
      // The Register form collects phone. We should store it.
      // Let's add it to the doc, even if type doesn't strictly enforce it yet (Typescript allows extra props if casted or strictness loose)
      // Or better, add it to 'addresses' as a default contact? Or just store it.
    };

    // Store with UID as document ID
    await setDoc(doc(firestore, 'users', uid), newUser);

    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(newUser));
    return newUser;
  }

  getCurrentUser(): User | null {
    const data = localStorage.getItem(STORAGE_KEYS.USER);
    return data ? JSON.parse(data) : null;
  }

  async logout() {
    const { signOut } = await import("firebase/auth");
    const { auth } = await import("./firebaseConfig");
    await signOut(auth);
    localStorage.removeItem(STORAGE_KEYS.USER);
  }
}

export const db = new FirebaseService();