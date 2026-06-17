/**
 * AccountSettings — the Account section of the Settings hub. Minimal today:
 * shows the signed-in identity and a sign-out action.
 */
import { LogOut } from 'lucide-react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';

export function AccountSettings(): JSX.Element {
  const { user, signOut } = useAuth();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Account</CardTitle>
        <CardDescription>Your IDEA Brand Coach account.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">Email</span>
          <span className="font-medium">{user?.email ?? '—'}</span>
        </div>
      </CardContent>
      <CardFooter>
        <Button variant="outline" onClick={() => void signOut()}>
          <LogOut className="h-4 w-4 mr-1.5" /> Sign out
        </Button>
      </CardFooter>
    </Card>
  );
}
