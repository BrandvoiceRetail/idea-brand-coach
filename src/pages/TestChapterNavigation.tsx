/**
 * Test page for ChapterNavigation component
 */

import { useState } from 'react';
import { ChapterNavigation } from '@/components/chat/ChapterNavigation';
import { ChapterId, ChapterStatus } from '@/types/chapter';

export default function TestChapterNavigation(): JSX.Element {
  const [currentChapterId, setCurrentChapterId] = useState<ChapterId>('chapter-01-introduction');
  const [chapterStatuses, setChapterStatuses] = useState<Record<ChapterId, ChapterStatus>>({
    'chapter-01-introduction': 'completed',
    'chapter-02-insight-fundamentals': 'in_progress',
    'chapter-03-insight-application': 'not_started',
    'chapter-04-distinctive-positioning': 'not_started',
    'chapter-05-distinctive-execution': 'not_started',
    'chapter-06-empathetic-understanding': 'not_started',
    'chapter-07-empathetic-connection': 'not_started',
    'chapter-08-authentic-values': 'not_started',
    'chapter-09-authentic-expression': 'not_started',
    'chapter-10-integration-strategy': 'not_started',
    'chapter-11-implementation': 'not_started',
  });

  const handleSelectChapter = (chapterId: ChapterId): void => {
    setCurrentChapterId(chapterId);
    console.log('Selected chapter:', chapterId);
  };

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">ChapterNavigation Test Page</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Component Preview */}
        <div className="border rounded-lg h-[600px] overflow-hidden">
          <ChapterNavigation
            currentChapterId={currentChapterId}
            chapterStatuses={chapterStatuses}
            onSelectChapter={handleSelectChapter}
          />
        </div>

        {/* State Display */}
        <div className="space-y-4">
          <div className="border rounded-lg p-4">
            <h2 className="text-xl font-semibold mb-2">Current State</h2>
            <div className="space-y-2 text-sm">
              <div>
                <span className="font-medium">Current Chapter:</span>{' '}
                <code className="bg-muted px-2 py-1 rounded">{currentChapterId}</code>
              </div>
            </div>
          </div>

          <div className="border rounded-lg p-4">
            <h2 className="text-xl font-semibold mb-2">Test Instructions</h2>
            <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
              <li>Click on any chapter to select it</li>
              <li>Current chapter should be highlighted</li>
              <li>Check status icons (completed ✓, in progress •, not started ○)</li>
              <li>Verify all 11 chapters are displayed</li>
              <li>Chapters should be grouped by category</li>
              <li>Hover effects should work</li>
              <li>Keyboard navigation (Enter/Space) should work</li>
              <li>Progress summary at bottom should update</li>
            </ul>
          </div>

          <div className="border rounded-lg p-4">
            <h2 className="text-xl font-semibold mb-2">Verification Checklist</h2>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <input type="checkbox" id="check1" />
                <label htmlFor="check1">Component renders without errors</label>
              </li>
              <li className="flex items-center gap-2">
                <input type="checkbox" id="check2" />
                <label htmlFor="check2">Shows all 11 chapters</label>
              </li>
              <li className="flex items-center gap-2">
                <input type="checkbox" id="check3" />
                <label htmlFor="check3">Can click to select chapter</label>
              </li>
              <li className="flex items-center gap-2">
                <input type="checkbox" id="check4" />
                <label htmlFor="check4">Current chapter is highlighted</label>
              </li>
              <li className="flex items-center gap-2">
                <input type="checkbox" id="check5" />
                <label htmlFor="check5">Categories are grouped properly</label>
              </li>
              <li className="flex items-center gap-2">
                <input type="checkbox" id="check6" />
                <label htmlFor="check6">Status icons display correctly</label>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
