/**
 * Avatar Demographics Component with Local-First Persistence
 * Example implementation using the new IndexedDB-backed persistence
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle, WifiOff, AlertCircle } from "lucide-react";
import { usePersistedField } from "@/hooks/usePersistedField";
import type { SyncStatus } from "@/lib/knowledge-base/interfaces";

/**
 * Sync status indicator component
 */
function SyncStatusIndicator({ status }: { status: SyncStatus }) {
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

/**
 * Avatar Demographics component with local-first persistence
 * Demonstrates instant field updates with background sync
 */
export function AvatarDemographicsWithPersistence() {
  // Use persisted fields with local-first architecture
  const age = usePersistedField({
    fieldIdentifier: 'avatar_demographics_age',
    category: 'avatar',
    defaultValue: ''
  });

  const income = usePersistedField({
    fieldIdentifier: 'avatar_demographics_income',
    category: 'avatar',
    defaultValue: ''
  });

  const location = usePersistedField({
    fieldIdentifier: 'avatar_demographics_location',
    category: 'avatar',
    defaultValue: ''
  });

  const lifestyle = usePersistedField({
    fieldIdentifier: 'avatar_demographics_lifestyle',
    category: 'avatar',
    defaultValue: '',
    debounceDelay: 1000 // Longer debounce for textarea
  });

  // Determine overall sync status
  const getOverallSyncStatus = (): SyncStatus => {
    const statuses = [age.syncStatus, income.syncStatus, location.syncStatus, lifestyle.syncStatus];
    if (statuses.some(s => s === 'error')) return 'error';
    if (statuses.some(s => s === 'syncing')) return 'syncing';
    if (statuses.some(s => s === 'offline')) return 'offline';
    return 'synced';
  };

  return (
    <Card className="relative">
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle>Demographics</CardTitle>
            <CardDescription>
              Basic demographic information about your target customer
            </CardDescription>
          </div>
          <SyncStatusIndicator status={getOverallSyncStatus()} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Age Range */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <Label htmlFor="age-range">Age Range</Label>
            {age.syncStatus === 'syncing' && (
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            )}
          </div>
          <Select
            value={age.value}
            onValueChange={age.onChange}
            disabled={age.isLoading}
          >
            <SelectTrigger id="age-range">
              <SelectValue placeholder="Select age range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="18-24">18-24</SelectItem>
              <SelectItem value="25-34">25-34</SelectItem>
              <SelectItem value="35-44">35-44</SelectItem>
              <SelectItem value="45-54">45-54</SelectItem>
              <SelectItem value="55-64">55-64</SelectItem>
              <SelectItem value="65+">65+</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Income Level */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <Label htmlFor="income-level">Income Level</Label>
            {income.syncStatus === 'syncing' && (
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            )}
          </div>
          <Select
            value={income.value}
            onValueChange={income.onChange}
            disabled={income.isLoading}
          >
            <SelectTrigger id="income-level">
              <SelectValue placeholder="Select income level" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="<25k">Under $25,000</SelectItem>
              <SelectItem value="25-50k">$25,000 - $50,000</SelectItem>
              <SelectItem value="50-75k">$50,000 - $75,000</SelectItem>
              <SelectItem value="75-100k">$75,000 - $100,000</SelectItem>
              <SelectItem value="100-150k">$100,000 - $150,000</SelectItem>
              <SelectItem value=">150k">Over $150,000</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Location Type */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <Label htmlFor="location-type">Location Type</Label>
            {location.syncStatus === 'syncing' && (
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            )}
          </div>
          <Select
            value={location.value}
            onValueChange={location.onChange}
            disabled={location.isLoading}
          >
            <SelectTrigger id="location-type">
              <SelectValue placeholder="Select location type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="urban">Urban</SelectItem>
              <SelectItem value="suburban">Suburban</SelectItem>
              <SelectItem value="rural">Rural</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Lifestyle Description */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <Label htmlFor="lifestyle">Lifestyle Description</Label>
            {lifestyle.syncStatus === 'syncing' && (
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            )}
          </div>
          <Textarea
            id="lifestyle"
            placeholder="Describe their typical day, family situation, work life, hobbies..."
            value={lifestyle.value}
            onChange={(e) => lifestyle.onChange(e.target.value)}
            disabled={lifestyle.isLoading}
            rows={4}
            className="resize-none"
          />
          <p className="text-xs text-muted-foreground">
            {lifestyle.value.length} characters
          </p>
        </div>

        {/* Offline notification */}
        {getOverallSyncStatus() === 'offline' && (
          <div className="bg-amber-50 dark:bg-amber-950/20 p-3 rounded-lg flex items-start gap-2">
            <WifiOff className="w-4 h-4 text-amber-600 mt-0.5" />
            <div className="text-sm text-amber-900 dark:text-amber-200">
              <p className="font-medium">Working offline</p>
              <p className="text-xs mt-1">
                Your changes are saved locally and will sync when you're back online.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Example of using batch persistence for a complete form
 */
export function AvatarFormWithBatchPersistence() {
  const { values, setValues, syncStatus, isLoading } = usePersistedForm([
    { identifier: 'avatar_demographics_age', category: 'avatar' },
    { identifier: 'avatar_demographics_income', category: 'avatar' },
    { identifier: 'avatar_demographics_location', category: 'avatar' },
    { identifier: 'avatar_demographics_lifestyle', category: 'avatar' }
  ]);

  const handleSubmit = async () => {
    // All fields are automatically persisted
    // This could trigger additional actions like validation or navigation
    console.log('Form submitted with values:', values);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          <span className="ml-2">Loading saved data...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Avatar Demographics (Batch Form)</CardTitle>
        <CardDescription>
          All fields save together when you update any field
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Form fields using values object */}
        <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
          {/* ... form fields ... */}
        </form>
      </CardContent>
    </Card>
  );
}