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
  Edit2,
  Clock,
  GripHorizontal
} from "lucide-react";

import { 
  DndContext, 
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

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
import { Book, Series, Chapter } from "./types";
import BarcodeScanner from "./components/BarcodeScanner";
import { auth, db, signInWithGoogle, logOut, handleFirestoreError, OperationType } from "./firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import { collection, doc, setDoc, deleteDoc, onSnapshot, query, where, updateDoc, writeBatch } from "firebase/firestore";

type Tab = "collections" | "calendar" | "wishlist" | "dragons";

const ProgressInput = ({ bookId, currentPage, totalPages, onUpdate }: { bookId: string, currentPage: number, totalPages: number, onUpdate: (id: string, page: number) => void }) => {
  const [localValue, setLocalValue] = useState(currentPage);
  const [isDragging, setIsDragging] = useState(false);
  const sliderRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isDragging) {
      setLocalValue(currentPage);
    }
  }, [currentPage, isDragging]);

  const updateFromEvent = (e: React.MouseEvent | React.TouchEvent) => {
    if (!sliderRef.current) return;
    const rect = sliderRef.current.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const percentage = x / rect.width;
    const newValue = Math.round(percentage * totalPages);
    setLocalValue(newValue);
    return newValue;
  };

  const handleStart = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDragging(true);
    updateFromEvent(e);
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMove = (e: MouseEvent | TouchEvent) => {
      // @ts-ignore
      updateFromEvent(e);
    };

    const handleEnd = () => {
      setIsDragging(false);
      onUpdate(bookId, localValue);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleEnd);
    window.addEventListener('touchmove', handleMove);
    window.addEventListener('touchend', handleEnd);

    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleEnd);
    };
  }, [isDragging, localValue, bookId, onUpdate]);

  const progress = totalPages > 0 ? (localValue / totalPages) * 100 : 0;

  return (
    <div className="w-full py-4 group/slider">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-accent">Slide to update progress</span>
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-xl font-black text-white">{localValue}</span>
          <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">/ {totalPages}</span>
        </div>
      </div>

      <div className="relative h-12 w-full flex items-center cursor-pointer touch-none"
        ref={sliderRef}
        onMouseDown={handleStart}
        onTouchStart={handleStart}
      >
        {/* Background Track with Ticks */}
        <div className="h-3 w-full bg-white/5 rounded-full relative overflow-hidden border border-white/5">
          <div 
            className="absolute top-0 left-0 h-full bg-gradient-to-r from-accent/40 to-accent rounded-full transition-all duration-75 shadow-[0_0_15px_rgba(230,168,215,0.3)]"
            style={{ width: `${progress}%` }}
          />
          {/* Subtle Ticks */}
          <div className="absolute inset-0 flex justify-between px-4 pointer-events-none opacity-20">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="w-[1px] h-full bg-white/20" />
            ))}
          </div>
        </div>
        
        {/* Enhanced Handle */}
        <div 
          className={`absolute top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center transition-all z-10 ${isDragging ? 'scale-110' : 'scale-100'}`}
          style={{ left: `calc(${progress}% - 16px)` }}
        >
          <div className="absolute inset-0 bg-accent rounded-full blur-md opacity-20 animate-pulse" />
          <div className="relative w-6 h-6 bg-white rounded-full shadow-[0_0_20px_rgba(0,0,0,0.5)] flex items-center justify-center border-2 border-accent">
            <div className="flex gap-0.5">
              <div className="w-0.5 h-2 bg-accent/30 rounded-full" />
              <div className="w-0.5 h-2 bg-accent/30 rounded-full" />
              <div className="w-0.5 h-2 bg-accent/30 rounded-full" />
            </div>
          </div>
          
          {/* Floating Value Tooltip */}
          {isDragging && (
            <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-accent text-bg px-3 py-1 rounded-lg font-black text-xs shadow-xl whitespace-nowrap">
              {localValue}
            </div>
          )}
        </div>
      </div>
      
      <div className="flex justify-between items-center mt-2">
        <span className="text-[9px] font-bold text-text-muted uppercase tracking-widest">Start</span>
        <div className="flex items-center gap-1.5">
          <span className="text-[14px] font-black text-accent">{Math.round(progress)}%</span>
          <span className="text-[9px] font-bold text-text-muted uppercase tracking-widest">Completed</span>
        </div>
        <span className="text-[9px] font-bold text-text-muted uppercase tracking-widest">Finish</span>
      </div>
    </div>
  );
};

const BookCard = React.memo(({ book, onClick, updateProgress, onMove, isFirst, isLast }: { 
  book: Book; 
  onClick: () => void; 
  updateProgress: (id: string, page: number) => void;
  onMove: (direction: 'left' | 'right') => void;
  isFirst: boolean;
  isLast: boolean;
}) => {
  const isRead = book.currentPage >= book.totalPages && book.totalPages > 0;

  return (
    <div
      className="group/book relative flex flex-col gap-2 p-2 rounded-lg bg-surface hover:bg-surface-hover transition-all duration-300 cursor-pointer active:scale-[0.98]"
      onClick={onClick}
    >
      <div className="aspect-[2/3] w-full rounded-md overflow-hidden shadow-xl relative group/cover">
        <img 
          src={book.coverUrl} 
          className={`w-full h-full object-cover transition-transform duration-700 group-hover/cover:scale-110 ${isRead ? 'grayscale opacity-40' : ''}`} 
          referrerPolicy="no-referrer" 
          loading="lazy" 
        />
        
        {/* Move Arrows - Minimalist */}
        <div className="absolute inset-0 flex items-center justify-between px-1 opacity-0 group-hover/cover:opacity-100 transition-opacity pointer-events-none">
          {!isFirst && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onMove('left');
              }}
              className="p-1.5 bg-black/80 backdrop-blur-md text-white rounded-full transition-all pointer-events-auto hover:bg-accent hover:text-black active:scale-90"
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
              className="p-1.5 bg-black/80 backdrop-blur-md text-white rounded-full transition-all pointer-events-auto hover:bg-accent hover:text-black active:scale-90"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <div className="px-1 py-1">
        <h3 className={`font-bold text-xs md:text-sm leading-tight truncate ${isRead ? 'text-text-muted' : 'text-white'}`}>
          {book.title}
        </h3>
        <p className="text-[10px] text-text-muted truncate mt-0.5">{book.author}</p>
      </div>
    </div>
  );
});

const SeriesCardHorizontal = ({ series, onClick }: { series: Series, onClick: () => void, key?: React.Key }) => (
  <div 
    onClick={onClick}
    className="flex items-center gap-2 bg-white/5 hover:bg-white/10 rounded-md overflow-hidden cursor-pointer transition-all active:scale-[0.98] group"
  >
    <div className="w-14 h-14 flex-shrink-0 bg-surface-hover shadow-lg">
      {series.coverUrl ? (
        <img src={series.coverUrl} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <Library className="w-5 h-5 text-text-muted opacity-20" />
        </div>
      )}
    </div>
    <span className="text-[11px] font-bold text-white truncate pr-2 group-hover:text-accent transition-colors">{series.title}</span>
  </div>
);

const SeriesCardSquare = ({ series, onClick }: { series: Series, onClick: () => void, key?: React.Key }) => (
  <div 
    onClick={onClick}
    className="flex flex-col gap-2 p-3 rounded-xl bg-surface hover:bg-surface-hover transition-all cursor-pointer group w-36 flex-shrink-0"
  >
    <div className="aspect-square w-full rounded-lg overflow-hidden shadow-2xl relative">
      {series.coverUrl ? (
        <img src={series.coverUrl} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-surface-hover">
          <Library className="w-8 h-8 text-text-muted opacity-20" />
        </div>
      )}
      <div className="absolute bottom-2 right-2 w-8 h-8 rounded-full bg-accent text-bg flex items-center justify-center opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all shadow-xl">
        <ArrowRight className="w-4 h-4 fill-current" />
      </div>
    </div>
    <div className="space-y-0.5">
      <h3 className="text-xs font-bold text-white truncate">{series.title}</h3>
      <p className="text-[10px] text-text-muted line-clamp-2 leading-tight">Collection • {series.description || "Your reading journey"}</p>
    </div>
  </div>
); const BookListItem = React.memo(({ book, onClick, onMore }: { 
  book: Book; 
  onClick: () => void; 
  onMore: (e: React.MouseEvent) => void;
}) => {
  const isRead = book.currentPage >= book.totalPages && book.totalPages > 0;

  return (
    <div
      className="flex items-center gap-3 p-2 rounded-md transition-colors cursor-pointer group/item flex-1 min-w-0"
      onClick={onClick}
    >
      <div className="w-10 h-10 rounded-sm overflow-hidden shadow-lg flex-shrink-0">
        <img 
          src={book.coverUrl} 
          className={`w-full h-full object-cover ${isRead ? 'grayscale opacity-40' : ''}`} 
          referrerPolicy="no-referrer" 
          loading="lazy" 
        />
      </div>
      <div className="flex-1 min-w-0">
        <h3 className={`font-bold text-[13px] truncate ${isRead ? 'text-text-muted' : 'text-white'}`}>
          {book.title}
        </h3>
        <p className="text-[11px] text-text-muted truncate">{book.author}</p>
      </div>
      <button 
        onClick={onMore}
        className="p-2 text-text-muted hover:text-white transition-opacity"
      >
        <MoreVertical className="w-4 h-4" />
      </button>
    </div>
  );
});

const SortableBookItem = React.memo(({ 
  book, 
  idx, 
  onClick, 
  onMore 
}: { 
  book: Book; 
  idx: number; 
  onClick: () => void; 
  onMore: (e: React.MouseEvent) => void;
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: book.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 'auto',
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      className="grid grid-cols-[44px_1fr_48px] gap-4 items-center group/row hover:bg-white/5 rounded-md transition-colors px-2"
    >
      <div 
        {...attributes} 
        {...listeners} 
        className="flex items-center justify-center text-text-muted group-hover/row:text-white cursor-grab active:cursor-grabbing py-4"
      >
        <GripVertical className="w-3 h-3 mr-1 opacity-0 group-hover/row:opacity-100 transition-opacity" />
        <span className="text-xs font-medium">{idx + 1}</span>
      </div>
      <BookListItem
        book={book}
        onClick={onClick}
        onMore={onMore}
      />
      <div className="text-right text-[10px] font-bold text-accent pr-2">
        {Math.round((book.currentPage / (book.totalPages || 1)) * 100)}%
      </div>
    </div>
  );
});

const StarRating = ({ rating, onRate, size = "md", interactive = true }: { rating: number, onRate: (rating: number) => void, size?: "sm" | "md" | "lg", interactive?: boolean }) => {
  const sizes = {
    sm: "w-3 h-3",
    md: "w-6 h-6 md:w-7 md:h-7",
    lg: "w-8 h-8 md:w-10 md:h-10"
  };

  return (
    <div className="flex items-center gap-2 md:gap-3">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={!interactive}
          onClick={(e) => {
            e.stopPropagation();
            if (interactive) onRate(star);
          }}
          className={`${interactive ? 'cursor-pointer hover:scale-125 active:scale-90' : 'cursor-default'} focus:outline-none transition-all duration-300`}
        >
          <Star 
            className={`${sizes[size]} ${star <= rating ? 'fill-accent text-accent' : 'text-white/10 fill-white/5'} transition-colors`} 
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
  const [duplicateBook, setDuplicateBook] = useState<Book | null>(null);

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
        updatedAt: new Date().toISOString()
      });
      setSelectedBookForDetail(editedBook);
      setIsEditingBookDetail(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, "books");
    } finally {
      setIsSaving(false);
    }
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const series = seriesList.find(s => s.id === viewingSeriesId);
    if (!series) return;

    const seriesBooks = books.filter(b => b.seriesId === series.id).sort((a, b) => (a.priority || 0) - (b.priority || 0));
    const oldIndex = seriesBooks.findIndex(b => b.id === active.id.toString());
    const newIndex = seriesBooks.findIndex(b => b.id === over.id.toString());

    if (oldIndex === -1 || newIndex === -1) return;

    const newOrder = arrayMove(seriesBooks, oldIndex, newIndex) as Book[];
    
    // Update priorities in Firestore
    const batch = writeBatch(db);
    newOrder.forEach((book: Book, idx: number) => {
      const bookRef = doc(db, "books", book.id);
      batch.update(bookRef, { priority: idx, updatedAt: new Date().toISOString() });
    });
    
    try {
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, "books");
    }
  };

  const [libraryFilter, setLibraryFilter] = useState<"All" | "Collections" | "Wishlist" | "Dragons">("All");
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
  const [viewingSeriesId, setViewingSeriesId] = useState<string | null>(null);
  const [isUploadingSeriesCover, setIsUploadingSeriesCover] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const compressImage = (base64Str: string, maxWidth = 600, maxHeight = 900): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = base64Str;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width / height > maxWidth / maxHeight) {
          if (width > maxWidth) {
            height *= maxWidth / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width *= maxHeight / height;
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.onerror = () => resolve(base64Str);
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert("File is too large. Please select an image under 5MB.");
        return;
      }

      setIsSaving(true);
      const reader = new FileReader();
      reader.onloadend = async () => {
        const rawBase64 = reader.result as string;
        const base64 = await compressImage(rawBase64);

        if (isUploadingSeriesCover && viewingSeriesId) {
          try {
            const seriesRef = doc(db, "series", viewingSeriesId);
            await updateDoc(seriesRef, { 
              coverUrl: base64,
              updatedAt: new Date().toISOString()
            });
            setIsUploadingSeriesCover(false);
          } catch (error) {
            handleFirestoreError(error, OperationType.UPDATE, "series");
          }
        } else if (isSeriesModalOpen) {
          setNewSeries(prev => ({ ...prev, coverUrl: base64 }));
        } else if (isEditingBookDetail && editedBook) {
          setEditedBook({ ...editedBook, coverUrl: base64 });
        } else if (selectedBookForDetail) {
          try {
            await updateDoc(doc(db, "books", selectedBookForDetail.id), { 
              coverUrl: base64,
              updatedAt: new Date().toISOString()
            });
            setSelectedBookForDetail(prev => prev ? { ...prev, coverUrl: base64 } : null);
          } catch (error) {
            handleFirestoreError(error, OperationType.UPDATE, "books");
          }
        } else {
          setNewBook(prev => ({ ...prev, coverUrl: base64 }));
        }
        setIsSaving(false);
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
    coverUrl: "",
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

      // Check for duplicates first
      const existingBook = books.find(b => b.isbn?.replace(/[-\s]/g, "") === cleanIsbn);
      if (existingBook) {
        setDuplicateBook(existingBook);
        setIsScanning(false);
        setIsFetchingBook(false);
        return;
      }
      
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
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [activeTab, viewingSeriesId]);
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
      uid: user.uid,
      updatedAt: new Date().toISOString()
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
        await updateDoc(doc(db, "series", editingSeries.id), { 
          ...newSeries,
          updatedAt: new Date().toISOString()
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, "series");
      }
    } else {
      const seriesId = doc(collection(db, "series")).id;
      const series: Series = {
        id: seriesId,
        ...newSeries,
        uid: user.uid,
        updatedAt: new Date().toISOString()
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
      await updateDoc(doc(db, "books", bookId), { 
        chapters: updatedChapters,
        updatedAt: new Date().toISOString()
      });
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
      await updateDoc(doc(db, "books", bookId), { 
        chapters: updatedChapters,
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, "books");
    }
  };

  const deleteChapter = async (bookId: string, chapterId: string) => {
    const book = books.find(b => b.id === bookId);
    if (!book || !book.chapters) return;

    const updatedChapters = book.chapters.filter(c => c.id !== chapterId);

    try {
      await updateDoc(doc(db, "books", bookId), { 
        chapters: updatedChapters,
        updatedAt: new Date().toISOString()
      });
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
          finishedDate: isFinished ? (finishedDate || new Date().toISOString()) : null,
          updatedAt: new Date().toISOString()
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
        finishedDate: !isRead ? new Date().toISOString() : null,
        updatedAt: new Date().toISOString()
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
        journalEntries: [...(b.journalEntries || []), newEntry],
        updatedAt: new Date().toISOString()
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
        journalEntries: b.journalEntries?.filter(e => e.id !== entryId),
        updatedAt: new Date().toISOString()
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
        totalPages: bookToMove.totalPages,
        updatedAt: new Date().toISOString()
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
    return books.filter(b => !b.isWishlist).sort((a, b) => {
      const dateA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const dateB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      return dateB - dateA;
    });
  }, [books]);

  // Calendar logic
  const calendarData = useMemo(() => {
    if (activeTab !== "calendar") return { days: [], monthStart: new Date() };
    
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);
    const days = eachDayOfInterval({ start: startDate, end: endDate });

    // Pre-calculate activity for each day to avoid filtering in the render loop
    const activityMap = new Map();
    days.forEach(day => {
      const dayStr = day.toDateString();
      const activity = books.filter(b => {
        const isFinishedToday = b.finishedDate && isSameDay(parseISO(b.finishedDate), day);
        const hasEntryToday = b.journalEntries?.some(e => isSameDay(parseISO(e.date), day));
        return isFinishedToday || hasEntryToday;
      });
      if (activity.length > 0) {
        activityMap.set(dayStr, activity);
      }
    });

    return { days, monthStart, activityMap };
  }, [currentMonth, books, activeTab]);

  const renderCalendar = () => {
    const { days, monthStart, activityMap } = calendarData;

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl md:text-2xl font-bold text-white">{format(currentMonth, "MMMM yyyy")}</h2>
          <div className="flex gap-1">
            <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-2 text-text-muted hover:text-white transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-2 text-text-muted hover:text-white transition-colors">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-px bg-white/5 rounded-lg overflow-hidden border border-white/5">
          {["S", "M", "T", "W", "T", "F", "S"].map((day, i) => (
            <div key={`${day}-${i}`} className="bg-surface p-3 text-center text-[10px] font-bold text-text-muted">
              {day}
            </div>
          ))}
          {days.map((day) => {
            const dayStr = day.toDateString();
            const booksWithActivityOnDay = activityMap.get(dayStr) || [];
            
            const isCurrentMonth = isSameMonth(day, monthStart);
            const isToday = isSameDay(day, new Date());

            return (
              <div 
                key={day.toISOString()} 
                className={`min-h-[80px] md:min-h-[120px] p-2 transition-colors relative ${isCurrentMonth ? 'bg-surface' : 'bg-black/20 opacity-20'}`}
              >
                <span className={`text-[10px] font-medium ${isToday ? 'text-accent font-bold' : 'text-text-muted'}`}>
                  {format(day, "d")}
                </span>
                
                <div className="mt-2 flex flex-wrap gap-1">
                  {booksWithActivityOnDay.map(book => {
                    const entriesToday = book.journalEntries?.filter(e => isSameDay(parseISO(e.date), day)) || [];
                    return (
                      <div
                        key={`${book.id}-${dayStr}`}
                        onClick={() => setSelectedBookForDetail(book)}
                        className="w-8 h-12 md:w-10 md:h-15 rounded-sm overflow-hidden border border-black/20 shadow-sm cursor-pointer hover:scale-105 transition-transform relative group"
                      >
                        <img src={book.coverUrl} className="w-full h-full object-cover" referrerPolicy="no-referrer" loading="lazy" />
                        {entriesToday.length > 0 && (
                          <div className="absolute top-0 right-0 bg-accent w-2 h-2 rounded-full border border-bg" />
                        )}
                      </div>
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

  const scrollRef = useRef<HTMLDivElement>(null);
  const [isDraggingScroll, setIsDraggingScroll] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!scrollRef.current) return;
    setIsDraggingScroll(true);
    setStartX(e.pageX - scrollRef.current.offsetLeft);
    setScrollLeft(scrollRef.current.scrollLeft);
  };

  const handleMouseLeave = () => {
    setIsDraggingScroll(false);
  };

  const handleMouseUp = () => {
    setIsDraggingScroll(false);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingScroll || !scrollRef.current) return;
    e.preventDefault();
    const x = e.pageX - scrollRef.current.offsetLeft;
    const walk = (x - startX) * 2; // Scroll speed
    scrollRef.current.scrollLeft = scrollLeft - walk;
  };

  const recentScrollRef = useRef<HTMLDivElement>(null);
  const [isDraggingRecent, setIsDraggingRecent] = useState(false);
  const [startRecentX, setStartRecentX] = useState(0);
  const [scrollRecentLeft, setScrollRecentLeft] = useState(0);

  const handleRecentMouseDown = (e: React.MouseEvent) => {
    if (!recentScrollRef.current) return;
    setIsDraggingRecent(true);
    setStartRecentX(e.pageX - recentScrollRef.current.offsetLeft);
    setScrollRecentLeft(recentScrollRef.current.scrollLeft);
  };

  const handleRecentMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRecent || !recentScrollRef.current) return;
    e.preventDefault();
    const x = e.pageX - recentScrollRef.current.offsetLeft;
    const walk = (x - startRecentX) * 2;
    recentScrollRef.current.scrollLeft = scrollRecentLeft - walk;
  };

  return (
    <div className="min-h-screen bg-[#121212] selection:bg-accent/30 flex flex-col pb-24 md:pb-0">
      {/* Compact Header for Mobile */}
      <header className={`sticky top-0 z-40 bg-[#121212]/95 backdrop-blur-2xl md:hidden px-6 py-4 flex flex-col gap-0.5 border-b border-white/5 ${viewingSeriesId ? 'hidden' : ''}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-accent/10 flex items-center justify-center">
              <Library className="w-2.5 h-2.5 text-accent" />
            </div>
            <span className="text-[9px] font-bold text-accent uppercase tracking-widest">Your Library</span>
          </div>
          {user && (
            <button onClick={() => setIsSettingsModalOpen(true)} className="p-1 text-text-muted hover:text-white">
              <Settings2 className="w-4 h-4" />
            </button>
          )}
        </div>
        <h1 className="text-2xl font-black text-white tracking-tight">
          {viewingSeriesId ? seriesList.find(s => s.id === viewingSeriesId)?.title : 
           activeTab === "collections" ? "Your Library" : 
           activeTab === "calendar" ? "Reading Log" : 
           activeTab === "dragons" ? "Dragon Books" : "Wishlist"}
        </h1>
        {user && !viewingSeriesId && (
          <p className="text-[10px] text-text-muted font-medium">Welcome back, {user.displayName?.split(' ')[0]}</p>
        )}
      </header>

      {/* Hero Section - Hidden on mobile, shown on desktop */}
      <section className="hidden md:block relative pt-12 pb-8 px-6 overflow-hidden">
        <div className="max-w-6xl mx-auto relative z-10">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
            <div className="space-y-2 flex-1">
              <h1 className="text-6xl font-black tracking-tighter text-white leading-tight">
                {activeTab === "collections" ? "Your Library" : 
                 activeTab === "calendar" ? "Reading Log" :
                 activeTab === "dragons" ? "Dragon Books" : "Wishlist"}
              </h1>
              <p className="text-text-muted font-medium">
                {user ? `Welcome back, ${user.displayName?.split(' ')[0]}` : 'Track your reading journey'}
              </p>
            </div>
            
            <div className="flex items-center gap-6 flex-shrink-0">
              {user && activeTab === "collections" && (
                <button 
                  onClick={() => {
                    setEditingSeries(null);
                    setNewSeries({ title: "", description: "", color: "#e6a8d7" });
                    setIsSeriesModalOpen(true);
                  }}
                  className="flex items-center gap-2 px-8 py-4 bg-accent text-black rounded-full font-bold hover:scale-105 transition-all"
                >
                  <Plus className="w-6 h-6" />
                  New Collection
                </button>
              )}
              
              {user && (
                <div className="flex items-center gap-3 pl-6 border-l border-white/10">
                  <div className="flex flex-col items-end">
                    <span className="text-[10px] font-bold text-white uppercase tracking-widest">{user.displayName}</span>
                    <button onClick={logOut} className="text-[8px] text-text-muted hover:text-red-400 uppercase tracking-widest font-bold">Sign Out</button>
                  </div>
                  <img src={user.photoURL || ""} alt="Profile" className="w-10 h-10 rounded-full border border-white/10" />
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Desktop Tabs */}
      <div className="hidden md:flex max-w-6xl mx-auto px-6 mb-8 gap-10 border-b border-white/5">
        {[
          { id: "collections", label: "Library", icon: Library },
          { id: "calendar", label: "Reading Log", icon: CalendarIcon },
          { id: "wishlist", label: "Wishlist", icon: ShoppingBag },
          { id: "dragons", label: "Dragons", icon: Flame },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as Tab)}
            className={`flex items-center gap-3 pb-5 text-sm font-bold transition-all relative ${activeTab === tab.id ? 'text-white' : 'text-text-muted hover:text-white'}`}
          >
            <tab.icon className={`w-5 h-5 ${activeTab === tab.id ? 'text-accent' : ''}`} />
            {tab.label}
            {activeTab === tab.id && (
              <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent" />
            )}
          </button>
        ))}
      </div>

      <main className="max-w-6xl mx-auto px-6 pb-12 flex-1 w-full mt-6 md:mt-0">
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
                <div className="space-y-8">
                  {viewingSeriesId ? (
                    <div className="space-y-4">
                      {/* Series Detail View (Spotify Style) */}
                      {seriesList.find(s => s.id === viewingSeriesId) && (() => {
                        const series = seriesList.find(s => s.id === viewingSeriesId)!;
                        const seriesBooks = books.filter(b => b.seriesId === series.id).sort((a, b) => (a.priority || 0) - (b.priority || 0));
                        const totalPages = seriesBooks.reduce((acc, b) => acc + b.totalPages, 0);
                        const currentPages = seriesBooks.reduce((acc, b) => acc + b.currentPage, 0);
                        const progress = totalPages > 0 ? (currentPages / totalPages) * 100 : 0;

                        return (
                          <div className="space-y-6 -mx-6 -mt-6">
                            {/* Spotify Header Style with Dynamic Gradient */}
                            <div 
                              className="relative pt-20 pb-8 px-6 flex flex-col items-center text-center md:flex-row md:items-end md:text-left gap-6 transition-colors duration-500"
                              style={{ 
                                background: `linear-gradient(to bottom, ${series.color || '#1DB954'}cc, #121212)` 
                              }}
                            >
                              {/* Floating Back Button - Sticky behavior handled by scrollY */}
                              <button 
                                onClick={() => setViewingSeriesId(null)}
                                className={`fixed left-6 w-8 h-8 rounded-full flex items-center justify-center text-white transition-all z-[60] md:absolute ${scrollY > 200 ? 'top-3 bg-transparent' : 'top-8 bg-black/20 hover:bg-black/40'} ${currentBookDetail ? 'hidden' : ''}`}
                              >
                                <ChevronLeft className="w-5 h-5" />
                              </button>

                              {/* Sticky Title Bar for Mobile */}
                              <AnimatePresence>
                                {scrollY > 200 && (
                                  <motion.div
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    className="fixed top-0 left-0 right-0 h-14 flex items-center justify-center px-16 z-50 md:hidden shadow-2xl"
                                    style={{ 
                                      background: `linear-gradient(to bottom, ${series.color || '#121212'}cc, #121212)` 
                                    }}
                                  >
                                    <div className="absolute inset-0 backdrop-blur-xl" />
                                    <h2 className="relative z-10 text-sm font-black text-white truncate">{series.title}</h2>
                                  </motion.div>
                                )}
                              </AnimatePresence>

                              <motion.div 
                                style={{ 
                                  opacity: Math.max(0, 1 - scrollY / 250),
                                  scale: Math.max(0.7, 1 - scrollY / 1000)
                                }}
                                className="w-44 md:w-52 aspect-square rounded-lg bg-surface-hover shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden relative group shrink-0"
                              >
                                {series.coverUrl ? (
                                  <img src={series.coverUrl} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                ) : (
                                  <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-text-muted">
                                    <Library className="w-12 h-12 opacity-20" />
                                    <span className="text-[10px] font-bold uppercase tracking-widest">No Cover</span>
                                  </div>
                                )}
                              </motion.div>

                              <motion.div 
                                style={{ opacity: Math.max(0, 1 - scrollY / 300) }}
                                className="flex-1 space-y-3"
                              >
                                <div className="space-y-1">
                                  <span className="text-[10px] font-bold text-white uppercase tracking-tight">Collection</span>
                                  <h2 className="text-4xl md:text-6xl font-black text-white tracking-tighter leading-none">{series.title}</h2>
                                </div>
                                <div className="flex items-center justify-center md:justify-start gap-2 text-[11px] font-bold text-text-muted">
                                  <div className="w-5 h-5 rounded-full bg-accent/20 flex items-center justify-center overflow-hidden shrink-0">
                                     {user?.photoURL ? <img src={user.photoURL} className="w-full h-full object-cover" /> : <UserIcon className="w-3 h-3 text-accent" />}
                                  </div>
                                  <span className="text-white hover:underline cursor-pointer">{user?.displayName}</span>
                                  <span>•</span>
                                  <span className="text-white">{seriesBooks.length} books</span>
                                  <span>•</span>
                                  <span>{Math.round(progress)}% read</span>
                                </div>
                              </motion.div>
                            </div>

                            {/* Action Bar */}
                            <div className="flex items-center justify-between py-2 px-2">
                              <div className="flex items-center gap-6">
                                <button className="w-12 h-12 rounded-full bg-accent text-bg flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-all">
                                  <ArrowRight className="w-6 h-6 fill-current" />
                                </button>
                                <button 
                                  onClick={() => {
                                    setEditingSeries(series);
                                    setNewSeries({ title: series.title, description: series.description || "", color: series.color || "#e6a8d7", coverUrl: series.coverUrl || "" });
                                    setIsSeriesModalOpen(true);
                                  }}
                                  className="text-text-muted hover:text-white transition-colors"
                                  title="Edit Collection"
                                >
                                  <MoreVertical className="w-6 h-6" />
                                </button>
                              </div>
                            </div>

                            {/* Books List Header */}
                            <div className="px-6 py-2 border-b border-white/5 grid grid-cols-[44px_1fr_48px] gap-4 text-[10px] font-bold text-text-muted uppercase tracking-widest">
                              <div className="text-center">#</div>
                              <div>Title</div>
                              <div className="text-right"><Clock className="w-3 h-3 ml-auto" /></div>
                            </div>

                            {/* Books List */}
                            <div className="space-y-1">
                              <DndContext 
                                sensors={sensors}
                                collisionDetection={closestCenter}
                                onDragEnd={handleDragEnd}
                              >
                                <SortableContext 
                                  items={seriesBooks.map(b => b.id)}
                                  strategy={verticalListSortingStrategy}
                                >
                                  {seriesBooks.map((book, idx) => (
                                    <SortableBookItem
                                      key={book.id}
                                      book={book}
                                      idx={idx}
                                      onClick={() => setSelectedBookForDetail(book)}
                                      onMore={(e) => {
                                        e.stopPropagation();
                                        setSelectedBookForDetail(book);
                                      }}
                                    />
                                  ))}
                                </SortableContext>
                              </DndContext>
                              <button 
                                onClick={() => {
                                  setNewBook({ ...newBook, seriesId: series.id, isWishlist: false, coverUrl: "" });
                                  setIsAddBookModalOpen(true);
                                }}
                                className="w-full flex items-center gap-3 p-2 px-6 rounded-md hover:bg-white/5 transition-colors group/add"
                              >
                                <div className="w-10 h-10 rounded-sm border border-dashed border-white/10 flex items-center justify-center text-text-muted group-hover/add:border-accent group-hover/add:text-accent transition-colors">
                                  <Plus className="w-4 h-4" />
                                </div>
                                <span className="text-xs font-bold text-text-muted group-hover/add:text-white">Add Book</span>
                              </button>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  ) : (
                    <div className="space-y-10">
                      {/* Filter Pills */}
                      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
                        {(["All", "Collections", "Wishlist", "Dragons"] as const).map((filter) => (
                          <button 
                            key={filter}
                            onClick={() => setLibraryFilter(filter)}
                            className={`px-4 py-1.5 rounded-full text-[11px] font-bold transition-all whitespace-nowrap ${libraryFilter === filter ? 'bg-accent text-bg' : 'bg-white/10 text-white hover:bg-white/20'}`}
                          >
                            {filter}
                          </button>
                        ))}
                      </div>

                      {libraryFilter === "All" && (
                        <div className="space-y-10">
                          {/* Your recent series */}
                          <section className="space-y-4">
                            <h2 className="text-2xl font-black text-white tracking-tight">Your recent series</h2>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                              {seriesList.slice(0, 6).map((series) => (
                                <SeriesCardHorizontal 
                                  key={series.id} 
                                  series={series} 
                                  onClick={() => setViewingSeriesId(series.id)} 
                                />
                              ))}
                            </div>
                          </section>

                          {/* Made For You */}
                          <section className="space-y-4">
                            <h2 className="text-xl font-black text-white tracking-tight">Made For {user.displayName?.split(' ')[0]}</h2>
                            <div 
                              ref={scrollRef}
                              onMouseDown={handleMouseDown}
                              onMouseLeave={handleMouseLeave}
                              onMouseUp={handleMouseUp}
                              onMouseMove={handleMouseMove}
                              className={`flex items-start gap-4 overflow-x-auto pb-4 spotify-scrollbar ${isDraggingScroll ? 'cursor-grabbing select-none' : 'cursor-grab'}`}
                            >
                              {seriesList.map((series) => (
                                <div key={series.id} className="shrink-0">
                                  <SeriesCardSquare 
                                    series={series} 
                                    onClick={() => setViewingSeriesId(series.id)} 
                                  />
                                </div>
                              ))}
                              <div className="w-4 shrink-0" /> {/* Spacer for end of scroll */}
                              {seriesList.length === 0 && (
                                <div className="w-full py-12 text-center card border-dashed">
                                  <Library className="w-12 h-12 text-accent/20 mx-auto mb-4" />
                                  <p className="text-xs text-text-muted">No collections yet</p>
                                </div>
                              )}
                            </div>
                          </section>

                          {/* Recently Updated (Books) */}
                          <section className="space-y-4">
                            <h2 className="text-xl font-black text-white tracking-tight">Recently Updated</h2>
                            <div 
                              ref={recentScrollRef}
                              onMouseDown={handleRecentMouseDown}
                              onMouseLeave={() => setIsDraggingRecent(false)}
                              onMouseUp={() => setIsDraggingRecent(false)}
                              onMouseMove={handleRecentMouseMove}
                              className={`flex items-start gap-4 overflow-x-auto pb-4 spotify-scrollbar ${isDraggingRecent ? 'cursor-grabbing select-none' : 'cursor-grab'}`}
                            >
                              {ownedBooks.slice(0, 10).map((book) => (
                                <div 
                                  key={book.id}
                                  onClick={() => !isDraggingRecent && setSelectedBookForDetail(book)}
                                  className="flex flex-col gap-2 p-3 rounded-xl bg-surface hover:bg-surface-hover transition-all cursor-pointer group w-32 shrink-0"
                                >
                                  <div className="aspect-[2/3] w-full rounded-lg overflow-hidden shadow-2xl relative">
                                    <img src={book.coverUrl} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                  </div>
                                  <div className="space-y-0.5">
                                    <h3 className="text-[11px] font-bold text-white truncate">{book.title}</h3>
                                    <p className="text-[9px] text-text-muted truncate">{book.author}</p>
                                  </div>
                                </div>
                              ))}
                              <div className="w-4 shrink-0" /> {/* Spacer for end of scroll */}
                            </div>
                          </section>
                        </div>
                      )}

                      {libraryFilter === "Collections" && (
                        <div className="space-y-6">
                          <div className="flex items-center justify-between">
                            <h2 className="text-2xl font-black text-white tracking-tight">All Collections</h2>
                            <button 
                              onClick={() => setIsSeriesModalOpen(true)}
                              className="text-xs font-bold text-accent hover:underline"
                            >
                              + New Collection
                            </button>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                            {seriesList.map((series) => (
                              <SeriesCardHorizontal 
                                key={series.id} 
                                series={series} 
                                onClick={() => setViewingSeriesId(series.id)} 
                              />
                            ))}
                          </div>
                        </div>
                      )}

                      {libraryFilter === "Wishlist" && (
                        <div className="space-y-6">
                          <div className="flex items-center justify-between">
                            <h2 className="text-2xl font-black text-white tracking-tight">Your Wishlist</h2>
                            <button 
                              onClick={() => {
                                setNewBook({ ...newBook, isWishlist: true, isDragonBook: false, coverUrl: "" });
                                setIsAddBookModalOpen(true);
                              }}
                              className="text-xs font-bold text-accent hover:underline"
                            >
                              + Add Book
                            </button>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                            {wishlistBooks.map((book) => (
                              <div 
                                key={book.id}
                                onClick={() => setSelectedBookForDetail(book)}
                                className="flex flex-col gap-2 p-3 rounded-xl bg-surface hover:bg-surface-hover transition-all cursor-pointer group"
                              >
                                <div className="aspect-[2/3] w-full rounded-lg overflow-hidden shadow-2xl relative">
                                  <img src={book.coverUrl} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                </div>
                                <div className="space-y-0.5">
                                  <h3 className="text-[11px] font-bold text-white truncate">{book.title}</h3>
                                  <p className="text-[9px] text-text-muted truncate">{book.author}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {libraryFilter === "Dragons" && (
                        <div className="space-y-6">
                          <div className="flex items-center justify-between">
                            <h2 className="text-2xl font-black text-white tracking-tight">Dragon Books</h2>
                            <button 
                              onClick={() => {
                                setNewBook({ ...newBook, isWishlist: false, isDragonBook: true, coverUrl: "" });
                                setIsAddBookModalOpen(true);
                              }}
                              className="text-xs font-bold text-accent hover:underline"
                            >
                              + Add Dragon Book
                            </button>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                            {dragonBooks.map((book) => (
                              <div 
                                key={book.id}
                                onClick={() => setSelectedBookForDetail(book)}
                                className="flex flex-col gap-2 p-3 rounded-xl bg-surface hover:bg-surface-hover transition-all cursor-pointer group"
                              >
                                <div className="aspect-[2/3] w-full rounded-lg overflow-hidden shadow-2xl relative">
                                  <img src={book.coverUrl} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                </div>
                                <div className="space-y-0.5">
                                  <h3 className="text-[11px] font-bold text-white truncate">{book.title}</h3>
                                  <p className="text-[9px] text-text-muted truncate">{book.author}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
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

      {/* Spotify-like Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-[#121212]/95 backdrop-blur-2xl px-2 pt-2 pb-8 border-t border-white/5">
        <div className="flex justify-around items-center max-w-md mx-auto">
          {[
            { id: "collections", label: "Home", icon: Library },
            { id: "calendar", label: "Log", icon: CalendarIcon },
            { id: "wishlist", label: "Wishlist", icon: ShoppingBag },
            { id: "dragons", label: "Dragons", icon: Flame },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as Tab)}
              className={`flex-1 flex flex-col items-center py-2 gap-1 transition-all active:scale-95 ${activeTab === tab.id ? 'text-white' : 'text-text-muted'}`}
            >
              <tab.icon className={`w-6 h-6 transition-all ${activeTab === tab.id ? 'text-accent fill-accent/20' : ''}`} />
              <span className={`text-[9px] font-medium tracking-tight transition-all ${activeTab === tab.id ? 'opacity-100' : 'opacity-60'}`}>{tab.label}</span>
            </button>
          ))}
        </div>
      </nav>

              {/* Mobile Floating Action Button */}
              {activeTab === "collections" && user && !viewingSeriesId && (
                <div className="fixed bottom-28 right-6 z-40 flex flex-col gap-4 items-end md:hidden">
                  <button 
                    onClick={() => {
                      setEditingSeries(null);
                      setNewSeries({ title: "", description: "", color: "#e6a8d7", coverUrl: "" });
                      setIsSeriesModalOpen(true);
                    }}
                    className="w-16 h-16 rounded-full bg-accent text-bg shadow-2xl flex items-center justify-center active:scale-90 transition-transform"
                  >
                    <Plus className="w-10 h-10" />
                  </button>
                </div>
              )}

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

        <div className="flex items-center justify-between p-4 rounded-xl bg-[#242424] group hover:bg-[#2a2a2a] transition-all">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg transition-colors ${newBook.isDragonBook ? 'bg-accent/20 text-accent' : 'bg-black/40 text-text-muted'}`}>
              <Flame className="w-5 h-5" />
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-bold text-white">Dragon Book</span>
              <span className="text-[10px] text-text-muted">Special collection</span>
            </div>
          </div>
          <button 
            type="button"
            onClick={() => setNewBook({...newBook, isDragonBook: !newBook.isDragonBook})}
            className={`w-10 h-5 rounded-full relative transition-colors ${newBook.isDragonBook ? 'bg-accent' : 'bg-black'}`}
          >
            <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${newBook.isDragonBook ? 'left-5' : 'left-1'}`} />
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
          <div key="series-modal-container" className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsSeriesModalOpen(false)} className="absolute inset-0 bg-bg/80 backdrop-blur-md" />
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="relative w-full max-w-md card p-8 max-h-[90vh] overflow-y-auto scrollbar-hide">
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-2xl font-serif font-bold">{editingSeries ? "Edit Collection" : "New Collection"}</h3>
                <button onClick={() => setIsSeriesModalOpen(false)} className="p-2 text-text-muted hover:text-white"><X className="w-5 h-5" /></button>
              </div>
              <form onSubmit={handleSaveSeries} className="space-y-6">
                <div 
                  className="w-32 h-32 mx-auto rounded-2xl bg-surface-hover border-2 border-dashed border-white/10 flex flex-col items-center justify-center gap-2 text-text-muted hover:border-accent hover:text-accent transition-all cursor-pointer overflow-hidden relative group"
                  onClick={() => {
                    setIsUploadingSeriesCover(false); // This is for the "New/Edit" modal, not the detail view
                    fileInputRef.current?.click();
                  }}
                >
                  {newSeries.coverUrl ? (
                    <img src={newSeries.coverUrl} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <>
                      <Upload className="w-6 h-6" />
                      <span className="text-[8px] font-bold uppercase tracking-widest">Cover</span>
                    </>
                  )}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Upload className="w-4 h-4 text-white" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-[0.2em] text-text-muted font-bold">Collection Title</label>
                  <input required value={newSeries.title} onChange={e => setNewSeries({...newSeries, title: e.target.value})} className="input-field" placeholder="e.g. The Lord of the Rings" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-[0.2em] text-text-muted font-bold">Description</label>
                  <textarea value={newSeries.description} onChange={e => setNewSeries({...newSeries, description: e.target.value})} className="input-field h-24 resize-none" placeholder="Brief description of the saga..." />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] uppercase tracking-[0.2em] text-text-muted font-bold">Theme Color</label>
                    <input 
                      type="color" 
                      value={newSeries.color || "#1DB954"} 
                      onChange={e => setNewSeries({...newSeries, color: e.target.value})}
                      className="w-6 h-6 rounded-md bg-transparent border-none cursor-pointer"
                    />
                  </div>
                  <div className="flex flex-wrap gap-2 md:gap-3">
                    {[
                      "#1DB954", "#e91e63", "#9c27b0", "#673ab7", "#3f51b5", "#2196f3",
                      "#00bcd4", "#009688", "#4caf50", "#8bc34a", "#cddc39", "#ffeb3b",
                      "#ffc107", "#ff9800", "#ff5722", "#795548"
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
                <div className="space-y-4">
                  <div className="flex items-center gap-3 text-white">
                    <Library className="w-5 h-5 text-accent" />
                    <h4 className="font-bold uppercase tracking-widest text-xs">Manage Collections</h4>
                  </div>
                  
                  <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-2 scrollbar-hide">
                    {seriesList.map((series) => (
                      <div key={`settings-series-${series.id}`} className="flex items-center justify-between p-4 rounded-xl bg-surface border border-white/5 group">
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: series.color }} />
                          <span className="text-sm font-bold text-white">{series.title}</span>
                        </div>
                        <div className="flex gap-2">
                          <button 
                            onClick={() => {
                              setEditingSeries(series);
                              setNewSeries({ title: series.title, description: series.description || "", color: series.color || "#e6a8d7", coverUrl: series.coverUrl || "" });
                              setIsSeriesModalOpen(true);
                            }}
                            className="p-2 text-text-muted hover:text-accent transition-colors"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => {
                              if (window.confirm(`Are you sure you want to delete "${series.title}"? Books will be moved to standalone.`)) {
                                deleteSeries(series.id);
                              }
                            }}
                            className="p-2 text-text-muted hover:text-red-400 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                    {seriesList.length === 0 && (
                      <p className="text-xs text-text-muted italic text-center py-4">No collections found.</p>
                    )}
                  </div>
                </div>

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
          <div key="book-detail-modal-overlay" className="fixed inset-0 z-50 flex items-center justify-center p-0 md:p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => setSelectedBookForDetail(null)} 
              className="absolute inset-0 bg-black/95 backdrop-blur-xl" 
            />
            <motion.div 
              layoutId={currentBookDetail.id}
              className="relative w-full h-full md:h-auto md:max-w-2xl bg-[#121212] md:rounded-3xl shadow-2xl overflow-y-auto flex flex-col max-h-screen md:max-h-[90vh] scrollbar-hide"
            >
              {/* Spotify-style Header */}
              <div 
                className="relative pt-16 pb-8 px-6 flex flex-col items-center text-center gap-6 shrink-0"
                style={{ 
                  background: `linear-gradient(to bottom, ${seriesList.find(s => s.id === currentBookDetail.seriesId)?.color || '#1DB954'}44, #121212)` 
                }}
              >
                <button 
                  onClick={() => setSelectedBookForDetail(null)} 
                  className="fixed md:absolute top-6 left-6 p-2 text-white/70 hover:text-white transition-colors z-[70]"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>

                <div className="relative group">
                  <div className="w-48 md:w-56 aspect-[2/3] rounded-lg overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex-shrink-0">
                    <img src={currentBookDetail.coverUrl} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  </div>
                  <button 
                    onClick={() => {
                      setEditedBook(currentBookDetail);
                      setIsEditingBookDetail(true);
                      setTimeout(() => fileInputRef.current?.click(), 100);
                    }}
                    className="absolute bottom-2 right-2 w-10 h-10 rounded-full bg-black/60 backdrop-blur-md border border-white/10 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-all shadow-xl"
                  >
                    <Edit3 className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-2">
                  <h3 className="text-3xl font-black text-white tracking-tighter leading-tight">{currentBookDetail.title}</h3>
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-accent/20 flex items-center justify-center overflow-hidden shrink-0">
                      {user?.photoURL ? <img src={user.photoURL} className="w-full h-full object-cover" /> : <UserIcon className="w-3 h-3 text-accent" />}
                    </div>
                    <p className="text-white font-bold text-sm">{currentBookDetail.author}</p>
                  </div>
                  <div className="flex justify-center pt-1">
                    <StarRating 
                      rating={currentBookDetail.rating || 0} 
                      onRate={async (r) => {
                        try {
                          await updateDoc(doc(db, "books", currentBookDetail.id), { rating: r });
                        } catch (error) {
                          handleFirestoreError(error, OperationType.UPDATE, "books");
                        }
                      }} 
                      size="sm"
                    />
                  </div>
                </div>
              </div>

              <div className="px-6 pb-24 space-y-8">
                {/* Action Row */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-6">
                    {!currentBookDetail.isWishlist && (
                      <button 
                        onClick={() => setIsAddChapterModalOpen(true)}
                        className="w-14 h-14 rounded-full bg-accent text-bg flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-all"
                      >
                        <Plus className="w-7 h-7" />
                      </button>
                    )}
                    {currentBookDetail.isWishlist && (
                      <button 
                        onClick={() => {
                          setBookToMove(currentBookDetail);
                          setIsSelectSeriesModalOpen(true);
                          setSelectedBookForDetail(null);
                        }}
                        className="w-14 h-14 rounded-full bg-green-500 text-white flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-all"
                      >
                        <CheckCircle2 className="w-7 h-7" />
                      </button>
                    )}
                    <button 
                      onClick={() => setIsEditingBookDetail(true)}
                      className="text-text-muted hover:text-white transition-colors"
                    >
                      <Settings2 className="w-6 h-6" />
                    </button>
                  </div>
                  <button 
                    onClick={() => deleteBook(currentBookDetail.id)}
                    className="text-red-500/70 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="w-6 h-6" />
                  </button>
                </div>

                {/* Progress Section */}
                <div className="bg-surface/30 rounded-2xl p-6 space-y-4">
                  <div className="flex justify-between items-end">
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Reading Progress</span>
                      <p className="text-2xl font-black text-white">{Math.round((currentBookDetail.currentPage / currentBookDetail.totalPages) * 100)}%</p>
                    </div>
                    <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">{currentBookDetail.currentPage} / {currentBookDetail.totalPages} pages</p>
                  </div>
                  <ProgressInput 
                    bookId={currentBookDetail.id}
                    currentPage={currentBookDetail.currentPage}
                    totalPages={currentBookDetail.totalPages}
                    onUpdate={updateProgress}
                  />
                </div>

                {/* Chapters Section */}
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h4 className="text-lg font-black text-white tracking-tight">Chapters & Notes</h4>
                    <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">{currentBookDetail.chapters?.length || 0} entries</span>
                  </div>
                  
                  {currentBookDetail.chapters && currentBookDetail.chapters.length > 0 ? (
                    <div className="space-y-2">
                      {currentBookDetail.chapters.map((chapter, idx) => (
                        <div 
                          key={`chapter-item-${chapter.id}-${idx}`}
                          className="group flex items-start gap-4 p-4 rounded-xl hover:bg-white/5 transition-all cursor-default"
                        >
                          <div className="w-8 h-8 rounded-lg bg-surface flex items-center justify-center text-[10px] font-bold text-text-muted shrink-0">
                            {idx + 1}
                          </div>
                          <div className="flex-1 min-w-0 space-y-1">
                            <h5 className="text-sm font-bold text-white truncate">{chapter.title}</h5>
                            <p className="text-xs text-text-muted line-clamp-2 leading-relaxed">{chapter.notes}</p>
                            <span className="text-[9px] text-text-muted/50 font-medium">{new Date(chapter.timestamp).toLocaleDateString()}</span>
                          </div>
                          <button 
                            onClick={() => deleteChapter(currentBookDetail.id, chapter.id)}
                            className="p-2 text-text-muted opacity-0 group-hover:opacity-100 hover:text-red-400 transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-12 flex flex-col items-center justify-center gap-4 text-text-muted border-2 border-dashed border-white/5 rounded-3xl">
                      <BookOpen className="w-10 h-10 opacity-20" />
                      <p className="text-xs font-bold uppercase tracking-widest opacity-50">No chapters recorded</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Edit Mode Overlay */}
              <AnimatePresence>
                {isEditingBookDetail && editedBook && (
                  <motion.div 
                    initial={{ opacity: 0, y: '100%' }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: '100%' }}
                    className="absolute inset-0 bg-[#121212] z-50 flex flex-col"
                  >
                    <div className="p-6 border-b border-white/5 flex justify-between items-center bg-surface/30 backdrop-blur-md">
                      <h3 className="text-xl font-black text-white tracking-tight">Edit Book</h3>
                      <button onClick={() => setIsEditingBookDetail(false)} className="p-2 text-text-muted hover:text-white"><X className="w-5 h-5" /></button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide">
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
                            <input value={editedBook.title} onChange={e => setEditedBook({...editedBook, title: e.target.value})} className="input-field text-sm" />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] uppercase tracking-[0.2em] text-text-muted font-bold">Author</label>
                            <input value={editedBook.author} onChange={e => setEditedBook({...editedBook, author: e.target.value})} className="input-field text-sm" />
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-[10px] uppercase tracking-[0.2em] text-text-muted font-bold">Current Page</label>
                          <input type="number" value={editedBook.currentPage} onChange={e => setEditedBook({...editedBook, currentPage: parseInt(e.target.value) || 0})} className="input-field text-sm" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] uppercase tracking-[0.2em] text-text-muted font-bold">Total Pages</label>
                          <input type="number" value={editedBook.totalPages} onChange={e => setEditedBook({...editedBook, totalPages: parseInt(e.target.value) || 0})} className="input-field text-sm" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] uppercase tracking-[0.2em] text-text-muted font-bold">Collection</label>
                        <select value={editedBook.seriesId || ""} onChange={e => setEditedBook({...editedBook, seriesId: e.target.value})} className="input-field text-sm">
                          <option value="">No Collection</option>
                          {seriesList.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="p-6 border-t border-white/5 bg-surface/30 backdrop-blur-md">
                      <button 
                        onClick={handleUpdateBook}
                        disabled={isSaving}
                        className="w-full py-4 bg-accent text-bg rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:opacity-90 transition-all shadow-xl shadow-accent/20 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                        Save Changes
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </div>
        )}

        {isScanning && (
          <div key="scanning-modal-container" className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsScanning(false)} className="absolute inset-0 bg-bg/90 backdrop-blur-xl" />
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="relative w-full max-w-md bg-surface border border-white/10 rounded-[32px] p-8 shadow-2xl overflow-hidden">
              <div className="flex justify-between items-center mb-8">
                <div className="space-y-1">
                  <h3 className="text-2xl font-serif font-bold text-white">Scan Barcode</h3>
                  <p className="text-[10px] text-text-muted uppercase tracking-widest font-bold">Point your camera at the barcode</p>
                </div>
                <button onClick={() => setIsScanning(false)} className="p-2 text-text-muted hover:text-white transition-colors"><X className="w-6 h-6" /></button>
              </div>
              
              <div className="rounded-2xl overflow-visible border border-white/10 bg-black/40 relative">
                <BarcodeScanner 
                  onScanSuccess={(isbn) => {
                    console.log("Barcode scanned successfully:", isbn);
                    setIsScanning(false);
                    setIsAddBookModalOpen(true);
                    fetchBookByISBN(isbn);
                  }}
                />
              </div>

              <div className="grid grid-cols-2 gap-4 mt-8">
                <button 
                  onClick={() => {
                    setIsScanning(false);
                    setIsAddBookModalOpen(true);
                  }}
                  className="btn-secondary py-4 text-[10px] uppercase tracking-widest font-bold"
                >
                  Manual Entry
                </button>
                <button 
                  onClick={() => setIsScanning(false)}
                  className="btn-primary py-4 text-[10px] uppercase tracking-widest font-bold"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {duplicateBook && (
          <div key="duplicate-modal-container" className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => setDuplicateBook(null)} 
              className="absolute inset-0 bg-black/60 backdrop-blur-sm" 
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }} 
              animate={{ opacity: 1, scale: 1 }} 
              exit={{ opacity: 0, scale: 0.9 }} 
              className="relative w-full max-w-[320px] bg-surface border border-white/10 rounded-[32px] p-8 text-center shadow-2xl"
            >
              <div className="w-14 h-14 bg-accent/10 text-accent rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Library className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-serif font-bold mb-2 text-white">Already Owned</h3>
              <p className="text-text-muted text-sm mb-8 leading-relaxed">
                You already have <span className="text-white font-bold italic">"{duplicateBook.title}"</span> in your library.
              </p>
              <div className="flex flex-col gap-3">
                <button 
                  onClick={() => {
                    setSelectedBookForDetail(duplicateBook);
                    setDuplicateBook(null);
                  }}
                  className="w-full bg-accent hover:bg-accent/90 text-bg font-bold py-4 rounded-2xl transition-all shadow-lg shadow-accent/20 active:scale-95"
                >
                  View Book
                </button>
                <button 
                  onClick={() => setDuplicateBook(null)}
                  className="w-full py-4 text-text-muted hover:text-white font-bold transition-colors text-sm"
                >
                  Dismiss
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
