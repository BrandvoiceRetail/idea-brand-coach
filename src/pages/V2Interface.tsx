import { V2StateProvider } from '@/v2/contexts/V2StateContext';
import { PanelCommunicationProvider } from '@/v2/contexts/PanelCommunicationContext';
import { ThreePanelTemplate } from '@/v2/components/ThreePanelTemplate';
import { EnhancedChatInterface } from '@/v2/components/EnhancedChatInterface';
import { BookContextDisplay } from '@/v2/components/BookContextDisplay';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// Placeholder component for the left panel (brands list)
function BrandsList() {
  return (
    <Card className="h-full border-0 rounded-none">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">Brands</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[calc(100vh-8rem)]">
          <div className="p-4 space-y-2">
            <div className="p-3 rounded-lg bg-muted/50 cursor-pointer hover:bg-muted transition-colors">
              <div className="font-medium text-sm">Default Brand</div>
              <div className="text-xs text-muted-foreground mt-1">
                Click to load brand context
              </div>
            </div>
            <div className="p-3 rounded-lg border-2 border-dashed border-muted cursor-pointer hover:border-muted-foreground/50 transition-colors">
              <div className="text-sm text-muted-foreground text-center">
                + Add New Brand
              </div>
            </div>
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

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
                leftPanel={<BrandsList />}
                middlePanel={<EnhancedChatInterface />}
                rightPanel={<BookContextDisplay />}
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