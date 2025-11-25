/**
 * Sync Status Indicator Component
 * Shows the current sync status of persisted fields
 */

import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle, WifiOff, AlertCircle } from "lucide-react";
import type { SyncStatus } from "@/lib/knowledge-base/interfaces";

interface SyncStatusIndicatorProps {
  status: SyncStatus;
}

export function SyncStatusIndicator({ status }: SyncStatusIndicatorProps) {
  switch (status) {
    case 'synced':
      return (
        <Badge variant="outline" className="text-green-600 border-green-600">
          <CheckCircle className="w-3 h-3 mr-1" />
          Saved
        </Badge>
      );
    case 'syncing':
      return (
        <Badge variant="outline" className="text-blue-600 border-blue-600">
          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
          Saving...
        </Badge>
      );
    case 'offline':
      return (
        <Badge variant="outline" className="text-amber-600 border-amber-600">
          <WifiOff className="w-3 h-3 mr-1" />
          Offline (saved locally)
        </Badge>
      );
    case 'error':
      return (
        <Badge variant="outline" className="text-red-600 border-red-600">
          <AlertCircle className="w-3 h-3 mr-1" />
          Error
        </Badge>
      );
  }
}
