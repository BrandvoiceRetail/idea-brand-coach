import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/useAuth';
import { Home, Loader2 } from 'lucide-react';
import { BetaNavigationWidget } from '@/components/BetaNavigationWidget';
import { z } from 'zod';
import { useToast } from '@/hooks/use-toast';

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
  const { signIn, signUp, signOut, resetPassword, user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

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
    const { error } = await signIn(email, password);
    setIsLoading(false);
    
    if (!error) {
      navigate('/');
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const isNameValid = validateName(fullName);
    const isEmailValid = validateEmail(email);
    const isPasswordValid = validatePassword(password);
    
    if (!isNameValid || !isEmailValid || !isPasswordValid) return;
    
    setIsLoading(true);
    const { error } = await signUp(email, password, fullName);
    setIsLoading(false);
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
  
  // Show loading state while checking auth
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Show account management if user is already logged in
  if (user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Account Management</CardTitle>
            <CardDescription>You are already signed in as {user.email}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button 
              onClick={() => navigate('/')} 
              className="w-full"
            >
              Go to Dashboard
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
            onClick={() => navigate('/')}
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