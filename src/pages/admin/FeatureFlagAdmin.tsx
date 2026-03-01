import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FEATURES, getCurrentPhase, type DeploymentPhase, type Feature } from "@/config/features";
import { useAllFeatureFlags } from "@/hooks/useFeatureFlag";
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
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Status</TableHead>
                      <TableHead>Flag Name</TableHead>
                      <TableHead>Targeting Rules</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dynamicFlags.map((flag) => (
                      <TableRow key={flag.name}>
                        <TableCell>
                          {flag.enabled ? (
                            <Badge variant="default" className="gap-1">
                              <CheckCircle className="w-3 h-3" />
                              Enabled
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="gap-1">
                              <XCircle className="w-3 h-3" />
                              Disabled
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <code className="text-sm font-mono">{flag.name}</code>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            {flag.targeting_rules?.userIds && flag.targeting_rules.userIds.length > 0 && (
                              <div className="text-sm">
                                <span className="font-medium">User IDs:</span>{' '}
                                {flag.targeting_rules.userIds.join(', ')}
                              </div>
                            )}
                            {flag.targeting_rules?.percentage !== undefined && (
                              <div className="text-sm">
                                <span className="font-medium">User Rollout:</span>{' '}
                                {flag.targeting_rules.percentage}%
                              </div>
                            )}
                            {flag.targeting_rules?.sessionPercentage !== undefined && (
                              <div className="text-sm">
                                <span className="font-medium">Session Rollout:</span>{' '}
                                {flag.targeting_rules.sessionPercentage}%
                              </div>
                            )}
                            {!flag.targeting_rules || Object.keys(flag.targeting_rules).length === 0 ? (
                              <span className="text-sm text-muted-foreground">No targeting rules</span>
                            ) : null}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
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
