/**
 * SettingsPage — the Settings hub. Sections live as tabs; the active section is
 * reflected in the URL (`/settings/:section`) so each is deep-linkable.
 * Currently: Integrations (Figma) and Account.
 */
import { useNavigate, useParams } from 'react-router-dom';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { FigmaConnectCard } from '@/components/integrations/FigmaConnectCard';
import { AccountSettings } from '@/components/settings/AccountSettings';

const SECTIONS = ['integrations', 'account'] as const;
type Section = (typeof SECTIONS)[number];

export default function SettingsPage(): JSX.Element {
  const navigate = useNavigate();
  const { section } = useParams<{ section?: string }>();
  const active: Section = SECTIONS.includes(section as Section)
    ? (section as Section)
    : 'integrations';

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage your account and connected tools.</p>
      </div>

      <Tabs value={active} onValueChange={(value) => navigate(`/settings/${value}`)}>
        <TabsList>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
          <TabsTrigger value="account">Account</TabsTrigger>
        </TabsList>
        <TabsContent value="integrations" className="mt-6">
          <FigmaConnectCard />
        </TabsContent>
        <TabsContent value="account" className="mt-6">
          <AccountSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
}
