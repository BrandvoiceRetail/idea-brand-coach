/**
 * IDEA Framework Book Content
 *
 * Static reference excerpts from "The IDEA Framework" book, organised by
 * IDEA phase. Used by IdeaBookPanel to display contextual book content
 * as the user works through chapters.
 *
 * Extracted from IdeaBookPanel.tsx for cleaner separation of data and UI.
 */

import type { BookExcerpt } from '@/v2/components/BookContextDisplay';

// ---------------------------------------------------------------------------
// Phase excerpts
// ---------------------------------------------------------------------------

export const IDEA_BOOK_CONTENT: Record<string, BookExcerpt[]> = {
  overview: [
    {
      section: 'Identify',
      text: 'The IDEA Strategic Brand Framework\u2122 begins with Identify - understanding who you are as a brand at your core. This phase focuses on uncovering your authentic brand purpose, values, and the unique space you occupy in the market. It\'s about discovering the truth of your brand that already exists, not creating something artificial.',
      pageReference: 'p. 15-16',
      chapter: 'Introduction to IDEA',
    },
    {
      section: 'Discover',
      text: 'The Discover phase is about exploration and insight. Here we uncover deep consumer insights, market opportunities, and the emotional connections that will form the foundation of your brand strategy. Discovery is both an internal and external journey - understanding your customers as deeply as you understand yourself.',
      pageReference: 'p. 17-18',
      chapter: 'Introduction to IDEA',
    },
    {
      section: 'Execute',
      text: 'Execute transforms strategy into action. This phase is where brand strategy becomes brand experience. Every touchpoint, every communication, every interaction must embody your brand truth. Execution is not just about doing things right, but doing the right things - those that authentically express your brand.',
      pageReference: 'p. 19-20',
      chapter: 'Introduction to IDEA',
    },
    {
      section: 'Analyze',
      text: 'Analyze closes the loop by measuring impact and gathering insights for continuous improvement. This isn\'t just about metrics and KPIs - it\'s about understanding how your brand is living in the world, how it\'s being received, and where opportunities for growth exist.',
      pageReference: 'p. 21-22',
      chapter: 'Introduction to IDEA',
    },
  ],
  identify: [
    {
      section: 'Identify',
      text: 'Brand Insight is the foundation of the Identify phase. It\'s the profound understanding that emerges when you connect what the market needs with what your brand uniquely offers. This isn\'t surface-level positioning - it\'s the deep truth that makes your brand necessary in the world.',
      pageReference: 'p. 45',
      chapter: 'Chapter 2: The Power of Insight',
    },
    {
      section: 'Identify',
      text: 'Your brand purpose answers the question: Why do we exist beyond making money? Simon Sinek calls it your "why." It\'s the belief that drives everything you do. A clear purpose acts as a North Star, guiding decisions and inspiring both employees and customers.',
      pageReference: 'p. 52',
      chapter: 'Chapter 2: The Power of Insight',
    },
    {
      section: 'Identify',
      text: 'Consumer insights are not just data points or demographics. They\'re the unspoken truths, the tensions, the unmet needs that your brand can uniquely address. The best insights make you say "of course!" - they\'re obvious once uncovered but hidden in plain sight.',
      pageReference: 'p. 58',
      chapter: 'Chapter 2: The Power of Insight',
    },
  ],
  discover: [
    {
      section: 'Discover',
      text: 'Distinctive brands don\'t compete - they create their own category. Being distinctive isn\'t about being different for the sake of it. It\'s about being so uniquely yourself that comparison becomes irrelevant. Your distinction emerges from the intersection of what you do best and what the world needs most.',
      pageReference: 'p. 78',
      chapter: 'Chapter 3: Standing Apart',
    },
    {
      section: 'Discover',
      text: 'Emotional connection is the bridge between brand and human. Brands that create genuine emotional connections don\'t just have customers - they have advocates, believers, even evangelists. This connection isn\'t manufactured through advertising; it\'s earned through consistent, authentic experiences.',
      pageReference: 'p. 85',
      chapter: 'Chapter 3: Standing Apart',
    },
    {
      section: 'Discover',
      text: 'Market positioning is both art and science. It requires rigorous analysis of competitors, customers, and context. But it also requires creativity and courage - the willingness to stake a claim to a specific piece of mental real estate and defend it consistently over time.',
      pageReference: 'p. 92',
      chapter: 'Chapter 3: Standing Apart',
    },
  ],
  execute: [
    {
      section: 'Execute',
      text: 'Brand experience is the sum total of every interaction someone has with your brand. From the first impression to long-term loyalty, every touchpoint either reinforces or undermines your brand promise. Consistency isn\'t about repetition - it\'s about harmony across all expressions of your brand.',
      pageReference: 'p. 115',
      chapter: 'Chapter 4: Bringing Brands to Life',
    },
    {
      section: 'Execute',
      text: 'Authenticity cannot be faked. In an age of radical transparency, brands must be who they claim to be. This means aligning internal culture with external promise, walking the talk, and having the courage to admit mistakes when they happen.',
      pageReference: 'p. 124',
      chapter: 'Chapter 4: Bringing Brands to Life',
    },
    {
      section: 'Execute',
      text: 'The best brand strategies fail without proper execution. This requires not just planning and processes, but people who believe in the brand and are empowered to bring it to life. Your employees are your first and most important brand ambassadors.',
      pageReference: 'p. 132',
      chapter: 'Chapter 4: Bringing Brands to Life',
    },
  ],
  analyze: [
    {
      section: 'Analyze',
      text: 'Brand metrics must measure what matters. While awareness and reach have their place, the most important metrics are those that indicate deep engagement: advocacy, repeat purchase, emotional connection, and ultimately, the role your brand plays in people\'s lives.',
      pageReference: 'p. 155',
      chapter: 'Chapter 5: Measuring What Matters',
    },
    {
      section: 'Analyze',
      text: 'Continuous improvement isn\'t about constant change - it\'s about evolution guided by insight. The brands that endure are those that stay true to their core while adapting their expression to remain relevant. Analysis provides the feedback loop that makes this evolution intentional rather than reactive.',
      pageReference: 'p. 162',
      chapter: 'Chapter 5: Measuring What Matters',
    },
    {
      section: 'Analyze',
      text: 'Customer feedback is a gift, even when it\'s critical. The key is to listen not just to what customers say, but to what they mean. Often, the most valuable insights come from reading between the lines, understanding the emotions and needs behind the words.',
      pageReference: 'p. 170',
      chapter: 'Chapter 5: Measuring What Matters',
    },
  ],
};

// ---------------------------------------------------------------------------
// Key concepts / glossary
// ---------------------------------------------------------------------------

export const KEY_CONCEPTS: BookExcerpt[] = [
  {
    section: 'Identify',
    text: 'Insight (noun): A profound understanding of a person, situation, or subject that reveals a hidden truth or opportunity. In branding, insight connects human needs with brand capabilities.',
    pageReference: 'Glossary',
    chapter: 'Key Terms',
  },
  {
    section: 'Discover',
    text: 'Distinctive (adjective): Possessing a quality or characteristic that makes something clearly different from others. Distinctive brands own a unique position in the mind and heart of their audience.',
    pageReference: 'Glossary',
    chapter: 'Key Terms',
  },
  {
    section: 'Execute',
    text: 'Empathy (noun): The ability to understand and share the feelings of another. Empathetic brands don\'t just understand their customers\' needs - they feel them and respond accordingly.',
    pageReference: 'Glossary',
    chapter: 'Key Terms',
  },
  {
    section: 'Analyze',
    text: 'Authentic (adjective): Genuine, real, and true to one\'s own personality, spirit, or character. Authentic brands are consistent in their values and actions, inside and out.',
    pageReference: 'Glossary',
    chapter: 'Key Terms',
  },
];
