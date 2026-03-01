import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { FEATURES, getCurrentPhase, type DeploymentPhase, type Feature } from "@/config/features";
import { useAllFeatureFlags, updateFeatureFlagEnabled, updateFeatureFlagPercentage } from "@/hooks/useFeatureFlag";
import { CheckCircle, XCircle, Clock, Settings } from "lucide-react";

/**
 * Feature Flag Admin Dashboard
 *
 * Displays all feature flags in the system:
 * - Phase-based features (from features.ts)
 * - Dynamic feature flags (from useFeatureFlag.ts)
 */
export default function FeatureFlagAdmin() {
  const currentPhase = getCurrentPhase();
  const dynamicFlags = useAllFeatureFlags();

  // Group phase-based features by phase
  const featuresByPhase = {
    P0: [] as Feature[],
    P1: [] as Feature[],
    P2: [] as Feature[],
  };

  Object.values(FEATURES).forEach((feature) => {
    featuresByPhase[feature.phase].push(feature);
  });

  return (
    <div className="container mx-auto py-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold mb-2">Feature Flag Administration</h1>
        <p className="text-muted-foreground">
          Manage and monitor all feature flags in the IDEA Brand Coach application
        </p>
      </div>

      {/* Current Phase Indicator */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Current Deployment Phase
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Badge variant="default" className="text-lg px-4 py-2">
              {currentPhase}
            </Badge>
            <span className="text-muted-foreground">
              {currentPhase === 'P0' && 'Beta Launch - Core features only'}
              {currentPhase === 'P1' && 'Enhanced Collaboration - Core + Collaboration features'}
              {currentPhase === 'P2' && 'Advanced Analytics - All features enabled'}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Feature Flags Tabs */}
      <Tabs defaultValue="phase-based" className="space-y-4">
        <TabsList>
          <TabsTrigger value="phase-based">Phase-Based Features</TabsTrigger>
          <TabsTrigger value="dynamic">Dynamic Feature Flags</TabsTrigger>
        </TabsList>

        {/* Phase-Based Features Tab */}
        <TabsContent value="phase-based" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Phase-Based Features</CardTitle>
              <CardDescription>
                Features controlled by deployment phase (P0, P1, P2)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* P0 Features */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <h3 className="text-lg font-semibold">P0 - Beta Launch</h3>
                    <Badge variant={currentPhase === 'P0' || currentPhase === 'P1' || currentPhase === 'P2' ? 'default' : 'secondary'}>
                      {featuresByPhase.P0.length} features
                    </Badge>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Status</TableHead>
                        <TableHead>Feature</TableHead>
                        <TableHead>Route</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Auth Required</TableHead>
                        <TableHead>Show in Nav</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {featuresByPhase.P0.map((feature) => (
                        <TableRow key={feature.id}>
                          <TableCell>
                            <FeatureStatusBadge
                              phase={feature.phase}
                              currentPhase={currentPhase}
                            />
                          </TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium">{feature.name}</div>
                              <div className="text-sm text-muted-foreground">
                                {feature.shortDescription}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <code className="text-xs bg-muted px-2 py-1 rounded">
                              {feature.route}
                            </code>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{feature.category}</Badge>
                          </TableCell>
                          <TableCell>
                            {feature.requiresAuth ? (
                              <CheckCircle className="w-4 h-4 text-green-600" />
                            ) : (
                              <XCircle className="w-4 h-4 text-gray-400" />
                            )}
                          </TableCell>
                          <TableCell>
                            {feature.showInNav ? (
                              <CheckCircle className="w-4 h-4 text-green-600" />
                            ) : (
                              <XCircle className="w-4 h-4 text-gray-400" />
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* P1 Features */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <h3 className="text-lg font-semibold">P1 - Enhanced Collaboration</h3>
                    <Badge variant={currentPhase === 'P1' || currentPhase === 'P2' ? 'default' : 'secondary'}>
                      {featuresByPhase.P1.length} features
                    </Badge>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Status</TableHead>
                        <TableHead>Feature</TableHead>
                        <TableHead>Route</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Auth Required</TableHead>
                        <TableHead>Show in Nav</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {featuresByPhase.P1.map((feature) => (
                        <TableRow key={feature.id}>
                          <TableCell>
                            <FeatureStatusBadge
                              phase={feature.phase}
                              currentPhase={currentPhase}
                            />
                          </TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium">{feature.name}</div>
                              <div className="text-sm text-muted-foreground">
                                {feature.shortDescription}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <code className="text-xs bg-muted px-2 py-1 rounded">
                              {feature.route}
                            </code>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{feature.category}</Badge>
                          </TableCell>
                          <TableCell>
                            {feature.requiresAuth ? (
                              <CheckCircle className="w-4 h-4 text-green-600" />
                            ) : (
                              <XCircle className="w-4 h-4 text-gray-400" />
                            )}
                          </TableCell>
                          <TableCell>
                            {feature.showInNav ? (
                              <CheckCircle className="w-4 h-4 text-green-600" />
                            ) : (
                              <XCircle className="w-4 h-4 text-gray-400" />
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* P2 Features */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <h3 className="text-lg font-semibold">P2 - Advanced Analytics</h3>
                    <Badge variant={currentPhase === 'P2' ? 'default' : 'secondary'}>
                      {featuresByPhase.P2.length} features
                    </Badge>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Status</TableHead>
                        <TableHead>Feature</TableHead>
                        <TableHead>Route</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Auth Required</TableHead>
                        <TableHead>Show in Nav</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {featuresByPhase.P2.map((feature) => (
                        <TableRow key={feature.id}>
                          <TableCell>
                            <FeatureStatusBadge
                              phase={feature.phase}
                              currentPhase={currentPhase}
                            />
                          </TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium">{feature.name}</div>
                              <div className="text-sm text-muted-foreground">
                                {feature.shortDescription}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <code className="text-xs bg-muted px-2 py-1 rounded">
                              {feature.route}
                            </code>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{feature.category}</Badge>
                          </TableCell>
                          <TableCell>
                            {feature.requiresAuth ? (
                              <CheckCircle className="w-4 h-4 text-green-600" />
                            ) : (
                              <XCircle className="w-4 h-4 text-gray-400" />
                            )}
                          </TableCell>
                          <TableCell>
                            {feature.showInNav ? (
                              <CheckCircle className="w-4 h-4 text-green-600" />
                            ) : (
                              <XCircle className="w-4 h-4 text-gray-400" />
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Dynamic Feature Flags Tab */}
        <TabsContent value="dynamic" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Dynamic Feature Flags</CardTitle>
              <CardDescription>
                Runtime feature flags with percentage rollouts and targeting
              </CardDescription>
            </CardHeader>
            <CardContent>
              {dynamicFlags.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No dynamic feature flags configured
                </div>
              ) : (
                <div className="space-y-6">
                  {dynamicFlags.map((flag) => (
                    <div key={flag.name} className="border rounded-lg p-6 space-y-4">
                      {/* Flag Header */}
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <code className="text-sm font-mono font-semibold">{flag.name}</code>
                          {flag.enabled ? (
                            <Badge variant="default" className="gap-1 ml-3">
                              <CheckCircle className="w-3 h-3" />
                              Enabled
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="gap-1 ml-3">
                              <XCircle className="w-3 h-3" />
                              Disabled
                            </Badge>
                          )}
                        </div>

                        {/* Enable/Disable Toggle */}
                        <div className="flex items-center gap-3">
                          <Label htmlFor={`${flag.name}-enabled`} className="text-sm font-medium">
                            Enabled
                          </Label>
                          <Switch
                            id={`${flag.name}-enabled`}
                            checked={flag.enabled}
                            onCheckedChange={(checked) => updateFeatureFlagEnabled(flag.name, checked)}
                          />
                        </div>
                      </div>

                      {/* Targeting Rules */}
                      <div className="space-y-4 pt-4 border-t">
                        <h4 className="text-sm font-semibold">Targeting Rules</h4>

                        {/* User IDs */}
                        {flag.targeting_rules?.userIds && flag.targeting_rules.userIds.length > 0 && (
                          <div className="text-sm">
                            <span className="font-medium">User IDs:</span>{' '}
                            <code className="text-xs bg-muted px-2 py-1 rounded">
                              {flag.targeting_rules.userIds.join(', ')}
                            </code>
                          </div>
                        )}

                        {/* User Percentage Rollout */}
                        {flag.targeting_rules?.percentage !== undefined && (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <Label htmlFor={`${flag.name}-user-percentage`} className="text-sm">
                                User Rollout Percentage
                              </Label>
                              <span className="text-sm font-medium">
                                {flag.targeting_rules.percentage}%
                              </span>
                            </div>
                            <Slider
                              id={`${flag.name}-user-percentage`}
                              value={[flag.targeting_rules.percentage]}
                              onValueChange={(values) =>
                                updateFeatureFlagPercentage(flag.name, 'percentage', values[0])
                              }
                              min={0}
                              max={100}
                              step={1}
                              className="w-full"
                            />
                          </div>
                        )}

                        {/* Session Percentage Rollout */}
                        {flag.targeting_rules?.sessionPercentage !== undefined && (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <Label htmlFor={`${flag.name}-session-percentage`} className="text-sm">
                                Session Rollout Percentage
                              </Label>
                              <span className="text-sm font-medium">
                                {flag.targeting_rules.sessionPercentage}%
                              </span>
                            </div>
                            <Slider
                              id={`${flag.name}-session-percentage`}
                              value={[flag.targeting_rules.sessionPercentage]}
                              onValueChange={(values) =>
                                updateFeatureFlagPercentage(flag.name, 'sessionPercentage', values[0])
                              }
                              min={0}
                              max={100}
                              step={1}
                              className="w-full"
                            />
                          </div>
                        )}

                        {!flag.targeting_rules || Object.keys(flag.targeting_rules).length === 0 ? (
                          <p className="text-sm text-muted-foreground">No targeting rules configured</p>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

/**
 * Status badge component for phase-based features
 */
function FeatureStatusBadge({
  phase,
  currentPhase
}: {
  phase: DeploymentPhase;
  currentPhase: DeploymentPhase;
}): JSX.Element {
  const phaseOrder: Record<DeploymentPhase, number> = {
    'P0': 0,
    'P1': 1,
    'P2': 2,
  };

  const isEnabled = phaseOrder[phase] <= phaseOrder[currentPhase];

  if (isEnabled) {
    return (
      <Badge variant="default" className="gap-1">
        <CheckCircle className="w-3 h-3" />
        Live
      </Badge>
    );
  }

  return (
    <Badge variant="secondary" className="gap-1">
      <Clock className="w-3 h-3" />
      Coming Soon
    </Badge>
  );
}
