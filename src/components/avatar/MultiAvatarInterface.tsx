/**
 * Multi-Avatar Interface Component
 * Manages multiple customer personas with CRUD operations
 */

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Edit, Trash2, User, CheckCircle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { usePersistedField } from "@/hooks/usePersistedField";
import type { SyncStatus } from "@/lib/knowledge-base/interfaces";

/**
 * Interface for Avatar metadata
 */
interface Avatar {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
}

/**
 * Props for the MultiAvatarInterface component
 */
interface MultiAvatarInterfaceProps {
  onSelectAvatar?: (avatarId: string) => void;
  className?: string;
}

/**
 * Sync status indicator for the header
 */
function SyncStatusIndicator({ status }: { status: SyncStatus }) {
  if (status === 'synced') return null;

  switch (status) {
    case 'syncing':
      return (
        <div className="flex items-center gap-2 text-sm text-blue-600">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Saving...</span>
        </div>
      );
    case 'offline':
      return (
        <div className="flex items-center gap-2 text-sm text-amber-600">
          <Badge variant="outline" className="text-amber-600 border-amber-600">
            Offline
          </Badge>
        </div>
      );
    default:
      return null;
  }
}

/**
 * Multi-Avatar Interface Component
 * Supports creating, reading, updating, and deleting multiple customer avatars
 */
export function MultiAvatarInterface({ onSelectAvatar, className = "" }: MultiAvatarInterfaceProps) {
  const { toast } = useToast();

  // Persisted field for storing avatars list (JSON array)
  const avatarsField = usePersistedField({
    fieldIdentifier: 'multi_avatar_list',
    category: 'avatar',
    defaultValue: '[]',
    debounceDelay: 500
  });

  // Persisted field for active avatar ID
  const activeAvatarField = usePersistedField({
    fieldIdentifier: 'active_avatar_id',
    category: 'avatar',
    defaultValue: '',
    debounceDelay: 300
  });

  // Local UI state
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [deleteAvatarId, setDeleteAvatarId] = useState<string | null>(null);
  const [editingAvatar, setEditingAvatar] = useState<Avatar | null>(null);
  const [newAvatarName, setNewAvatarName] = useState("");
  const [newAvatarDescription, setNewAvatarDescription] = useState("");

  /**
   * Parse avatars from persisted JSON
   */
  const parseAvatars = (): Avatar[] => {
    try {
      const parsed = JSON.parse(avatarsField.value || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const avatars = parseAvatars();
  const activeAvatarId = activeAvatarField.value;

  /**
   * Save avatars list to persisted field
   */
  const saveAvatars = (updatedAvatars: Avatar[]): void => {
    avatarsField.onChange(JSON.stringify(updatedAvatars));
  };

  /**
   * Create a new avatar
   */
  const handleCreateAvatar = (): void => {
    if (!newAvatarName.trim()) {
      toast({
        title: "Name Required",
        description: "Please enter a name for your avatar.",
        variant: "destructive"
      });
      return;
    }

    const newAvatar: Avatar = {
      id: `avatar-${Date.now()}`,
      name: newAvatarName.trim(),
      description: newAvatarDescription.trim(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isActive: avatars.length === 0 // First avatar is active by default
    };

    const updatedAvatars = [...avatars, newAvatar];
    saveAvatars(updatedAvatars);

    // Set as active if it's the first one
    if (avatars.length === 0) {
      activeAvatarField.onChange(newAvatar.id);
      onSelectAvatar?.(newAvatar.id);
    }

    toast({
      title: "Avatar Created",
      description: `${newAvatar.name} has been created successfully.`
    });

    // Reset form
    setNewAvatarName("");
    setNewAvatarDescription("");
    setIsCreateDialogOpen(false);
  };

  /**
   * Update an existing avatar
   */
  const handleUpdateAvatar = (): void => {
    if (!editingAvatar || !newAvatarName.trim()) {
      toast({
        title: "Name Required",
        description: "Please enter a name for your avatar.",
        variant: "destructive"
      });
      return;
    }

    const updatedAvatars = avatars.map(avatar =>
      avatar.id === editingAvatar.id
        ? {
            ...avatar,
            name: newAvatarName.trim(),
            description: newAvatarDescription.trim(),
            updatedAt: new Date().toISOString()
          }
        : avatar
    );

    saveAvatars(updatedAvatars);

    toast({
      title: "Avatar Updated",
      description: `${newAvatarName} has been updated successfully.`
    });

    // Reset form
    setEditingAvatar(null);
    setNewAvatarName("");
    setNewAvatarDescription("");
    setIsEditDialogOpen(false);
  };

  /**
   * Delete an avatar
   */
  const handleDeleteAvatar = (avatarId: string): void => {
    const avatarToDelete = avatars.find(a => a.id === avatarId);
    if (!avatarToDelete) return;

    const updatedAvatars = avatars.filter(a => a.id !== avatarId);
    saveAvatars(updatedAvatars);

    // If deleting the active avatar, set a new one
    if (activeAvatarId === avatarId && updatedAvatars.length > 0) {
      const newActiveId = updatedAvatars[0].id;
      activeAvatarField.onChange(newActiveId);
      onSelectAvatar?.(newActiveId);
    } else if (updatedAvatars.length === 0) {
      activeAvatarField.onChange('');
    }

    toast({
      title: "Avatar Deleted",
      description: `${avatarToDelete.name} has been deleted.`
    });

    setDeleteAvatarId(null);
  };

  /**
   * Select an avatar as active
   */
  const handleSelectAvatar = (avatarId: string): void => {
    activeAvatarField.onChange(avatarId);
    onSelectAvatar?.(avatarId);

    const selectedAvatar = avatars.find(a => a.id === avatarId);
    if (selectedAvatar) {
      toast({
        title: "Avatar Selected",
        description: `Now working with ${selectedAvatar.name}.`
      });
    }
  };

  /**
   * Open edit dialog with avatar data
   */
  const openEditDialog = (avatar: Avatar): void => {
    setEditingAvatar(avatar);
    setNewAvatarName(avatar.name);
    setNewAvatarDescription(avatar.description);
    setIsEditDialogOpen(true);
  };

  /**
   * Calculate overall sync status
   */
  const getOverallSyncStatus = (): SyncStatus => {
    const statuses = [avatarsField.syncStatus, activeAvatarField.syncStatus];
    if (statuses.some(s => s === 'error')) return 'error';
    if (statuses.some(s => s === 'syncing')) return 'syncing';
    if (statuses.some(s => s === 'offline')) return 'offline';
    return 'synced';
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Customer Avatars</h2>
          <p className="text-muted-foreground">
            Manage multiple customer personas for your brand
          </p>
        </div>
        <div className="flex items-center gap-4">
          <SyncStatusIndicator status={getOverallSyncStatus()} />
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            New Avatar
          </Button>
        </div>
      </div>

      {/* Avatar List */}
      {avatarsField.isLoading ? (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">Loading avatars...</span>
          </CardContent>
        </Card>
      ) : avatars.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <User className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Avatars Yet</h3>
            <p className="text-muted-foreground mb-4">
              Create your first customer avatar to get started
            </p>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create First Avatar
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {avatars.map((avatar) => (
            <Card
              key={avatar.id}
              className={`cursor-pointer transition-all hover:shadow-lg ${
                activeAvatarId === avatar.id
                  ? 'ring-2 ring-primary bg-primary/5'
                  : 'hover:bg-muted/50'
              }`}
              onClick={() => handleSelectAvatar(avatar.id)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <User className="w-5 h-5 text-muted-foreground" />
                    <CardTitle className="text-lg">{avatar.name}</CardTitle>
                  </div>
                  {activeAvatarId === avatar.id && (
                    <Badge variant="default" className="bg-primary">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Active
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <CardDescription className="min-h-[2.5rem]">
                  {avatar.description || "No description provided"}
                </CardDescription>

                <div className="flex items-center justify-between pt-2 border-t">
                  <div className="text-xs text-muted-foreground">
                    Updated {new Date(avatar.updatedAt).toLocaleDateString()}
                  </div>
                  <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditDialog(avatar)}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteAvatarId(avatar.id)}
                      disabled={avatars.length === 1}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Avatar Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Avatar</DialogTitle>
            <DialogDescription>
              Add a new customer persona to your brand strategy
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new-avatar-name">Avatar Name *</Label>
              <Input
                id="new-avatar-name"
                placeholder="e.g., Busy Professional Mom"
                value={newAvatarName}
                onChange={(e) => setNewAvatarName(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleCreateAvatar();
                  }
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-avatar-description">Description (Optional)</Label>
              <Input
                id="new-avatar-description"
                placeholder="Brief description of this customer persona"
                value={newAvatarDescription}
                onChange={(e) => setNewAvatarDescription(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsCreateDialogOpen(false);
              setNewAvatarName("");
              setNewAvatarDescription("");
            }}>
              Cancel
            </Button>
            <Button onClick={handleCreateAvatar}>Create Avatar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Avatar Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Avatar</DialogTitle>
            <DialogDescription>
              Update your customer persona details
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-avatar-name">Avatar Name *</Label>
              <Input
                id="edit-avatar-name"
                placeholder="e.g., Busy Professional Mom"
                value={newAvatarName}
                onChange={(e) => setNewAvatarName(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleUpdateAvatar();
                  }
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-avatar-description">Description (Optional)</Label>
              <Input
                id="edit-avatar-description"
                placeholder="Brief description of this customer persona"
                value={newAvatarDescription}
                onChange={(e) => setNewAvatarDescription(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsEditDialogOpen(false);
              setEditingAvatar(null);
              setNewAvatarName("");
              setNewAvatarDescription("");
            }}>
              Cancel
            </Button>
            <Button onClick={handleUpdateAvatar}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteAvatarId !== null} onOpenChange={() => setDeleteAvatarId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Avatar?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this avatar and all associated data. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteAvatarId && handleDeleteAvatar(deleteAvatarId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
