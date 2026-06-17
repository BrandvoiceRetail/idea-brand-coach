/**
 * SettingsPage — the Settings hub. Sections live as tabs; the active section is
 * reflected in the URL (`/settings/:section`) so each is deep-linkable.
 * Currently: Integrations (Figma) and Account.
 */
import { useNavigate, useParams } from 'react-router-dom';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { FigmaConnectCard } from '@/components/integrations/FigmaConnectCard';
import { AccountSettings } from '@/components/settings/AccountSettings';
import { useFeatureFlag } from '@/hooks/useFeatureFlag';

type Section = 'integrations' | 'account';

export default function SettingsPage(): JSX.Element {
  const navigate = useNavigate();
  const { section } = useParams<{ section?: string }>();
  const figmaEnabled = useFeatureFlag('FIGMA_INTEGRATION', false);

  const valid = new Set<Section>(figmaEnabled ? ['integrations', 'account'] : ['account']);
  const fallback: Section = figmaEnabled ? 'integrations' : 'account';
  const active: Section = valid.has(section as Section) ? (section as Section) : fallback;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage your account and connected tools.</p>
      </div>

      <Tabs value={active} onValueChange={(value) => navigate(`/settings/${value}`)}>
        <TabsList>
          {figmaEnabled && <TabsTrigger value="integrations">Integrations</TabsTrigger>}
          <TabsTrigger value="account">Account</TabsTrigger>
        </TabsList>
        {figmaEnabled && (
          <TabsContent value="integrations" className="mt-6">
            <FigmaConnectCard />
          </TabsContent>
        )}
        <TabsContent value="account" className="mt-6">
          <AccountSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
}
