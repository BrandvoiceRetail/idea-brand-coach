/**
 * FieldsHierarchyPanel Component
 * A collapsible field editor for the IDEA framework fields
 * Provides hierarchical organization and manual editing capabilities with sync status
 */

import React, { useState, useEffect } from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from '@/components/ui/accordion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { usePersistedField } from '@/hooks/usePersistedField';
import { usePanelCommunication } from '@/v2/contexts/PanelCommunicationContext';
import {
  Lightbulb,
  Target,
  Rocket,
  ChartBar,
  Save,
  Check,
  AlertCircle,
  RefreshCw,
  Edit3,
  Cloud,
  CloudOff,
} from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Field definition for IDEA framework
 */
interface FieldDefinition {
  id: string;
  label: string;
  description?: string;
  placeholder?: string;
  category: 'identify' | 'discover' | 'execute' | 'analyze';
}

/**
 * Field state with value and sync status
 */
interface FieldState {
  value: string;
  isSynced: boolean;
  isEditing: boolean;
  lastSynced?: Date;
}

// IDEA Framework field definitions
const IDEA_FIELDS: FieldDefinition[] = [
  // Identify fields
  {
    id: 'brand_purpose',
    label: 'Brand Purpose',
    description: 'Why does your brand exist beyond making money?',
    placeholder: 'e.g., To empower individuals to express their authentic selves...',
    category: 'identify',
  },
  {
    id: 'target_audience',
    label: 'Target Audience',
    description: 'Who is your ideal customer? What are their needs and desires?',
    placeholder: 'e.g., Creative professionals aged 25-40 who value authenticity...',
    category: 'identify',
  },
  {
    id: 'core_values',
    label: 'Core Values',
    description: 'What fundamental beliefs guide your brand\'s actions?',
    placeholder: 'e.g., Innovation, Transparency, Sustainability, Community...',
    category: 'identify',
  },
  {
    id: 'brand_personality',
    label: 'Brand Personality',
    description: 'If your brand were a person, how would you describe them?',
    placeholder: 'e.g., Bold, innovative, approachable, trustworthy...',
    category: 'identify',
  },

  // Discover fields
  {
    id: 'market_insights',
    label: 'Market Insights',
    description: 'What unique understanding do you have about your market?',
    placeholder: 'e.g., Consumers are increasingly seeking brands that align with their values...',
    category: 'discover',
  },
  {
    id: 'competitive_advantage',
    label: 'Competitive Advantage',
    description: 'What makes you distinctively better than alternatives?',
    placeholder: 'e.g., Our proprietary technology enables 10x faster results...',
    category: 'discover',
  },
  {
    id: 'customer_pain_points',
    label: 'Customer Pain Points',
    description: 'What problems or frustrations do your customers face?',
    placeholder: 'e.g., Difficulty finding authentic, high-quality products...',
    category: 'discover',
  },
  {
    id: 'opportunity_spaces',
    label: 'Opportunity Spaces',
    description: 'Where are the unmet needs or gaps in the market?',
    placeholder: 'e.g., No existing solution combines convenience with sustainability...',
    category: 'discover',
  },

  // Execute fields
  {
    id: 'brand_promise',
    label: 'Brand Promise',
    description: 'What do you commit to delivering to your customers?',
    placeholder: 'e.g., We promise to deliver innovative solutions that simplify your life...',
    category: 'execute',
  },
  {
    id: 'messaging_framework',
    label: 'Messaging Framework',
    description: 'How do you communicate your brand\'s value proposition?',
    placeholder: 'e.g., Tagline: "Simplify Today, Transform Tomorrow"...',
    category: 'execute',
  },
  {
    id: 'visual_identity',
    label: 'Visual Identity',
    description: 'How does your brand express itself visually?',
    placeholder: 'e.g., Modern, minimalist design with bold accent colors...',
    category: 'execute',
  },
  {
    id: 'customer_experience',
    label: 'Customer Experience Strategy',
    description: 'How do you deliver on your brand promise at every touchpoint?',
    placeholder: 'e.g., Personalized onboarding, 24/7 support, seamless digital experience...',
    category: 'execute',
  },

  // Analyze fields
  {
    id: 'performance_metrics',
    label: 'Performance Metrics',
    description: 'What KPIs measure your brand\'s success?',
    placeholder: 'e.g., Customer lifetime value, Net Promoter Score, brand awareness...',
    category: 'analyze',
  },
  {
    id: 'feedback_loops',
    label: 'Feedback Loops',
    description: 'How do you gather and act on customer feedback?',
    placeholder: 'e.g., Monthly surveys, social listening, customer advisory board...',
    category: 'analyze',
  },
  {
    id: 'optimization_strategy',
    label: 'Optimization Strategy',
    description: 'How do you continuously improve your brand experience?',
    placeholder: 'e.g., A/B testing, iterative design, data-driven decision making...',
    category: 'analyze',
  },
  {
    id: 'growth_opportunities',
    label: 'Growth Opportunities',
    description: 'Where are the next frontiers for your brand?',
    placeholder: 'e.g., International expansion, new product categories, partnerships...',
    category: 'analyze',
  },
];

// Category configuration
const CATEGORIES = [
  {
    id: 'identify',
    label: 'Identify',
    icon: Lightbulb,
    description: 'Understand who you are as a brand',
    color: 'text-yellow-600',
  },
  {
    id: 'discover',
    label: 'Discover',
    icon: Target,
    description: 'Explore insights and opportunities',
    color: 'text-blue-600',
  },
  {
    id: 'execute',
    label: 'Execute',
    icon: Rocket,
    description: 'Transform strategy into action',
    color: 'text-green-600',
  },
  {
    id: 'analyze',
    label: 'Analyze',
    icon: ChartBar,
    description: 'Measure impact and optimize',
    color: 'text-purple-600',
  },
];

export function FieldsHierarchyPanel(): JSX.Element {
  const { sendMessage, subscribeToMessages } = usePanelCommunication();
  const [expandedSections, setExpandedSections] = useState<string[]>(['identify']);
  const [fieldStates, setFieldStates] = useState<Record<string, FieldState>>({});

  // Initialize field states
  useEffect(() => {
    const initialStates: Record<string, FieldState> = {};
    IDEA_FIELDS.forEach(field => {
      initialStates[field.id] = {
        value: '',
        isSynced: true,
        isEditing: false,
      };
    });
    setFieldStates(initialStates);
  }, []);

  // Subscribe to messages from other panels (e.g., chat extracting field values)
  useEffect(() => {
    const unsubscribe = subscribeToMessages((message) => {
      if (message?.type === 'fields_populated' && message.payload?.fields) {
        const updates = { ...fieldStates };
        Object.entries(message.payload.fields).forEach(([fieldId, value]) => {
          if (updates[fieldId]) {
            updates[fieldId] = {
              ...updates[fieldId],
              value: value as string,
              isSynced: true,
              lastSynced: new Date(),
            };
          }
        });
        setFieldStates(updates);
      }
    });

    return unsubscribe;
  }, [subscribeToMessages, fieldStates]);

  // Handle field value change
  const handleFieldChange = (fieldId: string, value: string): void => {
    setFieldStates(prev => ({
      ...prev,
      [fieldId]: {
        ...prev[fieldId],
        value,
        isSynced: false,
        isEditing: true,
      },
    }));
  };

  // Handle field blur (save)
  const handleFieldBlur = (fieldId: string): void => {
    const field = IDEA_FIELDS.find(f => f.id === fieldId);
    const state = fieldStates[fieldId];

    if (!field || !state) return;

    // Mark as synced after a short delay (simulating save)
    setTimeout(() => {
      setFieldStates(prev => ({
        ...prev,
        [fieldId]: {
          ...prev[fieldId],
          isSynced: true,
          isEditing: false,
          lastSynced: new Date(),
        },
      }));

      // Notify other panels that field was updated
      sendMessage({
        type: 'field_updated',
        source: 'fields_hierarchy',
        payload: {
          fieldId,
          value: state.value,
          label: field.label,
          category: field.category,
        },
      });
    }, 500);
  };

  // Render a single field editor
  const renderField = (field: FieldDefinition): JSX.Element => {
    const state = fieldStates[field.id] || { value: '', isSynced: true, isEditing: false };

    return (
      <div key={field.id} className="space-y-2 p-4 border rounded-lg hover:bg-accent/50 transition-colors">
        <div className="flex items-start justify-between">
          <div className="flex-1 space-y-1">
            <Label htmlFor={field.id} className="font-medium flex items-center gap-2">
              {field.label}
              {state.isSynced ? (
                <Cloud className="h-3 w-3 text-green-600" />
              ) : state.isEditing ? (
                <Edit3 className="h-3 w-3 text-blue-600" />
              ) : (
                <CloudOff className="h-3 w-3 text-yellow-600" />
              )}
            </Label>
            {field.description && (
              <p className="text-xs text-muted-foreground">{field.description}</p>
            )}
          </div>
          {state.lastSynced && (
            <Badge variant="outline" className="text-xs">
              Synced {state.lastSynced.toLocaleTimeString()}
            </Badge>
          )}
        </div>
        <Textarea
          id={field.id}
          value={state.value}
          onChange={(e) => handleFieldChange(field.id, e.target.value)}
          onBlur={() => handleFieldBlur(field.id)}
          placeholder={field.placeholder}
          className="min-h-[80px] resize-none text-sm"
        />
      </div>
    );
  };

  // Group fields by category
  const fieldsByCategory = IDEA_FIELDS.reduce((acc, field) => {
    if (!acc[field.category]) {
      acc[field.category] = [];
    }
    acc[field.category].push(field);
    return acc;
  }, {} as Record<string, FieldDefinition[]>);

  return (
    <div className="h-full flex flex-col">
      <CardHeader className="border-b">
        <CardTitle className="text-lg">IDEA Framework Fields</CardTitle>
        <p className="text-sm text-muted-foreground">
          Manually edit your brand strategy fields. Changes auto-save.
        </p>
      </CardHeader>

      <CardContent className="flex-1 overflow-auto p-4">
        <Accordion
          type="multiple"
          value={expandedSections}
          onValueChange={setExpandedSections}
          className="space-y-2"
        >
          {CATEGORIES.map(category => {
            const Icon = category.icon;
            const fields = fieldsByCategory[category.id] || [];
            const filledCount = fields.filter(f => fieldStates[f.id]?.value).length;
            const totalCount = fields.length;

            return (
              <AccordionItem key={category.id} value={category.id} className="border rounded-lg">
                <AccordionTrigger className="px-4 hover:no-underline">
                  <div className="flex items-center justify-between w-full mr-4">
                    <div className="flex items-center gap-3">
                      <Icon className={cn('h-5 w-5', category.color)} />
                      <div className="text-left">
                        <h3 className="font-semibold">{category.label}</h3>
                        <p className="text-xs text-muted-foreground">
                          {category.description}
                        </p>
                      </div>
                    </div>
                    <Badge variant="secondary">
                      {filledCount}/{totalCount}
                    </Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 py-2">
                  <div className="space-y-3">
                    {fields.map(field => renderField(field))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </CardContent>
    </div>
  );
}