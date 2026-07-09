/**
 * PrivacySettings — the Privacy & Data section of the Settings hub.
 * The user's GDPR rights, self-service:
 *  - Analytics consent toggle (withdraw as easily as given — Art. 7(3))
 *  - Download my data (Art. 15 access / Art. 20 portability)
 *  - Delete account + all data (Art. 17 erasure), typed-confirmation gated
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { getStoredConsent, setStoredConsent } from '@/lib/consent';
import { recordConsentDecision } from '@/services/consentService';
import { deleteAccount, downloadExportFile, requestDataExport } from '@/services/gdprService';

export function PrivacySettings(): JSX.Element {
  const [analyticsOn, setAnalyticsOn] = useState<boolean>(
    () => getStoredConsent()?.analytics === 'granted',
  );
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  const handleAnalyticsToggle = (checked: boolean): void => {
    setAnalyticsOn(checked);
    setStoredConsent(checked ? 'granted' : 'denied');
    void recordConsentDecision('analytics', checked, 'settings');
    toast.success(checked ? 'Analytics enabled.' : 'Analytics disabled — no further events will be sent.');
  };

  const handleExport = async (): Promise<void> => {
    setExporting(true);
    try {
      const { data, error } = await requestDataExport();
      if (error || !data) {
        toast.error(error ?? 'Export failed. Please try again.');
        return;
      }
      downloadExportFile(data);
      toast.success('Your data export has been downloaded.');
    } finally {
      setExporting(false);
    }
  };

  const handleDelete = async (): Promise<void> => {
    setDeleting(true);
    try {
      const { deleted, error } = await deleteAccount();
      if (!deleted) {
        toast.error(error ?? 'Deletion failed. Your account was not removed.');
        return;
      }
      // Wipe every local trace before leaving; the server side is already gone.
      try {
        localStorage.clear();
        sessionStorage.clear();
      } catch {
        // storage failure must not block the redirect
      }
      window.location.href = '/';
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Analytics</CardTitle>
          <CardDescription>
            Optional PostHog (EU-hosted) product analytics. Changing this takes effect immediately.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="analytics-consent" className="text-sm font-normal">
              Allow anonymous-to-account usage analytics
            </Label>
            <Switch
              id="analytics-consent"
              checked={analyticsOn}
              onCheckedChange={handleAnalyticsToggle}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your data</CardTitle>
          <CardDescription>
            Download a complete, machine-readable copy of everything stored about you — account,
            brand content, conversations, diagnostics, and files. See the{' '}
            <Link to="/privacy" className="underline">Privacy Policy</Link> for what we store and why.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={() => void handleExport()} disabled={exporting}>
            {exporting ? (
              <>
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Preparing export…
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-1.5" /> Download my data (JSON)
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="text-destructive">Delete account</CardTitle>
          <CardDescription>
            Permanently deletes your account and ALL associated data — brands, avatars,
            conversations, diagnostics, uploads, and analytics identity. This cannot be undone.
            Consider downloading your data first.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AlertDialog onOpenChange={(open) => { if (!open) setConfirmText(''); }}>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">
                <Trash2 className="h-4 w-4 mr-1.5" /> Delete my account and data
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete your account permanently?</AlertDialogTitle>
                <AlertDialogDescription>
                  Every brand, avatar, conversation, diagnostic, and uploaded file will be erased.
                  Type <span className="font-mono font-semibold">DELETE</span> to confirm.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <Input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="Type DELETE to confirm"
                aria-label="Type DELETE to confirm account deletion"
                autoComplete="off"
              />
              <AlertDialogFooter>
                <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  disabled={confirmText !== 'DELETE' || deleting}
                  onClick={(e) => {
                    // Keep the dialog open while the request runs.
                    e.preventDefault();
                    void handleDelete();
                  }}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {deleting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Deleting…
                    </>
                  ) : (
                    'Delete everything'
                  )}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  );
}
