---
title: 'Review Analyzer Tool'
slug: 'review-analyzer-tool'
created: '2026-03-21'
status: 'review'
stepsCompleted: [1, 2, 3]
tech_stack: ['React 18', 'TypeScript', 'shadcn-ui', 'Supabase Edge Functions', 'Firecrawl API', 'TanStack Query', 'Radix UI']
files_to_modify: ['src/pages/v2/BrandCoachV2.tsx', 'src/components/v2/ReviewAnalyzerModal.tsx', 'src/components/v2/ChatToolsMenu.tsx', 'src/utils/asinParser.ts']
code_patterns: ['ghost icon button 60x60', 'Popover (Radix)', 'Dialog (Radix)', 'supabase.functions.invoke', 'chatService.setCompetitiveInsightsContext', 'useServices() hook', 'cn() for conditional classes', 'Card-based chat messages']
test_patterns: ['vitest + @testing-library/react', 'vi.mock for service mocking', 'renderHook with QueryClientProvider wrapper']
---

# Tech-Spec: Review Analyzer Tool

**Created:** 2026-03-21

## Overview

### Problem Statement

Users building their brand with Trevor have no way to feed real competitor review data into the conversation. Competitive insights are limited to what the user manually describes. A `review-scraper` edge function exists that can scrape Amazon reviews via Firecrawl, but there is no frontend path to use it from the brand coach chat interface.

### Solution

Add a Tools button next to the chat send button that opens a popover menu. First tool: "Review Analyzer" — opens a modal where users paste Amazon URLs or ASINs, scrapes their review pages via the existing edge function, and silently feeds the data to Trevor as background context for market research analysis.

### Scope

**In Scope:**
- Tools icon button in chat input bar (next to paperclip)
- Popover menu with "Review Analyzer" option (extensible for future tools)
- Modal with single textarea for pasting ASINs/URLs (mixed formats, one per line)
- Smart ASIN parsing from any Amazon URL format
- ASIN → review page URL conversion (`amazon.com/product-reviews/{ASIN}`)
- Progress indicator per product during scraping
- "Send to Trevor" that injects review data as background context
- Visual subtext indicator in chat (not a message — a distinct styled annotation)
- Trevor processes review data as market research context

**Out of Scope:**
- Displaying individual reviews in the modal
- Sentiment analysis or keyword extraction UI
- Extending the existing `CustomerReviewAnalyzer` component
- Image-based product identification
- Persisting review data to database

## Context for Development

### Codebase Patterns

- **Chat input bar:** `[ Paperclip (60x60 ghost) ] [ Textarea ] [ Send (60x60 primary) ]` — tools button inserts after paperclip, same sizing/style
- **Popover:** Radix-based at `src/components/ui/popover.tsx` — `PopoverTrigger` + `PopoverContent`
- **Dialog:** Radix-based at `src/components/ui/dialog.tsx` — `DialogTrigger` + `DialogContent` + `DialogHeader/Title/Description/Footer`
- **Edge function calls:** `supabase.functions.invoke('review-scraper', { body: { urls, maxReviewsPerUrl } })` — returns `{ results, totalReviews, urlsProcessed }`
- **Context injection:** `chatService.setCompetitiveInsightsContext(contextString)` — sets persistent context passed to edge function body as `competitiveInsights` field. Already wired through to `idea-framework-consultant` edge function
- **Service access:** `const { chatService } = useServices()` from `src/services/ServiceProvider`
- **Icons:** `lucide-react` — use `Wrench` or `Settings2` for tools icon, `Search` for Review Analyzer menu item
- **Conditional classes:** `cn()` utility from `@/lib/utils`
- **Toasts:** `sonner` for error/success notifications via `toast()` from `sonner`
- **Chat messages:** Card-based rendering in scrollable `chatContainerRef` div. Existing subtext pattern: field extraction badges render below message content with `mt-3 pt-2 border-t border-border/30`

### Files to Reference

| File | Purpose |
| ---- | ------- |
| `src/pages/v2/BrandCoachV2.tsx` | Main page — chat input bar (line 1003), message rendering (line 884), `handleSendMessage` (line 408) |
| `src/components/ui/popover.tsx` | Popover component for tools menu |
| `src/components/ui/dialog.tsx` | Dialog component for review analyzer modal |
| `supabase/functions/review-scraper/index.ts` | Edge function — `{ urls: string[], maxReviewsPerUrl?: number }` → `{ results: ScrapeResult[], totalReviews, urlsProcessed }` |
| `src/services/SupabaseChatService.ts` | `setCompetitiveInsightsContext(context)` at line 33 — injects into edge function body at line 181 |
| `src/services/ServiceProvider.tsx` | `useServices()` hook exposes `chatService` |
| `src/integrations/supabase/client.ts` | Supabase client for edge function invocation |
| `src/hooks/useChat.ts` | Chat hook — `sendMessage`, `isSending`, `messages` |

### Technical Decisions

- **ASIN parsing:** Extract ASIN from any Amazon URL format (`/dp/`, `/gp/product/`, `/product-reviews/`) or accept raw ASIN. Regex: `/\/(?:dp|gp\/product|product-reviews)\/([A-Z0-9]{10})/i` or raw `/^[A-Z0-9]{10}$/i`
- **Review page URL:** Convert ASIN → `https://www.amazon.com/product-reviews/{ASIN}` for better review density than product pages
- **Context injection via existing pattern:** Use `chatService.setCompetitiveInsightsContext()` — already wired to edge function. No backend changes needed
- **Visual indicator:** A styled subtext element in the chat messages area — NOT a chat message. Uses muted text, italic, smaller font, and a distinct icon to differentiate from conversation messages
- **Tools menu extensibility:** Popover with simple list items — adding new tools = adding a new list item + component
- **No new edge functions needed:** `review-scraper` handles scraping, `competitiveInsightsContext` handles injection
- **Context string format:** Build a structured text summary of review data (product ASIN, review count, average rating, top review snippets) that Trevor can reason about — NOT raw JSON

## Implementation Plan

### Tasks

- [ ] Task 1: Create ASIN parser utility
  - File: `src/utils/asinParser.ts` (create)
  - Action: Implement three exported functions:
    - `extractAsin(input: string): string | null` — Extract ASIN from a single line (Amazon URL or raw ASIN). Use regex `/\/(?:dp|gp\/product|product-reviews)\/([A-Z0-9]{10})/i` for URLs, `/^[A-Z0-9]{10}$/i` for raw. Return null if no ASIN found.
    - `parseAsinInput(text: string): string[]` — Split textarea value by newlines, trim each line, run `extractAsin` on each, filter nulls, deduplicate.
    - `asinToReviewUrl(asin: string): string` — Return `https://www.amazon.com/product-reviews/${asin}`
  - Notes: Pure functions, no dependencies. Handle edge cases: empty lines, whitespace, duplicate ASINs, URLs with query params/fragments.

- [ ] Task 2: Create ReviewAnalyzerModal component
  - File: `src/components/v2/ReviewAnalyzerModal.tsx` (create)
  - Action: Implement a Dialog-based modal with three states:
    - **Input state:** Textarea for pasting ASINs/URLs. Live count below: "{N} products detected". "Analyze" button disabled when count is 0.
    - **Scraping state:** Progress list showing each ASIN with status icon (checkmark/spinner/pending). Progress text: "Scraping reviews... {completed} of {total}". Call `supabase.functions.invoke('review-scraper', { body: { urls: reviewUrls, maxReviewsPerUrl: 20 } })`. Note: edge function processes all URLs in one call, so progress is simulated — show "scraping..." until response arrives, then mark all complete.
    - **Results state:** Summary line: "Found {totalReviews} reviews across {N} products". Per-product row: ASIN (truncated), review count, average rating (computed from reviews). "Send to Trevor" button. "Close" button.
  - Props: `open: boolean`, `onOpenChange: (open: boolean) => void`, `onSendToTrevor: (contextString: string) => void`
  - Notes: Import `supabase` from `@/integrations/supabase/client`. Use `parseAsinInput` and `asinToReviewUrl` from Task 1. Build context string in `handleSendToTrevor`: format as readable text summary with per-product review counts, ratings, and top review excerpts (first 200 chars of top 3 reviews per product). Use `toast.error()` for scraping failures.

- [ ] Task 3: Create ChatToolsMenu component
  - File: `src/components/v2/ChatToolsMenu.tsx` (create)
  - Action: Implement a Popover-triggered menu with a single item:
    - Trigger: Ghost icon button (60x60, matching paperclip style) with `Wrench` icon from lucide-react
    - Content: Simple list with one item: `Search` icon + "Review Analyzer" label
    - Clicking "Review Analyzer" closes popover and opens ReviewAnalyzerModal
  - Props: `onSendReviewContext: (contextString: string) => void`
  - Notes: Manages its own `popoverOpen` and `modalOpen` state internally. Passes `onSendReviewContext` through to ReviewAnalyzerModal's `onSendToTrevor`.

- [ ] Task 4: Integrate into BrandCoachV2
  - File: `src/pages/v2/BrandCoachV2.tsx` (modify)
  - Action — Part A (Tools button in input bar):
    - Import `ChatToolsMenu` from `@/components/v2/ChatToolsMenu`
    - Import `useServices` from `@/services/ServiceProvider`
    - Add state: `const [reviewContextActive, setReviewContextActive] = useState(false)`
    - Add handler: `handleSendReviewContext(contextString: string)` that calls `chatService.setCompetitiveInsightsContext(contextString)`, sets `reviewContextActive` to `true`, and shows `toast.success('Review data shared with Trevor')`
    - Insert `<ChatToolsMenu onSendReviewContext={handleSendReviewContext} />` in the chat input `div.flex.gap-2` (line 1003), after the Paperclip button and before the Textarea
  - Action — Part B (Visual subtext indicator in chat area):
    - Add a conditional element above the chat input area (inside the `border-t p-4` div, before the document context indicator):
    - When `reviewContextActive` is true, render: `<div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground italic"><Search className="h-3 w-3" /><span>Review data from competitor analysis shared with Trevor</span><button onClick={() => { chatService.setCompetitiveInsightsContext(null); setReviewContextActive(false); }} className="ml-auto text-xs underline hover:text-foreground">Clear</button></div>`
    - This follows the exact same pattern as the existing document context indicator at line 997-1001
  - Notes: Access `chatService` via `const { chatService } = useServices()`. The `useServices` import may already exist — check before adding duplicate.

- [ ] Task 5: Unit tests for ASIN parser
  - File: `src/utils/__tests__/asinParser.test.ts` (create)
  - Action: Test `extractAsin`, `parseAsinInput`, and `asinToReviewUrl` with cases:
    - Raw ASIN: `B0CJBQ7F5C` → extracts correctly
    - Product URL: `https://www.amazon.com/dp/B0CJBQ7F5C` → extracts ASIN
    - Product URL with path: `https://www.amazon.com/Product-Name/dp/B0CJBQ7F5C/ref=sr_1_1` → extracts ASIN
    - Review URL: `https://www.amazon.com/product-reviews/B0CJBQ7F5C` → extracts ASIN
    - GP URL: `https://www.amazon.com/gp/product/B0CJBQ7F5C` → extracts ASIN
    - Invalid input: `hello world` → returns null
    - Empty string: → returns null
    - Multi-line parsing: mixed URLs and ASINs → correct array, deduped
    - Case insensitivity: lowercase asin → still extracts
    - URL with query params: `?ref=xyz` → still extracts ASIN
    - `asinToReviewUrl`: produces correct `amazon.com/product-reviews/` URL

### Acceptance Criteria

- [ ] AC 1: Given the chat input bar is visible, when the user looks at the input area, then a tools icon button (wrench) appears between the paperclip button and the textarea, matching the paperclip button's ghost style and 60x60 size
- [ ] AC 2: Given the tools button exists, when the user clicks it, then a popover appears with a "Review Analyzer" menu item
- [ ] AC 3: Given the popover is open, when the user clicks "Review Analyzer", then the popover closes and a dialog modal opens with a textarea and an "Analyze" button
- [ ] AC 4: Given the modal is open, when the user pastes `B0CJBQ7F5C` (raw ASIN), then the modal shows "1 product detected" below the textarea
- [ ] AC 5: Given the modal is open, when the user pastes `https://www.amazon.com/dp/B0CJBQ7F5C`, then the modal extracts the ASIN and shows "1 product detected"
- [ ] AC 6: Given the modal is open, when the user pastes multiple lines with mixed URLs and raw ASINs (including duplicates), then the modal deduplicates and shows the correct unique count
- [ ] AC 7: Given the modal shows "N products detected" with N > 0, when the user clicks "Analyze", then the modal transitions to a scraping progress state showing per-product status
- [ ] AC 8: Given scraping is in progress, when the edge function responds successfully, then all products show a checkmark and a results summary appears with total reviews and per-product review count + average rating
- [ ] AC 9: Given results are displayed, when the user clicks "Send to Trevor", then `chatService.setCompetitiveInsightsContext()` is called with a formatted text summary of the review data, the modal closes, and a toast confirms the action
- [ ] AC 10: Given review context has been sent, when the user looks at the chat input area, then a subtle italic subtext reads "Review data from competitor analysis shared with Trevor" with a "Clear" link
- [ ] AC 11: Given the review context indicator is visible, when the user clicks "Clear", then `setCompetitiveInsightsContext(null)` is called and the indicator disappears
- [ ] AC 12: Given the review-scraper edge function fails, when the error response is received, then a toast error is shown and the modal returns to the input state
- [ ] AC 13: Given the modal textarea is empty, when the user views the "Analyze" button, then it is disabled

## Additional Context

### Dependencies

- Existing `review-scraper` Supabase edge function (no changes needed)
- `FIRECRAWL_API_KEY` must be set in Supabase edge function environment
- shadcn-ui Popover and Dialog components (already installed)
- `setCompetitiveInsightsContext` on `SupabaseChatService` (already implemented, line 33)
- `supabase` client from `@/integrations/supabase/client`
- lucide-react icons: `Wrench`, `Search`, `Loader2`, `Check`, `X`

### Testing Strategy

- **Unit tests (Task 5):** `asinParser.ts` — pure functions, comprehensive coverage of URL formats, edge cases, deduplication
- **Component tests (future):** `ReviewAnalyzerModal` — render states, mock `supabase.functions.invoke`, verify progress/results transitions
- **Component tests (future):** `ChatToolsMenu` — popover interaction, modal trigger
- **Manual testing:** End-to-end flow: paste ASINs → scrape → send to Trevor → verify context appears in next Trevor response
- **Manual testing:** Verify review context indicator shows/clears correctly

### Notes

- `review-scraper` caps at 10 URLs per request with 2-second rate limiting between scrapes — scraping multiple products will take time, hence the progress UI
- `competitiveInsightsContext` is persistent on the service instance — once set, it's included in ALL subsequent messages until the user clears it or the page reloads
- The existing `CustomerReviewAnalyzer` component at `src/components/research/` uses mock data and is completely unrelated to this feature
- Context string should be human-readable text, not raw JSON — Trevor needs to reason about it naturally
- The `review-scraper` response includes `results[].reviews[].rating` — compute average per product by summing and dividing
