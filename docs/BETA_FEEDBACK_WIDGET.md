# Beta Feedback Widget Documentation

## Overview

The Beta Feedback Widget is a floating UI component that appears on all pages during the beta phase, allowing users to quickly submit feedback without interrupting their workflow.

## Features

- **Persistent across all pages**: Appears on every page except the /beta routes
- **Three feedback types**: General, Bug Report, and Idea/Suggestion
- **Minimizable interface**: Can be minimized to save screen space
- **Auto-collapse**: Automatically minimizes after sending feedback
- **Page context**: Automatically includes the current page URL with feedback
- **Logged-in users only**: Only visible to authenticated users

## Configuration

### Enable/Disable Widget

The widget visibility is controlled by environment variables:

```bash
# In your .env file

# Option 1: Explicit control
VITE_ENABLE_BETA_FEEDBACK=true  # Shows widget
VITE_ENABLE_BETA_FEEDBACK=false # Hides widget

# Option 2: Automatic based on deployment phase
VITE_DEPLOYMENT_PHASE=P0  # Shows widget (P0 is beta phase)
VITE_DEPLOYMENT_PHASE=P1  # Hides widget (post-beta)
```

### Widget Position

By default, the widget appears in the bottom-left corner. You can change this in `App.tsx`:

```tsx
// Bottom-left (default)
<BetaFeedbackWidget />

// Bottom-right
<BetaFeedbackWidget position="bottom-right" />
```

## How It Works

1. **Component Location**: `/src/components/BetaFeedbackWidget.tsx`
2. **Integration**: Added to `App.tsx` at the root level, outside Routes
3. **Data Storage**:
   - Quick feedback is saved via the `save-beta-feedback` Supabase edge function
   - Stored in the `beta_feedback` table with special formatting for widget feedback
   - Also saved to localStorage via the `useBetaMode` hook for offline capability

## User Experience

### Collapsed State
- Shows as a purple "Beta Feedback" button with a pulsing indicator
- Click to expand the feedback form

### Expanded State
- Shows feedback type selector (General/Bug/Idea)
- Text area for feedback with contextual placeholder
- Send button to submit
- Link to full beta journey
- Can be minimized or closed

### Minimized State
- Shows just the header bar
- Click to re-expand
- Preserves entered text

## Database Schema

Feedback from the widget is stored in the `beta_feedback` table:

```sql
-- Widget feedback is stored with special formatting:
{
  user_id: 'user-uuid',
  step_comments: [{
    stepId: 'widget-[type]',  -- e.g., 'widget-bug', 'widget-idea'
    pageUrl: '/current/path',
    comment: '[TYPE] User feedback text',
    timestamp: '2024-01-01T00:00:00Z'
  }],
  -- Also stored in appropriate field based on type:
  issues: 'bug feedback here',
  improvements: 'idea feedback here',
  liked_most: 'general feedback here'
}
```

## Removing After Beta

To remove the beta feedback widget after the beta phase:

### Option 1: Environment Variable (Recommended)
Simply set in your production environment:
```bash
VITE_ENABLE_BETA_FEEDBACK=false
```
Or change deployment phase:
```bash
VITE_DEPLOYMENT_PHASE=P1
```

### Option 2: Complete Removal
1. Remove the import from `App.tsx`:
   ```tsx
   // Remove this line
   import { BetaFeedbackWidget } from "@/components/BetaFeedbackWidget";
   ```

2. Remove the component from `App.tsx`:
   ```tsx
   // Remove this line
   <BetaFeedbackWidget />
   ```

3. Delete the component file:
   ```bash
   rm src/components/BetaFeedbackWidget.tsx
   ```

4. Clean up the documentation:
   ```bash
   rm docs/BETA_FEEDBACK_WIDGET.md
   ```

## Analytics and Monitoring

To track beta feedback engagement:

1. **Feedback Volume**: Query the `beta_feedback` table for entries with `step_comments` containing 'widget-' prefix
2. **Feedback Types**: Count by feedback type (bug/idea/general)
3. **Most Reported Pages**: Group by `pageUrl` in step_comments
4. **Active Beta Testers**: Count unique user_ids

Example query:
```sql
-- Get all widget feedback
SELECT
  user_id,
  step_comments->0->>'pageUrl' as page,
  step_comments->0->>'comment' as feedback,
  created_at
FROM beta_feedback
WHERE step_comments::text LIKE '%widget-%'
ORDER BY created_at DESC;
```

## Best Practices

1. **Keep it non-intrusive**: The widget should not block important UI elements
2. **Clear communication**: Let users know this is temporary beta feature
3. **Regular monitoring**: Check feedback daily during beta
4. **Response to feedback**: Consider adding a "Thank you" message or email follow-up
5. **Set end date**: Plan when to remove the widget (e.g., after 30 days or when reaching stability)

## Troubleshooting

### Widget Not Appearing
- Check user is logged in
- Verify environment variable is set correctly
- Check browser console for errors
- Ensure not on /beta routes

### Feedback Not Saving
- Check Supabase connection
- Verify edge function is deployed
- Check browser network tab for API errors
- Ensure user has valid session

### Performance Issues
- Widget is lightweight (~5KB)
- Uses lazy state to minimize re-renders
- Consider reducing animation if needed

## Future Enhancements

Potential improvements for future iterations:
- Screenshot capture capability
- Session recording integration
- Sentiment analysis
- Feedback categorization
- Priority scoring
- Response notifications