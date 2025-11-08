# Beta Testing Setup Guide
## IDEA Brand Coach Platform

**Version:** 1.0  
**Last Updated:** 2025-11-08  
**Status:** Pre-Launch Configuration  

---

## Required Supabase Configuration for Beta Testing

### 1. Disable Email Confirmation (Critical for Testing)

**Why:** Supabase's default email provider doesn't reliably send emails in development. Disabling this allows testers to sign up and immediately access the app.

**Steps:**
1. Go to [Supabase Authentication Providers](https://supabase.com/dashboard/project/ecdrxtbclxfpkknasmrw/auth/providers)
2. Click on **Email** provider
3. Scroll to "Email confirmation"
4. **Toggle OFF** "Enable email confirmation"
5. Click **Save**

⚠️ **Remember:** Re-enable this before production launch after configuring a proper email provider.

---

### 2. Configure Site URL and Redirect URLs

**Why:** Prevents "invalid path" errors and ensures proper redirects after authentication.

**Steps:**
1. Go to [Supabase URL Configuration](https://supabase.com/dashboard/project/ecdrxtbclxfpkknasmrw/auth/url-configuration)
2. Set **Site URL** to your production URL (e.g., `https://yourdomain.com`)
3. Add **Redirect URLs**:
   - `https://yourdomain.com/**` (production wildcard)
   - `https://yourdomain.lovable.app/**` (preview wildcard)
   - `http://localhost:5173/**` (local development)
4. Click **Save**

---

### 3. Verify Database Trigger

**Why:** Ensures user profiles are automatically created when users sign up.

**Check if trigger exists:**
```sql
-- Run in Supabase SQL Editor
SELECT * FROM pg_trigger 
WHERE tgname = 'on_auth_user_created';
```

**If trigger is missing, create it:**
```sql
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

**Test profile creation:**
1. Create a test user account
2. Check the `profiles` table for a matching row
3. Verify `user_id` matches the user's ID from `auth.users`

---

## Email Configuration (Optional - For Production)

### Option 1: Use Resend (Recommended)

**Setup:**
1. Sign up at [resend.com](https://resend.com)
2. Verify your sending domain at [resend.com/domains](https://resend.com/domains)
3. Create API key at [resend.com/api-keys](https://resend.com/api-keys)
4. Go to [Supabase Project Settings](https://supabase.com/dashboard/project/ecdrxtbclxfpkknasmrw/settings/auth)
5. Scroll to "SMTP Settings"
6. Configure:
   - **Host:** smtp.resend.com
   - **Port:** 465
   - **Username:** resend
   - **Password:** [Your Resend API Key]
   - **Sender Email:** noreply@yourdomain.com
   - **Sender Name:** IDEA Brand Coach

**Customize Email Templates:**
1. Go to [Authentication → Email Templates](https://supabase.com/dashboard/project/ecdrxtbclxfpkknasmrw/auth/templates)
2. Edit these templates:
   - **Confirm signup** - Sent when users sign up
   - **Magic Link** - For passwordless login
   - **Change Email Address** - Email change confirmation
   - **Reset Password** - Password reset instructions

### Option 2: Use Supabase Default (Development Only)

⚠️ **Not recommended for production** - Supabase's default email service:
- Has rate limits
- May be unreliable
- Emails often land in spam
- Should only be used for testing

---

## Testing Checklist

### Before Inviting Beta Testers

- [ ] Email confirmation is **DISABLED** in Supabase
- [ ] Site URL is set to production domain
- [ ] All redirect URLs are configured
- [ ] Database trigger `on_auth_user_created` is active
- [ ] Test user signup creates profile in database
- [ ] Test user signin works with created account
- [ ] Password reset flow works (optional if emails not configured)
- [ ] Protected routes redirect unauthenticated users to /auth
- [ ] Dashboard redirects authenticated users away from /auth

### User Testing Scenarios

Give beta testers these tasks:

1. **Sign Up Flow**
   - Visit the app
   - Click "Sign Up"
   - Enter email, password, and full name
   - Verify successful account creation
   - Verify automatic redirect to dashboard

2. **Sign In Flow**
   - Sign out (if needed)
   - Enter credentials on /auth page
   - Verify successful sign in
   - Verify redirect to dashboard

3. **Password Reset Flow** (if emails configured)
   - Click "Forgot password?"
   - Enter email address
   - Check email for reset link
   - Click link and set new password
   - Sign in with new password

4. **Session Persistence**
   - Sign in to the app
   - Close browser tab
   - Reopen app URL
   - Verify still signed in

5. **Protected Content**
   - Visit /brand-canvas or /dashboard while signed out
   - Verify redirect to /auth
   - Sign in
   - Verify access to protected content

---

## Common Issues and Solutions

### Issue: "Invalid login credentials" on signup
**Cause:** Email confirmation is enabled, and user hasn't confirmed email  
**Solution:** Disable email confirmation in Supabase settings

### Issue: "requested path is invalid"
**Cause:** Site URL or Redirect URLs not configured correctly  
**Solution:** Add your domain to redirect URLs in Supabase

### Issue: User can sign up but no profile created
**Cause:** `on_auth_user_created` trigger not active  
**Solution:** Create the trigger using SQL from this guide

### Issue: Password too weak error
**Cause:** Client-side validation requires 8+ chars, uppercase, lowercase, number  
**Solution:** This is intentional - ensure testers use strong passwords

### Issue: Emails not being received
**Cause:** Email confirmation is enabled but SMTP not configured  
**Solution:** Either disable email confirmation or configure Resend

---

## Security Reminders for Production

When launching to production, remember to:

1. **Re-enable email confirmation**
2. **Configure proper email provider** (Resend recommended)
3. **Enable leaked password protection** in Supabase
4. **Review and test all RLS policies**
5. **Run Supabase security linter**
6. **Update CORS settings** if using custom domain
7. **Enable rate limiting** on auth endpoints
8. **Review Postgres version** and schedule upgrade if needed
9. **Set up error monitoring** (e.g., Sentry)
10. **Configure backup strategy** for database

---

## Beta Tester Invitation Template

```
Subject: You're invited to beta test IDEA Brand Coach! 🚀

Hi [Name],

You've been invited to beta test IDEA Brand Coach - a platform to help you build an emotionally intelligent brand strategy.

Getting Started:
1. Visit: [Your App URL]
2. Click "Sign Up" and create your account
3. Start with the Brand Diagnostic to get personalized insights

What to Test:
- Sign up and sign in experience
- Brand Diagnostic assessment
- Brand Coach chat functionality
- Overall usability and design

Please report any issues or suggestions directly in the app or email us at [Your Email].

Thank you for helping us improve!

The IDEA Brand Coach Team
```

---

## Support Links

- [Supabase Dashboard](https://supabase.com/dashboard/project/ecdrxtbclxfpkknasmrw)
- [Authentication Settings](https://supabase.com/dashboard/project/ecdrxtbclxfpkknasmrw/auth/providers)
- [Database Editor](https://supabase.com/dashboard/project/ecdrxtbclxfpkknasmrw/editor)
- [SQL Editor](https://supabase.com/dashboard/project/ecdrxtbclxfpkknasmrw/sql/new)
- [Logs](https://supabase.com/dashboard/project/ecdrxtbclxfpkknasmrw/logs/explorer)

---

**Questions?** Refer to [AUTH_IMPLEMENTATION.md](./AUTH_IMPLEMENTATION.md) for detailed technical documentation.
