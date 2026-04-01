import React, { useState, useEffect, useMemo } from 'react';
import { BookContextDisplay } from './BookContextDisplay';
import { usePanelCommunication } from '@/v2/contexts/PanelCommunicationContext';
import { useSystemKB } from '@/contexts/SystemKBContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, BookOpen, Lightbulb, Target, Rocket, ChartBar } from 'lucide-react';
import { IDEA_BOOK_CONTENT, KEY_CONCEPTS } from '@/v2/constants/idea-book-content';

export function IdeaBookPanel() {
  const { useSystemKB: systemKBEnabled } = useSystemKB();
  const { lastMessage, subscribeToMessages } = usePanelCommunication();
  const [activeTab, setActiveTab] = useState<string | null>(null); // Start with no active tab
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPhase, setSelectedPhase] = useState<string | null>(null);

  // Listen for messages from other panels
  useEffect(() => {
    const unsubscribe = subscribeToMessages((message) => {
      if (message?.type === 'topic-selected' || message?.type === 'chat_context_update') {
        // When a topic is selected in chat, show relevant book content
        const topic = message.payload.topic?.toLowerCase() || message.payload.content?.toLowerCase();
        if (topic?.includes('insight') || topic?.includes('identify') || topic?.includes('purpose') || topic?.includes('values')) {
          setActiveTab('identify');
        } else if (topic?.includes('distinctive') || topic?.includes('discover') || topic?.includes('market') || topic?.includes('competitive')) {
          setActiveTab('discover');
        } else if (topic?.includes('empathy') || topic?.includes('execute') || topic?.includes('promise') || topic?.includes('experience')) {
          setActiveTab('execute');
        } else if (topic?.includes('authentic') || topic?.includes('analyze') || topic?.includes('metrics') || topic?.includes('feedback')) {
          setActiveTab('analyze');
        } else if (topic?.includes('overview') || topic?.includes('framework') || topic?.includes('idea')) {
          setActiveTab('overview');
        }
      }
    });

    return unsubscribe;
  }, [subscribeToMessages]);

  // Filter excerpts based on search query
  const filteredExcerpts = useMemo(() => {
    const currentExcerpts = activeTab === 'concepts'
      ? KEY_CONCEPTS
      : IDEA_BOOK_CONTENT[activeTab] || [];

    if (!searchQuery) return currentExcerpts;

    return currentExcerpts.filter(excerpt =>
      excerpt.text.toLowerCase().includes(searchQuery.toLowerCase()) ||
      excerpt.chapter?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      excerpt.section.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [activeTab, searchQuery]);

  // Phase-specific filtering
  const phaseFilteredExcerpts = useMemo(() => {
    if (!selectedPhase) return filteredExcerpts;
    return filteredExcerpts.filter(excerpt => excerpt.section === selectedPhase);
  }, [filteredExcerpts, selectedPhase]);

  const phaseIcons = {
    Identify: <Lightbulb className="h-4 w-4" />,
    Discover: <Target className="h-4 w-4" />,
    Execute: <Rocket className="h-4 w-4" />,
    Analyze: <ChartBar className="h-4 w-4" />,
  };

  return (
    <div className="h-full flex flex-col">
      {/* Search Bar */}
      <div className="p-4 border-b">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search book content..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Phase Filter Buttons */}
      <div className="flex gap-2 p-4 border-b">
        {Object.entries(phaseIcons).map(([phase, icon]) => (
          <Button
            key={phase}
            variant={selectedPhase === phase ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedPhase(selectedPhase === phase ? null : phase)}
            className="flex items-center gap-1"
          >
            {icon}
            <span className="hidden lg:inline">{phase}</span>
          </Button>
        ))}
      </div>

      {/* Content Tabs */}
      <Tabs value={activeTab || ''} onValueChange={(value) => setActiveTab(value || null)} className="flex-1 flex flex-col">
        <TabsList className="w-full justify-start rounded-none border-b h-auto p-0">
          <TabsTrigger
            value="overview"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary"
          >
            <BookOpen className="h-4 w-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger
            value="identify"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary"
          >
            Insight
          </TabsTrigger>
          <TabsTrigger
            value="discover"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary"
          >
            Distinctive
          </TabsTrigger>
          <TabsTrigger
            value="execute"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary"
          >
            Empathy
          </TabsTrigger>
          <TabsTrigger
            value="analyze"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary"
          >
            Authentic
          </TabsTrigger>
          <TabsTrigger
            value="concepts"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary"
          >
            Key Concepts
          </TabsTrigger>
        </TabsList>

        <div className="flex-1 overflow-hidden">
          {activeTab ? (
            <TabsContent value={activeTab} className="h-full m-0">
              <BookContextDisplay
                excerpts={phaseFilteredExcerpts}
                title={`${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} - IDEA Framework`}
                description={
                  systemKBEnabled
                    ? "Content from 'The IDEA Framework' book"
                    : "Sample content (System KB disabled)"
                }
                maxHeight="calc(100vh - 250px)"
                className="border-0 shadow-none"
              />
            </TabsContent>
          ) : (
            <div className="h-full flex items-center justify-center p-8">
              <div className="text-center space-y-4 max-w-md">
                <BookOpen className="h-12 w-12 text-muted-foreground mx-auto" />
                <h3 className="text-lg font-semibold">IDEA Framework Book</h3>
                <p className="text-sm text-muted-foreground">
                  Start a conversation in the chat to see relevant book excerpts appear here.
                  As you discuss different aspects of the IDEA framework, relevant content will
                  be displayed automatically.
                </p>
                <p className="text-xs text-muted-foreground">
                  You can also click on the tabs above to manually explore different sections
                  of the IDEA framework.
                </p>
              </div>
            </div>
          )}
        </div>
      </Tabs>
    </div>
  );
}