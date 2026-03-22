/**
 * Chapter Types
 *
 * Type definitions for Book-Guided Chat Workflow feature.
 * These types define the 11-chapter IDEA framework progression structure
 * used to guide users through Trevor's brand-building methodology.
 */

/**
 * Chapter identifier for the 11-chapter IDEA framework progression
 */
export type ChapterId =
  | 'chapter-01-introduction'
  | 'chapter-02-insight-fundamentals'
  | 'chapter-03-insight-application'
  | 'chapter-04-distinctive-positioning'
  | 'chapter-05-distinctive-execution'
  | 'chapter-06-empathetic-understanding'
  | 'chapter-07-empathetic-connection'
  | 'chapter-08-authentic-values'
  | 'chapter-09-authentic-expression'
  | 'chapter-10-integration-strategy'
  | 'chapter-11-implementation';

/**
 * IDEA framework category that a chapter belongs to
 */
export type ChapterCategory = 'introduction' | 'insight' | 'distinctive' | 'empathetic' | 'authentic' | 'integration';

/**
 * Chapter completion status
 */
export type ChapterStatus = 'not_started' | 'in_progress' | 'completed';

/**
 * Individual chapter definition with metadata.
 * Represents a single chapter in Trevor's 11-chapter IDEA framework book.
 */
export interface Chapter {
  /** Unique identifier for the chapter */
  id: ChapterId;

  /** Chapter number (1-11) */
  number: number;

  /** Chapter title */
  title: string;

  /** IDEA framework category */
  category: ChapterCategory;

  /** Brief description of chapter content */
  description: string;

  /** Key questions to explore in this chapter */
  key_questions: string[];

  /** Learning objectives for the chapter */
  learning_objectives: string[];

  /** Estimated time to complete (in minutes) */
  estimated_time: number;
}

/**
 * Chapter progress tracking for a specific user session.
 * Tracks user's progress through the 11-chapter framework.
 */
export interface ChapterProgress {
  /** ID of the chat session this progress belongs to */
  session_id: string;

  /** ID of the user */
  user_id: string;

  /** Current chapter the user is on */
  current_chapter_id: ChapterId;

  /** Current chapter number (1-11) */
  current_chapter_number: number;

  /** Status of each chapter (indexed by chapter_id) */
  chapter_statuses: Record<ChapterId, ChapterStatus>;

  /** Number of completed chapters */
  completed_chapters: number;

  /** Total number of chapters (always 11) */
  total_chapters: number;

  /** ISO 8601 timestamp when progress was started */
  started_at: string;

  /** ISO 8601 timestamp when progress was last updated */
  updated_at: string;

  /** ISO 8601 timestamp when all chapters were completed (null if not completed) */
  completed_at: string | null;
}

/**
 * Data required to create new chapter progress.
 * Used when starting a new book-guided chat workflow.
 */
export interface ChapterProgressCreate {
  /** ID of the chat session */
  session_id: string;

  /** Optional starting chapter (defaults to chapter-01-introduction) */
  current_chapter_id?: ChapterId;
}

/**
 * Data for updating existing chapter progress.
 */
export interface ChapterProgressUpdate {
  /** Updated current chapter ID */
  current_chapter_id?: ChapterId;

  /** Updated chapter statuses */
  chapter_statuses?: Partial<Record<ChapterId, ChapterStatus>>;

  /** Timestamp when all chapters were completed */
  completed_at?: string;
}

/**
 * Chapter metadata attached to chat messages.
 * Links chat messages to specific chapters for context-aware responses.
 */
export interface ChapterMetadata {
  /** Chapter this message belongs to */
  chapter_id: ChapterId;

  /** Chapter number */
  chapter_number: number;

  /** Chapter title for display */
  chapter_title: string;

  /** IDEA framework category */
  chapter_category: ChapterCategory;

  /** Question index within the chapter (if applicable) */
  question_index?: number;

  /** Persisted completion status for each chapter */
  chapter_statuses?: Partial<Record<ChapterId, ChapterStatus>>;
}

/**
 * Chapter context passed to the AI for field extraction and conversation guidance.
 * This context helps the AI understand what fields to extract and what to focus on.
 */
export interface ChapterContext {
  /** Chapter ID for context */
  chapterId: ChapterId | 'all-chapters';

  /** Chapter title for display */
  chapterTitle: string;

  /** Chapter number (0 for all chapters) */
  chapterNumber: number;

  /** Fields the AI should extract from the conversation */
  fieldsToCapture: string[];

  /** Human-readable labels for each field */
  fieldLabels: Record<string, string>;

  /** Currently focused field ID (for conversational guidance) */
  focusedField?: string | null;

  /** Details about the currently focused field */
  currentFieldDetails?: {
    id: string;
    label: string;
    type: string;
    helpText?: string;
  } | null;

  /** Whether to use comprehensive mode (default false for conversational) */
  comprehensiveMode?: boolean;

  /** Backward compatibility field name */
  extractionFields?: string[];

  /** Current values of already-filled fields — lets the AI know what's captured vs. missing */
  currentFieldValues?: Record<string, string | string[]>;
}

/**
 * Chapter navigation event payload for analytics.
 */
export interface ChapterNavigationEvent {
  /** Event name */
  event_name: 'chapter_started' | 'chapter_completed' | 'chapter_skipped' | 'chapter_revisited';

  /** User ID */
  user_id: string;

  /** Session ID */
  session_id: string;

  /** Chapter navigated to */
  chapter_id: ChapterId;

  /** Chapter number */
  chapter_number: number;

  /** Previous chapter (if applicable) */
  previous_chapter_id?: ChapterId;

  /** ISO 8601 timestamp */
  timestamp: string;
}

/**
 * Chapter summary data from RAG vector store.
 * Retrieved from existing vector store (vs_6948707b318c81918a90e9b44970a99e).
 */
export interface ChapterSummary {
  /** Chapter ID */
  chapter_id: ChapterId;

  /** Chapter title */
  title: string;

  /** Summary text from book content */
  summary: string;

  /** Key concepts covered in the chapter */
  key_concepts: string[];

  /** Relevant book excerpts */
  excerpts: string[];

  /** Source citations from RAG */
  sources?: string[];
}

/**
 * Complete book structure containing all 11 chapters.
 * This is the master data structure for the IDEA framework progression.
 */
export interface BookStructure {
  /** Book title */
  title: string;

  /** Book author */
  author: string;

  /** All chapters in order */
  chapters: Chapter[];

  /** Total number of chapters */
  total_chapters: number;

  /** Book description */
  description: string;
}

/**
 * Hook return type for chapter progress management.
 */
export interface UseChapterProgressReturn {
  /** Current chapter progress */
  progress: ChapterProgress | null;

  /** Currently active chapter */
  currentChapter: Chapter | null;

  /** All available chapters */
  allChapters: Chapter[];

  /** Loading state */
  isLoading: boolean;

  /** Error state */
  error: Error | null;

  /** Navigate to a specific chapter */
  navigateToChapter: (chapterId: ChapterId) => Promise<void>;

  /** Mark current chapter as completed and move to next */
  completeCurrentChapter: () => Promise<void>;

  /** Mark a specific chapter as completed */
  markChapterComplete: (chapterId: ChapterId) => Promise<void>;

  /** Reset progress to start */
  resetProgress: () => Promise<void>;

  /** Get chapter by ID */
  getChapterById: (chapterId: ChapterId) => Chapter | undefined;

  /** Get next chapter */
  getNextChapter: () => Chapter | null;

  /** Get previous chapter */
  getPreviousChapter: () => Chapter | null;

  /** Check if a chapter is completed */
  isChapterCompleted: (chapterId: ChapterId) => boolean;

  /** Initialize chapter progress for a new session (persists default state to DB) */
  initializeProgress: () => Promise<void>;

  /** True while initial progress save is in flight */
  isInitializing: boolean;
}

/**
 * Default book structure with all 11 chapters.
 * This constant defines the complete IDEA framework progression.
 */
export const DEFAULT_BOOK_STRUCTURE: BookStructure = {
  title: "The IDEA Framework: Building Brands That Resonate",
  author: "Trevor Young",
  total_chapters: 11,
  description: "A comprehensive guide to building emotionally resonant brands using the IDEA framework (Insight, Distinctive, Empathetic, Authentic).",
  chapters: [
    {
      id: 'chapter-01-introduction',
      number: 1,
      title: 'Introduction to the IDEA Framework',
      category: 'introduction',
      description: 'Understanding the foundations of brand building and the IDEA methodology.',
      key_questions: [
        'What makes a brand truly resonate with customers?',
        'How do the four pillars of IDEA work together?',
        'What is your current brand maturity level?'
      ],
      learning_objectives: [
        'Understand the IDEA framework components',
        'Assess your current brand position',
        'Set clear brand development goals'
      ],
      estimated_time: 30
    },
    {
      id: 'chapter-02-insight-fundamentals',
      number: 2,
      title: 'Insight: Understanding Your Market',
      category: 'insight',
      description: 'Developing deep market insights through research and analysis.',
      key_questions: [
        'Who are your ideal customers and what do they truly need?',
        'What market trends are shaping your industry?',
        'What insights differentiate your understanding from competitors?'
      ],
      learning_objectives: [
        'Conduct meaningful market research',
        'Identify actionable customer insights',
        'Map competitive landscape'
      ],
      estimated_time: 45
    },
    {
      id: 'chapter-03-insight-application',
      number: 3,
      title: 'Insight: Turning Data into Strategy',
      category: 'insight',
      description: 'Applying insights to create strategic brand decisions.',
      key_questions: [
        'How do you translate insights into brand strategy?',
        'What customer pain points can your brand solve?',
        'How do insights inform your value proposition?'
      ],
      learning_objectives: [
        'Transform insights into strategic opportunities',
        'Define clear value propositions',
        'Align brand strategy with customer needs'
      ],
      estimated_time: 40
    },
    {
      id: 'chapter-04-distinctive-positioning',
      number: 4,
      title: 'Distinctive: Defining Your Unique Position',
      category: 'distinctive',
      description: 'Creating a distinctive brand position that stands out in the market.',
      key_questions: [
        'What makes your brand genuinely different?',
        'How do you communicate your uniqueness clearly?',
        'What is your unfair advantage?'
      ],
      learning_objectives: [
        'Identify your distinctive brand attributes',
        'Craft a compelling positioning statement',
        'Differentiate from competitors effectively'
      ],
      estimated_time: 45
    },
    {
      id: 'chapter-05-distinctive-execution',
      number: 5,
      title: 'Distinctive: Bringing Your Brand to Life',
      category: 'distinctive',
      description: 'Executing your distinctive brand across all touchpoints.',
      key_questions: [
        'How does your brand look, sound, and feel?',
        'What brand assets make you instantly recognizable?',
        'How do you maintain consistency while staying fresh?'
      ],
      learning_objectives: [
        'Develop distinctive brand identity elements',
        'Create consistent brand experiences',
        'Build recognizable brand assets'
      ],
      estimated_time: 50
    },
    {
      id: 'chapter-06-empathetic-understanding',
      number: 6,
      title: 'Empathetic: Understanding Your Audience',
      category: 'empathetic',
      description: 'Building deep empathy for your customers and their journeys.',
      key_questions: [
        'What does a day in your customer\'s life look like?',
        'What are their fears, hopes, and aspirations?',
        'How can your brand make their life better?'
      ],
      learning_objectives: [
        'Develop detailed customer personas',
        'Map customer journey touchpoints',
        'Identify emotional connection points'
      ],
      estimated_time: 45
    },
    {
      id: 'chapter-07-empathetic-connection',
      number: 7,
      title: 'Empathetic: Creating Emotional Connections',
      category: 'empathetic',
      description: 'Crafting brand experiences that emotionally resonate with customers.',
      key_questions: [
        'What emotions do you want customers to feel?',
        'How do you communicate with genuine empathy?',
        'What stories will your customers tell about your brand?'
      ],
      learning_objectives: [
        'Design emotionally resonant brand experiences',
        'Communicate with empathy and understanding',
        'Build lasting customer relationships'
      ],
      estimated_time: 40
    },
    {
      id: 'chapter-08-authentic-values',
      number: 8,
      title: 'Authentic: Defining Your Brand Values',
      category: 'authentic',
      description: 'Establishing authentic values and purpose that guide your brand.',
      key_questions: [
        'What does your brand truly stand for?',
        'What are your non-negotiable values?',
        'How does your purpose drive your business?'
      ],
      learning_objectives: [
        'Define core brand values',
        'Articulate brand purpose',
        'Align values with business practices'
      ],
      estimated_time: 40
    },
    {
      id: 'chapter-09-authentic-expression',
      number: 9,
      title: 'Authentic: Living Your Brand Truth',
      category: 'authentic',
      description: 'Expressing your authentic brand in everything you do.',
      key_questions: [
        'How do you demonstrate authenticity daily?',
        'What brand promises must you keep?',
        'How do you build trust through authentic action?'
      ],
      learning_objectives: [
        'Create authentic brand communication',
        'Build trust through consistent actions',
        'Demonstrate values in customer interactions'
      ],
      estimated_time: 45
    },
    {
      id: 'chapter-10-integration-strategy',
      number: 10,
      title: 'Integration: Bringing IDEA Together',
      category: 'integration',
      description: 'Integrating all four IDEA pillars into a cohesive brand strategy.',
      key_questions: [
        'How do Insight, Distinctive, Empathetic, and Authentic work together?',
        'What is your complete brand strategy?',
        'How do you measure brand success?'
      ],
      learning_objectives: [
        'Integrate all IDEA components',
        'Create comprehensive brand strategy',
        'Define success metrics and KPIs'
      ],
      estimated_time: 50
    },
    {
      id: 'chapter-11-implementation',
      number: 11,
      title: 'Implementation: Executing Your Brand Strategy',
      category: 'integration',
      description: 'Implementing your IDEA-based brand strategy across your organization.',
      key_questions: [
        'How do you launch your brand strategy effectively?',
        'What are the key implementation milestones?',
        'How do you evolve your brand over time?'
      ],
      learning_objectives: [
        'Create brand implementation roadmap',
        'Execute brand strategy across touchpoints',
        'Establish continuous improvement processes'
      ],
      estimated_time: 55
    }
  ]
};
