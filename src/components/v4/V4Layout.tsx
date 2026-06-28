/**
 * V4Layout — the /v4 app shell: desktop sidebar + sticky spine stepper +
 * routed content + mobile bottom-nav. Wraps the routed stages via <Outlet/>.
 *
 * Mobile-first: single column with bottom-nav under `md`; sidebar + content
 * at >=768px. Content is width-capped (~1100px) so desktop uses the space without
 * letterboxing. Bottom padding clears the fixed mobile nav only below `md`.
 */
import { Outlet } from 'react-router-dom';
import { SpineStepper } from './SpineStepper';
import { V4Sidebar } from './V4Sidebar';
import { V4BottomNav } from './V4BottomNav';
import { V4TopBar } from './V4TopBar';

export function V4Layout(): JSX.Element {
  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <V4Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <V4TopBar />
        <SpineStepper />
        <main className="mx-auto w-full max-w-[1100px] flex-1 px-4 pb-24 pt-6 sm:px-6 md:pb-10">
          <Outlet />
        </main>
        <V4BottomNav />
      </div>
    </div>
  );
}
