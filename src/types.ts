export interface Chapter {
  id: string;
  title: string;
  notes: string;
}

export interface JournalEntry {
  id: string;
  date: string; // ISO string
  content: string;
}

export interface Book {
  id: string;
  title: string;
  author: string;
  coverUrl: string;
  currentPage: number;
  totalPages: number;
  seriesId?: string;
  priority: number;
  isBought?: boolean;
  isWishlist?: boolean;
  isDragonBook?: boolean;
  finishedDate?: string; // ISO string
  notes?: string; // Legacy field
  journalEntries?: JournalEntry[];
  chapters?: Chapter[];
  uid: string;
}

export interface Series {
  id: string;
  title: string;
  description?: string;
  color?: string;
  uid: string;
}
