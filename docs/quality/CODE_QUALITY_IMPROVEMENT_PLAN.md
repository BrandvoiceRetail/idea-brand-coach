# Code Quality Improvement Plan
## IDEA Brand Coach - TypeScript/React Project

**Created**: 2025-10-14
**Based on**: Code Complete 2 methodology and DRY principles
**Project**: idea-brand-coach (TypeScript/React/Supabase)

---

## 📋 Executive Summary

This comprehensive code quality analysis applies proven practices to identify and remediate code quality issues in the IDEA Brand Coach application. The analysis examined 85+ TypeScript/React files and identified significant opportunities for improvement in code organization, type safety, and maintainability.

**Key Findings**:
- **54 instances of `any` type** across 18 files compromising type safety
- **7 components > 500 lines** requiring decomposition
- **Significant code duplication** in Avatar interfaces and PDF generation
- **Missing defensive programming patterns** throughout codebase
- **Inconsistent error handling** across 27 try-catch blocks
- **No centralized constants** leading to magic numbers and hardcoded values

**Estimated Technical Debt**: 3-4 weeks of focused refactoring

---

## 🎯 Core Principles from Code Complete 2

### 1. Don't Repeat Yourself (DRY)
**Current State**: Major DRY violations identified
- Duplicate Avatar interface definitions (2 locations)
- Repeated PDF generation logic (744 lines + 295 lines)
- Duplicated validation patterns across components
- Repeated UI card patterns (8+ times)

### 2. Defensive Programming
**Current State**: Minimal defensive practices
- No null safety checks on optional data
- Missing array length validations
- No API response validation
- Silent failures in some error handlers

### 3. Code Construction Quality
**Current State**: Functional but needs structure
- Large monolithic components (802 lines max)
- Excessive state variables (7+ per component)
- Magic numbers throughout (file sizes, timeouts, etc.)
- Inconsistent naming conventions

---

## 🔴 CRITICAL ISSUES (Immediate Action Required)

### Issue #1: Duplicate Avatar Type Definitions
**Priority**: CRITICAL
**Impact**: Type inconsistency, maintenance burden, potential bugs
**Technical Debt**: 2-3 hours

**Problem**:
```typescript
// Location 1: src/pages/AvatarBuilder.tsx (lines 16-37)
interface Avatar {
  name: string;
  demographics: {
    age: string;
    income: string;
    location: string;
    lifestyle: string;
  };
  psychographics: {
    values: string[];
    fears: string[];
    desires: string[];
    triggers: string[];
  };
  buyingBehavior: {
    intent: string;
    decisionFactors: string[];
    shoppingStyle: string;
    priceConsciousness: string;
  };
  voiceOfCustomer: string;
}

// Location 2: src/components/AvatarPDFExport.tsx (lines 9-30)
// IDENTICAL interface definition repeated
```

**Solution - Apply DRY Principle**:

**Step 1**: Create shared types directory structure
```bash
mkdir -p src/types
```

**Step 2**: Create comprehensive Avatar type definitions
```typescript
// src/types/avatar.ts

/**
 * Customer avatar demographic information
 * Represents quantifiable customer characteristics
 */
export interface AvatarDemographics {
  /** Age range or specific age (e.g., "25-34" or "32") */
  age: string;
  /** Income level or range (e.g., "$50k-$75k") */
  income: string;
  /** Geographic location (e.g., "Austin, TX" or "Urban Northeast") */
  location: string;
  /** Lifestyle description (e.g., "Active professional") */
  lifestyle: string;
}

/**
 * Customer avatar psychological characteristics
 * Represents internal motivations and triggers
 */
export interface AvatarPsychographics {
  /** Core values that drive decisions */
  values: string[];
  /** Key fears or concerns */
  fears: string[];
  /** Primary desires and aspirations */
  desires: string[];
  /** Emotional triggers that influence behavior */
  triggers: string[];
}

/**
 * Customer buying behavior patterns
 * Represents purchasing decision factors
 */
export interface AvatarBuyingBehavior {
  /** Primary buying intent or motivation */
  intent: string;
  /** Key factors in purchase decisions */
  decisionFactors: string[];
  /** Shopping style and preferences */
  shoppingStyle: string;
  /** Price sensitivity level */
  priceConsciousness: string;
}

/**
 * Complete customer avatar profile
 * Single source of truth for avatar data structure
 */
export interface Avatar {
  /** Avatar name or identifier */
  name: string;
  /** Demographic characteristics */
  demographics: AvatarDemographics;
  /** Psychological characteristics */
  psychographics: AvatarPsychographics;
  /** Buying behavior patterns */
  buyingBehavior: AvatarBuyingBehavior;
  /** Direct customer feedback or voice */
  voiceOfCustomer: string;
}

/**
 * Default empty avatar for initialization
 */
export const createEmptyAvatar = (): Avatar => ({
  name: '',
  demographics: {
    age: '',
    income: '',
    location: '',
    lifestyle: '',
  },
  psychographics: {
    values: [],
    fears: [],
    desires: [],
    triggers: [],
  },
  buyingBehavior: {
    intent: '',
    decisionFactors: [],
    shoppingStyle: '',
    priceConsciousness: '',
  },
  voiceOfCustomer: '',
});
```

**Step 3**: Update imports in both files
```typescript
// src/pages/AvatarBuilder.tsx
import { Avatar, createEmptyAvatar } from '@/types/avatar';

// Remove old interface definition
// Use: const [avatar, setAvatar] = useState<Avatar>(createEmptyAvatar());

// src/components/AvatarPDFExport.tsx
import { Avatar } from '@/types/avatar';
// Remove old interface definition
```

**Verification**:
- [ ] TypeScript compilation succeeds
- [ ] Both components work with shared types
- [ ] No type errors in IDE
- [ ] Git diff shows interface removed from both files

---

### Issue #2: Excessive Use of `any` Type
**Priority**: CRITICAL
**Impact**: Loss of type safety, potential runtime errors, poor IDE support
**Occurrences**: 54 instances across 18 files
**Technical Debt**: 1 week

**Problem Examples**:
```typescript
// src/components/DocumentUpload.tsx:22
const [documents, setDocuments] = useState<any[]>([]);

// src/contexts/BrandContext.tsx
const [brandData, setBrandData] = useState<any>(null);

// src/pages/IdeaFrameworkConsultant.tsx:22
const [userDocuments, setUserDocuments] = useState<any[]>([]);
```

**Solution - Replace with Proper Types**:

**Step 1**: Create document types
```typescript
// src/types/document.ts

/**
 * Document processing status
 */
export type DocumentStatus = 'uploading' | 'processing' | 'completed' | 'error';

/**
 * Supported document MIME types
 */
export type DocumentMimeType =
  | 'application/pdf'
  | 'text/plain'
  | 'application/msword'
  | 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/**
 * Uploaded user document
 */
export interface UserDocument {
  /** Unique document identifier */
  id: string;
  /** User ID who uploaded the document */
  user_id: string;
  /** Original filename */
  filename: string;
  /** File size in bytes */
  file_size: number;
  /** MIME type of the document */
  mime_type: DocumentMimeType;
  /** Current processing status */
  status: DocumentStatus;
  /** Extracted text content (if processing completed) */
  extracted_content?: string;
  /** Processing error message (if status is error) */
  error_message?: string;
  /** Upload timestamp */
  created_at: string;
  /** Last update timestamp */
  updated_at: string;
}

/**
 * Document upload progress
 */
export interface DocumentUploadProgress {
  documentId: string;
  filename: string;
  progress: number; // 0-100
  status: DocumentStatus;
}
```

**Step 2**: Create brand context types
```typescript
// src/types/brand.ts

/**
 * Brand canvas data structure
 */
export interface BrandCanvasData {
  brandPurpose: string;
  brandVision: string;
  brandMission: string;
  brandValues: string[];
  positioningStatement: string;
  valueProposition: string;
  brandPersonality: string[];
  brandVoice: string;
  visualIdentity: {
    colors: string[];
    typography: string[];
    imagery: string;
  };
  created_at?: string;
  updated_at?: string;
}

/**
 * Brand context state
 */
export interface BrandContextState {
  brandData: BrandCanvasData | null;
  isLoading: boolean;
  error: string | null;
  lastSaved: Date | null;
}
```

**Step 3**: Update component implementations
```typescript
// src/components/DocumentUpload.tsx
import { UserDocument, DocumentUploadProgress } from '@/types/document';

const [documents, setDocuments] = useState<UserDocument[]>([]);
const [uploadProgress, setUploadProgress] = useState<Map<string, DocumentUploadProgress>>(new Map());

// src/contexts/BrandContext.tsx
import { BrandContextState, BrandCanvasData } from '@/types/brand';

const [state, setState] = useState<BrandContextState>({
  brandData: null,
  isLoading: false,
  error: null,
  lastSaved: null,
});
```

**Verification Checklist**:
- [ ] Create `src/types/document.ts`
- [ ] Create `src/types/brand.ts`
- [ ] Update all 18 files with `any` types
- [ ] Run TypeScript compiler: `npx tsc --noEmit`
- [ ] Verify no type errors
- [ ] Test all affected components
- [ ] Enable strict mode in tsconfig.json (future improvement)

---

### Issue #3: Massive Components Requiring Decomposition
**Priority**: CRITICAL
**Impact**: Maintainability, testability, code reusability
**Technical Debt**: 2 weeks

**Problem - Large Components**:

| File | Lines | Complexity | Status |
|------|-------|------------|--------|
| `src/pages/BrandCanvas.tsx` | 802 | Very High | CRITICAL |
| `src/components/AvatarPDFExport.tsx` | 744 | Very High | CRITICAL |
| `src/pages/AvatarBuilder.tsx` | 732 | Very High | CRITICAL |
| `src/pages/IdeaFrameworkConsultant.tsx` | 540 | High | HIGH |
| `src/components/research/SurveyBuilder.tsx` | 540 | High | HIGH |

**Solution for BrandCanvas.tsx (802 lines)**:

**Current Structure Problem**:
```typescript
// BrandCanvas.tsx - 802 lines doing EVERYTHING
function BrandCanvas() {
  // 20+ state variables
  // All form handlers
  // All API calls
  // All UI rendering
  // All validation
  // 8 major sections inline
}
```

**Decomposition Strategy**:

```
src/features/brand-canvas/
├── BrandCanvas.tsx (main orchestrator - ~150 lines)
├── components/
│   ├── sections/
│   │   ├── BrandPurposeSection.tsx
│   │   ├── BrandVisionSection.tsx
│   │   ├── BrandMissionSection.tsx
│   │   ├── BrandValuesSection.tsx
│   │   ├── PositioningStatementSection.tsx
│   │   ├── ValuePropositionSection.tsx
│   │   ├── BrandPersonalitySection.tsx
│   │   └── BrandVoiceSection.tsx
│   ├── BrandCanvasSidebar.tsx
│   └── shared/
│       ├── SectionCard.tsx
│       └── AIAssistantField.tsx
├── hooks/
│   ├── useBrandCanvas.ts
│   ├── useBrandCanvasPersistence.ts
│   └── useAIAssistance.ts
├── types/
│   └── brandCanvas.ts
└── utils/
    ├── validation.ts
    └── formatters.ts
```

**Implementation Example**:

```typescript
// src/features/brand-canvas/components/shared/SectionCard.tsx
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '@/components/ui/card';
import { LucideIcon } from 'lucide-react';

interface SectionCardProps {
  icon: LucideIcon;
  iconColor: string;
  title: string;
  description: string;
  children: React.ReactNode;
}

/**
 * Reusable section card for brand canvas sections
 * Provides consistent styling and layout
 */
export function SectionCard({
  icon: Icon,
  iconColor,
  title,
  description,
  children
}: SectionCardProps) {
  return (
    <Card className="bg-card shadow-card hover:shadow-brand transition-all duration-300">
      <CardHeader>
        <div className="flex items-start gap-4">
          <div className={`w-12 h-12 ${iconColor} rounded-full flex items-center justify-center flex-shrink-0`}>
            <Icon className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1">
            <CardTitle className="text-foreground">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {children}
      </CardContent>
    </Card>
  );
}

// src/features/brand-canvas/components/sections/BrandPurposeSection.tsx
import { SectionCard } from '../shared/SectionCard';
import { Sparkles } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';

interface BrandPurposeSectionProps {
  value: string;
  onChange: (value: string) => void;
  onAIAssist?: () => void;
}

/**
 * Brand Purpose section component
 * Handles the "why" of the brand
 */
export function BrandPurposeSection({
  value,
  onChange,
  onAIAssist
}: BrandPurposeSectionProps) {
  return (
    <SectionCard
      icon={Sparkles}
      iconColor="bg-orange-500"
      title="Brand Purpose"
      description="The reason your brand exists beyond making money. Your 'why'."
    >
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="What positive change does your brand seek to create in the world?"
        className="min-h-[100px]"
      />
      {onAIAssist && (
        <button onClick={onAIAssist} className="mt-2">
          Get AI Suggestions
        </button>
      )}
    </SectionCard>
  );
}

// src/features/brand-canvas/hooks/useBrandCanvas.ts
import { useReducer, useCallback } from 'react';
import { BrandCanvasData } from '@/types/brand';

type BrandCanvasAction =
  | { type: 'UPDATE_FIELD'; field: keyof BrandCanvasData; value: any }
  | { type: 'LOAD_DATA'; data: BrandCanvasData }
  | { type: 'RESET' };

function brandCanvasReducer(
  state: BrandCanvasData,
  action: BrandCanvasAction
): BrandCanvasData {
  switch (action.type) {
    case 'UPDATE_FIELD':
      return { ...state, [action.field]: action.value };
    case 'LOAD_DATA':
      return action.data;
    case 'RESET':
      return createEmptyBrandCanvas();
    default:
      return state;
  }
}

/**
 * Custom hook for brand canvas state management
 * Centralizes state logic and reduces component complexity
 */
export function useBrandCanvas(initialData?: BrandCanvasData) {
  const [data, dispatch] = useReducer(
    brandCanvasReducer,
    initialData ?? createEmptyBrandCanvas()
  );

  const updateField = useCallback(
    (field: keyof BrandCanvasData, value: any) => {
      dispatch({ type: 'UPDATE_FIELD', field, value });
    },
    []
  );

  const loadData = useCallback((data: BrandCanvasData) => {
    dispatch({ type: 'LOAD_DATA', data });
  }, []);

  const reset = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, []);

  return { data, updateField, loadData, reset };
}

// src/features/brand-canvas/BrandCanvas.tsx (refactored main component)
import { useBrandCanvas } from './hooks/useBrandCanvas';
import { useBrandCanvasPersistence } from './hooks/useBrandCanvasPersistence';
import { BrandPurposeSection } from './components/sections/BrandPurposeSection';
import { BrandVisionSection } from './components/sections/BrandVisionSection';
// ... other section imports

/**
 * Main Brand Canvas page
 * Orchestrates all brand canvas sections
 */
export function BrandCanvas() {
  const { data, updateField, loadData } = useBrandCanvas();
  const { save, isLoading, lastSaved } = useBrandCanvasPersistence();

  return (
    <div className="container mx-auto p-6">
      <BrandPurposeSection
        value={data.brandPurpose}
        onChange={(value) => updateField('brandPurpose', value)}
      />
      <BrandVisionSection
        value={data.brandVision}
        onChange={(value) => updateField('brandVision', value)}
      />
      {/* ... other sections */}
    </div>
  );
}
```

**Verification Checklist for Each Large Component**:
- [ ] Create feature directory structure
- [ ] Extract section components
- [ ] Create shared UI components
- [ ] Extract state management to hooks
- [ ] Create utility functions
- [ ] Update imports
- [ ] Test each section independently
- [ ] Test integrated functionality
- [ ] Verify no regressions

---

### Issue #4: Massive PDF Generation Code Duplication
**Priority**: CRITICAL
**Impact**: Maintenance nightmare, inconsistent output, DRY violation
**Technical Debt**: 1 week

**Problem**:
```
src/components/AvatarPDFExport.tsx: 744 lines
src/components/BrandCanvasPDFExport.tsx: 295 lines

Total duplicated logic: ~400 lines
- Page break handling (identical)
- Header generation (nearly identical)
- Text formatting (identical)
- Spacing calculations (identical)
```

**Solution - Create Reusable PDF Generator**:

```typescript
// src/utils/pdf/PDFGenerator.ts
import jsPDF from 'jspdf';

/**
 * PDF generation configuration
 */
export interface PDFConfig {
  margin?: number;
  lineHeight?: number;
  fontSize?: {
    title: number;
    section: number;
    body: number;
  };
}

/**
 * PDF section content
 */
export interface PDFSection {
  title: string;
  content: string | string[];
  type?: 'text' | 'list' | 'grid';
}

/**
 * Reusable PDF generator utility
 * Eliminates duplication across PDF export components
 *
 * Based on Code Complete 2 DRY principle:
 * "Every piece of knowledge must have a single, unambiguous,
 * authoritative representation within a system"
 */
export class PDFGenerator {
  private pdf: jsPDF;
  private yPosition: number;
  private readonly pageHeight: number;
  private readonly pageWidth: number;
  private readonly margin: number;
  private readonly lineHeight: number;
  private readonly fontSize: Required<PDFConfig>['fontSize'];

  constructor(config: PDFConfig = {}) {
    this.pdf = new jsPDF('p', 'mm', 'a4');
    this.pageWidth = this.pdf.internal.pageSize.getWidth();
    this.pageHeight = this.pdf.internal.pageSize.getHeight();
    this.margin = config.margin ?? 20;
    this.lineHeight = config.lineHeight ?? 6;
    this.fontSize = config.fontSize ?? {
      title: 24,
      section: 16,
      body: 11,
    };
    this.yPosition = this.margin;
  }

  /**
   * Add header with logo and title
   * Defensive: validates inputs and handles missing logo gracefully
   */
  addHeader(logoUrl: string | null, title: string, subtitle: string): void {
    // Defensive validation
    if (!title || title.trim().length === 0) {
      throw new Error('PDF header requires a title');
    }

    try {
      if (logoUrl) {
        this.pdf.addImage(logoUrl, 'PNG', this.margin, this.yPosition, 30, 30);
      }

      this.pdf.setFontSize(this.fontSize.title);
      this.pdf.setFont('helvetica', 'bold');
      this.pdf.text(title, this.pageWidth / 2, this.yPosition + 15, { align: 'center' });

      this.yPosition += 20;

      if (subtitle && subtitle.trim().length > 0) {
        this.pdf.setFontSize(this.fontSize.body);
        this.pdf.setFont('helvetica', 'normal');
        this.pdf.text(subtitle, this.pageWidth / 2, this.yPosition, { align: 'center' });
        this.yPosition += this.lineHeight;
      }

      this.yPosition += 10;
      this.addDivider();
    } catch (error) {
      console.error('Error adding PDF header:', error);
      // Graceful degradation - continue without logo
      this.pdf.setFontSize(this.fontSize.title);
      this.pdf.text(title, this.pageWidth / 2, this.yPosition + 15, { align: 'center' });
      this.yPosition += 30;
    }
  }

  /**
   * Check if page break is needed
   * Defensive: ensures valid additionalSpace parameter
   */
  checkPageBreak(additionalSpace: number = 15): boolean {
    // Defensive validation
    if (additionalSpace < 0) {
      console.warn('additionalSpace cannot be negative, using 0');
      additionalSpace = 0;
    }

    if (this.yPosition > this.pageHeight - this.margin - additionalSpace) {
      this.pdf.addPage();
      this.yPosition = this.margin;
      return true;
    }
    return false;
  }

  /**
   * Add a section with title and content
   * Defensive: handles empty content gracefully
   */
  addSection(section: PDFSection): void {
    // Defensive validation
    if (!section.title || section.title.trim().length === 0) {
      console.warn('Section title is empty, skipping section');
      return;
    }

    this.checkPageBreak(20);

    // Section title
    this.pdf.setFontSize(this.fontSize.section);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.text(section.title, this.margin, this.yPosition);
    this.yPosition += this.lineHeight + 2;

    // Section content
    this.pdf.setFontSize(this.fontSize.body);
    this.pdf.setFont('helvetica', 'normal');

    if (Array.isArray(section.content)) {
      this.addList(section.content);
    } else if (section.content && section.content.trim().length > 0) {
      this.addText(section.content);
    } else {
      this.pdf.setTextColor(150, 150, 150);
      this.pdf.text('(Not specified)', this.margin, this.yPosition);
      this.pdf.setTextColor(0, 0, 0);
      this.yPosition += this.lineHeight;
    }

    this.yPosition += 5;
  }

  /**
   * Add formatted text with word wrapping
   * Defensive: handles null/undefined text
   */
  private addText(text: string): void {
    if (!text) return;

    const maxWidth = this.pageWidth - 2 * this.margin;
    const lines = this.pdf.splitTextToSize(text, maxWidth);

    lines.forEach((line: string) => {
      this.checkPageBreak();
      this.pdf.text(line, this.margin, this.yPosition);
      this.yPosition += this.lineHeight;
    });
  }

  /**
   * Add bulleted list
   * Defensive: filters out empty items
   */
  private addList(items: string[]): void {
    if (!items || items.length === 0) {
      this.pdf.setTextColor(150, 150, 150);
      this.pdf.text('(No items)', this.margin, this.yPosition);
      this.pdf.setTextColor(0, 0, 0);
      this.yPosition += this.lineHeight;
      return;
    }

    // Filter out empty items
    const validItems = items.filter(item => item && item.trim().length > 0);

    validItems.forEach((item) => {
      this.checkPageBreak();
      this.pdf.circle(this.margin + 2, this.yPosition - 1, 0.8, 'F');

      const maxWidth = this.pageWidth - 2 * this.margin - 5;
      const lines = this.pdf.splitTextToSize(item, maxWidth);

      lines.forEach((line: string, index: number) => {
        if (index > 0) this.checkPageBreak();
        this.pdf.text(line, this.margin + 5, this.yPosition);
        this.yPosition += this.lineHeight;
      });
    });
  }

  /**
   * Add visual divider line
   */
  private addDivider(): void {
    this.pdf.setDrawColor(200, 200, 200);
    this.pdf.line(this.margin, this.yPosition, this.pageWidth - this.margin, this.yPosition);
    this.yPosition += 5;
  }

  /**
   * Add metrics grid (2 columns)
   * Defensive: validates metrics array
   */
  addMetricGrid(metrics: Array<{ label: string; value: string }>): void {
    if (!metrics || metrics.length === 0) return;

    const columnWidth = (this.pageWidth - 3 * this.margin) / 2;
    const validMetrics = metrics.filter(m => m.label && m.value);

    for (let i = 0; i < validMetrics.length; i += 2) {
      this.checkPageBreak(20);

      // Left column
      const leftMetric = validMetrics[i];
      this.pdf.setFont('helvetica', 'bold');
      this.pdf.text(leftMetric.label, this.margin, this.yPosition);
      this.pdf.setFont('helvetica', 'normal');
      this.pdf.text(leftMetric.value, this.margin, this.yPosition + this.lineHeight);

      // Right column (if exists)
      if (i + 1 < validMetrics.length) {
        const rightMetric = validMetrics[i + 1];
        this.pdf.setFont('helvetica', 'bold');
        this.pdf.text(rightMetric.label, this.margin + columnWidth + this.margin, this.yPosition);
        this.pdf.setFont('helvetica', 'normal');
        this.pdf.text(rightMetric.value, this.margin + columnWidth + this.margin, this.yPosition + this.lineHeight);
      }

      this.yPosition += this.lineHeight * 2 + 5;
    }
  }

  /**
   * Save PDF with filename
   * Defensive: validates filename and handles errors
   */
  save(filename: string): void {
    // Defensive validation
    if (!filename || filename.trim().length === 0) {
      filename = 'document.pdf';
    }

    // Ensure .pdf extension
    if (!filename.toLowerCase().endsWith('.pdf')) {
      filename += '.pdf';
    }

    try {
      this.pdf.save(filename);
    } catch (error) {
      console.error('Error saving PDF:', error);
      throw new Error(`Failed to save PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get PDF as blob for upload
   */
  getBlob(): Blob {
    return this.pdf.output('blob');
  }
}

// src/utils/pdf/index.ts
export { PDFGenerator } from './PDFGenerator';
export type { PDFConfig, PDFSection } from './PDFGenerator';
```

**Usage in Components**:

```typescript
// src/components/AvatarPDFExport.tsx (refactored)
import { PDFGenerator, PDFSection } from '@/utils/pdf';
import { Avatar } from '@/types/avatar';

interface AvatarPDFExportProps {
  avatar: Avatar;
  logoUrl?: string;
}

export function AvatarPDFExport({ avatar, logoUrl }: AvatarPDFExportProps) {
  const handleExport = () => {
    try {
      const pdf = new PDFGenerator({
        margin: 20,
        lineHeight: 6,
      });

      // Header
      pdf.addHeader(
        logoUrl ?? null,
        `Customer Avatar: ${avatar.name}`,
        `Generated ${new Date().toLocaleDateString()}`
      );

      // Demographics section
      pdf.addMetricGrid([
        { label: 'Age', value: avatar.demographics.age },
        { label: 'Income', value: avatar.demographics.income },
        { label: 'Location', value: avatar.demographics.location },
        { label: 'Lifestyle', value: avatar.demographics.lifestyle },
      ]);

      // Psychographics
      pdf.addSection({
        title: 'Values',
        content: avatar.psychographics.values,
      });

      pdf.addSection({
        title: 'Fears',
        content: avatar.psychographics.fears,
      });

      pdf.addSection({
        title: 'Desires',
        content: avatar.psychographics.desires,
      });

      // Buying Behavior
      pdf.addSection({
        title: 'Buying Intent',
        content: avatar.buyingBehavior.intent,
      });

      pdf.addSection({
        title: 'Decision Factors',
        content: avatar.buyingBehavior.decisionFactors,
      });

      // Voice of Customer
      pdf.addSection({
        title: 'Voice of Customer',
        content: avatar.voiceOfCustomer,
      });

      // Save
      pdf.save(`${avatar.name}-avatar.pdf`);

      toast({
        title: 'PDF Generated',
        description: 'Avatar PDF has been downloaded successfully',
      });
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({
        title: 'Export Failed',
        description: error instanceof Error ? error.message : 'Failed to generate PDF',
        variant: 'destructive',
      });
    }
  };

  return (
    <Button onClick={handleExport}>
      <FileDown className="w-4 h-4 mr-2" />
      Export PDF
    </Button>
  );
}
```

**Benefits**:
- Reduced from 1,039 lines to ~200 lines across both components
- Single source of truth for PDF generation
- Consistent output formatting
- Easier to test and maintain
- Defensive programming built-in

**Verification**:
- [ ] Create `src/utils/pdf/PDFGenerator.ts`
- [ ] Create `src/utils/pdf/index.ts`
- [ ] Refactor `AvatarPDFExport.tsx`
- [ ] Refactor `BrandCanvasPDFExport.tsx`
- [ ] Test PDF generation for both
- [ ] Verify output quality matches original
- [ ] Delete old PDF generation code

---

## 🟠 HIGH PRIORITY ISSUES

### Issue #5: Missing Constants File
**Priority**: HIGH
**Impact**: Magic numbers, hardcoded strings, poor maintainability
**Technical Debt**: 3 days

**Problem - Scattered Hardcoded Values**:
```typescript
// File size limits (appears 3+ times)
if (file.size > 10 * 1024 * 1024) { ... }

// Status strings (appears 15+ times)
status === "available"
status === "coming-soon"
status === "locked"

// Colors (appears 32+ times)
className="from-blue-500 to-blue-600"
className="from-purple-500 to-purple-600"

// Toast messages (60+ variations)
toast({ title: "Upload Failed", description: "..." })
```

**Solution - Centralized Constants**:

```typescript
// src/constants/files.ts

/**
 * File upload configuration constants
 * Single source of truth for file handling limits and rules
 */
export const FILE_UPLOAD = {
  /** Maximum file size in bytes (10MB) */
  MAX_SIZE_BYTES: 10 * 1024 * 1024,

  /** Maximum file size in MB for display */
  MAX_SIZE_MB: 10,

  /** Allowed document MIME types */
  ALLOWED_TYPES: [
    'application/pdf',
    'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ] as const,

  /** Human-readable file type descriptions */
  TYPE_DESCRIPTIONS: {
    'application/pdf': 'PDF Document',
    'text/plain': 'Text File',
    'application/msword': 'Word Document (DOC)',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word Document (DOCX)',
  } as const,
} as const;

// src/constants/modules.ts

/**
 * Module status types
 */
export const MODULE_STATUS = {
  AVAILABLE: 'available',
  COMING_SOON: 'coming-soon',
  LOCKED: 'locked',
} as const;

export type ModuleStatus = typeof MODULE_STATUS[keyof typeof MODULE_STATUS];

/**
 * Module categories
 */
export const MODULE_CATEGORY = {
  IDEA: 'IDEA Framework',
  RESEARCH: 'Research Tools',
  CANVAS: 'Brand Canvas',
  AVATAR: 'Customer Avatar',
  DIAGNOSTIC: 'Brand Diagnostic',
} as const;

// src/constants/theme.ts

/**
 * Gradient color combinations
 * Used for consistent visual hierarchy
 */
export const GRADIENT_COLORS = {
  BLUE: 'from-blue-500 to-blue-600',
  PURPLE: 'from-purple-500 to-purple-600',
  PINK: 'from-pink-500 to-pink-600',
  GREEN: 'from-green-500 to-green-600',
  ORANGE: 'from-orange-500 to-orange-600',
  INDIGO: 'from-indigo-500 to-indigo-600',
  TEAL: 'from-teal-500 to-teal-600',
  RED: 'from-red-500 to-red-600',
} as const;

/**
 * Icon background colors for sections
 */
export const ICON_COLORS = {
  BLUE: 'bg-blue-500',
  PURPLE: 'bg-purple-500',
  PINK: 'bg-pink-500',
  GREEN: 'bg-green-500',
  ORANGE: 'bg-orange-500',
  INDIGO: 'bg-indigo-500',
  TEAL: 'bg-teal-500',
  RED: 'bg-red-500',
} as const;

// src/constants/messages.ts

/**
 * Toast message templates
 * Provides consistent user feedback
 */
export const TOAST_MESSAGES = {
  // Upload messages
  UPLOAD: {
    SUCCESS: (filename: string) => ({
      title: 'Upload Successful',
      description: `${filename} has been uploaded and is being processed`,
    }),
    ERROR: (message: string) => ({
      title: 'Upload Failed',
      description: message,
      variant: 'destructive' as const,
    }),
    SIZE_ERROR: (maxSizeMB: number) => ({
      title: 'File Too Large',
      description: `File size exceeds ${maxSizeMB}MB limit`,
      variant: 'destructive' as const,
    }),
    TYPE_ERROR: {
      title: 'Invalid File Type',
      description: 'Please upload a supported document type (PDF, DOC, DOCX, TXT)',
      variant: 'destructive' as const,
    },
  },

  // Save messages
  SAVE: {
    SUCCESS: {
      title: 'Saved Successfully',
      description: 'Your changes have been saved',
    },
    ERROR: (message: string) => ({
      title: 'Save Failed',
      description: message,
      variant: 'destructive' as const,
    }),
    AUTO_SAVE: {
      title: 'Auto-saved',
      description: 'Your progress has been automatically saved',
    },
  },

  // AI messages
  AI: {
    GENERATING: {
      title: 'AI Processing',
      description: 'Generating suggestions...',
    },
    SUCCESS: {
      title: 'Suggestions Ready',
      description: 'AI has generated personalized suggestions',
    },
    ERROR: (message: string) => ({
      title: 'AI Generation Failed',
      description: message,
      variant: 'destructive' as const,
    }),
  },

  // Export messages
  EXPORT: {
    SUCCESS: (type: string) => ({
      title: 'Export Successful',
      description: `${type} has been downloaded`,
    }),
    ERROR: (message: string) => ({
      title: 'Export Failed',
      description: message,
      variant: 'destructive' as const,
    }),
  },
} as const;

// src/constants/api.ts

/**
 * API endpoint configuration
 */
export const API_ENDPOINTS = {
  DOCUMENTS: {
    UPLOAD: '/document-processor',
    LIST: '/documents',
    DELETE: (id: string) => `/documents/${id}`,
  },
  AI: {
    INSIGHT: '/ai-insight-guidance',
    ASSISTANT: '/brand-ai-assistant',
    BUYER_INTENT: '/buyer-intent-analyzer',
    CONSULTANT: '/idea-framework-consultant',
  },
  EMAIL: {
    FRAMEWORK: '/send-framework-email',
  },
  BETA: {
    TESTER: '/save-beta-tester',
    FEEDBACK: '/save-beta-feedback',
  },
} as const;

/**
 * API timeouts in milliseconds
 */
export const API_TIMEOUTS = {
  DEFAULT: 30000, // 30 seconds
  DOCUMENT_UPLOAD: 60000, // 1 minute
  AI_GENERATION: 90000, // 1.5 minutes
  QUICK_ACTION: 10000, // 10 seconds
} as const;

// src/constants/validation.ts

/**
 * Validation rules and limits
 */
export const VALIDATION_RULES = {
  BRAND_NAME: {
    MIN_LENGTH: 2,
    MAX_LENGTH: 50,
  },
  BRAND_PURPOSE: {
    MIN_LENGTH: 10,
    MAX_LENGTH: 500,
  },
  BRAND_VISION: {
    MIN_LENGTH: 10,
    MAX_LENGTH: 500,
  },
  BRAND_MISSION: {
    MIN_LENGTH: 10,
    MAX_LENGTH: 500,
  },
  BRAND_VALUES: {
    MIN_COUNT: 1,
    MAX_COUNT: 10,
    MIN_LENGTH: 3,
    MAX_LENGTH: 50,
  },
  EMAIL: {
    PATTERN: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
  },
} as const;

// src/constants/index.ts (barrel export)
export * from './files';
export * from './modules';
export * from './theme';
export * from './messages';
export * from './api';
export * from './validation';
```

**Usage Example**:
```typescript
// Before:
if (file.size > 10 * 1024 * 1024) {
  toast({ title: "File Too Large", description: "Max 10MB" });
}

// After:
import { FILE_UPLOAD, TOAST_MESSAGES } from '@/constants';

if (file.size > FILE_UPLOAD.MAX_SIZE_BYTES) {
  toast(TOAST_MESSAGES.UPLOAD.SIZE_ERROR(FILE_UPLOAD.MAX_SIZE_MB));
}

// Before:
<div className="from-blue-500 to-blue-600">

// After:
import { GRADIENT_COLORS } from '@/constants';

<div className={GRADIENT_COLORS.BLUE}>
```

**Verification**:
- [ ] Create all constant files
- [ ] Create barrel export
- [ ] Replace hardcoded values across codebase
- [ ] Update 32+ files with color constants
- [ ] Update 27+ files with message constants
- [ ] Test all affected components

---

### Issue #6: Inconsistent Error Handling
**Priority**: HIGH
**Impact**: Poor UX, debugging difficulty
**Technical Debt**: 3 days

**Problem - 27 Different Error Handling Patterns**:
```typescript
// Pattern 1: Good
catch (error) {
  console.error('Upload error:', error);
  toast({
    title: "Upload Failed",
    description: error instanceof Error ? error.message : "Failed",
    variant: "destructive",
  });
}

// Pattern 2: Poor
catch (error) {
  console.error(error);
  toast({ title: "Error" });
}

// Pattern 3: Missing
catch (error) {
  // Silent failure
}
```

**Solution - Standardized Error Handler**:

```typescript
// src/utils/errors/errorHandler.ts

/**
 * Error severity levels
 */
export enum ErrorSeverity {
  /** Low severity - informational only */
  INFO = 'info',
  /** Medium severity - user should be aware */
  WARNING = 'warning',
  /** High severity - operation failed */
  ERROR = 'error',
  /** Critical severity - system malfunction */
  CRITICAL = 'critical',
}

/**
 * Error context for better debugging
 */
export interface ErrorContext {
  /** Component or feature where error occurred */
  source: string;
  /** Operation being performed */
  operation: string;
  /** Additional context data */
  data?: Record<string, any>;
  /** User ID if applicable */
  userId?: string;
}

/**
 * Error handling configuration
 */
export interface ErrorHandlerConfig {
  /** Show toast notification to user */
  showToast?: boolean;
  /** Log to console (development) */
  logToConsole?: boolean;
  /** Send to error tracking service */
  reportToService?: boolean;
  /** Custom fallback message */
  fallbackMessage?: string;
  /** Error severity level */
  severity?: ErrorSeverity;
}

/**
 * Centralized error handling utility
 *
 * Implements Code Complete 2 error handling principles:
 * 1. Handle errors at the appropriate level
 * 2. Provide meaningful error messages
 * 3. Log errors for debugging
 * 4. Fail gracefully
 */
export class ErrorHandler {
  private static isDevelopment = import.meta.env.MODE === 'development';

  /**
   * Handle an error with consistent logging and user notification
   */
  static handle(
    error: unknown,
    context: ErrorContext,
    config: ErrorHandlerConfig = {}
  ): void {
    const {
      showToast = true,
      logToConsole = true,
      reportToService = !this.isDevelopment,
      fallbackMessage = 'An unexpected error occurred',
      severity = ErrorSeverity.ERROR,
    } = config;

    // Extract error message
    const errorMessage = this.extractErrorMessage(error);
    const fullMessage = errorMessage || fallbackMessage;

    // Log to console in development
    if (logToConsole && this.isDevelopment) {
      const logData = {
        severity,
        source: context.source,
        operation: context.operation,
        message: fullMessage,
        error: error,
        context: context.data,
        timestamp: new Date().toISOString(),
      };

      switch (severity) {
        case ErrorSeverity.INFO:
          console.info('Error Handler:', logData);
          break;
        case ErrorSeverity.WARNING:
          console.warn('Error Handler:', logData);
          break;
        case ErrorSeverity.CRITICAL:
          console.error('CRITICAL Error Handler:', logData);
          break;
        default:
          console.error('Error Handler:', logData);
      }
    }

    // Show toast notification
    if (showToast) {
      const variant = severity === ErrorSeverity.ERROR || severity === ErrorSeverity.CRITICAL
        ? 'destructive'
        : 'default';

      toast({
        title: this.getTitleForOperation(context.operation),
        description: fullMessage,
        variant: variant as any,
      });
    }

    // Report to error tracking service (production only)
    if (reportToService && !this.isDevelopment) {
      this.reportToErrorService(error, context, severity);
    }
  }

  /**
   * Extract user-friendly message from error
   */
  private static extractErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    if (typeof error === 'string') {
      return error;
    }

    if (error && typeof error === 'object' && 'message' in error) {
      return String(error.message);
    }

    return '';
  }

  /**
   * Get appropriate title based on operation
   */
  private static getTitleForOperation(operation: string): string {
    const operationTitles: Record<string, string> = {
      'upload': 'Upload Failed',
      'save': 'Save Failed',
      'load': 'Load Failed',
      'delete': 'Delete Failed',
      'generate': 'Generation Failed',
      'export': 'Export Failed',
      'analyze': 'Analysis Failed',
    };

    const operationLower = operation.toLowerCase();
    for (const [key, title] of Object.entries(operationTitles)) {
      if (operationLower.includes(key)) {
        return title;
      }
    }

    return 'Operation Failed';
  }

  /**
   * Report error to tracking service (Sentry, etc.)
   */
  private static reportToErrorService(
    error: unknown,
    context: ErrorContext,
    severity: ErrorSeverity
  ): void {
    // TODO: Implement error tracking service integration
    // Example: Sentry.captureException(error, { contexts: { operation: context } });
    console.log('[Error Service] Would report:', { error, context, severity });
  }

  /**
   * Handle API errors specifically
   */
  static handleAPIError(
    error: unknown,
    endpoint: string,
    operation: string,
    config?: Partial<ErrorHandlerConfig>
  ): void {
    this.handle(
      error,
      {
        source: 'API',
        operation,
        data: { endpoint },
      },
      {
        severity: ErrorSeverity.ERROR,
        ...config,
      }
    );
  }

  /**
   * Handle validation errors
   */
  static handleValidationError(
    field: string,
    message: string,
    config?: Partial<ErrorHandlerConfig>
  ): void {
    this.handle(
      new Error(message),
      {
        source: 'Validation',
        operation: 'Validate',
        data: { field },
      },
      {
        severity: ErrorSeverity.WARNING,
        showToast: true,
        logToConsole: false,
        reportToService: false,
        ...config,
      }
    );
  }
}

// src/utils/errors/index.ts
export { ErrorHandler, ErrorSeverity } from './errorHandler';
export type { ErrorContext, ErrorHandlerConfig } from './errorHandler';
```

**Usage Example**:
```typescript
// Before:
try {
  await uploadDocument(file);
  toast({ title: "Success" });
} catch (error) {
  console.error(error);
  toast({ title: "Error", variant: "destructive" });
}

// After:
import { ErrorHandler } from '@/utils/errors';

try {
  await uploadDocument(file);
  toast({ title: "Upload Successful", description: file.name });
} catch (error) {
  ErrorHandler.handle(
    error,
    {
      source: 'DocumentUpload',
      operation: 'Upload Document',
      data: { filename: file.name, size: file.size },
    },
    {
      fallbackMessage: 'Failed to upload document. Please try again.',
    }
  );
}

// API error example:
try {
  const response = await fetch('/api/documents');
  const data = await response.json();
} catch (error) {
  ErrorHandler.handleAPIError(
    error,
    '/api/documents',
    'Fetch Documents'
  );
}
```

**Verification**:
- [ ] Create error handler utility
- [ ] Update all 27 try-catch blocks
- [ ] Test error scenarios
- [ ] Verify consistent user feedback

---

### Issue #7: Complex State Management
**Priority**: HIGH
**Impact**: Component coupling, testing difficulty
**Technical Debt**: 1 week

**Problem - 80+ useState Calls**:
```typescript
// AvatarBuilder.tsx has fragmented state
const [avatar, setAvatar] = useState<Avatar>({ ... });
const [newTag, setNewTag] = useState("");
const [currentSection, setCurrentSection] = useState("values");
const [isAnalyzing, setIsAnalyzing] = useState(false);
const [analysisResults, setAnalysisResults] = useState(null);
const [selectedDocuments, setSelectedDocuments] = useState([]);
const [isLoading, setIsLoading] = useState(false);
```

**Solution - Reducer Pattern**:

```typescript
// src/reducers/avatarReducer.ts
import { Avatar, createEmptyAvatar } from '@/types/avatar';

/**
 * Avatar UI state
 */
interface AvatarUIState {
  newTag: string;
  currentSection: 'values' | 'fears' | 'desires' | 'triggers';
  isAnalyzing: boolean;
  isLoading: boolean;
  isSaving: boolean;
}

/**
 * Analysis results from AI
 */
interface AnalysisResults {
  suggestions: string[];
  confidence: number;
  timestamp: Date;
}

/**
 * Complete avatar state
 */
export interface AvatarState {
  avatar: Avatar;
  ui: AvatarUIState;
  analysisResults: AnalysisResults | null;
  selectedDocuments: string[];
  error: string | null;
}

/**
 * Avatar actions
 */
export type AvatarAction =
  | { type: 'UPDATE_AVATAR'; payload: Partial<Avatar> }
  | { type: 'UPDATE_DEMOGRAPHICS'; payload: Partial<Avatar['demographics']> }
  | { type: 'UPDATE_PSYCHOGRAPHICS'; payload: Partial<Avatar['psychographics']> }
  | { type: 'UPDATE_BUYING_BEHAVIOR'; payload: Partial<Avatar['buyingBehavior']> }
  | { type: 'ADD_VALUE'; payload: string }
  | { type: 'REMOVE_VALUE'; payload: number }
  | { type: 'ADD_FEAR'; payload: string }
  | { type: 'REMOVE_FEAR'; payload: number }
  | { type: 'ADD_DESIRE'; payload: string }
  | { type: 'REMOVE_DESIRE'; payload: number }
  | { type: 'ADD_TRIGGER'; payload: string }
  | { type: 'REMOVE_TRIGGER'; payload: number }
  | { type: 'SET_NEW_TAG'; payload: string }
  | { type: 'SET_CURRENT_SECTION'; payload: AvatarUIState['currentSection'] }
  | { type: 'START_ANALYSIS' }
  | { type: 'COMPLETE_ANALYSIS'; payload: AnalysisResults }
  | { type: 'ANALYSIS_ERROR'; payload: string }
  | { type: 'START_LOADING' }
  | { type: 'STOP_LOADING' }
  | { type: 'START_SAVING' }
  | { type: 'STOP_SAVING' }
  | { type: 'TOGGLE_DOCUMENT'; payload: string }
  | { type: 'LOAD_AVATAR'; payload: Avatar }
  | { type: 'RESET' }
  | { type: 'SET_ERROR'; payload: string }
  | { type: 'CLEAR_ERROR' };

/**
 * Initial state factory
 */
export function createInitialAvatarState(): AvatarState {
  return {
    avatar: createEmptyAvatar(),
    ui: {
      newTag: '',
      currentSection: 'values',
      isAnalyzing: false,
      isLoading: false,
      isSaving: false,
    },
    analysisResults: null,
    selectedDocuments: [],
    error: null,
  };
}

/**
 * Avatar reducer
 * Centralizes state management logic
 */
export function avatarReducer(
  state: AvatarState,
  action: AvatarAction
): AvatarState {
  switch (action.type) {
    case 'UPDATE_AVATAR':
      return {
        ...state,
        avatar: { ...state.avatar, ...action.payload },
      };

    case 'UPDATE_DEMOGRAPHICS':
      return {
        ...state,
        avatar: {
          ...state.avatar,
          demographics: { ...state.avatar.demographics, ...action.payload },
        },
      };

    case 'UPDATE_PSYCHOGRAPHICS':
      return {
        ...state,
        avatar: {
          ...state.avatar,
          psychographics: { ...state.avatar.psychographics, ...action.payload },
        },
      };

    case 'UPDATE_BUYING_BEHAVIOR':
      return {
        ...state,
        avatar: {
          ...state.avatar,
          buyingBehavior: { ...state.avatar.buyingBehavior, ...action.payload },
        },
      };

    case 'ADD_VALUE':
      return {
        ...state,
        avatar: {
          ...state.avatar,
          psychographics: {
            ...state.avatar.psychographics,
            values: [...state.avatar.psychographics.values, action.payload],
          },
        },
        ui: { ...state.ui, newTag: '' },
      };

    case 'REMOVE_VALUE':
      return {
        ...state,
        avatar: {
          ...state.avatar,
          psychographics: {
            ...state.avatar.psychographics,
            values: state.avatar.psychographics.values.filter(
              (_, index) => index !== action.payload
            ),
          },
        },
      };

    case 'SET_NEW_TAG':
      return {
        ...state,
        ui: { ...state.ui, newTag: action.payload },
      };

    case 'SET_CURRENT_SECTION':
      return {
        ...state,
        ui: { ...state.ui, currentSection: action.payload },
      };

    case 'START_ANALYSIS':
      return {
        ...state,
        ui: { ...state.ui, isAnalyzing: true },
        error: null,
      };

    case 'COMPLETE_ANALYSIS':
      return {
        ...state,
        ui: { ...state.ui, isAnalyzing: false },
        analysisResults: action.payload,
      };

    case 'ANALYSIS_ERROR':
      return {
        ...state,
        ui: { ...state.ui, isAnalyzing: false },
        error: action.payload,
      };

    case 'START_LOADING':
      return {
        ...state,
        ui: { ...state.ui, isLoading: true },
      };

    case 'STOP_LOADING':
      return {
        ...state,
        ui: { ...state.ui, isLoading: false },
      };

    case 'START_SAVING':
      return {
        ...state,
        ui: { ...state.ui, isSaving: true },
        error: null,
      };

    case 'STOP_SAVING':
      return {
        ...state,
        ui: { ...state.ui, isSaving: false },
      };

    case 'TOGGLE_DOCUMENT':
      const isSelected = state.selectedDocuments.includes(action.payload);
      return {
        ...state,
        selectedDocuments: isSelected
          ? state.selectedDocuments.filter(id => id !== action.payload)
          : [...state.selectedDocuments, action.payload],
      };

    case 'LOAD_AVATAR':
      return {
        ...state,
        avatar: action.payload,
      };

    case 'RESET':
      return createInitialAvatarState();

    case 'SET_ERROR':
      return {
        ...state,
        error: action.payload,
      };

    case 'CLEAR_ERROR':
      return {
        ...state,
        error: null,
      };

    default:
      return state;
  }
}

// src/hooks/useAvatarState.ts
import { useReducer, useCallback } from 'react';
import { avatarReducer, createInitialAvatarState, AvatarAction } from '@/reducers/avatarReducer';
import { Avatar } from '@/types/avatar';

/**
 * Custom hook for avatar state management
 * Provides typed actions and selectors
 */
export function useAvatarState(initialAvatar?: Avatar) {
  const [state, dispatch] = useReducer(
    avatarReducer,
    initialAvatar ? { ...createInitialAvatarState(), avatar: initialAvatar } : createInitialAvatarState()
  );

  // Action creators
  const actions = {
    updateDemographics: useCallback(
      (demographics: Partial<Avatar['demographics']>) =>
        dispatch({ type: 'UPDATE_DEMOGRAPHICS', payload: demographics }),
      []
    ),

    updatePsychographics: useCallback(
      (psychographics: Partial<Avatar['psychographics']>) =>
        dispatch({ type: 'UPDATE_PSYCHOGRAPHICS', payload: psychographics }),
      []
    ),

    updateBuyingBehavior: useCallback(
      (buyingBehavior: Partial<Avatar['buyingBehavior']>) =>
        dispatch({ type: 'UPDATE_BUYING_BEHAVIOR', payload: buyingBehavior }),
      []
    ),

    addValue: useCallback(
      (value: string) => dispatch({ type: 'ADD_VALUE', payload: value }),
      []
    ),

    removeValue: useCallback(
      (index: number) => dispatch({ type: 'REMOVE_VALUE', payload: index }),
      []
    ),

    setNewTag: useCallback(
      (tag: string) => dispatch({ type: 'SET_NEW_TAG', payload: tag }),
      []
    ),

    setCurrentSection: useCallback(
      (section: 'values' | 'fears' | 'desires' | 'triggers') =>
        dispatch({ type: 'SET_CURRENT_SECTION', payload: section }),
      []
    ),

    startAnalysis: useCallback(
      () => dispatch({ type: 'START_ANALYSIS' }),
      []
    ),

    completeAnalysis: useCallback(
      (results: any) => dispatch({ type: 'COMPLETE_ANALYSIS', payload: results }),
      []
    ),

    startSaving: useCallback(
      () => dispatch({ type: 'START_SAVING' }),
      []
    ),

    stopSaving: useCallback(
      () => dispatch({ type: 'STOP_SAVING' }),
      []
    ),

    toggleDocument: useCallback(
      (documentId: string) => dispatch({ type: 'TOGGLE_DOCUMENT', payload: documentId }),
      []
    ),

    loadAvatar: useCallback(
      (avatar: Avatar) => dispatch({ type: 'LOAD_AVATAR', payload: avatar }),
      []
    ),

    reset: useCallback(
      () => dispatch({ type: 'RESET' }),
      []
    ),
  };

  // Selectors
  const selectors = {
    avatar: state.avatar,
    isAnalyzing: state.ui.isAnalyzing,
    isLoading: state.ui.isLoading,
    isSaving: state.ui.isSaving,
    newTag: state.ui.newTag,
    currentSection: state.ui.currentSection,
    analysisResults: state.analysisResults,
    selectedDocuments: state.selectedDocuments,
    error: state.error,
    hasUnsavedChanges: state.ui.isSaving, // Can add logic to track changes
  };

  return { state: selectors, actions };
}
```

**Usage in Component**:
```typescript
// src/pages/AvatarBuilder.tsx (refactored)
import { useAvatarState } from '@/hooks/useAvatarState';

export function AvatarBuilder() {
  const { state, actions } = useAvatarState();

  // Much cleaner component code
  return (
    <div>
      <Input
        value={state.avatar.name}
        onChange={(e) => actions.updateDemographics({ name: e.target.value })}
      />

      {state.isAnalyzing && <Spinner />}

      <Button onClick={actions.startAnalysis}>
        Analyze
      </Button>
    </div>
  );
}
```

**Benefits**:
- Reduced from 7+ useState to 1 useReducer
- Centralized state logic
- Easier to test
- Better TypeScript support
- Clear action types

---

## 🟡 MEDIUM PRIORITY ISSUES

### Issue #8: Missing Input Validation
**Priority**: MEDIUM
**Technical Debt**: 1 week

**Solution**: Use Zod (already in dependencies) for validation:

```typescript
// src/validations/brandCanvas.ts
import { z } from 'zod';
import { VALIDATION_RULES } from '@/constants';

export const brandCanvasSchema = z.object({
  brandPurpose: z
    .string()
    .min(
      VALIDATION_RULES.BRAND_PURPOSE.MIN_LENGTH,
      `Purpose must be at least ${VALIDATION_RULES.BRAND_PURPOSE.MIN_LENGTH} characters`
    )
    .max(
      VALIDATION_RULES.BRAND_PURPOSE.MAX_LENGTH,
      `Purpose cannot exceed ${VALIDATION_RULES.BRAND_PURPOSE.MAX_LENGTH} characters`
    ),

  brandVision: z
    .string()
    .min(VALIDATION_RULES.BRAND_VISION.MIN_LENGTH)
    .max(VALIDATION_RULES.BRAND_VISION.MAX_LENGTH),

  brandMission: z
    .string()
    .min(VALIDATION_RULES.BRAND_MISSION.MIN_LENGTH)
    .max(VALIDATION_RULES.BRAND_MISSION.MAX_LENGTH),

  brandValues: z
    .array(
      z.string()
        .min(VALIDATION_RULES.BRAND_VALUES.MIN_LENGTH)
        .max(VALIDATION_RULES.BRAND_VALUES.MAX_LENGTH)
    )
    .min(VALIDATION_RULES.BRAND_VALUES.MIN_COUNT, 'Add at least one brand value')
    .max(VALIDATION_RULES.BRAND_VALUES.MAX_COUNT, `Maximum ${VALIDATION_RULES.BRAND_VALUES.MAX_COUNT} values`),

  positioningStatement: z.string().min(20),
  valueProposition: z.string().min(20),
  brandPersonality: z.array(z.string()).min(1),
  brandVoice: z.string().min(10),
});

export type BrandCanvasData = z.infer<typeof brandCanvasSchema>;

// Usage with react-hook-form (already in dependencies)
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

const form = useForm<BrandCanvasData>({
  resolver: zodResolver(brandCanvasSchema),
});
```

---

### Issue #9: Inconsistent Component Organization
**Priority**: MEDIUM
**Technical Debt**: 1 week

**Recommended Structure**:
```
src/
├── features/
│   ├── avatar/
│   │   ├── components/
│   │   │   ├── AvatarBuilder.tsx
│   │   │   ├── AvatarPDFExport.tsx
│   │   │   └── sections/
│   │   ├── hooks/
│   │   │   └── useAvatarState.ts
│   │   ├── reducers/
│   │   │   └── avatarReducer.ts
│   │   └── types/
│   │       └── index.ts
│   ├── brand-canvas/
│   │   ├── components/
│   │   ├── hooks/
│   │   └── types/
│   ├── idea-framework/
│   ├── research/
│   └── pdf-export/
│       └── utils/
│           └── PDFGenerator.ts
├── shared/
│   ├── components/
│   │   ├── ErrorBoundary.tsx
│   │   ├── SectionCard.tsx
│   │   └── AIAssistantField.tsx
│   ├── hooks/
│   │   ├── useTagManager.ts
│   │   └── useDebounce.ts
│   └── utils/
│       ├── errors/
│       └── validation/
├── constants/
├── types/
└── ui/ (shadcn components)
```

---

### Issue #10: Console Logging in Production
**Priority**: MEDIUM
**Technical Debt**: 2 days

**Solution - Logger Utility**:

```typescript
// src/utils/logger.ts
const isDevelopment = import.meta.env.MODE === 'development';

export const logger = {
  debug: (...args: any[]) => {
    if (isDevelopment) console.debug('[DEBUG]', ...args);
  },

  info: (...args: any[]) => {
    if (isDevelopment) console.info('[INFO]', ...args);
  },

  warn: (...args: any[]) => {
    console.warn('[WARN]', ...args);
  },

  error: (...args: any[]) => {
    console.error('[ERROR]', ...args);
    // Could send to error tracking service
  },
};

// Replace all console.log with logger
```

---

## 🔵 LOW PRIORITY ISSUES

### Issue #11: Missing Error Boundaries
**Priority**: LOW
**Technical Debt**: 2 days

**Solution**:
```typescript
// src/components/ErrorBoundary.tsx
import React from 'react';

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error boundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="p-8 text-center">
          <h2>Something went wrong</h2>
          <p>{this.state.error?.message}</p>
        </div>
      );
    }

    return this.props.children;
  }
}

// Usage in App.tsx
<ErrorBoundary>
  <Dashboard />
</ErrorBoundary>
```

---

## 📊 Implementation Roadmap

### Phase 1: Critical Issues (Weeks 1-2)
**Goal**: Eliminate technical debt blockers

- [ ] **Week 1 Days 1-2**: Create shared type definitions
  - [ ] Avatar types in `src/types/avatar.ts`
  - [ ] Document types in `src/types/document.ts`
  - [ ] Brand types in `src/types/brand.ts`
  - [ ] Update all imports

- [ ] **Week 1 Days 3-5**: Replace `any` types
  - [ ] Update 18 files with proper types
  - [ ] Run TypeScript compiler
  - [ ] Fix type errors
  - [ ] Test affected components

- [ ] **Week 2 Days 1-3**: Extract PDF Generator utility
  - [ ] Create `src/utils/pdf/PDFGenerator.ts`
  - [ ] Refactor `AvatarPDFExport.tsx`
  - [ ] Refactor `BrandCanvasPDFExport.tsx`
  - [ ] Test PDF generation

- [ ] **Week 2 Days 4-5**: Create constants files
  - [ ] File constants
  - [ ] Module constants
  - [ ] Theme constants
  - [ ] Message constants
  - [ ] Update 50+ files

### Phase 2: High Priority (Weeks 3-4)
**Goal**: Improve maintainability and consistency

- [ ] **Week 3**: Decompose large components
  - [ ] BrandCanvas.tsx → 8 section components
  - [ ] AvatarBuilder.tsx → 6 tab components
  - [ ] Create shared SectionCard component
  - [ ] Test all sections

- [ ] **Week 4**: Standardize patterns
  - [ ] Create ErrorHandler utility
  - [ ] Update all error handling
  - [ ] Create reducer for complex state
  - [ ] Add input validation with Zod

### Phase 3: Medium Priority (Week 5-6)
**Goal**: Polish and improve developer experience

- [ ] **Week 5**: Reorganize file structure
  - [ ] Create feature directories
  - [ ] Move components to features
  - [ ] Update import paths
  - [ ] Create barrel exports

- [ ] **Week 6**: Add utilities and testing
  - [ ] Create logger utility
  - [ ] Add error boundaries
  - [ ] Create reusable hooks
  - [ ] Write unit tests for utilities

---

## 📋 Quality Assurance Checklist

### Pre-Implementation
- [ ] Review Code Complete 2 principles
- [ ] Review DRY methodology
- [ ] Create branch: `refactor/code-quality-improvement`
- [ ] Set up TypeScript strict mode (future)
- [ ] Review existing test coverage

### During Implementation
- [ ] Follow defensive programming principles
- [ ] Add JSDoc comments to new utilities
- [ ] Write unit tests for new utilities
- [ ] Update documentation
- [ ] No new `any` types
- [ ] All new code follows DRY principles

### Post-Implementation
- [ ] TypeScript compilation succeeds: `npx tsc --noEmit`
- [ ] ESLint passes: `npm run lint`
- [ ] All components render correctly
- [ ] No console errors
- [ ] Performance not degraded
- [ ] Bundle size not significantly increased
- [ ] All features tested manually
- [ ] Git commit messages follow conventions
- [ ] Pull request created with detailed description

---

## 📈 Success Metrics

### Quantitative Goals
- **Reduce `any` types**: From 54 to 0
- **Reduce largest component**: From 802 lines to <300 lines each
- **Code duplication**: Reduce by 30% (eliminate 1,000+ duplicate lines)
- **Type coverage**: Achieve 95%+ type safety
- **Bundle size**: Maintain or improve
- **Build time**: No significant increase

### Qualitative Goals
- **Single source of truth**: All types, constants, and utilities centralized
- **Consistent patterns**: Error handling, state management, validation
- **Improved maintainability**: Smaller, focused components
- **Better developer experience**: Clear organization, typed APIs
- **Defensive coding**: Null checks, validation, error handling throughout

---

## 🔍 Code Review Guidelines

### For Reviewers
Check each PR for:
- [ ] No new `any` types introduced
- [ ] Constants used instead of magic numbers
- [ ] Proper error handling with ErrorHandler
- [ ] Components < 300 lines
- [ ] DRY principles followed
- [ ] Defensive programming patterns used
- [ ] TypeScript types properly defined
- [ ] Tests added for new utilities

### For Developers
Before submitting PR:
- [ ] Run TypeScript compiler
- [ ] Run ESLint
- [ ] Test all affected features
- [ ] Update related documentation
- [ ] Check for code duplication
- [ ] Verify defensive programming
- [ ] Add JSDoc comments

---

## 📚 Reference Materials

### Code Complete 2 Principles Applied
1. **DRY (Don't Repeat Yourself)**: Eliminate all code duplication
2. **Defensive Programming**: Validate inputs, handle errors gracefully
3. **Code Construction**: Write for readability, minimize complexity
4. **Error Handling**: Handle at appropriate level, provide meaningful messages
5. **Constants**: Replace magic numbers with named constants
6. **Decomposition**: Break large components into focused pieces

### TypeScript Best Practices
1. **Avoid `any`**: Use proper types or `unknown`
2. **Use `const assertions`**: For constant objects
3. **Discriminated unions**: For state machines
4. **Type guards**: For runtime type checking
5. **Generics**: For reusable components and utilities

### React Best Practices
1. **Component size**: Keep < 300 lines
2. **Single responsibility**: Each component does one thing
3. **Custom hooks**: Extract reusable logic
4. **Error boundaries**: Catch and handle errors
5. **Reducers**: For complex state

---

## 🎯 Conclusion

This code quality improvement plan provides a comprehensive roadmap to transform the IDEA Brand Coach codebase from functional to exemplary. By applying Code Complete 2 principles and DRY methodology, we can:

1. **Eliminate technical debt** through systematic refactoring
2. **Improve type safety** by removing all `any` types
3. **Enhance maintainability** through component decomposition
4. **Establish consistent patterns** for error handling and validation
5. **Create reusable utilities** following DRY principles
6. **Improve developer experience** with better organization

**Estimated Timeline**: 6 weeks for complete implementation
**Estimated Effort**: 1 developer full-time or 2 developers part-time
**ROI**: Significant reduction in bugs, faster feature development, easier onboarding

---

**Remember**:
> "Every piece of knowledge must have a single, unambiguous, authoritative representation within a system." - The Pragmatic Programmer

This plan embodies that principle by creating single sources of truth for types, constants, error handling, PDF generation, and all major patterns in the codebase.
