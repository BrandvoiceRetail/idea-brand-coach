/**
 * Coach Instructions Studio — Phase B instruction authoring surface.
 *
 * Lets authorized users create, edit, and publish versioned coach_instructions
 * that ground MCP tools and edge functions. Unlike CriteriaStudio's localStorage
 * approach, this writes to the coach_instructions table with proper versioning.
 *
 * IMPORTANT: This is wired but dark until the coach_instructions migration is applied
 * and the admin-gate mechanism is resolved (see Matthew's questions).
 */
import { useEffect, useState } from 'react';
import { Plus, Save, Archive, RefreshCw, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';

interface CoachInstruction {
  id: string;
  instruction_id: string;
  surface: 'preamble' | 'edge-fn' | 'both';
  when_to_use: string | null;
  body: string;
  input_keys: string[] | null;
  version: number;
  status: 'draft' | 'published' | 'archived';
  created_by: string | null;
  created_at: string;
  published_at: string | null;
  updated_at: string;
}

/** Expert Intelligence Loop provenance: the corrections a drafted instruction was distilled from. */
interface SourceCorrection {
  id: string;
  source: string;
  coach_claim: string;
  correction: string;
  status: string;
  created_at: string;
}

// Common instruction IDs for quick selection
const COMMON_INSTRUCTION_IDS = [
  'global.tier_a_terminology',
  'build_avatar_stage.s1',
  'build_avatar_stage.s2',
  'build_avatar_stage.s3',
  'build_avatar_stage.s4',
  'generate_listing_image_brief',
  'generate_brief',
  'identify_decision_trigger',
  'run_trust_gap',
  'avatar_vocabulary',
  'diagnostic_interpretation_evidence',
];

export default function CoachInstructionsStudio() {
  const { user } = useAuth();
  const [instructions, setInstructions] = useState<CoachInstruction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedInstruction, setSelectedInstruction] = useState<CoachInstruction | null>(null);
  const [draftBody, setDraftBody] = useState('');
  const [draftWhenToUse, setDraftWhenToUse] = useState('');
  const [draftSurface, setDraftSurface] = useState<'preamble' | 'edge-fn' | 'both'>('both');
  const [newInstructionId, setNewInstructionId] = useState('');
  const [tableExists, setTableExists] = useState(true);
  const [sourceCorrections, setSourceCorrections] = useState<SourceCorrection[]>([]);

  // Check if the feature is enabled
  const isEnabled = import.meta.env.VITE_COACH_INSTRUCTIONS_ENABLED === 'true';

  useEffect(() => {
    if (isEnabled) {
      loadInstructions();
    }
  }, [isEnabled]);

  const loadInstructions = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('coach_instructions')
        .select('*')
        .order('instruction_id', { ascending: true })
        .order('version', { ascending: false });

      if (error) {
        // Check if table doesn't exist
        if (error.code === '42P01' || error.message?.includes('does not exist')) {
          setTableExists(false);
          setError('Coach instructions table not found. The migration needs to be applied.');
        } else {
          setError(error.message);
        }
        return;
      }

      setInstructions(data || []);
      setError(null);
    } catch (err) {
      setError('Failed to load instructions');
      console.error('Load error:', err);
    } finally {
      setLoading(false);
    }
  };

  const createInstruction = async () => {
    if (!newInstructionId.trim() || !draftBody.trim()) {
      toast.error('Instruction ID and body are required');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('coach_instructions')
        .insert({
          instruction_id: newInstructionId.trim(),
          surface: draftSurface,
          when_to_use: draftWhenToUse.trim() || null,
          body: draftBody.trim(),
          version: 1,
          status: 'draft',
          created_by: user?.id,
        })
        .select()
        .single();

      if (error) throw error;

      toast.success('Instruction created');
      setInstructions([...instructions, data]);
      setNewInstructionId('');
      setDraftBody('');
      setDraftWhenToUse('');
      setSelectedInstruction(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create instruction');
    }
  };

  const updateDraft = async () => {
    if (!selectedInstruction || !draftBody.trim()) return;

    try {
      const { data, error } = await supabase
        .from('coach_instructions')
        .update({
          body: draftBody.trim(),
          when_to_use: draftWhenToUse.trim() || null,
          surface: draftSurface,
        })
        .eq('id', selectedInstruction.id)
        .select()
        .single();

      if (error) throw error;

      toast.success('Draft updated');
      const updated = instructions.map(i => i.id === data.id ? data : i);
      setInstructions(updated);
      setSelectedInstruction(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update draft');
    }
  };

  const publishInstruction = async () => {
    if (!selectedInstruction) return;

    try {
      // First, archive any existing published version
      await supabase
        .from('coach_instructions')
        .update({ status: 'archived' })
        .eq('instruction_id', selectedInstruction.instruction_id)
        .eq('status', 'published');

      // Then publish this version
      const { data, error } = await supabase
        .from('coach_instructions')
        .update({
          status: 'published',
          published_at: new Date().toISOString(),
        })
        .eq('id', selectedInstruction.id)
        .select()
        .single();

      if (error) throw error;

      toast.success('Instruction published');
      const updated = instructions.map(i => i.id === data.id ? data : i);
      setInstructions(updated);
      setSelectedInstruction(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to publish instruction');
    }
  };

  const archiveInstruction = async () => {
    if (!selectedInstruction) return;

    try {
      const { data, error } = await supabase
        .from('coach_instructions')
        .update({ status: 'archived' })
        .eq('id', selectedInstruction.id)
        .select()
        .single();

      if (error) throw error;

      toast.success('Instruction archived');
      const updated = instructions.map(i => i.id === data.id ? data : i);
      setInstructions(updated);
      setSelectedInstruction(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to archive instruction');
    }
  };

  // Expert Intelligence Loop: load the corrections a drafted instruction was distilled from.
  const loadSourceCorrections = async (instructionId: string) => {
    const { data, error } = await supabase
      .from('expert_corrections')
      .select('id, source, coach_claim, correction, status, created_at')
      .eq('proposed_instruction_id', instructionId)
      .order('created_at', { ascending: false });
    if (error) {
      console.error('Failed to load source corrections:', error);
      setSourceCorrections([]);
      return;
    }
    setSourceCorrections((data ?? []) as SourceCorrection[]);
  };

  const selectInstruction = (inst: CoachInstruction) => {
    setSelectedInstruction(inst);
    setDraftBody(inst.body);
    setDraftWhenToUse(inst.when_to_use || '');
    setDraftSurface(inst.surface);
    loadSourceCorrections(inst.instruction_id);
  };

  // Group instructions by instruction_id
  const groupedInstructions = instructions.reduce((acc, inst) => {
    if (!acc[inst.instruction_id]) {
      acc[inst.instruction_id] = [];
    }
    acc[inst.instruction_id].push(inst);
    return acc;
  }, {} as Record<string, CoachInstruction[]>);

  if (!isEnabled) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Coach Instructions Studio is not enabled. Set COACH_INSTRUCTIONS_ENABLED=true to activate.
        </AlertDescription>
      </Alert>
    );
  }

  if (loading) {
    return <div className="text-center py-8">Loading instructions...</div>;
  }

  if (!tableExists) {
    return (
      <Alert className="border-red-200">
        <AlertCircle className="h-4 w-4 text-red-600" />
        <AlertDescription className="text-red-800">
          The coach_instructions table does not exist yet.
          Please apply the migration file: supabase/migrations/20260707211007_coach_instructions.sql
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Coach Instructions Studio</h1>
          <p className="text-muted-foreground">
            Author and manage versioned instructions for MCP tools and edge functions.
          </p>
        </div>
        <Button onClick={loadInstructions} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {error && (
        <Alert className="border-red-200">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Instructions List */}
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Instructions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {Object.entries(groupedInstructions).map(([instructionId, versions]) => (
                <div key={instructionId} className="border rounded-lg p-3 space-y-2">
                  <div className="font-medium text-sm">{instructionId}</div>
                  <div className="space-y-1">
                    {versions.map(inst => (
                      <button
                        key={inst.id}
                        onClick={() => selectInstruction(inst)}
                        className={`w-full text-left px-2 py-1 rounded-md text-sm hover:bg-muted transition-colors ${
                          selectedInstruction?.id === inst.id ? 'bg-muted' : ''
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span>v{inst.version}</span>
                          <Badge
                            variant={
                              inst.status === 'published' ? 'default' :
                              inst.status === 'draft' ? 'secondary' : 'outline'
                            }
                            className="text-xs"
                          >
                            {inst.status}
                          </Badge>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* New Instruction */}
          <Card>
            <CardHeader>
              <CardTitle>New Instruction</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label htmlFor="new-id">Instruction ID</Label>
                <Select
                  value={newInstructionId}
                  onValueChange={setNewInstructionId}
                >
                  <SelectTrigger id="new-id">
                    <SelectValue placeholder="Select or type..." />
                  </SelectTrigger>
                  <SelectContent>
                    {COMMON_INSTRUCTION_IDS.map(id => (
                      <SelectItem key={id} value={id}>{id}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  className="mt-2"
                  placeholder="Or type custom ID..."
                  value={newInstructionId}
                  onChange={(e) => setNewInstructionId(e.target.value)}
                />
              </div>
              <Button onClick={createInstruction} className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                Create Draft
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Editor */}
        <div className="lg:col-span-2">
          {selectedInstruction ? (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>{selectedInstruction.instruction_id}</CardTitle>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge
                        variant={
                          selectedInstruction.status === 'published' ? 'default' :
                          selectedInstruction.status === 'draft' ? 'secondary' : 'outline'
                        }
                      >
                        {selectedInstruction.status}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        Version {selectedInstruction.version}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {selectedInstruction.status === 'draft' && (
                      <>
                        <Button onClick={updateDraft} size="sm">
                          <Save className="h-4 w-4 mr-2" />
                          Save Draft
                        </Button>
                        <Button onClick={publishInstruction} size="sm" variant="default">
                          Publish
                        </Button>
                      </>
                    )}
                    {selectedInstruction.status === 'published' && (
                      <Button onClick={archiveInstruction} size="sm" variant="outline">
                        <Archive className="h-4 w-4 mr-2" />
                        Archive
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="surface">Surface</Label>
                  <Select
                    value={draftSurface}
                    onValueChange={(v) => setDraftSurface(v as 'preamble' | 'edge-fn' | 'both')}
                    disabled={selectedInstruction.status !== 'draft'}
                  >
                    <SelectTrigger id="surface">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="preamble">MCP Preamble</SelectItem>
                      <SelectItem value="edge-fn">Edge Functions</SelectItem>
                      <SelectItem value="both">Both</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="when">When to Use</Label>
                  <Input
                    id="when"
                    value={draftWhenToUse}
                    onChange={(e) => setDraftWhenToUse(e.target.value)}
                    placeholder="Brief description of when this instruction applies..."
                    disabled={selectedInstruction.status !== 'draft'}
                  />
                </div>

                <div>
                  <Label htmlFor="body">Instruction Body</Label>
                  <Textarea
                    id="body"
                    value={draftBody}
                    onChange={(e) => setDraftBody(e.target.value)}
                    rows={15}
                    className="font-mono text-sm"
                    placeholder="The actual instruction text..."
                    disabled={selectedInstruction.status !== 'draft'}
                  />
                </div>

                <Separator />

                <div className="text-sm text-muted-foreground space-y-1">
                  <p>Created: {new Date(selectedInstruction.created_at).toLocaleString()}</p>
                  {selectedInstruction.published_at && (
                    <p>Published: {new Date(selectedInstruction.published_at).toLocaleString()}</p>
                  )}
                  <p>Updated: {new Date(selectedInstruction.updated_at).toLocaleString()}</p>
                </div>

                {sourceCorrections.length > 0 && (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      <Label>Source expert corrections ({sourceCorrections.length})</Label>
                      <p className="text-xs text-muted-foreground">
                        The expert corrections this instruction was distilled from. Publishing marks them applied.
                      </p>
                      <div className="space-y-2">
                        {sourceCorrections.map((c) => (
                          <div key={c.id} className="border rounded-md p-2 text-sm space-y-1">
                            <div className="flex items-center justify-between">
                              <Badge variant="outline" className="text-xs">{c.source}</Badge>
                              <Badge variant="secondary" className="text-xs">{c.status}</Badge>
                            </div>
                            <p className="text-muted-foreground line-through">{c.coach_claim}</p>
                            <p>→ {c.correction}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                Select an instruction to edit or create a new one.
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}