import { V2StateProvider } from '@/v2/contexts/V2StateContext';
import { PanelCommunicationProvider } from '@/v2/contexts/PanelCommunicationContext';
import { ThreePanelTemplate } from '@/v2/components/ThreePanelTemplate';
import { V2ChatPanel } from '@/v2/components/V2ChatPanel';
import { IdeaBookPanel } from '@/v2/components/IdeaBookPanel';
import { SimpleBrandPanel } from '@/v2/components/SimpleBrandPanel';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export function V2Interface() {
  return (
    <V2StateProvider>
      <PanelCommunicationProvider>
        <div className="h-screen w-full overflow-hidden">
          <Tabs defaultValue="workspace" className="h-full">
            <div className="border-b px-4">
              <TabsList className="h-12 bg-transparent">
                <TabsTrigger value="workspace" className="data-[state=active]:bg-muted">
                  Workspace
                </TabsTrigger>
                <TabsTrigger value="settings" className="data-[state=active]:bg-muted">
                  Settings
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="workspace" className="h-[calc(100%-3rem)] m-0">
              <ThreePanelTemplate
                leftPanel={<SimpleBrandPanel />}
                middlePanel={<V2ChatPanel />}
                rightPanel={<IdeaBookPanel />}
              />
            </TabsContent>

            <TabsContent value="settings" className="h-[calc(100%-3rem)] p-4">
              <Card>
                <CardHeader>
                  <CardTitle>V2 Interface Settings</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    Settings and configuration options will appear here.
                  </p>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </PanelCommunicationProvider>
    </V2StateProvider>
  );
}