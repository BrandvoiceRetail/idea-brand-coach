# P0 Beta Launch - Manual Testing Guide

**Project:** IDEA Brand Coach  
**Testing Period:** Pre-Launch  
**Last Updated:** 2025-11-08  
**Commit Reference:** Post 9384aa9ce23047bdfb928cdf0729b6062487837f

---

## Overview

This guide provides comprehensive manual testing procedures for all P0 features implemented since commit `9384aa9`. The goal is to verify that all core functionality works correctly before beta launch.

### Test Environment Setup

**Prerequisites:**
- Access to the staging environment at `https://[your-lovable-url].lovable.app`
- Valid test email addresses (recommended: Gmail accounts for OAuth testing)
- Multiple browsers for cross-browser testing (Chrome, Firefox, Safari)
- Mobile device or browser dev tools for responsive testing

**Test Data Needed:**
- Test user credentials (create fresh accounts for each test run)
- Sample documents (PDF, DOCX, TXT files under 10MB)
- Multiple email addresses for testing different user scenarios

---

## Feature 1: Brand Diagnostic Flow

### Test Scenario 1.1: Anonymous Diagnostic Completion

**Objective:** Verify users can complete the diagnostic anonymously

**Steps:**
1. Navigate to homepage
2. Click "Start Free Diagnostic" button
3. Complete all 6 questions:
   - Select different score levels (1-5) for variety
   - Test "Previous" button navigation
   - Test validation (attempt to proceed without selecting an answer)
4. Click "Complete Assessment" on final question
5. Verify diagnostic auth modal appears with calculated score

**Expected Results:**
- ✅ Progress bar updates correctly (shows X of 6)
- ✅ "Previous" button disabled on question 1
- ✅ "Next" button disabled until answer selected
- ✅ Error toast appears if attempting to proceed without answer
- ✅ Modal displays correct overall score percentage
- ✅ Modal shows "Sign Up" and "Sign In" tabs

**Data Validation:**
- Check browser localStorage contains `diagnosticData` key
- Verify JSON structure includes: `answers`, `scores`, `overallScore`, `completedAt`

---

### Test Scenario 1.2: Account Creation from Diagnostic

**Objective:** Verify users can create account after completing diagnostic

**Steps:**
1. Complete diagnostic (Scenario 1.1)
2. In auth modal, switch to "Sign Up" tab
3. Fill in form:
   - Full Name: "Test User"
   - Email: `testuser+[timestamp]@gmail.com`
   - Password: "TestPass123!"
4. Click "Create Free Account"
5. Wait for confirmation toast
6. Verify redirect to diagnostic results page

**Expected Results:**
- ✅ Form validation works (test invalid email, short password)
- ✅ Loading spinner shows during account creation
- ✅ Success toast appears: "Your account has been created"
- ✅ User automatically signed in
- ✅ Redirected to `/diagnostic/results`
- ✅ Diagnostic scores displayed correctly
- ✅ Data persisted to database (not just localStorage)

**Database Validation:**
```sql
-- Check Supabase database
SELECT * FROM profiles WHERE email = 'testuser+[timestamp]@gmail.com';
SELECT * FROM diagnostic_submissions WHERE user_id = [user_id];
```

---

### Test Scenario 1.3: Sign In from Diagnostic (Existing User)

**Objective:** Verify existing users can sign in and sync data

**Steps:**
1. Complete diagnostic anonymously
2. In auth modal, switch to "Sign In" tab
3. Enter existing test user credentials
4. Click "Sign In"
5. Verify redirect to results page

**Expected Results:**
- ✅ Login successful with correct credentials
- ✅ Error toast appears with incorrect credentials
- ✅ localStorage data synced to database
- ✅ Previous diagnostic data preserved (if user has existing diagnostics)
- ✅ New diagnostic added to history

---

### Test Scenario 1.4: Google OAuth Sign Up

**Objective:** Verify Google OAuth integration works

**Steps:**
1. Complete diagnostic anonymously
2. In auth modal, click "Continue with Google" button
3. Complete Google OAuth flow
4. Verify redirect back to app

**Expected Results:**
- ✅ OAuth popup opens (or redirect depending on flow)
- ✅ User can select Google account
- ✅ After authorization, user signed in
- ✅ Profile auto-created with Google email
- ✅ Diagnostic data synced to new account
- ✅ Redirected to results page

**Note:** Test with both new and existing Google accounts

---

### Test Scenario 1.5: Skip Account Creation

**Objective:** Verify users can view results without account

**Steps:**
1. Complete diagnostic anonymously
2. In auth modal, click "Skip for now - View Results"
3. Verify redirect to results page

**Expected Results:**
- ✅ Results page shows diagnostic scores
- ✅ Data remains in localStorage only
- ✅ Toast message: "Sign in anytime to save your progress"
- ✅ Navigation persists (can browse other pages)
- ✅ Data lost after browser refresh (expected behavior for anonymous users)

---

### Test Scenario 1.6: Data Persistence & Sync

**Objective:** Verify diagnostic data syncs correctly

**Steps:**
1. Complete diagnostic as authenticated user
2. Sign out
3. Sign in again
4. Navigate to diagnostic results or Brand Coach
5. Verify previous diagnostic data visible

**Expected Results:**
- ✅ Diagnostic scores displayed in Brand Coach profile section
- ✅ Latest diagnostic data available in profile
- ✅ Suggested prompts reflect diagnostic weaknesses
- ✅ Multiple diagnostics tracked over time (if completed more than once)

---

## Feature 2: Authentication System

### Test Scenario 2.1: Email/Password Sign Up

**Objective:** Verify standard sign-up flow

**Steps:**
1. Navigate to `/auth`
2. Click "Sign Up" tab
3. Fill form:
   - Full Name: "Jane Doe"
   - Email: `janedoe+[timestamp]@gmail.com`
   - Password: "SecurePass456!"
4. Click "Let's get started!"
5. Check email for confirmation (if email confirmation enabled)
6. Verify account creation

**Expected Results:**
- ✅ Validation errors for invalid inputs:
  - Email: "Please enter a valid email address"
  - Password: "Password must be at least 6 characters"
  - Name: "Name is required"
- ✅ Success toast appears
- ✅ User signed in automatically (or prompted to check email)
- ✅ Redirected to dashboard/home page

---

### Test Scenario 2.2: Email/Password Sign In

**Objective:** Verify standard sign-in flow

**Steps:**
1. Navigate to `/auth`
2. Ensure "Sign In" tab active
3. Enter test user credentials
4. Click "Let's go!"

**Expected Results:**
- ✅ Success toast: "Welcome back!"
- ✅ User authenticated
- ✅ Redirected to home page
- ✅ User menu shows correct email

**Test Invalid Credentials:**
- Wrong password → Error toast: "Invalid login credentials"
- Non-existent email → Error toast: "Invalid login credentials"

---

### Test Scenario 2.3: Google OAuth Sign In

**Objective:** Verify Google OAuth sign-in

**Steps:**
1. Navigate to `/auth`
2. Click "Sign in with Google" button (on Sign In tab)
3. Complete OAuth flow
4. Verify successful authentication

**Expected Results:**
- ✅ OAuth flow completes
- ✅ User authenticated
- ✅ Profile created/updated with Google data
- ✅ Redirected to home page

---

### Test Scenario 2.4: Password Reset

**Objective:** Verify password reset flow

**Steps:**
1. Navigate to `/auth`
2. Click "Forgot password?" link
3. Enter email address
4. Click "Send Reset Link"
5. Check email for reset link
6. Click reset link and set new password
7. Sign in with new password

**Expected Results:**
- ✅ Email validation works
- ✅ Success toast: "Check your email"
- ✅ Reset email received
- ✅ Reset link works
- ✅ Password successfully changed
- ✅ Can sign in with new password

---

### Test Scenario 2.5: Sign Out

**Objective:** Verify sign-out functionality

**Steps:**
1. Sign in as test user
2. Navigate to `/auth` page (or user menu if exists)
3. Click "Sign Out" button
4. Verify signed out state

**Expected Results:**
- ✅ Success toast: "Signed out successfully"
- ✅ User session cleared
- ✅ Redirected to home/auth page
- ✅ Protected routes no longer accessible

---

### Test Scenario 2.6: Protected Routes

**Objective:** Verify authentication guards work

**Steps:**
1. Sign out (if signed in)
2. Attempt to navigate to `/brand-coach` directly
3. Verify redirect to auth page

**Expected Results:**
- ✅ Redirect to `/auth` page
- ✅ Toast message: "Authentication Required"
- ✅ After sign in, redirected to originally requested page

---

## Feature 3: Brand Coach GPT with RAG

### Test Scenario 3.1: Access Brand Coach

**Objective:** Verify Brand Coach is accessible to authenticated users

**Steps:**
1. Sign in as test user with completed diagnostic
2. Navigate to Brand Coach (via menu or direct URL)
3. Verify page loads correctly

**Expected Results:**
- ✅ Brand Coach page loads
- ✅ Diagnostic scores displayed in profile card
- ✅ Suggested prompts appear based on diagnostic weaknesses
- ✅ Chat interface visible with input area

---

### Test Scenario 3.2: Diagnostic-Based Suggested Prompts

**Objective:** Verify suggested prompts reflect user's diagnostic weaknesses

**Steps:**
1. Sign in as user with low "Insight" score (<60%)
2. Navigate to Brand Coach
3. Check suggested prompts

**Expected Results:**
- ✅ Suggested prompt includes: "How can I better understand my customers' emotional triggers?"
- ✅ Prompts specific to low-scoring categories
- ✅ If all scores high, generic prompts shown

**Test Multiple Scenarios:**
- User with low Distinctive score → "What makes my brand stand out?"
- User with low Empathetic score → "How do I build deeper emotional connections?"
- User with low Authentic score → "How can I communicate more authentically?"

---

### Test Scenario 3.3: Send Chat Message

**Objective:** Verify chat functionality works

**Steps:**
1. Access Brand Coach as authenticated user
2. Type message in chat input: "How can I improve my brand messaging?"
3. Press Enter or click "Send"
4. Wait for AI response
5. Verify response appears in chat

**Expected Results:**
- ✅ Loading spinner appears during processing
- ✅ User message appears in chat (right-aligned, blue background)
- ✅ AI response appears below (left-aligned, gray background)
- ✅ Response relevant to IDEA framework
- ✅ Response considers user's diagnostic data (if present)
- ✅ Input field cleared after sending

---

### Test Scenario 3.4: Chat Persistence

**Objective:** Verify chat history persists across sessions

**Steps:**
1. Send 2-3 messages to Brand Coach
2. Sign out
3. Sign in again
4. Navigate to Brand Coach
5. Verify previous chat history visible

**Expected Results:**
- ✅ All previous messages displayed
- ✅ Messages in correct order (chronological)
- ✅ Can continue conversation from where left off

**Database Validation:**
```sql
SELECT * FROM chat_messages 
WHERE user_id = [user_id] 
ORDER BY created_at DESC;
```

---

### Test Scenario 3.5: Clear Chat History

**Objective:** Verify clear chat functionality

**Steps:**
1. Send 2-3 messages to Brand Coach
2. Click "Clear Chat" button
3. Confirm deletion (if prompted)
4. Verify chat history cleared

**Expected Results:**
- ✅ All messages removed from UI
- ✅ Success toast: "Chat Cleared"
- ✅ Suggested prompts reappear (if applicable)
- ✅ Messages deleted from database
- ✅ New conversation can start fresh

---

### Test Scenario 3.6: Document Upload

**Objective:** Verify document upload and processing

**Steps:**
1. Access Brand Coach as authenticated user
2. In "Enhance Context" section, click document upload area
3. Select a PDF file (e.g., sample brand guidelines)
4. Wait for upload to complete
5. Verify document appears in uploaded documents list

**Expected Results:**
- ✅ File selection dialog opens
- ✅ Upload progress bar shows during upload
- ✅ Success toast: "Upload Successful - [filename] is being processed"
- ✅ Document appears in list with "Processing" status
- ✅ Status changes to "Completed" after processing
- ✅ Can delete uploaded document

**Test File Validation:**
- Invalid file type → Error toast: "Please upload PDF, DOC, DOCX, or TXT files only"
- File too large (>10MB) → Error toast: "Please upload files smaller than 10MB"

---

### Test Scenario 3.7: RAG-Enhanced Responses

**Objective:** Verify uploaded documents enhance AI responses

**Steps:**
1. Upload a document with specific brand information
2. Wait for processing to complete
3. Ask question related to uploaded document content
4. Verify AI response incorporates document context

**Expected Results:**
- ✅ AI response references uploaded document information
- ✅ More personalized and specific advice
- ✅ Response acknowledges having access to user's materials

**Note:** This requires document with specific identifiable information

---

### Test Scenario 3.8: Keyboard Shortcuts

**Objective:** Verify chat input keyboard shortcuts work

**Steps:**
1. Access Brand Coach
2. Type message in input field
3. Press Enter → Message sends
4. Press Shift+Enter → New line in input
5. Verify behavior

**Expected Results:**
- ✅ Enter key sends message
- ✅ Shift+Enter creates new line
- ✅ Input field expands for multi-line messages

---

## Feature 4: Integration Testing

### Test Scenario 4.1: Complete User Journey

**Objective:** Test full end-to-end user flow

**Steps:**
1. Start as anonymous user on homepage
2. Complete brand diagnostic (all 6 questions)
3. Create account from diagnostic modal
4. View diagnostic results page
5. Navigate to Brand Coach
6. Upload a brand document
7. Send 3 chat messages to Brand Coach
8. Sign out
9. Sign in again
10. Verify all data persists

**Expected Results:**
- ✅ Smooth flow with no errors
- ✅ All data saved correctly
- ✅ Session persistence works
- ✅ User experience cohesive and intuitive

---

### Test Scenario 4.2: Cross-Browser Compatibility

**Objective:** Verify app works across major browsers

**Browsers to Test:**
- Chrome (latest)
- Firefox (latest)
- Safari (latest, if available)
- Edge (latest)

**Steps:**
1. Complete diagnostic in each browser
2. Create account and sign in
3. Access Brand Coach
4. Test core functionality

**Expected Results:**
- ✅ UI renders correctly in all browsers
- ✅ Authentication works in all browsers
- ✅ Chat functionality works in all browsers
- ✅ No console errors specific to any browser

---

### Test Scenario 4.3: Mobile Responsiveness

**Objective:** Verify mobile experience

**Steps:**
1. Open app on mobile device or use browser dev tools mobile view
2. Complete diagnostic on mobile
3. Create account on mobile
4. Access Brand Coach on mobile

**Expected Results:**
- ✅ All pages responsive (no horizontal scroll)
- ✅ Touch interactions work correctly
- ✅ Forms usable on mobile
- ✅ Chat interface functional
- ✅ Document upload shows desktop-only message with alternative

---

### Test Scenario 4.4: Error Handling

**Objective:** Verify graceful error handling

**Test Cases:**
1. **Network Offline:**
   - Disable network mid-operation
   - Attempt to send chat message
   - Expected: Error toast with user-friendly message

2. **Invalid Session:**
   - Sign in, then manually delete session from Supabase
   - Attempt protected action
   - Expected: Redirect to auth with message

3. **Rate Limiting:**
   - Send many rapid chat messages
   - Expected: Error handling or queue management

4. **Large File Upload:**
   - Upload 15MB file
   - Expected: Validation error before upload starts

**Expected Results:**
- ✅ No crashes or white screens
- ✅ User-friendly error messages
- ✅ Clear recovery paths

---

## Test Reporting

### Defect Template

When reporting bugs, use this format:

```
**Title:** [Brief description]

**Severity:** [Critical/High/Medium/Low]

**Environment:** [Browser, OS, Device]

**Steps to Reproduce:**
1. [Step 1]
2. [Step 2]
3. [Step 3]

**Expected Result:** [What should happen]

**Actual Result:** [What actually happened]

**Screenshots:** [If applicable]

**Console Errors:** [Any errors from browser console]

**Additional Notes:** [Any other relevant information]
```

---

## Test Checklist Summary

### Brand Diagnostic Flow
- [ ] Anonymous diagnostic completion
- [ ] Account creation from diagnostic
- [ ] Sign in from diagnostic
- [ ] Google OAuth from diagnostic
- [ ] Skip account creation
- [ ] Data persistence and sync
- [ ] Score calculation accuracy
- [ ] localStorage sync to database

### Authentication System
- [ ] Email/password sign up
- [ ] Email/password sign in
- [ ] Google OAuth sign up
- [ ] Google OAuth sign in
- [ ] Password reset
- [ ] Sign out
- [ ] Protected route guards
- [ ] Session persistence

### Brand Coach GPT
- [ ] Access Brand Coach (authenticated only)
- [ ] Diagnostic scores displayed
- [ ] Suggested prompts (based on scores)
- [ ] Send chat messages
- [ ] Receive AI responses
- [ ] Chat history persistence
- [ ] Clear chat history
- [ ] Document upload
- [ ] Document processing
- [ ] RAG-enhanced responses
- [ ] Keyboard shortcuts

### Integration & Cross-Cutting
- [ ] Complete user journey (end-to-end)
- [ ] Cross-browser compatibility
- [ ] Mobile responsiveness
- [ ] Error handling and recovery
- [ ] Performance (page load times <3s)
- [ ] Accessibility (keyboard navigation)

---

## Sign-Off

**Tester Name:** _______________  
**Date Completed:** _______________  
**Overall Assessment:** _______________  
**Blockers Found:** _______________  
**Ready for Beta Launch:** [ ] Yes [ ] No

**Notes:**
