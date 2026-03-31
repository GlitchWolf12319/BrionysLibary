import * as React from "react";
import { useState, useEffect, FormEvent, useMemo, Component, ErrorInfo, ReactNode, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Plus, 
  Library, 
  CheckCircle2, 
  Circle, 
  Trash2, 
  Edit3,
  X,
  ChevronRight,
  BookOpen,
  Settings2,
  MoreVertical,
  ArrowRight,
  Calendar as CalendarIcon,
  Heart,
  ChevronLeft,
  MessageSquare,
  Save,
  ShoppingBag,
  Barcode,
  Loader2,
  LogOut,
  LogIn,
  User as UserIcon,
  Flame,
  Check,
  Upload,
  Image as ImageIcon,
  AlertTriangle,
  Zap,
  Search,
  Star,
  GripVertical,
  Edit2
} from "lucide-react";

import { 
  format, 
  addMonths, 
  subMonths, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  isSameMonth, 
  isSameYear,
  isSameDay, 
  addDays, 
  eachDayOfInterval,
  parseISO
} from "date-fns";
import { debounce } from "lodash";
import { arrayMove } from '@dnd-kit/sortable';
import { Book, Series, Chapter } from "./types";
import BarcodeScanner from "./components/BarcodeScanner";
import { auth, db, signInWithGoogle, logOut, handleFirestoreError, OperationType } from "./firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import { collection, doc, setDoc, deleteDoc, onSnapshot, query, where, updateDoc, writeBatch } from "firebase/firestore";

type Tab = "collections" | "calendar" | "wishlist" | "dragons";

const ProgressInput = ({ bookId, currentPage, totalPages, onUpdate }: { bookId: string, currentPage: number, totalPages: number, onUpdate: (id: string, page: number) => void }) => {
  const [localValue, setLocalValue] = useState(currentPage.toString());
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    setLocalValue(currentPage.toString());
  }, [currentPage]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalValue(e.target.value);
    setIsEditing(true);
  };

  const handleSave = () => {
    const val = Math.min(Math.max(0, parseInt(localValue) || 0), totalPages);
    if (val !== currentPage) {
      onUpdate(bookId, val);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSave();
      e.currentTarget.blur();
    }
  };

  const progress = totalPages > 0 ? (currentPage / totalPages) * 100 : 0;

  return (
    <div className="relative flex items-center gap-3 group">
      <div className="relative flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <input 
            type="number"
            min="0"
            max={totalPages}
            value={localValue}
            onClick={(e) => e.stopPropagation()}
            onFocus={() => setIsEditing(true)}
            onChange={handleChange}
            onBlur={handleSave}
            onKeyDown={handleKeyDown}
            className="w-14 md:w-16 bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-[11px] md:text-xs text-white focus:border-accent focus:ring-1 focus:ring-accent/30 outline-none font-mono transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none text-center"
          />
          <span className="text-[10px] text-text-muted font-bold uppercase tracking-widest">/ {totalPages}</span>
        </div>
        <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            className="h-full bg-accent shadow-[0_0_8px_rgba(255,99,33,0.5)]"
          />
        </div>
      </div>
    </div>
  );
};

const BookCard: React.FC<{ 
  book: Book; 
  onClick: () => void; 
  updateProgress: (id: string, page: number) => void;
  onMove: (direction: 'left' | 'right') => void;
  isFirst: boolean;
  isLast: boolean;
}> = ({ book, onClick, updateProgress, onMove, isFirst, isLast }) => {
  const isRead = book.currentPage >= book.totalPages && book.totalPages > 0;

  return (
    <div
      className="card p-2 flex flex-col gap-2 group/book relative cursor-pointer hover:border-accent transition-all"
      onClick={onClick}
    >
      <div className="aspect-[2/3] w-full rounded-lg overflow-hidden border border-border relative group/cover">
        <img src={book.coverUrl} className={`w-full h-full object-cover ${isRead ? 'grayscale opacity-40' : ''}`} referrerPolicy="no-referrer" />
        
        {/* Move Arrows */}
        <div className="absolute inset-0 flex items-center justify-between px-1 opacity-0 group-hover/cover:opacity-100 md:group-hover/cover:opacity-100 transition-opacity pointer-events-none">
          {!isFirst && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onMove('left');
              }}
              className="p-1.5 bg-black/60 hover:bg-accent text-white rounded-full transition-all pointer-events-auto shadow-lg backdrop-blur-sm"
              title="Move Left"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
          <div className="flex-1" />
          {!isLast && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onMove('right');
              }}
              className="p-1.5 bg-black/60 hover:bg-accent text-white rounded-full transition-all pointer-events-auto shadow-lg backdrop-blur-sm"
              title="Move Right"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
      <div className="space-y-1 min-w-0">
        <div className="flex justify-between items-start gap-1">
          <div className="min-w-0">
            <h3 className={`font-serif text-[11px] md:text-sm leading-tight truncate ${isRead ? 'text-text-muted line-through' : 'text-white'}`}>
              {book.title}
            </h3>
            <p className="text-[9px] md:text-xs text-text-muted italic truncate">{book.author}</p>
          </div>
        </div>
        
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <ProgressInput 
              bookId={book.id}
              currentPage={book.currentPage}
              totalPages={book.totalPages}
              onUpdate={updateProgress}
            />
            <span className="text-[8px] md:text-[10px] text-accent font-bold">
              {Math.round((book.currentPage / book.totalPages) * 100) || 0}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

const StarRating = ({ rating, onRate, size = "md", interactive = true }: { rating: number, onRate: (rating: number) => void, size?: "sm" | "md" | "lg", interactive?: boolean }) => {
  const sizes = {
    sm: "w-3 h-3 md:w-4 h-4",
    md: "w-5 h-5 md:w-6 h-6",
    lg: "w-7 h-7 md:w-8 h-8"
  };

  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={!interactive}
          onClick={(e) => {
            e.stopPropagation();
            if (interactive) onRate(star);
          }}
          className={`${interactive ? 'cursor-pointer hover:scale-110 active:scale-95' : 'cursor-default'} focus:outline-none transition-all`}
        >
          <Star 
            className={`${sizes[size]} ${star <= rating ? 'fill-accent text-accent' : 'text-text-muted/30'} transition-colors`} 
          />
        </button>
      ))}
    </div>
  );
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [books, setBooks] = useState<Book[]>([]);
  const [seriesList, setSeriesList] = useState<Series[]>([]);
  
  const [activeTab, setActiveTab] = useState<Tab>("collections");
  const [isScanning, setIsScanning] = useState(false);
  const [isFetchingBook, setIsFetchingBook] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditingBookDetail, setIsEditingBookDetail] = useState(false);
  const [editedBook, setEditedBook] = useState<Book | null>(null);

  const moveBook = async (book: Book, direction: 'left' | 'right', seriesBooks: Book[]) => {
    const currentIndex = seriesBooks.findIndex(b => b.id === book.id);
    const newIndex = direction === 'left' ? currentIndex - 1 : currentIndex + 1;

    if (newIndex < 0 || newIndex >= seriesBooks.length) return;

    const newOrder = arrayMove(seriesBooks, currentIndex, newIndex) as Book[];

    // Update priorities in Firestore
    const batch = writeBatch(db);
    newOrder.forEach((b, index) => {
      const bookRef = doc(db, "books", b.id);
      batch.update(bookRef, { priority: index });
    });
    
    try {
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, "books");
    }
  };

  const handleUpdateBook = async () => {
    if (!editedBook) return;
    setIsSaving(true);
    try {
      const bookRef = doc(db, "books", editedBook.id);
      await updateDoc(bookRef, {
        title: editedBook.title,
        author: editedBook.author,
        totalPages: editedBook.totalPages,
        currentPage: editedBook.currentPage,
        coverUrl: editedBook.coverUrl,
        rating: editedBook.rating,
        seriesId: editedBook.seriesId,
      });
      setSelectedBookForDetail(editedBook);
      setIsEditingBookDetail(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, "books");
    } finally {
      setIsSaving(false);
    }
  };
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {},
  });
  const [authError, setAuthError] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [selectedBookForDetail, setSelectedBookForDetail] = useState<Book | null>(null);
  const [isAddChapterModalOpen, setIsAddChapterModalOpen] = useState(false);
  const [newChapterData, setNewChapterData] = useState({ title: "", notes: "" });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        if (isEditingBookDetail && editedBook) {
          setEditedBook({ ...editedBook, coverUrl: base64 });
        } else if (selectedBookForDetail) {
          try {
            await updateDoc(doc(db, "books", selectedBookForDetail.id), { coverUrl: base64 });
            setSelectedBookForDetail(prev => prev ? { ...prev, coverUrl: base64 } : null);
          } catch (error) {
            handleFirestoreError(error, OperationType.UPDATE, "books");
          }
        } else {
          setNewBook(prev => ({ ...prev, coverUrl: base64 }));
        }
      };
      reader.readAsDataURL(file);
      e.target.value = '';
    }
  };

  const currentBookDetail = books.find(b => b.id === selectedBookForDetail?.id);

  const [newBook, setNewBook] = useState({
    title: "",
    author: "",
    isbn: "",
    totalPages: 0,
    seriesId: "",
    isBought: true,
    isWishlist: false,
    isDragonBook: false,
    coverUrl: "",
    chapters: [] as Chapter[],
    rating: 0,
  });

  const [newSeries, setNewSeries] = useState({
    title: "",
    description: "",
    color: "#e6a8d7",
  });

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    setAuthError(null);
    try {
      await signInWithGoogle();
    } catch (error: any) {
      console.error("Login Error:", error);
      if (error.code === 'auth/unauthorized-domain') {
        setAuthError(`This domain (${window.location.hostname}) is not authorized in your Firebase project. \n\nTo fix this:\n1. Go to the Firebase Console\n2. Navigate to Authentication > Settings > Authorized domains\n3. Add "${window.location.hostname}" to the list.`);
      } else if (error.code === 'auth/account-exists-with-different-credential') {
        setAuthError("An account already exists with the same email address but different sign-in credentials. Please try signing in with the provider you used originally.");
      } else if (error.code === 'auth/popup-blocked') {
        setAuthError("The sign-in popup was blocked by your browser. Please allow popups for this site and try again.");
      } else if (error.code === 'auth/cancelled-popup-request') {
        // User closed the popup, no need for a loud error message
        setAuthError(null);
      } else {
        setAuthError(`Sign-in failed: ${error.message || "Unknown error"}. Please check your Firebase configuration and console for details.`);
      }
    }
  };

  // Firestore Sync - Series
  useEffect(() => {
    if (!isAuthReady || !user) {
      setSeriesList([]);
      return;
    }

    const q = query(collection(db, "series"), where("uid", "==", user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Series));
      setSeriesList(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "series");
    });

    return () => unsubscribe();
  }, [isAuthReady, user]);

  // Firestore Sync - Books
  useEffect(() => {
    if (!isAuthReady || !user) {
      setBooks([]);
      return;
    }

    const q = query(collection(db, "books"), where("uid", "==", user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Book));
      setBooks(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "books");
    });

    return () => unsubscribe();
  }, [isAuthReady, user]);

  const fetchBookByISBN = async (isbn: string, customCoverUrl?: string, initialPages?: number) => {
    setIsFetchingBook(true);
    setFetchError("");
    console.log("Fetching book for ISBN:", isbn);
    try {
      // Clean ISBN
      const cleanIsbn = isbn.replace(/[-\s]/g, "");
      console.log("Cleaned ISBN:", cleanIsbn);
      
      // Try Google Books API first with ISBN
      let response = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${cleanIsbn}`);
      let data = await response.json();
      console.log("Google Books API response:", data);
      
      let title = "";
      let author = "";
      let totalPages = initialPages || 0;
      let coverUrl = customCoverUrl || "";

      if (data.items && data.items.length > 0) {
        // Sort items to find one with pageCount and imageLinks if possible
        const sortedItems = [...data.items].sort((a, b) => {
          const aScore = (a.volumeInfo?.pageCount ? 2 : 0) + (a.volumeInfo?.imageLinks ? 1 : 0);
          const bScore = (b.volumeInfo?.pageCount ? 2 : 0) + (b.volumeInfo?.imageLinks ? 1 : 0);
          return bScore - aScore;
        });

        const bookInfo = sortedItems[0].volumeInfo;
        title = bookInfo.title || "";
        author = bookInfo.authors ? bookInfo.authors.join(", ") : "";
        totalPages = bookInfo.pageCount || initialPages || 0;
        
        if (!coverUrl && bookInfo.imageLinks) {
          const links = bookInfo.imageLinks;
          // Try to get the largest available image, ensuring HTTPS
          const rawUrl = links.extraLarge || links.large || links.medium || links.small || links.thumbnail || links.smallThumbnail || "";
          coverUrl = rawUrl.replace('http:', 'https:');
          
          // If it's a Google Books URL, we can often request a higher quality version
          if (coverUrl.includes('books.google.com')) {
            const url = new URL(coverUrl);
            url.searchParams.set('zoom', '3'); // Try for highest quality zoom level (3 is usually large)
            url.searchParams.delete('edge');   // Remove edge effects like curled corners
            coverUrl = url.toString();
          }
        }
      }

      // Try to get a high-resolution cover from OpenLibrary directly as it's often better than Google's thumbnails
      if (!coverUrl || coverUrl.includes('zoom=1') || coverUrl.includes('zoom=5')) {
        console.log("Attempting to fetch high-res cover from OpenLibrary API...");
        const olCoverUrl = `https://covers.openlibrary.org/b/isbn/${cleanIsbn}-L.jpg?default=false`;
        try {
          const checkRes = await fetch(olCoverUrl, { method: 'HEAD' });
          if (checkRes.ok) {
            console.log("High-res OpenLibrary cover found!");
            coverUrl = olCoverUrl;
          }
        } catch (e) {
          console.log("OpenLibrary cover check failed, sticking with current cover.");
        }
      }

      // Try OpenLibrary for more details or as a fallback for other data
      try {
        console.log("Trying OpenLibrary fallback for metadata...");
        const olResponse = await fetch(`https://openlibrary.org/api/books?bibkeys=ISBN:${cleanIsbn}&format=json&jscmd=data`);
        const olData = await olResponse.json();
        const olKey = `ISBN:${cleanIsbn}`;
        const olBook = olData[olKey];
        
        if (olBook) {
          console.log("OpenLibrary data found:", olBook);
          if (!title) title = olBook.title || "";
          if (!author && olBook.authors) author = olBook.authors.map((a: any) => a.name).join(", ");
          if (totalPages === 0) {
            totalPages = olBook.number_of_pages || (olBook.pagination ? parseInt(olBook.pagination.replace(/\D/g, '')) : 0);
          }
          // Only overwrite cover if we don't have a good one yet or if OL specifically has a large one
          if ((!coverUrl || coverUrl.includes('zoom=1')) && olBook.cover) {
            coverUrl = olBook.cover.large || olBook.cover.medium || olBook.cover.small;
          }
        }
      } catch (olError) {
        console.error("OpenLibrary metadata fetch failed:", olError);
      }

      // If still no page count or cover, try a broader search on Google Books using title/author
      if ((totalPages === 0 || !coverUrl) && (title || author)) {
        console.log("Broadening search on Google Books...");
        const query = encodeURIComponent(title + (author ? " " + author : ""));
        const searchResponse = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${query}&maxResults=5`);
        const searchData = await searchResponse.json();
        if (searchData.items) {
          // Find the best match that has pageCount and imageLinks
          const bestMatch = searchData.items.find((item: any) => item.volumeInfo.pageCount && item.volumeInfo.imageLinks) || searchData.items[0];
          if (bestMatch) {
            const info = bestMatch.volumeInfo;
            if (!title) title = info.title;
            if (!author && info.authors) author = info.authors.join(", ");
            if (totalPages === 0) totalPages = info.pageCount || 0;
            if (!coverUrl && info.imageLinks) {
              const links = info.imageLinks;
              const rawUrl = links.extraLarge || links.large || links.medium || links.small || links.thumbnail || links.smallThumbnail || "";
              coverUrl = rawUrl.replace('http:', 'https:');
              if (coverUrl.includes('books.google.com')) {
                const url = new URL(coverUrl);
                url.searchParams.set('zoom', '1');
                url.searchParams.delete('edge');
                coverUrl = url.toString();
              }
            }
          }
        }
      }

      if (title || author || totalPages > 0) {
        console.log("Updating newBook state with:", { title, author, totalPages, coverUrl });
        setNewBook(prev => ({
          ...prev,
          title: title || prev.title,
          author: author || prev.author,
          totalPages: totalPages || prev.totalPages,
          isbn: cleanIsbn || prev.isbn,
          coverUrl: coverUrl || prev.coverUrl || `https://picsum.photos/seed/${cleanIsbn}/400/600`
        }));
        setIsScanning(false);
      } else {
        console.warn("No book data found for ISBN:", cleanIsbn);
        setFetchError("Book not found. Please enter details manually.");
      }
    } catch (error) {
      console.error("Error fetching book data:", error);
      setFetchError("Failed to fetch book data. Please check your connection.");
    } finally {
      setIsFetchingBook(false);
    }
  };
  const [isAddBookModalOpen, setIsAddBookModalOpen] = useState(false);
  const [isSeriesModalOpen, setIsSeriesModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isSelectSeriesModalOpen, setIsSelectSeriesModalOpen] = useState(false);
  const [bookToMove, setBookToMove] = useState<Book | null>(null);
  const [editingSeries, setEditingSeries] = useState<Series | null>(null);
  const [selectedSeriesId, setSelectedSeriesId] = useState<string | null>(null);
  const [editingBookNotes, setEditingBookNotes] = useState<Book | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // CRUD Operations
  const handleAddBook = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsSaving(true);
    const bookId = doc(collection(db, "books")).id;
    const book: Book = {
      id: bookId,
      ...newBook,
      coverUrl: newBook.coverUrl || `https://picsum.photos/seed/${newBook.title}/400/600`,
      currentPage: 0,
      priority: books.length,
      uid: user.uid
    };

    try {
      await setDoc(doc(db, "books", bookId), book);
      setIsAddBookModalOpen(false);
      setNewBook({ title: "", author: "", isbn: "", totalPages: 0, seriesId: "", isBought: true, isWishlist: false, isDragonBook: false, coverUrl: "", chapters: [], rating: 0 });
      setFetchError(null);
    } catch (error: any) {
      console.error("Add Book Error:", error);
      setFetchError("Failed to add book. Please check your connection and try again.");
      // We don't throw here so the modal stays open for the user to try again
      try {
        handleFirestoreError(error, OperationType.CREATE, "books");
      } catch (e) {
        // handleFirestoreError throws, but we already handled the UI part
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveSeries = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsSaving(true);
    if (editingSeries) {
      try {
        await updateDoc(doc(db, "series", editingSeries.id), { ...newSeries });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, "series");
      }
    } else {
      const seriesId = doc(collection(db, "series")).id;
      const series: Series = {
        id: seriesId,
        ...newSeries,
        uid: user.uid
      };
      try {
        await setDoc(doc(db, "series", seriesId), series);
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, "series");
      }
    }
    setIsSeriesModalOpen(false);
    setEditingSeries(null);
    setNewSeries({ title: "", description: "", color: "#e6a8d7" });
    setIsSaving(false);
  };

  const deleteSeries = async (id: string) => {
    setIsSaving(true);
    try {
      await deleteDoc(doc(db, "series", id));
      // Update books that were in this series in parallel
      const batch = books.filter(b => b.seriesId === id);
      const updatePromises = batch.map(book => updateDoc(doc(db, "books", book.id), { seriesId: "" }));
      await Promise.all(updatePromises);
      
      if (selectedSeriesId === id) {
        setSelectedSeriesId(null);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, "series");
    } finally {
      setIsSaving(false);
    }
  };

  const purgeAllData = async () => {
    if (!user) return;
    
    setConfirmModal({
      isOpen: true,
      title: "PURGE ALL DATA",
      message: "WARNING: This will permanently delete ALL your books, collections, and reading history. This action cannot be undone. Are you absolutely sure?",
      onConfirm: async () => {
        try {
          // Delete all books
          const bookPromises = books.map(book => deleteDoc(doc(db, "books", book.id)));
          // Delete all series
          const seriesPromises = seriesList.map(series => deleteDoc(doc(db, "series", series.id)));
          
          await Promise.all([...bookPromises, ...seriesPromises]);
          
          // Clear local state
          setBooks([]);
          setSeriesList([]);
          setSelectedBookForDetail(null);
          setSelectedSeriesId(null);
          setIsSettingsModalOpen(false);
          
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        } catch (error) {
          console.error("Error purging data:", error);
          alert("Failed to purge some data. Please try again.");
        }
      }
    });
  };

  const deleteBook = async (id: string) => {
    try {
      await deleteDoc(doc(db, "books", id));
      if (selectedBookForDetail?.id === id) {
        setSelectedBookForDetail(null);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, "books");
    }
  };

  const addChapter = async (bookId: string, title: string, notes: string) => {
    const book = books.find(b => b.id === bookId);
    if (!book) return;

    const newChapter: Chapter = {
      id: `chapter-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      title: title || `Chapter ${(book.chapters?.length || 0) + 1}`,
      notes: notes || ""
    };

    const updatedChapters = [...(book.chapters || []), newChapter];
    try {
      await updateDoc(doc(db, "books", bookId), { chapters: updatedChapters });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, "books");
    }
  };

  const handleAddChapter = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedBookForDetail) return;
    
    await addChapter(selectedBookForDetail.id, newChapterData.title, newChapterData.notes);
    setIsAddChapterModalOpen(false);
    setNewChapterData({ title: "", notes: "" });
  };

  const updateChapter = async (bookId: string, chapterId: string, updates: Partial<Chapter>) => {
    const book = books.find(b => b.id === bookId);
    if (!book || !book.chapters) return;

    const updatedChapters = book.chapters.map(c => 
      c.id === chapterId ? { ...c, ...updates } : c
    );

    try {
      await updateDoc(doc(db, "books", bookId), { chapters: updatedChapters });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, "books");
    }
  };

  const deleteChapter = async (bookId: string, chapterId: string) => {
    const book = books.find(b => b.id === bookId);
    if (!book || !book.chapters) return;

    const updatedChapters = book.chapters.filter(c => c.id !== chapterId);

    try {
      await updateDoc(doc(db, "books", bookId), { chapters: updatedChapters });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, "books");
    }
  };

  const debouncedUpdate = useMemo(
    () => debounce(async (id: string, page: number, totalPages: number, finishedDate: string | null) => {
      const isFinished = page >= totalPages && totalPages > 0;
      try {
        await updateDoc(doc(db, "books", id), {
          currentPage: page,
          finishedDate: isFinished ? (finishedDate || new Date().toISOString()) : null
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, "books");
      }
    }, 500),
    []
  );

  const updateProgress = (id: string, page: number) => {
    const book = books.find(b => b.id === id);
    if (!book) return;

    const newPage = Math.max(0, Math.min(page, book.totalPages));
    if (newPage === book.currentPage) return;
    
    // Optimistically update local state
    setBooks(prev => prev.map(b => b.id === id ? { ...b, currentPage: newPage } : b));
    
    // Debounce the database update
    debouncedUpdate(id, newPage, book.totalPages, book.finishedDate);
  };

  const toggleRead = async (id: string) => {
    const b = books.find(book => book.id === id);
    if (!b) return;

    const isRead = b.currentPage >= b.totalPages;
    const newPage = isRead ? 0 : b.totalPages;
    
    try {
      await updateDoc(doc(db, "books", id), {
        currentPage: newPage,
        finishedDate: !isRead ? new Date().toISOString() : null
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, "books");
    }
  };

  const saveBookNotes = async (id: string, content: string) => {
    if (!content.trim()) return;
    const b = books.find(book => book.id === id);
    if (!b) return;

    const newEntry = {
      id: crypto.randomUUID(),
      date: new Date().toISOString(),
      content: content.trim()
    };

    try {
      await updateDoc(doc(db, "books", id), {
        journalEntries: [...(b.journalEntries || []), newEntry]
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, "books");
    }
  };

  const deleteJournalEntry = async (bookId: string, entryId: string) => {
    const b = books.find(book => book.id === bookId);
    if (!b) return;

    try {
      await updateDoc(doc(db, "books", bookId), {
        journalEntries: b.journalEntries?.filter(e => e.id !== entryId)
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, "books");
    }
  };

  const handleMoveToSeries = async (seriesId: string) => {
    if (!bookToMove) return;
    try {
      await updateDoc(doc(db, "books", bookToMove.id), { 
        isWishlist: false, 
        seriesId,
        totalPages: bookToMove.totalPages 
      });
      setIsSelectSeriesModalOpen(false);
      setBookToMove(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, "books");
    }
  };

  const finishedCount = useMemo(() => {
    return books.filter(b => b.currentPage >= b.totalPages && b.totalPages > 0).length;
  }, [books]);

  const finishedThisMonth = useMemo(() => {
    const now = new Date();
    return books.filter(b => {
      if (!b.finishedDate) return false;
      const d = new Date(b.finishedDate);
      return isSameMonth(d, now) && isSameYear(d, now);
    }).length;
  }, [books]);

  const finishedThisYear = useMemo(() => {
    const now = new Date();
    return books.filter(b => {
      if (!b.finishedDate) return false;
      const d = new Date(b.finishedDate);
      return isSameYear(d, now);
    }).length;
  }, [books]);

  const totalPagesRead = useMemo(() => {
    return books.filter(b => !b.isWishlist).reduce((acc, b) => acc + (b.currentPage || 0), 0);
  }, [books]);

  const wishlistBooks = useMemo(() => {
    return books.filter(b => b.isWishlist);
  }, [books]);

  const dragonBooks = useMemo(() => {
    return books.filter(b => b.isDragonBook);
  }, [books]);

  const ownedBooks = useMemo(() => {
    return books.filter(b => !b.isWishlist).sort((a, b) => (a.priority || 0) - (b.priority || 0));
  }, [books]);

  // Calendar logic
  const renderCalendar = () => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);
    const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl md:text-3xl font-serif font-bold text-white">{format(currentMonth, "MMMM yyyy")}</h2>
          <div className="flex gap-2">
            <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-2 text-text-muted hover:text-accent transition-colors">
              <ChevronLeft className="w-5 h-5 md:w-6 md:h-6" />
            </button>
            <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-2 text-text-muted hover:text-accent transition-colors">
              <ChevronRight className="w-5 h-5 md:w-6 md:h-6" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-px bg-border rounded-2xl md:rounded-3xl overflow-hidden border border-border shadow-2xl">
          {["S", "M", "T", "W", "T", "F", "S"].map((day, i) => (
            <div key={`${day}-${i}`} className="bg-surface p-2 md:p-4 text-center text-[8px] md:text-[10px] uppercase tracking-widest text-text-muted font-bold">
              {day}
            </div>
          ))}
          {calendarDays.map((day) => {
            const dayKey = day.toISOString();
            const booksWithActivityOnDay = books.filter(b => {
              const isFinishedToday = b.finishedDate && isSameDay(parseISO(b.finishedDate), day);
              const hasEntryToday = b.journalEntries?.some(e => isSameDay(parseISO(e.date), day));
              return isFinishedToday || hasEntryToday;
            });
            
            const isCurrentMonth = isSameMonth(day, monthStart);
            const isToday = isSameDay(day, new Date());

            return (
              <div 
                key={dayKey} 
                className={`min-h-[60px] sm:min-h-[100px] md:min-h-[140px] p-1 md:p-2 transition-colors relative ${isCurrentMonth ? 'bg-surface' : 'bg-bg/40 opacity-30'}`}
              >
                <span className={`text-[10px] md:text-xs font-mono ${isToday ? 'text-accent font-bold' : 'text-text-muted'}`}>
                  {format(day, "d")}
                </span>
                
                <div className="mt-1 md:mt-2 flex flex-wrap gap-0.5 md:gap-1">
                  {booksWithActivityOnDay.map(book => {
                    const series = seriesList.find(s => s.id === book.seriesId);
                    const entriesToday = book.journalEntries?.filter(e => isSameDay(parseISO(e.date), day)) || [];
                    const isFinishedToday = book.finishedDate && isSameDay(parseISO(book.finishedDate), day);

                    return (
                      <motion.div
                        key={`${book.id}-${dayKey}`}
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        onClick={() => setSelectedBookForDetail(book)}
                        className="w-5 h-8 sm:w-8 sm:h-12 md:w-12 md:h-18 rounded-[2px] md:rounded-sm overflow-hidden border border-bg shadow-lg cursor-pointer hover:scale-110 transition-transform relative group"
                        style={{ outline: series ? `1px solid ${series.color}` : 'none', outlineOffset: '1px' }}
                      >
                        <img src={book.coverUrl} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        <div className="absolute inset-0 bg-accent/20 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-0.5 md:gap-1">
                          {entriesToday.length > 0 && (
                            <div className="bg-accent text-bg text-[6px] md:text-[8px] font-bold px-0.5 md:px-1 rounded-full">
                              {entriesToday.length}
                            </div>
                          )}
                          {isFinishedToday && <CheckCircle2 className="w-3 h-3 md:w-4 md:h-4 text-white" />}
                        </div>
                        {series && (
                          <div 
                            className="absolute bottom-0 left-0 right-0 h-0.5 md:h-1" 
                            style={{ backgroundColor: series.color }}
                          />
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-bg selection:bg-accent/30 flex flex-col">
      {/* Hero Section */}
      <section className="relative pt-12 md:pt-20 pb-8 md:pb-12 px-6 overflow-hidden">
        <div className="max-w-6xl mx-auto relative z-10">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 md:gap-12">
            <div className="space-y-4 md:space-y-6 flex-1">
              <div className="flex items-center gap-6 mb-2">
                <span className="font-sans text-[10px] md:text-xs uppercase tracking-[0.2em] text-accent font-bold">
                  {activeTab === "collections" ? "Your Library" : activeTab === "calendar" ? "Reading Log" : "Wishlist"}
                </span>
                <div className="h-px flex-1 bg-border/40" />
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl md:text-6xl font-serif font-black text-accent">{finishedCount}</span>
                  <span className="text-[8px] md:text-[10px] uppercase tracking-widest opacity-40">Finished Books</span>
                </div>
              </div>
              <h1 className="text-5xl md:text-8xl font-serif font-black tracking-tight text-white leading-tight">
                {activeTab === "collections" ? (
                  <>Reading <br /><span className="italic text-accent">Collections</span></>
                ) : activeTab === "calendar" ? (
                  <>Reading <br /><span className="italic text-accent">Calendar</span></>
                ) : activeTab === "dragons" ? (
                  <>Dragon <br /><span className="italic text-accent">Books</span></>
                ) : (
                  <>Book <br /><span className="italic text-accent">Wishlist</span></>
                )}
              </h1>
            </div>
            
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 md:gap-8 flex-shrink-0">
              {user ? (
                <div className="flex items-center gap-4">
                  <div className="flex flex-col items-end">
                    <span className="text-[10px] font-bold text-white uppercase tracking-widest">{user.displayName}</span>
                    <button onClick={logOut} className="text-[8px] text-text-muted hover:text-red-400 uppercase tracking-widest font-bold flex items-center gap-1">
                      <LogOut className="w-3 h-3" /> Sign Out
                    </button>
                    <button onClick={() => setIsSettingsModalOpen(true)} className="text-[8px] text-text-muted hover:text-accent uppercase tracking-widest font-bold flex items-center gap-1 mt-1">
                      <Settings2 className="w-3 h-3" /> Settings
                    </button>
                  </div>
                  {user.photoURL ? (
                    <img src={user.photoURL} alt="Profile" className="w-10 h-10 rounded-full border border-border" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-surface border border-border flex items-center justify-center">
                      <UserIcon className="w-5 h-5 text-text-muted" />
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-end gap-2">
                  <button 
                    onClick={handleLogin}
                    className="flex items-center gap-3 px-6 py-3 rounded-full bg-white text-bg hover:bg-accent hover:text-white transition-all font-bold text-[10px] uppercase tracking-widest"
                  >
                    <LogIn className="w-4 h-4" /> Sign In with Google
                  </button>
                  {authError && (
                    <div className="max-w-xs p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-[10px] text-red-400 font-medium leading-relaxed">
                      {authError}
                    </div>
                  )}
                </div>
              )}
              
              {activeTab === "collections" && user && (
                <button 
                  onClick={() => {
                    setEditingSeries(null);
                    setNewSeries({ title: "", description: "", color: "#e6a8d7" });
                    setIsSeriesModalOpen(true);
                  }}
                  className="group flex items-center gap-4 h-14 md:h-20 px-6 md:px-8 rounded-full border border-accent text-accent hover:bg-accent hover:text-bg transition-all duration-500"
                >
                  <Plus className="w-5 h-5 md:w-8 md:h-8" />
                  <span className="text-[10px] md:text-xs font-bold uppercase tracking-[0.2em]">
                    New Collection
                  </span>
                </button>
              )}
            </div>
          </div>
        </div>
        
        {/* Atmospheric background elements */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-accent/5 blur-[120px] rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-accent/5 blur-[100px] rounded-full translate-y-1/2 -translate-x-1/2" />
      </section>

      <main className="max-w-6xl mx-auto px-6 pb-32 flex-1 w-full">
        <AnimatePresence mode="wait">
          {!user ? (
            <motion.div 
              key="auth-screen"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex flex-col items-center justify-center py-32 text-center space-y-8"
            >
              <div className="w-24 h-24 rounded-full bg-accent/10 flex items-center justify-center">
                <Library className="w-12 h-12 text-accent" />
              </div>
              <div className="space-y-4">
                <h2 className="text-4xl font-serif font-bold text-white">Your library, anywhere.</h2>
                <p className="text-text-muted max-w-md mx-auto">Sign in with Google to sync your reading collections, progress, and wishlist across all your devices.</p>
              </div>
              <button 
                onClick={handleLogin}
                className="btn-primary px-12 py-4 text-sm"
              >
                Get Started
              </button>
              {authError && (
                <div className="max-w-md p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-xs text-red-400 font-medium leading-relaxed">
                  {authError}
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
            >
              {activeTab === "collections" && (
                <div className="space-y-12">
                  {seriesList.map((series, sIdx) => {
                    const seriesBooks = ownedBooks.filter(b => b.seriesId === series.id);
                    const totalPages = seriesBooks.reduce((acc, b) => acc + b.totalPages, 0);
                    const currentPages = seriesBooks.reduce((acc, b) => acc + b.currentPage, 0);
                    const finishedInSeries = seriesBooks.filter(b => b.currentPage >= b.totalPages && b.totalPages > 0).length;
                    const progress = totalPages > 0 ? (currentPages / totalPages) * 100 : 0;

                    return (
                      <div key={`${series.id}-${sIdx}`} className="group">
                        <div className="flex items-center justify-between mb-6">
                          <div className="space-y-1">
                            <h2 className="text-3xl font-serif font-bold text-white group-hover:text-accent transition-colors">
                              {series.title}
                            </h2>
                            <p className="text-text-muted text-sm font-medium tracking-wide uppercase text-[10px]">
                              {seriesBooks.length} Books • {currentPages} / {totalPages} Pages Read
                            </p>
                          </div>
                          <div className="flex gap-2 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                            <button 
                              onClick={() => {
                                setEditingSeries(series);
                                setNewSeries({ title: series.title, description: series.description || "", color: series.color || "#e6a8d7" });
                                setIsSeriesModalOpen(true);
                              }}
                              className="p-2 text-text-muted hover:text-accent transition-colors"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => deleteSeries(series.id)}
                              className="p-2 text-text-muted hover:text-red-400 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Pill Progress Bar with Stacking Covers */}
                        <div className="pill-progress-bg group/progress cursor-pointer relative" onClick={() => setSelectedSeriesId(selectedSeriesId === series.id ? null : series.id)}>
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${progress}%` }}
                            className="pill-progress-fill"
                            style={{ backgroundColor: series.color }}
                          />
                          
                          {/* Book Cover Stacking */}
                          <div className="absolute inset-0 flex items-center px-4 gap-[-12px]">
                            <div className="flex -space-x-3">
                              {seriesBooks.slice(0, 5).map((book, idx) => (
                                <motion.div
                                  key={`${book.id}-pill-${idx}`}
                                  initial={{ x: -20, opacity: 0 }}
                                  animate={{ x: 0, opacity: 1 }}
                                  transition={{ delay: idx * 0.1 }}
                                  className="w-8 h-10 rounded-sm overflow-hidden border border-bg shadow-lg relative"
                                  style={{ zIndex: 10 - idx }}
                                >
                                  <img 
                                    src={book.coverUrl} 
                                    alt={book.title} 
                                    className={`w-full h-full object-cover ${book.currentPage >= book.totalPages ? 'grayscale opacity-50' : ''}`}
                                    referrerPolicy="no-referrer"
                                  />
                                </motion.div>
                              ))}
                              {seriesBooks.length > 5 && (
                                <div className="w-8 h-10 rounded-sm bg-surface border border-bg flex items-center justify-center text-[10px] font-bold text-text-muted">
                                  +{seriesBooks.length - 5}
                                </div>
                              )}
                            </div>
                            
                            <div className="ml-auto flex items-center gap-3 pr-2">
                              <span className="text-xs font-bold tracking-tighter text-white drop-shadow-md">
                                {Math.round(progress)}%
                              </span>
                              <ChevronRight className={`w-4 h-4 text-white transition-transform duration-300 ${selectedSeriesId === series.id ? 'rotate-90' : ''}`} />
                            </div>
                          </div>
                        </div>

                        {/* Books List (Expandable) */}
                        <AnimatePresence>
                          {selectedSeriesId === series.id && (
                            <motion.div
                              key={`series-books-${series.id}`}
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="overflow-hidden"
                            >
                              <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-4">
                                {seriesBooks.map((book, index) => (
                                  <BookCard
                                    key={book.id}
                                    book={book}
                                    onClick={() => setSelectedBookForDetail(book)}
                                    updateProgress={updateProgress}
                                    onMove={(direction) => moveBook(book, direction, seriesBooks)}
                                    isFirst={index === 0}
                                    isLast={index === seriesBooks.length - 1}
                                  />
                                ))}
                                <button 
                                  onClick={() => {
                                    setNewBook({ ...newBook, seriesId: series.id, isWishlist: false, coverUrl: "" });
                                    setIsAddBookModalOpen(true);
                                  }}
                                  className="border-2 border-dashed border-accent/30 rounded-3xl aspect-[2/3] flex flex-col items-center justify-center gap-2 text-accent/60 hover:border-accent hover:text-accent hover:bg-accent/5 transition-all group/add"
                                >
                                  <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center group-hover/add:scale-110 transition-transform">
                                    <Plus className="w-5 h-5 md:w-6 md:h-6" />
                                  </div>
                                  <span className="text-[9px] md:text-xs font-bold uppercase tracking-widest">Add Book</span>
                                </button>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}

                  {seriesList.length === 0 && (
                    <div className="text-center py-32 card border-dashed">
                      <Library className="w-16 h-16 text-accent/20 mx-auto mb-6" />
                      <h3 className="text-2xl font-serif font-bold text-white mb-2">Your library is empty</h3>
                      <p className="text-text-muted mb-8 max-w-sm mx-auto">Create your first collection to start tracking your reading journey.</p>
                      <button onClick={() => setIsSeriesModalOpen(true)} className="btn-primary">
                        Create Collection
                      </button>
                    </div>
                  )}
                </div>
              )}

              {activeTab === "calendar" && (
                <div className="space-y-8">
                  {renderCalendar()}
                  
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="card p-4 border-l-2 border-l-accent flex flex-col justify-center gap-1">
                      <span className="text-[8px] uppercase tracking-[0.2em] text-text-muted font-bold">This Month</span>
                      <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-serif font-black text-white">{finishedThisMonth}</span>
                        <span className="text-[10px] text-text-muted italic">Books Finished</span>
                      </div>
                    </div>
                    <div className="card p-4 border-l-2 border-l-border flex flex-col justify-center gap-1">
                      <span className="text-[8px] uppercase tracking-[0.2em] text-text-muted font-bold">This Year</span>
                      <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-serif font-black text-white">{finishedThisYear}</span>
                        <span className="text-[10px] text-text-muted italic">Books Finished</span>
                      </div>
                    </div>
                    <div className="card p-4 border-l-2 border-l-accent/40 flex flex-col justify-center gap-1">
                      <span className="text-[8px] uppercase tracking-[0.2em] text-text-muted font-bold">Total Progress</span>
                      <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-serif font-black text-white">{totalPagesRead.toLocaleString()}</span>
                        <span className="text-[10px] text-text-muted italic">Pages Read</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "wishlist" && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {wishlistBooks.map((book, wIdx) => (
                    <motion.div 
                      key={`${book.id}-wishlist-${wIdx}`} 
                      layoutId={book.id}
                      onClick={() => setSelectedBookForDetail(book)}
                      className="card p-3 flex flex-col gap-3 group/wish relative cursor-pointer hover:border-accent transition-all"
                    >
                      <div className="aspect-[2/3] w-full rounded-lg overflow-hidden border border-border">
                        <img src={book.coverUrl} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      </div>
                      <div className="space-y-1">
                        <h3 className="font-serif text-sm leading-tight truncate text-white">{book.title}</h3>
                        <p className="text-[10px] text-text-muted italic truncate">{book.author}</p>
                        {book.seriesId && (
                          <div className="flex items-center gap-1.5 mt-1">
                            <div 
                              className="w-1.5 h-1.5 rounded-full" 
                              style={{ backgroundColor: seriesList.find(s => s.id === book.seriesId)?.color || '#ccc' }} 
                            />
                            <span className="text-[8px] uppercase tracking-widest text-accent font-bold truncate">
                              {seriesList.find(s => s.id === book.seriesId)?.title}
                            </span>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  ))}
                  <button 
                    onClick={() => {
                      setNewBook({ ...newBook, isWishlist: true, isDragonBook: false, coverUrl: "" });
                      setIsAddBookModalOpen(true);
                    }}
                    className="border-2 border-dashed border-border rounded-3xl aspect-[2/3] flex flex-col items-center justify-center gap-2 text-text-muted hover:border-accent hover:text-accent transition-all group/add"
                  >
                    <ShoppingBag className="w-8 h-8 group-hover/add:scale-110 transition-transform" />
                    <span className="text-xs font-bold uppercase tracking-widest">Add to Wishlist</span>
                  </button>
                </div>
              )}

              {activeTab === "dragons" && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {dragonBooks.map((book, dIdx) => (
                    <motion.div 
                      key={`${book.id}-dragon-${dIdx}`} 
                      layoutId={book.id}
                      onClick={() => setSelectedBookForDetail(book)}
                      className="card p-3 flex flex-col gap-3 group/dragon relative cursor-pointer hover:border-accent transition-all"
                    >
                      <div className="aspect-[2/3] w-full rounded-lg overflow-hidden border border-border">
                        <img src={book.coverUrl} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      </div>
                      <div className="space-y-1">
                        <h3 className="font-serif text-sm leading-tight truncate text-white">{book.title}</h3>
                        <p className="text-[10px] text-text-muted italic truncate">{book.author}</p>
                      </div>
                    </motion.div>
                  ))}
                  <button 
                    onClick={() => {
                      setNewBook({ ...newBook, isDragonBook: true, isWishlist: false, coverUrl: "" });
                      setIsAddBookModalOpen(true);
                    }}
                    className="border-2 border-dashed border-border rounded-3xl aspect-[2/3] flex flex-col items-center justify-center gap-2 text-text-muted hover:border-accent hover:text-accent transition-all group/add"
                  >
                    <Flame className="w-8 h-8 group-hover/add:scale-110 transition-transform" />
                    <span className="text-xs font-bold uppercase tracking-widest">Add Dragon Book</span>
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>


      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 inset-x-0 bg-surface/80 backdrop-blur-xl border-t border-border px-6 py-4 z-40">
        <div className="max-w-md mx-auto flex justify-between items-center">
          <button 
            onClick={() => setActiveTab("collections")}
            className={`flex flex-col items-center gap-1 transition-colors ${activeTab === "collections" ? 'text-accent' : 'text-text-muted hover:text-white'}`}
          >
            <Library className="w-6 h-6" />
            <span className="text-[10px] font-bold uppercase tracking-widest">Library</span>
          </button>
          <button 
            onClick={() => setActiveTab("calendar")}
            className={`flex flex-col items-center gap-1 transition-colors ${activeTab === "calendar" ? 'text-accent' : 'text-text-muted hover:text-white'}`}
          >
            <CalendarIcon className="w-6 h-6" />
            <span className="text-[10px] font-bold uppercase tracking-widest">Calendar</span>
          </button>
          <button 
            onClick={() => setActiveTab("wishlist")}
            className={`flex flex-col items-center gap-1 transition-colors ${activeTab === "wishlist" ? 'text-accent' : 'text-text-muted hover:text-white'}`}
          >
            <Heart className="w-6 h-6" />
            <span className="text-[10px] font-bold uppercase tracking-widest">Wishlist</span>
          </button>
          <button 
            onClick={() => setActiveTab("dragons")}
            className={`flex flex-col items-center gap-1 transition-colors ${activeTab === "dragons" ? 'text-accent' : 'text-text-muted hover:text-white'}`}
          >
            <Flame className="w-6 h-6" />
            <span className="text-[10px] font-bold uppercase tracking-widest">Dragons</span>
          </button>
        </div>
      </nav>

      {/* Modals */}
      <AnimatePresence>
        {confirmModal.isOpen && (
          <div key="confirm-modal-container" className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))} 
              className="absolute inset-0 bg-black/60 backdrop-blur-sm" 
            />
            <motion.div 
              initial={{ opacity: 0, y: 20 }} 
              animate={{ opacity: 1, y: 0 }} 
              exit={{ opacity: 0, y: 20 }} 
              className="relative w-full max-w-[320px] bg-surface border border-white/10 rounded-[32px] p-8 text-center shadow-2xl"
            >
              <div className="w-14 h-14 bg-red-500/10 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-6 rotate-3">
                <Trash2 className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-serif font-bold mb-2 text-white">{confirmModal.title}</h3>
              <p className="text-text-muted text-sm mb-8 leading-relaxed">{confirmModal.message}</p>
              <div className="flex flex-col gap-3">
                <button 
                  onClick={confirmModal.onConfirm}
                  disabled={isSaving}
                  className="w-full bg-red-500 hover:bg-red-600 text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-red-500/20 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                  Delete
                </button>
                <button 
                  onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                  className="w-full py-4 text-text-muted hover:text-white font-bold transition-colors text-sm"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {isAddBookModalOpen && (
          <div key="add-book-modal-container" className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsAddBookModalOpen(false)} className="absolute inset-0 bg-bg/80 backdrop-blur-md" />
            <motion.div 
              initial={{ opacity: 0, y: 20 }} 
              animate={{ opacity: 1, y: 0 }} 
              exit={{ opacity: 0, y: 20 }} 
              className="relative w-full max-w-md card overflow-hidden flex flex-col h-auto max-h-[90vh] sm:max-h-[85vh]"
            >
              <div className="p-4 md:p-6 border-b border-border flex justify-between items-center bg-surface/50 backdrop-blur-sm shrink-0">
                <div className="space-y-0.5">
                  <h3 className="text-lg md:text-2xl font-serif font-bold leading-tight">Add {newBook.isWishlist ? "to Wishlist" : "New Book"}</h3>
                  <p className="text-[8px] md:text-[10px] text-text-muted uppercase tracking-widest font-medium">Enter details manually or scan</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setIsAddBookModalOpen(false)} className="p-2 text-text-muted hover:text-white"><X className="w-5 h-5" /></button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 md:p-8 min-h-0 scrollbar-hide">
                <form id="add-book-form" onSubmit={handleAddBook} className="space-y-5 md:space-y-8">
                  <button 
                    type="button"
                    onClick={() => setIsScanning(true)}
                    className="w-full py-4 bg-accent/10 border-2 border-dashed border-accent/30 rounded-2xl text-accent hover:bg-accent/20 transition-all flex items-center justify-center gap-3 group/scan"
                  >
                    <Barcode className="w-6 h-6 group-hover/scan:scale-110 transition-transform" />
                    <span className="text-sm font-black uppercase tracking-[0.2em]">Scan Barcode</span>
                  </button>

                  {fetchError && (
                    <div className="p-3 md:p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-[10px] font-bold uppercase tracking-widest flex justify-between items-center">
                      <span>{fetchError}</span>
                      <button onClick={() => setFetchError(null)} className="p-1 hover:bg-red-500/20 rounded-full transition-colors">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                  {isFetchingBook && (
                    <div className="flex items-center justify-center gap-3 text-accent py-3 md:py-4 bg-accent/5 rounded-2xl border border-accent/20 animate-pulse">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-[10px] font-bold uppercase tracking-widest">
                        Fetching details...
                      </span>
                    </div>
                  )}
                  
                  <div className="flex flex-col md:flex-row gap-6 items-start">
                    <div className="w-full md:w-auto space-y-3">
                      <label className="text-[10px] uppercase tracking-[0.2em] text-text-muted font-bold">Cover Image</label>
                      <div 
                        onClick={() => fileInputRef.current?.click()}
                        className="group relative aspect-[2/3] w-24 md:w-32 rounded-2xl md:rounded-3xl overflow-hidden border-2 border-dashed border-border hover:border-accent transition-all cursor-pointer bg-bg/50 flex flex-col items-center justify-center gap-2 shadow-inner mx-auto md:mx-0"
                      >
                        {newBook.coverUrl ? (
                          <>
                            <img src={newBook.coverUrl} alt="Preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                              <Upload className="w-5 h-5 text-white" />
                            </div>
                          </>
                        ) : (
                          <>
                            <ImageIcon className="w-6 h-6 text-text-muted group-hover:text-accent transition-colors" />
                            <span className="text-[8px] font-bold uppercase tracking-widest text-text-muted group-hover:text-accent">Upload</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex-1 w-full space-y-4">
                      <div className="space-y-2">
                        <label className="text-[10px] uppercase tracking-[0.2em] text-text-muted font-bold">ISBN (Optional)</label>
                        <div className="relative flex gap-2">
                          <input 
                            value={newBook.isbn || ""} 
                            onChange={e => setNewBook({...newBook, isbn: e.target.value})} 
                            className="input-field text-sm flex-1" 
                            placeholder="e.g. 9780007136599" 
                          />
                          <button 
                            type="button"
                            disabled={!newBook.isbn || isFetchingBook}
                            onClick={async () => {
                              if (newBook.isbn) {
                                await fetchBookByISBN(newBook.isbn);
                              }
                            }}
                            className="flex items-center gap-2 px-4 py-2 bg-accent/10 border border-accent/20 rounded-xl text-accent hover:bg-accent/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all group/isbn"
                          >
                            {isFetchingBook ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Search className="w-4 h-4 group-hover/isbn:scale-110 transition-transform" />
                            )}
                            <span className="text-[10px] font-bold uppercase tracking-widest whitespace-nowrap">Search</span>
                          </button>
                        </div>
                      </div>

                    <div className="space-y-2">
                      <label className="text-[10px] uppercase tracking-[0.2em] text-text-muted font-bold">Initial Rating (Optional)</label>
                      <StarRating 
                        rating={newBook.rating || 0} 
                        onRate={(r) => setNewBook({...newBook, rating: r})} 
                        size="md"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] uppercase tracking-[0.2em] text-text-muted font-bold">Title</label>
                      <input required value={newBook.title} onChange={e => setNewBook({...newBook, title: e.target.value})} className="input-field text-sm" placeholder="e.g. The Fellowship..." />
                    </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] uppercase tracking-[0.2em] text-text-muted font-bold">Author</label>
                      <input required value={newBook.author} onChange={e => setNewBook({...newBook, author: e.target.value})} className="input-field text-sm" placeholder="e.g. J.R.R. Tolkien" />
                    </div>
                    
                    {!newBook.isWishlist && (
                      <div className="space-y-2">
                        <label className="text-[10px] uppercase tracking-[0.2em] text-text-muted font-bold">Total Pages</label>
                        <input required type="number" min="1" value={newBook.totalPages || ""} onChange={e => setNewBook({...newBook, totalPages: parseInt(e.target.value)})} className="input-field text-sm" placeholder="e.g. 423" />
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-[0.2em] text-text-muted font-bold">Collection (Optional)</label>
                    <select 
                      value={newBook.seriesId || ""} 
                      onChange={e => setNewBook({...newBook, seriesId: e.target.value})}
                      className="input-field text-sm bg-surface"
                    >
                      <option value="">No Collection (Standalone Book)</option>
                      {seriesList.map(series => (
                        <option key={series.id} value={series.id}>{series.title}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center justify-between p-3 md:p-4 rounded-2xl bg-surface border border-border group hover:border-accent/50 transition-all">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-xl transition-colors ${newBook.isDragonBook ? 'bg-accent/20 text-accent' : 'bg-bg text-text-muted'}`}>
                        <Flame className="w-4 h-4 md:w-5 md:h-5" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-white">Dragon Book</span>
                        <span className="text-[8px] text-text-muted uppercase tracking-widest">Special collection</span>
                      </div>
                    </div>
                    <button 
                      type="button"
                      onClick={() => setNewBook({...newBook, isDragonBook: !newBook.isDragonBook})}
                      className={`w-10 h-5 md:w-12 md:h-6 rounded-full relative transition-colors ${newBook.isDragonBook ? 'bg-accent' : 'bg-bg'}`}
                    >
                      <div className={`absolute top-0.5 md:top-1 w-4 h-4 rounded-full bg-white transition-all shadow-sm ${newBook.isDragonBook ? 'left-5 md:left-7' : 'left-1'}`} />
                    </button>
                  </div>
                </form>
              </div>

              <div className="p-4 border-t border-border bg-surface/80 backdrop-blur-md shrink-0">
                <button 
                  form="add-book-form"
                  type="submit" 
                  disabled={isSaving}
                  className="w-full py-3.5 md:py-4 bg-accent text-bg rounded-xl md:rounded-2xl font-black text-[10px] md:text-xs uppercase tracking-[0.2em] hover:opacity-90 transition-all shadow-xl shadow-accent/20 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                  Add {newBook.isWishlist ? "to Wishlist" : "to Collection"}
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {isSeriesModalOpen && (
          <div key="series-modal-container" className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsSeriesModalOpen(false)} className="absolute inset-0 bg-bg/80 backdrop-blur-md" />
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="relative w-full max-w-md card p-8 max-h-[90vh] overflow-y-auto scrollbar-hide">
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-2xl font-serif font-bold">{editingSeries ? "Edit Collection" : "New Collection"}</h3>
                <button onClick={() => setIsSeriesModalOpen(false)} className="p-2 text-text-muted hover:text-white"><X className="w-5 h-5" /></button>
              </div>
              <form onSubmit={handleSaveSeries} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-[0.2em] text-text-muted font-bold">Collection Title</label>
                  <input required value={newSeries.title} onChange={e => setNewSeries({...newSeries, title: e.target.value})} className="input-field" placeholder="e.g. The Lord of the Rings" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-[0.2em] text-text-muted font-bold">Description</label>
                  <textarea value={newSeries.description} onChange={e => setNewSeries({...newSeries, description: e.target.value})} className="input-field h-24 resize-none" placeholder="Brief description of the saga..." />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-[0.2em] text-text-muted font-bold">Theme Color</label>
                  <div className="flex flex-wrap gap-2 md:gap-3">
                    {[
                      "#e6a8d7", "#a8e6cf", "#dcedc1", "#ffd3b6", "#ffaaa5", "#8fa39f",
                      "#ff9ff3", "#feca57", "#ff6b6b", "#48dbfb", "#1dd1a1", "#5f27cd",
                      "#54a0ff", "#00d2d3", "#576574", "#222f3e"
                    ].map(color => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setNewSeries({...newSeries, color})}
                        className={`w-6 h-6 md:w-8 md:h-8 rounded-full border-2 transition-all ${newSeries.color === color ? 'ring-2 ring-offset-2 ring-accent border-white' : 'border-transparent'}`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
                <button type="submit" disabled={isSaving} className="btn-primary w-full mt-4 flex items-center justify-center gap-2">
                  {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editingSeries ? "Save Changes" : "Create Collection"}
                </button>
              </form>
            </motion.div>
          </div>
        )}

        {isAddChapterModalOpen && (
          <div key="add-chapter-modal-container" className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              key="add-chapter-modal-overlay"
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => setIsAddChapterModalOpen(false)} 
              className="absolute inset-0 bg-bg/80 backdrop-blur-md" 
            />
            <motion.div 
              key="add-chapter-modal-content"
              initial={{ opacity: 0, y: 20 }} 
              animate={{ opacity: 1, y: 0 }} 
              exit={{ opacity: 0, y: 20 }} 
              className="relative w-full max-w-md card p-8 max-h-[90vh] overflow-y-auto scrollbar-hide"
            >
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-2xl font-serif font-bold">Add Chapter</h3>
                <button onClick={() => setIsAddChapterModalOpen(false)} className="p-2 text-text-muted hover:text-white"><X className="w-5 h-5" /></button>
              </div>
              <form onSubmit={handleAddChapter} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-[0.2em] text-text-muted font-bold">Chapter Title</label>
                  <input 
                    required 
                    value={newChapterData.title} 
                    onChange={e => setNewChapterData({...newChapterData, title: e.target.value})} 
                    className="input-field" 
                    placeholder={`e.g. Chapter ${(currentBookDetail?.chapters?.length || 0) + 1}`} 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-[0.2em] text-text-muted font-bold">Notes</label>
                  <textarea 
                    value={newChapterData.notes} 
                    onChange={e => setNewChapterData({...newChapterData, notes: e.target.value})} 
                    className="input-field h-32 resize-none" 
                    placeholder="What happened in this chapter?" 
                  />
                </div>
                <button type="submit" className="btn-primary w-full mt-4 flex items-center justify-center gap-2">
                  <Save className="w-4 h-4" /> Save Chapter
                </button>
              </form>
            </motion.div>
          </div>
        )}
        {isSettingsModalOpen && (
          <div key="settings-modal-container" className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsSettingsModalOpen(false)} className="absolute inset-0 bg-bg/80 backdrop-blur-md" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-md card p-8 max-h-[90vh] overflow-y-auto scrollbar-hide">
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-2xl font-serif font-bold">Settings</h3>
                <button onClick={() => setIsSettingsModalOpen(false)} className="p-2 text-text-muted hover:text-white"><X className="w-5 h-5" /></button>
              </div>
              
              <div className="space-y-6">
                <div className="p-6 rounded-2xl bg-red-500/5 border border-red-500/20 space-y-4">
                  <div className="flex items-center gap-3 text-red-400">
                    <AlertTriangle className="w-5 h-5" />
                    <h4 className="font-bold uppercase tracking-widest text-xs">Danger Zone</h4>
                  </div>
                  <p className="text-xs text-text-muted leading-relaxed">
                    Purging your data will permanently remove all your books, collections, and reading history from our servers. This action is irreversible.
                  </p>
                  <button 
                    onClick={purgeAllData}
                    className="w-full py-4 rounded-xl bg-red-500 text-white font-bold text-xs uppercase tracking-widest hover:bg-red-600 transition-all shadow-lg shadow-red-500/20"
                  >
                    Purge All Data
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {isSelectSeriesModalOpen && (
          <div key="select-series-modal-container" className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsSelectSeriesModalOpen(false)} className="absolute inset-0 bg-bg/80 backdrop-blur-md" />
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="relative w-full max-w-md card p-8 max-h-[90vh] overflow-y-auto scrollbar-hide">
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-2xl font-serif font-bold">
                  {bookToMove?.isWishlist ? "Mark as Bought" : "Select Collection"}
                </h3>
                <button onClick={() => setIsSelectSeriesModalOpen(false)} className="p-2 text-text-muted hover:text-white"><X className="w-5 h-5" /></button>
              </div>
              <div className="space-y-6">
                <p className="text-sm text-text-muted">Which collection does <span className="text-white font-bold italic">"{bookToMove?.title}"</span> belong to?</p>
                
                {bookToMove?.totalPages === 0 && (
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-[0.2em] text-text-muted font-bold">Total Pages</label>
                    <input 
                      type="number" 
                      min="1" 
                      className="input-field text-sm" 
                      placeholder="e.g. 423"
                      onChange={(e) => {
                        if (bookToMove) {
                          setBookToMove({ ...bookToMove, totalPages: parseInt(e.target.value) || 0 });
                        }
                      }}
                    />
                  </div>
                )}

                <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-2">
                  {seriesList.map((series, idx) => (
                    <button
                      key={`select-series-${series.id}-${idx}`}
                      onClick={() => handleMoveToSeries(series.id)}
                      className="w-full p-4 rounded-2xl border border-border bg-surface hover:border-accent hover:bg-accent/5 transition-all flex items-center gap-4 group"
                    >
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: series.color }} />
                      <span className="text-sm font-bold text-white group-hover:text-accent transition-colors">{series.title}</span>
                    </button>
                  ))}
                  
                  <button
                    onClick={() => {
                      setIsSelectSeriesModalOpen(false);
                      setEditingSeries(null);
                      setNewSeries({ title: "", description: "", color: "#e6a8d7" });
                      setIsSeriesModalOpen(true);
                    }}
                    className="w-full p-4 rounded-2xl border border-dashed border-border hover:border-accent hover:bg-accent/5 transition-all flex items-center gap-4 group"
                  >
                    <Plus className="w-4 h-4 text-accent" />
                    <span className="text-sm font-bold text-text-muted group-hover:text-accent transition-colors">Create New Collection</span>
                  </button>
                </div>
                
                <button 
                  onClick={() => handleMoveToSeries("")}
                  className="text-[10px] uppercase tracking-widest text-text-muted hover:text-white transition-colors w-full text-center py-2"
                >
                  No Collection (Standalone Book)
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {currentBookDetail && (
          <div key="book-detail-modal-overlay" className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => setSelectedBookForDetail(null)} 
              className="absolute inset-0 bg-bg/90 backdrop-blur-xl" 
            />
            <motion.div 
              layoutId={currentBookDetail.id}
              className="relative w-full max-w-2xl bg-surface border border-border rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-8 border-b border-border flex justify-between items-start">
                <div className="flex gap-6">
                  <div className="w-24 h-36 rounded-lg overflow-hidden border border-border shadow-md flex-shrink-0">
                    <img src={currentBookDetail.coverUrl} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-serif font-bold text-white mb-1">{currentBookDetail.title}</h3>
                    <p className="text-text-muted italic mb-2">{currentBookDetail.author}</p>
                    <div className="mb-4">
                      <StarRating 
                        rating={currentBookDetail.rating || 0} 
                        onRate={async (r) => {
                          try {
                            await updateDoc(doc(db, "books", currentBookDetail.id), { rating: r });
                            // The onSnapshot listener will update the books list, but we update local state for immediate feedback
                            setSelectedBookForDetail(prev => prev ? { ...prev, rating: r } : null);
                          } catch (error) {
                            handleFirestoreError(error, OperationType.UPDATE, "books");
                          }
                        }} 
                        size="md"
                      />
                    </div>
                    <div className="flex items-center gap-3">
                      <ProgressInput 
                        bookId={currentBookDetail.id}
                        currentPage={currentBookDetail.currentPage}
                        totalPages={currentBookDetail.totalPages}
                        onUpdate={updateProgress}
                      />
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {!isEditingBookDetail ? (
                    <button 
                      onClick={() => {
                        setEditedBook(currentBookDetail);
                        setIsEditingBookDetail(true);
                      }}
                      className="p-2 text-text-muted hover:text-accent transition-colors"
                    >
                      <Edit2 className="w-5 h-5" />
                    </button>
                  ) : (
                    <button 
                      onClick={handleUpdateBook}
                      disabled={isSaving}
                      className="p-2 text-accent hover:text-accent/80 transition-colors"
                    >
                      {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                    </button>
                  )}
                  <button 
                    onClick={() => {
                      setSelectedBookForDetail(null);
                      setIsEditingBookDetail(false);
                    }} 
                    className="p-2 text-text-muted hover:text-white transition-colors"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-8 space-y-8 scrollbar-hide">
                {isEditingBookDetail && editedBook ? (
                  <div className="space-y-6">
                    <div className="flex gap-6 items-start">
                      <div 
                        onClick={() => fileInputRef.current?.click()}
                        className="group relative w-24 h-36 rounded-lg overflow-hidden border-2 border-dashed border-border hover:border-accent transition-all cursor-pointer bg-bg/50 flex flex-col items-center justify-center gap-2 shadow-inner flex-shrink-0"
                      >
                        {editedBook.coverUrl ? (
                          <>
                            <img src={editedBook.coverUrl} alt="Preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                              <Upload className="w-5 h-5 text-white" />
                            </div>
                          </>
                        ) : (
                          <>
                            <ImageIcon className="w-6 h-6 text-text-muted group-hover:text-accent transition-colors" />
                            <span className="text-[8px] font-bold uppercase tracking-widest text-text-muted group-hover:text-accent">Upload</span>
                          </>
                        )}
                      </div>
                      <div className="flex-1 space-y-4">
                        <div className="space-y-2">
                          <label className="text-[10px] uppercase tracking-[0.2em] text-text-muted font-bold">Title</label>
                          <input 
                            value={editedBook.title} 
                            onChange={e => setEditedBook({...editedBook, title: e.target.value})} 
                            className="input-field text-sm" 
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] uppercase tracking-[0.2em] text-text-muted font-bold">Author</label>
                          <input 
                            value={editedBook.author} 
                            onChange={e => setEditedBook({...editedBook, author: e.target.value})} 
                            className="input-field text-sm" 
                          />
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] uppercase tracking-[0.2em] text-text-muted font-bold">Current Page</label>
                        <input 
                          type="number"
                          value={editedBook.currentPage} 
                          onChange={e => setEditedBook({...editedBook, currentPage: parseInt(e.target.value) || 0})} 
                          className="input-field text-sm" 
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] uppercase tracking-[0.2em] text-text-muted font-bold">Total Pages</label>
                        <input 
                          type="number"
                          value={editedBook.totalPages} 
                          onChange={e => setEditedBook({...editedBook, totalPages: parseInt(e.target.value) || 0})} 
                          className="input-field text-sm" 
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] uppercase tracking-[0.2em] text-text-muted font-bold">Collection</label>
                      <select 
                        value={editedBook.seriesId || ""} 
                        onChange={e => setEditedBook({...editedBook, seriesId: e.target.value})} 
                        className="input-field text-sm"
                      >
                        <option value="">No Collection</option>
                        {seriesList.map(s => (
                          <option key={s.id} value={s.id}>{s.title}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] uppercase tracking-[0.2em] text-text-muted font-bold">Rating</label>
                      <StarRating 
                        rating={editedBook.rating || 0} 
                        onRate={(r) => setEditedBook({...editedBook, rating: r})} 
                        size="md"
                      />
                    </div>
                    <div className="flex gap-3 pt-4">
                      <button 
                        onClick={handleUpdateBook}
                        disabled={isSaving}
                        className="flex-1 btn-primary flex items-center justify-center gap-2"
                      >
                        {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                        Save Changes
                      </button>
                      <button 
                        onClick={() => setIsEditingBookDetail(false)}
                        className="px-6 py-3 rounded-xl bg-surface border border-border text-text-muted hover:text-white transition-all font-bold text-xs uppercase tracking-widest"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex gap-4">
                  {currentBookDetail.isWishlist ? (
                    <button 
                      onClick={() => {
                        setBookToMove(currentBookDetail);
                        setIsSelectSeriesModalOpen(true);
                        setSelectedBookForDetail(null);
                      }}
                      className="flex-1 btn-primary flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 border-green-500/20"
                    >
                      <CheckCircle2 className="w-4 h-4" /> Mark as Bought
                    </button>
                  ) : (
                    <button 
                      onClick={() => setIsAddChapterModalOpen(true)}
                      className="flex-1 btn-primary flex items-center justify-center gap-2"
                    >
                      <Plus className="w-4 h-4" /> Add Chapter
                    </button>
                  )}
                  <button 
                    onClick={() => deleteBook(currentBookDetail.id)}
                    className="px-6 py-3 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500 hover:text-white transition-all font-bold text-xs uppercase tracking-widest"
                  >
                    Delete
                  </button>
                </div>

                <div className="space-y-6">
                  <h4 className="text-[10px] uppercase tracking-[0.2em] text-accent font-black">Chapters & Notes</h4>
                  {currentBookDetail.chapters && currentBookDetail.chapters.length > 0 ? (
                    <div className="space-y-4">
                      {currentBookDetail.chapters.map((chapter, idx) => (
                        <div 
                          key={`chapter-item-${chapter.id}-${idx}`}
                          className="bg-bg/50 p-6 rounded-2xl border border-border space-y-4"
                        >
                          <div className="flex justify-between items-center">
                            <h5 className="font-serif font-bold text-white">
                              {idx + 1}. {chapter.title}
                            </h5>
                            <button 
                              onClick={() => deleteChapter(currentBookDetail.id, chapter.id)}
                              className="text-text-muted hover:text-red-400 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                          {chapter.notes && (
                            <p className="text-sm text-text-muted leading-relaxed whitespace-pre-wrap">
                              {chapter.notes}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12 border-2 border-dashed border-border rounded-2xl text-text-muted">
                      <BookOpen className="w-8 h-8 mx-auto mb-3 opacity-20" />
                      <p className="text-xs uppercase tracking-widest font-bold">No chapters yet</p>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </motion.div>
      </div>
    )}

        {isScanning && (
          <div key="scanning-modal-container" className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsScanning(false)} className="absolute inset-0 bg-bg/90 backdrop-blur-xl" />
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="relative w-full max-w-md card p-8">
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-2xl font-serif font-bold">Scan Barcode</h3>
                <button onClick={() => setIsScanning(false)} className="p-2 text-text-muted hover:text-white"><X className="w-5 h-5" /></button>
              </div>
              <BarcodeScanner 
                onScanSuccess={(isbn) => {
                  console.log("Barcode scanned successfully:", isbn);
                  fetchBookByISBN(isbn);
                }}
              />
              <div className="grid grid-cols-2 gap-3 mt-6">
                <button 
                  onClick={() => {
                    setIsScanning(false);
                    setIsAddBookModalOpen(true);
                  }}
                  className="btn-primary py-4"
                >
                  Manual Entry
                </button>
                <button 
                  onClick={() => setIsScanning(false)}
                  className="btn-secondary py-4"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        accept="image/*" 
        className="hidden" 
      />
    </div>
  );
}
