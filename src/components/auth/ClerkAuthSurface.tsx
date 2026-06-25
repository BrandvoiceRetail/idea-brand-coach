/**
 * ClerkAuthSurface — the Clerk sign-in / sign-up UI that replaces the custom
 * Supabase-Auth forms when Clerk mode is on. Rendered inside the existing page /
 * modal shells so the surrounding chrome (card, "Back to Home", Skip) is intact.
 *
 * `routing="virtual"` keeps Clerk's internal navigation off the app router (no
 * dedicated /sign-in/* paths needed). When `redirectUrl` is provided, a
 * successful auth navigates there (used by the /auth page); the diagnostic modal
 * omits it and instead watches the session to fire its own onComplete().
 */

import { SignIn, SignUp } from '@clerk/clerk-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface ClerkAuthSurfaceProps {
  /** Where to send the user after a successful sign-in/up. Omit to stay put. */
  redirectUrl?: string;
  /** Which tab opens first. */
  defaultTab?: 'signin' | 'signup';
}

// Strip Clerk's own card chrome so it sits flush inside our shadcn Card/Dialog.
const appearance = {
  elements: {
    rootBox: 'w-full',
    cardBox: 'w-full shadow-none',
    card: 'shadow-none border-0 bg-transparent p-0',
    footer: 'bg-transparent',
  },
} as const;

export function ClerkAuthSurface({
  redirectUrl,
  defaultTab = 'signin',
}: ClerkAuthSurfaceProps): JSX.Element {
  return (
    <Tabs defaultValue={defaultTab} className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="signin">Sign In</TabsTrigger>
        <TabsTrigger value="signup">Sign Up</TabsTrigger>
      </TabsList>

      <TabsContent value="signin" className="flex justify-center">
        <SignIn
          routing="virtual"
          signUpUrl="/auth"
          forceRedirectUrl={redirectUrl}
          appearance={appearance}
        />
      </TabsContent>

      <TabsContent value="signup" className="flex justify-center">
        <SignUp
          routing="virtual"
          signInUrl="/auth"
          forceRedirectUrl={redirectUrl}
          appearance={appearance}
        />
      </TabsContent>
    </Tabs>
  );
}
