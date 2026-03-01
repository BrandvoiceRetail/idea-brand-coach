/**
 * AvatarServiceDemo
 *
 * Integration test/demo component for avatar management service layer.
 * Demonstrates all CRUD operations and context integration.
 *
 * This component can be used for manual testing and verification of:
 * - Create avatar
 * - List avatars
 * - Update avatar
 * - Delete avatar
 * - Context updates
 * - Toast notifications
 */

import { useState } from 'react';
import { useAvatars } from '@/hooks/useAvatars';
import { useAvatarContext } from '@/contexts/AvatarContext';
import { AvatarCreate, AvatarUpdate } from '@/types/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export function AvatarServiceDemo(): JSX.Element {
  // Hooks
  const {
    avatars,
    templates,
    isLoadingAvatars,
    isLoadingTemplates,
    avatarsError,
    templatesError,
    createAvatar,
    isCreating,
    updateAvatar,
    isUpdating,
    deleteAvatar,
    isDeleting,
  } = useAvatars();

  const {
    selectedAvatarId,
    setSelectedAvatar,
    currentAvatar,
  } = useAvatarContext();

  // Local state for forms
  const [createForm, setCreateForm] = useState<AvatarCreate>({
    name: '',
    demographics: {},
    psychographics: {},
    pain_points: [],
    goals: [],
    preferred_channels: [],
  });

  const [updateForm, setUpdateForm] = useState<AvatarUpdate>({
    name: '',
  });

  const [selectedUpdateAvatarId, setSelectedUpdateAvatarId] = useState<string>('');
  const [painPointInput, setPainPointInput] = useState<string>('');
  const [goalInput, setGoalInput] = useState<string>('');

  // Handlers
  const handleCreateAvatar = (): void => {
    if (!createForm.name.trim()) {
      return;
    }
    createAvatar(createForm);
    // Reset form
    setCreateForm({
      name: '',
      demographics: {},
      psychographics: {},
      pain_points: [],
      goals: [],
      preferred_channels: [],
    });
    setPainPointInput('');
    setGoalInput('');
  };

  const handleUpdateAvatar = (): void => {
    if (!selectedUpdateAvatarId || !updateForm.name?.trim()) {
      return;
    }
    updateAvatar({ id: selectedUpdateAvatarId, data: updateForm });
    // Reset form
    setUpdateForm({ name: '' });
    setSelectedUpdateAvatarId('');
  };

  const handleDeleteAvatar = (id: string): void => {
    if (window.confirm('Are you sure you want to delete this avatar?')) {
      deleteAvatar(id);
    }
  };

  const handleAddPainPoint = (): void => {
    if (painPointInput.trim()) {
      setCreateForm(prev => ({
        ...prev,
        pain_points: [...(prev.pain_points || []), painPointInput.trim()],
      }));
      setPainPointInput('');
    }
  };

  const handleAddGoal = (): void => {
    if (goalInput.trim()) {
      setCreateForm(prev => ({
        ...prev,
        goals: [...(prev.goals || []), goalInput.trim()],
      }));
      setGoalInput('');
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Avatar Service Demo</h1>
        <p className="text-muted-foreground">
          Integration test component for avatar management service layer
        </p>
      </div>

      {/* Context State Display */}
      <Card>
        <CardHeader>
          <CardTitle>Context State</CardTitle>
          <CardDescription>Currently selected avatar from AvatarContext</CardDescription>
        </CardHeader>
        <CardContent>
          {currentAvatar ? (
            <div className="space-y-2">
              <p><strong>ID:</strong> {currentAvatar.id}</p>
              <p><strong>Name:</strong> {currentAvatar.name}</p>
              <p><strong>Pain Points:</strong> {currentAvatar.pain_points?.join(', ') || 'None'}</p>
              <p><strong>Goals:</strong> {currentAvatar.goals?.join(', ') || 'None'}</p>
            </div>
          ) : (
            <p className="text-muted-foreground">No avatar selected</p>
          )}
        </CardContent>
      </Card>

      {/* Avatar List */}
      <Card>
        <CardHeader>
          <CardTitle>Avatar List</CardTitle>
          <CardDescription>All avatars from useAvatars hook</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingAvatars && <p className="text-muted-foreground">Loading avatars...</p>}
          {avatarsError && <p className="text-destructive">Error: {(avatarsError as Error).message}</p>}
          {avatars && avatars.length === 0 && (
            <p className="text-muted-foreground">No avatars found. Create one below!</p>
          )}
          {avatars && avatars.length > 0 && (
            <div className="space-y-3">
              {avatars.map((avatar) => (
                <div
                  key={avatar.id}
                  className={`p-4 border rounded-lg ${
                    selectedAvatarId === avatar.id ? 'border-primary bg-primary/5' : ''
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold">{avatar.name}</h3>
                      <p className="text-sm text-muted-foreground">ID: {avatar.id}</p>
                      {avatar.pain_points && avatar.pain_points.length > 0 && (
                        <p className="text-sm mt-1">
                          <strong>Pain Points:</strong> {avatar.pain_points.join(', ')}
                        </p>
                      )}
                      {avatar.goals && avatar.goals.length > 0 && (
                        <p className="text-sm">
                          <strong>Goals:</strong> {avatar.goals.join(', ')}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2 ml-4">
                      <Button
                        size="sm"
                        variant={selectedAvatarId === avatar.id ? 'default' : 'outline'}
                        onClick={() => setSelectedAvatar(avatar.id)}
                      >
                        {selectedAvatarId === avatar.id ? 'Selected' : 'Select'}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedUpdateAvatarId(avatar.id);
                          setUpdateForm({ name: avatar.name });
                        }}
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDeleteAvatar(avatar.id)}
                        disabled={isDeleting}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Templates List */}
      <Card>
        <CardHeader>
          <CardTitle>Avatar Templates</CardTitle>
          <CardDescription>Pre-built templates from useAvatars hook</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingTemplates && <p className="text-muted-foreground">Loading templates...</p>}
          {templatesError && <p className="text-destructive">Error: {(templatesError as Error).message}</p>}
          {templates && templates.length === 0 && (
            <p className="text-muted-foreground">No templates available</p>
          )}
          {templates && templates.length > 0 && (
            <div className="space-y-2">
              {templates.map((template) => (
                <div key={template.id} className="p-3 border rounded">
                  <h4 className="font-medium">{template.name}</h4>
                  <p className="text-sm text-muted-foreground">Template ID: {template.id}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Avatar Form */}
      <Card>
        <CardHeader>
          <CardTitle>Create Avatar</CardTitle>
          <CardDescription>Test avatar creation functionality</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="create-name">Avatar Name *</Label>
            <Input
              id="create-name"
              value={createForm.name}
              onChange={(e) => setCreateForm(prev => ({ ...prev, name: e.target.value }))}
              placeholder="e.g., Sarah the Tech Entrepreneur"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="create-age">Age (Demographics)</Label>
            <Input
              id="create-age"
              value={createForm.demographics?.age || ''}
              onChange={(e) => setCreateForm(prev => ({
                ...prev,
                demographics: { ...prev.demographics, age: e.target.value },
              }))}
              placeholder="e.g., 25-34"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="create-occupation">Occupation (Demographics)</Label>
            <Input
              id="create-occupation"
              value={createForm.demographics?.occupation || ''}
              onChange={(e) => setCreateForm(prev => ({
                ...prev,
                demographics: { ...prev.demographics, occupation: e.target.value },
              }))}
              placeholder="e.g., Software Engineer"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="create-lifestyle">Lifestyle (Psychographics)</Label>
            <Input
              id="create-lifestyle"
              value={createForm.psychographics?.lifestyle || ''}
              onChange={(e) => setCreateForm(prev => ({
                ...prev,
                psychographics: { ...prev.psychographics, lifestyle: e.target.value },
              }))}
              placeholder="e.g., Fast-paced, tech-savvy"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="pain-point-input">Pain Points</Label>
            <div className="flex gap-2">
              <Input
                id="pain-point-input"
                value={painPointInput}
                onChange={(e) => setPainPointInput(e.target.value)}
                placeholder="e.g., Lacks time for research"
                onKeyPress={(e) => e.key === 'Enter' && handleAddPainPoint()}
              />
              <Button onClick={handleAddPainPoint} type="button">Add</Button>
            </div>
            {createForm.pain_points && createForm.pain_points.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {createForm.pain_points.map((point, idx) => (
                  <span key={idx} className="px-2 py-1 bg-secondary text-secondary-foreground rounded text-sm">
                    {point}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="goal-input">Goals</Label>
            <div className="flex gap-2">
              <Input
                id="goal-input"
                value={goalInput}
                onChange={(e) => setGoalInput(e.target.value)}
                placeholder="e.g., Build a successful startup"
                onKeyPress={(e) => e.key === 'Enter' && handleAddGoal()}
              />
              <Button onClick={handleAddGoal} type="button">Add</Button>
            </div>
            {createForm.goals && createForm.goals.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {createForm.goals.map((goal, idx) => (
                  <span key={idx} className="px-2 py-1 bg-secondary text-secondary-foreground rounded text-sm">
                    {goal}
                  </span>
                ))}
              </div>
            )}
          </div>
        </CardContent>
        <CardFooter>
          <Button
            onClick={handleCreateAvatar}
            disabled={isCreating || !createForm.name.trim()}
          >
            {isCreating ? 'Creating...' : 'Create Avatar'}
          </Button>
        </CardFooter>
      </Card>

      {/* Update Avatar Form */}
      {selectedUpdateAvatarId && (
        <Card>
          <CardHeader>
            <CardTitle>Update Avatar</CardTitle>
            <CardDescription>Test avatar update functionality</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="update-name">New Avatar Name *</Label>
              <Input
                id="update-name"
                value={updateForm.name || ''}
                onChange={(e) => setUpdateForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Enter new name"
              />
            </div>
          </CardContent>
          <CardFooter className="gap-2">
            <Button
              onClick={handleUpdateAvatar}
              disabled={isUpdating || !updateForm.name?.trim()}
            >
              {isUpdating ? 'Updating...' : 'Update Avatar'}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setSelectedUpdateAvatarId('');
                setUpdateForm({ name: '' });
              }}
            >
              Cancel
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* Debug Info */}
      <Card>
        <CardHeader>
          <CardTitle>Debug Info</CardTitle>
          <CardDescription>Service layer state for debugging</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-1 text-sm font-mono">
            <p>isLoadingAvatars: {String(isLoadingAvatars)}</p>
            <p>isLoadingTemplates: {String(isLoadingTemplates)}</p>
            <p>isCreating: {String(isCreating)}</p>
            <p>isUpdating: {String(isUpdating)}</p>
            <p>isDeleting: {String(isDeleting)}</p>
            <p>avatarsCount: {avatars?.length ?? 0}</p>
            <p>templatesCount: {templates?.length ?? 0}</p>
            <p>selectedAvatarId: {selectedAvatarId ?? 'null'}</p>
            <p>currentAvatar: {currentAvatar ? currentAvatar.name : 'null'}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
