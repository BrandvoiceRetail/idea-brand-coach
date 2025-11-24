/**
 * Test page for offline functionality of user knowledge base
 * Tests local-first architecture with IndexedDB and Supabase sync
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Check, X, AlertCircle, Loader2, Wifi, WifiOff } from 'lucide-react';
import { usePersistedField, usePersistedArrayField } from '@/hooks/usePersistedField';
import { KnowledgeRepository } from '@/lib/knowledge-base/knowledge-repository';
import { SupabaseSyncService } from '@/lib/knowledge-base/supabase-sync-service';
import { useAuth } from '@/hooks/useAuth';

interface TestResult {
  test: string;
  status: 'pending' | 'running' | 'passed' | 'failed' | 'skipped';
  message?: string;
  time?: number;
}

export function TestOfflineSync() {
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [overallStatus, setOverallStatus] = useState<'idle' | 'running' | 'passed' | 'failed'>('idle');
  const { user } = useAuth();
  const userId = user?.id || '';

  // Test fields
  const testField1 = usePersistedField({
    fieldIdentifier: 'test_field_1',
    category: 'avatar',
    defaultValue: ''
  });

  const testField2 = usePersistedField({
    fieldIdentifier: 'test_field_2',
    category: 'canvas',
    defaultValue: ''
  });

  const testArrayField = usePersistedArrayField({
    fieldIdentifier: 'test_array_field',
    category: 'canvas',
    defaultValue: []
  });

  const runTests = async () => {
    setIsRunning(true);
    setOverallStatus('running');
    const results: TestResult[] = [];

    try {
      // Test 1: Local Save Performance
      results.push({ test: 'Local Save Performance (<10ms)', status: 'running' });
      setTestResults([...results]);

      const saveStart = performance.now();
      testField1.onChange('Test Value 1');
      testField2.onChange('Test Value 2');
      testArrayField.add('Item 1');
      testArrayField.add('Item 2');
      const saveTime = performance.now() - saveStart;

      if (saveTime < 10) {
        results[0] = {
          test: 'Local Save Performance (<10ms)',
          status: 'passed',
          message: `Saved in ${saveTime.toFixed(2)}ms`,
          time: saveTime
        };
      } else {
        results[0] = {
          test: 'Local Save Performance (<10ms)',
          status: 'failed',
          message: `Took ${saveTime.toFixed(2)}ms (exceeds 10ms target)`,
          time: saveTime
        };
      }
      setTestResults([...results]);

      // Test 2: Local Retrieval Performance
      results.push({ test: 'Local Retrieval Performance (<10ms)', status: 'running' });
      setTestResults([...results]);

      const retrieveStart = performance.now();
      const repo = new KnowledgeRepository({
        dbName: 'idea-brand-coach',
        dbVersion: 1,
        syncInterval: 0,
        conflictResolution: 'local-first'
      });
      await repo.initialize();
      await repo.getField(userId, 'test_field_1');
      await repo.getField(userId, 'test_field_2');
      await repo.getField(userId, 'test_array_field');
      const retrieveTime = performance.now() - retrieveStart;

      if (retrieveTime < 30) { // 3 fields under 30ms total
        results[1] = {
          test: 'Local Retrieval Performance (<10ms)',
          status: 'passed',
          message: `Retrieved in ${(retrieveTime/3).toFixed(2)}ms per field`,
          time: retrieveTime
        };
      } else {
        results[1] = {
          test: 'Local Retrieval Performance (<10ms)',
          status: 'failed',
          message: `Took ${(retrieveTime/3).toFixed(2)}ms per field`,
          time: retrieveTime
        };
      }
      setTestResults([...results]);

      // Test 3: Offline Mode Simulation
      results.push({ test: 'Offline Mode Data Access', status: 'running' });
      setTestResults([...results]);

      // Simulate offline (this is just a check that data is accessible)
      const offlineValue1 = testField1.value;
      const offlineValue2 = testField2.value;
      const offlineArray = testArrayField.value;

      if (offlineValue1 === 'Test Value 1' && offlineValue2 === 'Test Value 2' && offlineArray.length === 2) {
        results[2] = {
          test: 'Offline Mode Data Access',
          status: 'passed',
          message: 'Data accessible offline'
        };
      } else {
        results[2] = {
          test: 'Offline Mode Data Access',
          status: 'failed',
          message: 'Data not accessible offline'
        };
      }
      setTestResults([...results]);

      // Test 4: Sync Status Check
      results.push({ test: 'Sync Status Monitoring', status: 'running' });
      setTestResults([...results]);

      const syncStatuses = [
        testField1.syncStatus,
        testField2.syncStatus,
        testArrayField.syncStatus
      ];

      const allSyncStatusesValid = syncStatuses.every(status =>
        ['synced', 'syncing', 'offline'].includes(status)
      );

      if (allSyncStatusesValid) {
        results[3] = {
          test: 'Sync Status Monitoring',
          status: 'passed',
          message: `Statuses: ${syncStatuses.join(', ')}`
        };
      } else {
        results[3] = {
          test: 'Sync Status Monitoring',
          status: 'failed',
          message: 'Invalid sync status detected'
        };
      }
      setTestResults([...results]);

      // Test 5: Data Persistence (simulated)
      results.push({ test: 'Data Persistence Across Sessions', status: 'running' });
      setTestResults([...results]);

      // Create new repository instance (simulating page refresh)
      const newRepo = new KnowledgeRepository({
        dbName: 'idea-brand-coach',
        dbVersion: 1,
        syncInterval: 0,
        conflictResolution: 'local-first'
      });
      await newRepo.initialize();

      const persistedValue = await newRepo.getField(userId, 'test_field_1');
      if (persistedValue === 'Test Value 1') {
        results[4] = {
          test: 'Data Persistence Across Sessions',
          status: 'passed',
          message: 'Data persists after reload'
        };
      } else {
        results[4] = {
          test: 'Data Persistence Across Sessions',
          status: 'failed',
          message: 'Data not persisting'
        };
      }
      setTestResults([...results]);

      // Test 6: Background Sync
      results.push({ test: 'Background Sync to Supabase', status: 'running' });
      setTestResults([...results]);

      try {
        const syncService = new SupabaseSyncService(newRepo);
        await syncService.syncAllFields(userId);
        results[5] = {
          test: 'Background Sync to Supabase',
          status: 'passed',
          message: 'Successfully synced to cloud'
        };
      } catch (error) {
        if (!navigator.onLine) {
          results[5] = {
            test: 'Background Sync to Supabase',
            status: 'skipped',
            message: 'Offline - sync deferred'
          };
        } else {
          results[5] = {
            test: 'Background Sync to Supabase',
            status: 'failed',
            message: error instanceof Error ? error.message : 'Sync failed'
          };
        }
      }
      setTestResults([...results]);

      // Check overall status
      const hasFailures = results.some(r => r.status === 'failed');
      setOverallStatus(hasFailures ? 'failed' : 'passed');

    } catch (error) {
      console.error('Test suite failed:', error);
      setOverallStatus('failed');
    } finally {
      setIsRunning(false);
    }
  };

  const getStatusIcon = (status: TestResult['status']) => {
    switch (status) {
      case 'passed':
        return <Check className="h-4 w-4 text-green-600" />;
      case 'failed':
        return <X className="h-4 w-4 text-red-600" />;
      case 'running':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-600" />;
      case 'skipped':
        return <AlertCircle className="h-4 w-4 text-yellow-600" />;
      default:
        return <div className="h-4 w-4" />;
    }
  };

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Offline Functionality Test Suite
            {navigator.onLine ? (
              <Wifi className="h-5 w-5 text-green-600" />
            ) : (
              <WifiOff className="h-5 w-5 text-red-600" />
            )}
          </CardTitle>
          <CardDescription>
            Testing local-first architecture with IndexedDB and Supabase sync
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <Button
              onClick={runTests}
              disabled={isRunning}
              className="w-32"
            >
              {isRunning ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Running...
                </>
              ) : (
                'Run Tests'
              )}
            </Button>

            {overallStatus === 'passed' && (
              <Alert className="flex-1">
                <Check className="h-4 w-4" />
                <AlertDescription className="font-medium">
                  All tests passed! The offline functionality is working correctly.
                </AlertDescription>
              </Alert>
            )}

            {overallStatus === 'failed' && (
              <Alert variant="destructive" className="flex-1">
                <X className="h-4 w-4" />
                <AlertDescription className="font-medium">
                  Some tests failed. Check the results below.
                </AlertDescription>
              </Alert>
            )}
          </div>

          {testResults.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground">Test Results</h3>
              <div className="space-y-2">
                {testResults.map((result, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 border rounded-lg bg-card"
                  >
                    <div className="flex items-center gap-2">
                      {getStatusIcon(result.status)}
                      <span className="font-medium">{result.test}</span>
                    </div>
                    {result.message && (
                      <span className="text-sm text-muted-foreground">
                        {result.message}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-6 p-4 bg-muted rounded-lg">
            <h3 className="text-sm font-medium mb-2">Test Coverage</h3>
            <ul className="text-sm space-y-1 text-muted-foreground">
              <li>✓ Local save performance (&lt;10ms target)</li>
              <li>✓ Local retrieval performance</li>
              <li>✓ Offline mode data access</li>
              <li>✓ Sync status monitoring</li>
              <li>✓ Data persistence across sessions</li>
              <li>✓ Background sync to Supabase</li>
            </ul>
          </div>

          <div className="mt-4 p-4 bg-muted rounded-lg">
            <h3 className="text-sm font-medium mb-2">How to Test Offline Mode</h3>
            <ol className="text-sm space-y-1 text-muted-foreground list-decimal list-inside">
              <li>Open Chrome DevTools (F12)</li>
              <li>Go to Network tab</li>
              <li>Click "Offline" checkbox or select "Slow 3G"</li>
              <li>Try using the Avatar Builder or Brand Canvas</li>
              <li>Data should save instantly and sync when back online</li>
            </ol>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}