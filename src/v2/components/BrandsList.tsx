import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useBrand } from '@/contexts/BrandContext';
import { usePanelCommunication } from '@/v2/contexts/PanelCommunicationContext';
import {
  Plus,
  Search,
  Briefcase,
  CheckCircle2,
  Circle,
  Archive,
  Star,
  MoreVertical
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

interface BrandItemProps {
  name: string;
  description?: string;
  completionStatus: {
    insight: boolean;
    distinctive: boolean;
    empathy: boolean;
    authentic: boolean;
  };
  lastModified?: Date;
  isActive?: boolean;
  isFavorite?: boolean;
  onSelect: () => void;
  onAction: (action: string) => void;
}

function BrandItem({
  name,
  description,
  completionStatus,
  lastModified,
  isActive = false,
  isFavorite = false,
  onSelect,
  onAction
}: BrandItemProps) {
  const completedCount = Object.values(completionStatus).filter(Boolean).length;
  const totalCount = Object.keys(completionStatus).length;
  const completionPercentage = (completedCount / totalCount) * 100;

  return (
    <div
      className={`group relative p-3 rounded-lg border transition-all cursor-pointer hover:shadow-sm ${
        isActive ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
      }`}
      onClick={onSelect}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-muted-foreground" />
            <h4 className="text-sm font-medium leading-none">{name}</h4>
            {isFavorite && <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />}
            {isActive && (
              <Badge variant="default" className="h-4 px-1 text-[10px]">
                Active
              </Badge>
            )}
          </div>

          {description && (
            <p className="text-xs text-muted-foreground line-clamp-2">
              {description}
            </p>
          )}

          {/* IDEA Framework Progress */}
          <div className="flex items-center gap-3 mt-2">
            <div className="flex gap-1">
              {Object.entries(completionStatus).map(([key, completed]) => (
                <div
                  key={key}
                  className="group/icon relative"
                  title={`${key.charAt(0).toUpperCase() + key.slice(1)}: ${completed ? 'Complete' : 'Incomplete'}`}
                >
                  {completed ? (
                    <CheckCircle2 className="h-3 w-3 text-green-500" />
                  ) : (
                    <Circle className="h-3 w-3 text-muted-foreground" />
                  )}
                </div>
              ))}
            </div>
            <span className="text-[10px] text-muted-foreground">
              {completionPercentage}% complete
            </span>
          </div>

          {lastModified && (
            <p className="text-[10px] text-muted-foreground">
              Modified {new Date(lastModified).toLocaleDateString()}
            </p>
          )}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100">
              <MoreVertical className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onAction('duplicate')}>
              Duplicate
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onAction('export')}>
              Export
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onAction('archive')}>
              <Archive className="h-3 w-3 mr-2" />
              Archive
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onAction('delete')}
              className="text-destructive"
            >
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

export function BrandsList() {
  const { brandData, updateBrandData } = useBrand();
  const { sendMessage } = usePanelCommunication();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBrandId, setSelectedBrandId] = useState<string>('default');

  // For now, we'll work with the current brand context
  // In the future, this could be extended to support multiple brands from a database
  const brands = [
    {
      id: 'default',
      name: 'Current Brand',
      description: 'Your active brand profile',
      completionStatus: {
        insight: brandData?.insight?.completed || false,
        distinctive: brandData?.distinctive?.completed || false,
        empathy: brandData?.empathy?.completed || false,
        authentic: brandData?.authentic?.completed || false,
      },
      lastModified: new Date(),
      isActive: true,
      isFavorite: false,
    }
  ];

  const filteredBrands = brands.filter(brand =>
    brand.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    brand.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelectBrand = (brandId: string) => {
    setSelectedBrandId(brandId);

    // Send message to other panels about brand selection
    sendMessage({
      type: 'brand-selected',
      payload: {
        brandId,
        brandData: brands.find(b => b.id === brandId),
      },
      source: 'left',
      target: 'all',
    });
  };

  const handleBrandAction = (brandId: string, action: string) => {
    console.log(`Action ${action} on brand ${brandId}`);

    // Handle different actions
    switch(action) {
      case 'duplicate':
        // Future: Implement brand duplication
        break;
      case 'export':
        // Future: Implement brand export
        break;
      case 'archive':
        // Future: Implement brand archiving
        break;
      case 'delete':
        // Future: Implement brand deletion with confirmation
        break;
    }
  };

  const handleCreateNewBrand = () => {
    // Send message to open brand creation in the center panel
    sendMessage({
      type: 'action',
      payload: {
        action: 'create-new-brand',
      },
      source: 'left',
      target: 'center',
    });
  };

  return (
    <Card className="h-full border-0 rounded-none">
      <CardHeader className="pb-3 space-y-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold">Brands</CardTitle>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={handleCreateNewBrand}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-3 w-3 text-muted-foreground" />
          <Input
            placeholder="Search brands..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 pl-7 text-xs"
          />
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <ScrollArea className="h-[calc(100vh-11rem)]">
          <div className="p-3 space-y-2">
            {filteredBrands.length > 0 ? (
              filteredBrands.map((brand) => (
                <BrandItem
                  key={brand.id}
                  name={brand.name}
                  description={brand.description}
                  completionStatus={brand.completionStatus}
                  lastModified={brand.lastModified}
                  isActive={brand.isActive}
                  isFavorite={brand.isFavorite}
                  onSelect={() => handleSelectBrand(brand.id)}
                  onAction={(action) => handleBrandAction(brand.id, action)}
                />
              ))
            ) : (
              <div className="text-center py-8">
                <p className="text-sm text-muted-foreground">No brands found</p>
              </div>
            )}

            {/* Create New Brand Card */}
            <div
              className="p-4 rounded-lg border-2 border-dashed border-muted hover:border-muted-foreground/50 transition-colors cursor-pointer group"
              onClick={handleCreateNewBrand}
            >
              <div className="flex flex-col items-center justify-center text-center space-y-2">
                <div className="p-2 rounded-full bg-muted group-hover:bg-muted/80 transition-colors">
                  <Plus className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium">Create New Brand</p>
                  <p className="text-xs text-muted-foreground">
                    Start with the IDEA framework
                  </p>
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}