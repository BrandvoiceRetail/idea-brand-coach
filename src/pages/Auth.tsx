import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { captureAlphaEvent } from '@/lib/posthogClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/useAuth';
import { useDiagnostic } from '@/hooks/useDiagnostic';
import { Home, Loader2 } from 'lucide-react';
import { BetaNavigationWidget } from '@/components/BetaNavigationWidget';
import { z } from 'zod';
import { useToast } from '@/hooks/use-toast';
import { ROUTES } from '@/config/routes';
import { isV4Forced } from '@/config/v4';
import { supabase } from '@/integrations/supabase/client';
import { Checkbox } from '@/components/ui/checkbox';
import { CONSENT_POLICY_VERSION } from '@/lib/consent';

const emailSchema = z.string().email('Please enter a valid email address').max(255, 'Email must be less than 255 characters');
const passwordSchema = z.string().min(6, 'Password must be at least 6 characters').max(100, 'Password must be less than 100 characters');
const nameSchema = z.string().trim().min(1, 'Name is required').max(100, 'Name must be less than 100 characters');

export default function Auth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [emailErrors, setEmailErrors] = useState('');
  const [passwordErrors, setPasswordErrors] = useState('');
  const [nameErrors, setNameErrors] = useState('');
  // GDPR: signup requires explicit acceptance of the privacy notice.
  const [acceptedPolicies, setAcceptedPolicies] = useState(false);
  const [policiesError, setPoliciesError] = useState('');
  // Set after a sign-up that returns no session (email confirmation required) so
  // we show a persistent "check your email" panel instead of routing into the app.
  const [pendingConfirmEmail, setPendingConfirmEmail] = useState<string | null>(null);
  // Password-recovery (set-new-password) form state.
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [confirmPasswordErrors, setConfirmPasswordErrors] = useState('');
  const { signIn, signUp, signOut, resetPassword, updatePassword, user, loading, isRecovering, signInWithGoogle } = useAuth();
  const { syncFromLocalStorage } = useDiagnostic();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  // The password-reset email links to /auth?mode=reset; isRecovering is set when
  // the recovery session arrives. Either signal puts us in set-new-password mode.
  const isPasswordReset = searchParams.get('mode') === 'reset' || isRecovering;

  // Get redirect URL from query params.
  // When the /v4 surface is forced, post-auth ALWAYS resolves through `/` so
  // VersionGate can fork first-run users into the onboarding CHOICE screen
  // (connector vs in-app). We must NOT shortcut diagnostic-completing users to
  // `/subscribe` here — that bypasses the connector recommendation entirely.
  // Outside v4, keep the legacy diagnostic → subscribe shortcut.
  const defaultRedirect = isV4Forced()
    ? '/'
    : localStorage.getItem('diagnosticData')
      ? '/subscribe'
      : '/';
  const redirectUrl = searchParams.get('redirect') || defaultRedirect;

  // Funnel: the signup/login prompt is shown to a guest (auth is itself a
  // drop-off point — see the diagnostic → bridge → coach journey).
  useEffect(() => {
    if (!loading && !user) {
      captureAlphaEvent('auth_started');
    }
  }, [loading, user]);

  const validateEmail = (value: string) => {
    try {
      emailSchema.parse(value);
      setEmailErrors('');
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        setEmailErrors(error.errors[0].message);
      }
      return false;
    }
  };

  const validatePassword = (value: string) => {
    try {
      passwordSchema.parse(value);
      setPasswordErrors('');
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        setPasswordErrors(error.errors[0].message);
      }
      return false;
    }
  };

  const validateName = (value: string) => {
    try {
      nameSchema.parse(value);
      setNameErrors('');
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        setNameErrors(error.errors[0].message);
      }
      return false;
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();

    const isEmailValid = validateEmail(email);
    const isPasswordValid = validatePassword(password);

    if (!isEmailValid || !isPasswordValid) return;

    setIsLoading(true);

    // If the visitor arrived on an ANONYMOUS session (a guest /v5 run), keep
    // its token: signing in replaces the session, and without this the run's
    // data stays stranded under the anon user (task #31). After sign-in the
    // reparent-anon-run edge fn verifies both identities and moves the rows.
    let anonToken: string | null = null;
    try {
      const { data: { session: preSession } } = await supabase.auth.getSession();
      if (preSession?.user?.is_anonymous) anonToken = preSession.access_token;
    } catch { /* no session to carry */ }

    const { error } = await signIn(email, password);

    if (!error) {
      setIsLoading(false);

      if (anonToken) {
        // Background carry-over; the app resurfaces the moved rows on load.
        supabase.functions.invoke('reparent-anon-run', { body: { anonToken } })
          .then(({ data, error: reparentError }) => {
            if (reparentError) console.error('❌ Auth: anon run carry-over failed:', reparentError);
            else console.log('✅ Auth: anon run carried into account:', data?.moved);
          })
          .catch((e) => console.error('❌ Auth: anon run carry-over failed:', e));
      }

      // Navigate first
      navigate(redirectUrl);

      // Then sync diagnostic data from localStorage if it exists (async, non-blocking)
      const diagnosticData = localStorage.getItem('diagnosticData');
      console.log('🔍 Auth: Checking for diagnostic data in localStorage:', diagnosticData ? 'FOUND' : 'NOT FOUND');
      if (diagnosticData) {
        // Don't await - let it run in background after navigation
        syncFromLocalStorage()
          .then(() => {
            console.log('✅ Auth: Diagnostic sync completed successfully');
          })
          .catch((syncError) => {
            console.error('❌ Auth: Error syncing diagnostic data:', syncError);
          });
      }
    } else {
      setIsLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();

    const isNameValid = validateName(fullName);
    const isEmailValid = validateEmail(email);
    const isPasswordValid = validatePassword(password);

    if (!acceptedPolicies) {
      setPoliciesError('Please agree to the Privacy Policy to create an account.');
    } else {
      setPoliciesError('');
    }

    if (!isNameValid || !isEmailValid || !isPasswordValid || !acceptedPolicies) return;

    setIsLoading(true);
    const { error, needsConfirmation } = await signUp(email, password, fullName, {
      version: CONSENT_POLICY_VERSION,
    });

    if (!error) {
      setIsLoading(false);

      // Email confirmation required: do NOT navigate into a sessionless app.
      // Surface a persistent panel telling the user to confirm their email.
      if (needsConfirmation) {
        setPendingConfirmEmail(email);
        return;
      }

      // Navigate first
      navigate(redirectUrl);

      // Then sync diagnostic data from localStorage if it exists (async, non-blocking)
      const diagnosticData = localStorage.getItem('diagnosticData');
      console.log('🔍 Auth (Sign Up): Checking for diagnostic data in localStorage:', diagnosticData ? 'FOUND' : 'NOT FOUND');
      if (diagnosticData) {
        // Don't await - let it run in background after navigation
        syncFromLocalStorage()
          .then(() => {
            console.log('✅ Auth (Sign Up): Diagnostic sync completed successfully');
            // Toast will be shown by the useDiagnostic hook
          })
          .catch((syncError) => {
            console.error('❌ Auth (Sign Up): Error syncing diagnostic data:', syncError);
          });
      }
    } else {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    const { error } = await signInWithGoogle();
    setIsLoading(false);
    
    if (error) {
      toast({
        title: "Google Sign In Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateEmail(resetEmail)) return;
    
    setIsLoading(true);
    const { error } = await resetPassword(resetEmail);
    setIsLoading(false);
    
    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Check your email",
        description: "We've sent you a password reset link.",
      });
      setShowResetPassword(false);
      setResetEmail('');
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validatePassword(newPassword)) return;
    if (newPassword !== confirmNewPassword) {
      setConfirmPasswordErrors('Passwords do not match');
      return;
    }
    setConfirmPasswordErrors('');

    setIsLoading(true);
    const { error } = await updatePassword(newPassword);
    setIsLoading(false);

    if (error) {
      const message = error instanceof Error ? error.message : 'Could not update your password. Please try again.';
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Password updated",
        description: "You're all set — taking you into Brand Coach.",
      });
      // Resolve through VersionGate (defaults to V2) — never /v1.
      navigate(ROUTES.APP_ROOT);
    }
  };

  // Show loading state while checking auth
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Password-recovery: a reset link established a recovery session. Show a
  // set-new-password form BEFORE the "already signed in" branch so the recovery
  // session never dead-ends on the account-management card (which routed to /v1).
  if (isPasswordReset) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Set a new password</CardTitle>
            <CardDescription>
              Choose a new password for your account.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">New password</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value);
                    validatePassword(e.target.value);
                  }}
                  placeholder="Choose a secure password (min. 6 characters)"
                  required
                />
                {passwordErrors && <p className="text-sm text-destructive">{passwordErrors}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-new-password">Confirm new password</Label>
                <Input
                  id="confirm-new-password"
                  type="password"
                  value={confirmNewPassword}
                  onChange={(e) => {
                    setConfirmNewPassword(e.target.value);
                    setConfirmPasswordErrors('');
                  }}
                  placeholder="Re-enter your new password"
                  required
                />
                {confirmPasswordErrors && <p className="text-sm text-destructive">{confirmPasswordErrors}</p>}
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Update password"}
              </Button>
            </form>
          </CardContent>
        </Card>
        <BetaNavigationWidget />
      </div>
    );
  }

  // Sign-up succeeded but no session (email confirmation required). Show a
  // persistent panel rather than dropping the user into a sessionless app.
  if (pendingConfirmEmail) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Check your email</CardTitle>
            <CardDescription>
              We've sent a confirmation link to <span className="font-medium text-foreground">{pendingConfirmEmail}</span>.
              Click it to activate your account, then come back and sign in.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setPendingConfirmEmail(null)}
            >
              Back to sign in
            </Button>
          </CardContent>
        </Card>
        <BetaNavigationWidget />
      </div>
    );
  }

  // Show account management if user is already logged in. An ANONYMOUS
  // session (minted by a guest /v5 run) must NOT count — it has no email and
  // no credentials, so this branch would be a dead end ("signed in as <blank>"
  // with no way to reach the sign-in form). Anon visitors fall through to the
  // real form; signing in replaces the anon session and honours ?redirect=.
  if (user && !(user as { is_anonymous?: boolean }).is_anonymous) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Account Management</CardTitle>
            <CardDescription>You are already signed in as {user.email}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              onClick={() => navigate(ROUTES.APP_ROOT)}
              className="w-full"
            >
              Continue to your listings
            </Button>
            <Button 
              onClick={signOut} 
              variant="outline" 
              className="w-full"
            >
              Sign Out
            </Button>
          </CardContent>
        </Card>
        <BetaNavigationWidget />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <Button
            variant="ghost"
            onClick={() => navigate(ROUTES.APP_ROOT)}
            className="flex items-center gap-2"
          >
            <Home className="w-4 h-4" />
            Back to Home
          </Button>
        </div>
        
        {showResetPassword ? (
          <Card className="w-full">
            <CardHeader>
              <CardTitle>Reset Password</CardTitle>
              <CardDescription>
                Enter your email address and we'll send you a reset link.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reset-email">Email</Label>
                  <Input
                    id="reset-email"
                    type="email"
                    value={resetEmail}
                    onChange={(e) => {
                      setResetEmail(e.target.value);
                      validateEmail(e.target.value);
                    }}
                    placeholder="your.email@example.com"
                    required
                  />
                  {emailErrors && <p className="text-sm text-destructive">{emailErrors}</p>}
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowResetPassword(false)}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button type="submit" className="flex-1" disabled={isLoading}>
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Send Reset Link"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        ) : (
          <Card className="w-full">
            <CardHeader>
              <CardTitle>Welcome to IDEA Brand Coach</CardTitle>
              <CardDescription>
                Sign in to your account or create a new one to get started.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="signin" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="signin">Sign In</TabsTrigger>
                  <TabsTrigger value="signup">Sign Up</TabsTrigger>
                </TabsList>
                
                <TabsContent value="signin">
                  <form onSubmit={handleSignIn} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="signin-email">Email</Label>
                      <Input
                        id="signin-email"
                        type="email"
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value);
                          validateEmail(e.target.value);
                        }}
                        placeholder="What's your email address?"
                        required
                      />
                      {emailErrors && <p className="text-sm text-destructive">{emailErrors}</p>}
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <Label htmlFor="signin-password">Password</Label>
                        <Button
                          type="button"
                          variant="link"
                          className="h-auto p-0 text-xs"
                          onClick={() => setShowResetPassword(true)}
                        >
                          Forgot password?
                        </Button>
                      </div>
                      <Input
                        id="signin-password"
                        type="password"
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value);
                          validatePassword(e.target.value);
                        }}
                        placeholder="Your password, please"
                        required
                      />
                      {passwordErrors && <p className="text-sm text-destructive">{passwordErrors}</p>}
                    </div>
                    <Button type="submit" className="w-full" disabled={isLoading}>
                      {isLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Getting you signed in...
                        </>
                      ) : (
                        "Let's go!"
                      )}
                    </Button>
                    
                    <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t" />
                      </div>
                      <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-background px-2 text-muted-foreground">
                          Or continue with
                        </span>
                      </div>
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      onClick={handleGoogleSignIn}
                      disabled={isLoading}
                    >
                      <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                        <path
                          fill="currentColor"
                          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        />
                        <path
                          fill="currentColor"
                          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        />
                        <path
                          fill="currentColor"
                          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                        />
                        <path
                          fill="currentColor"
                          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                        />
                      </svg>
                      Sign in with Google
                    </Button>
                  </form>
                </TabsContent>
                
                <TabsContent value="signup">
                  <form onSubmit={handleSignUp} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="signup-name">Full Name</Label>
                      <Input
                        id="signup-name"
                        type="text"
                        value={fullName}
                        onChange={(e) => {
                          setFullName(e.target.value);
                          validateName(e.target.value);
                        }}
                        placeholder="What should we call you?"
                        required
                      />
                      {nameErrors && <p className="text-sm text-destructive">{nameErrors}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-email">Email</Label>
                      <Input
                        id="signup-email"
                        type="email"
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value);
                          validateEmail(e.target.value);
                        }}
                        placeholder="Your email address here"
                        required
                      />
                      {emailErrors && <p className="text-sm text-destructive">{emailErrors}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-password">Password</Label>
                      <Input
                        id="signup-password"
                        type="password"
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value);
                          validatePassword(e.target.value);
                        }}
                        placeholder="Choose a secure password (min. 6 characters)"
                        required
                      />
                      {passwordErrors && <p className="text-sm text-destructive">{passwordErrors}</p>}
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-start gap-2">
                        <Checkbox
                          id="signup-policies"
                          checked={acceptedPolicies}
                          onCheckedChange={(checked) => {
                            setAcceptedPolicies(checked === true);
                            if (checked === true) setPoliciesError('');
                          }}
                          className="mt-0.5"
                        />
                        <Label htmlFor="signup-policies" className="text-sm font-normal leading-snug text-muted-foreground">
                          I agree to the{' '}
                          <a href="/privacy" target="_blank" rel="noopener noreferrer" className="underline text-foreground">
                            Privacy Policy
                          </a>{' '}
                          and to my brand data being processed to provide the coaching service.
                        </Label>
                      </div>
                      {policiesError && <p className="text-sm text-destructive">{policiesError}</p>}
                    </div>
                    <Button type="submit" className="w-full" disabled={isLoading}>
                      {isLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Setting up your account...
                        </>
                      ) : (
                        "Let's get started!"
                      )}
                    </Button>

                    <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t" />
                      </div>
                      <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-background px-2 text-muted-foreground">
                          Or continue with
                        </span>
                      </div>
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      onClick={handleGoogleSignIn}
                      disabled={isLoading}
                    >
                      <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                        <path
                          fill="currentColor"
                          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        />
                        <path
                          fill="currentColor"
                          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        />
                        <path
                          fill="currentColor"
                          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                        />
                        <path
                          fill="currentColor"
                          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                        />
                      </svg>
                      Sign up with Google
                    </Button>
                    <p className="text-xs text-muted-foreground text-center">
                      By signing up with Google you agree to the{' '}
                      <a href="/privacy" target="_blank" rel="noopener noreferrer" className="underline">
                        Privacy Policy
                      </a>.
                    </p>
                  </form>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        )}
      </div>
      <BetaNavigationWidget />
    </div>
  );
}