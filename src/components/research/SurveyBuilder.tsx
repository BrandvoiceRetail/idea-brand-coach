import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { 
  FileText, 
  Plus, 
  Trash2, 
  Eye, 
  Share, 
  BarChart3,
  Copy,
  Settings
} from "lucide-react";
import { toast } from "sonner";

interface Question {
  id: string;
  type: 'text' | 'multiple-choice' | 'scale' | 'boolean' | 'email';
  question: string;
  options?: string[];
  required: boolean;
}

interface Survey {
  title: string;
  description: string;
  questions: Question[];
  settings: {
    collectEmail: boolean;
    allowAnonymous: boolean;
    showProgress: boolean;
  };
}

export function SurveyBuilder() {
  const [survey, setSurvey] = useState<Survey>({
    title: "",
    description: "",
    questions: [],
    settings: {
      collectEmail: false,
      allowAnonymous: true,
      showProgress: true
    }
  });

  const [previewMode, setPreviewMode] = useState(false);

  const questionTypes = [
    { value: 'text', label: 'Text Input' },
    { value: 'multiple-choice', label: 'Multiple Choice' },
    { value: 'scale', label: 'Rating Scale (1-10)' },
    { value: 'boolean', label: 'Yes/No' },
    { value: 'email', label: 'Email Address' }
  ];

  const addQuestion = () => {
    const newQuestion: Question = {
      id: Date.now().toString(),
      type: 'text',
      question: '',
      required: false
    };
    setSurvey(prev => ({
      ...prev,
      questions: [...prev.questions, newQuestion]
    }));
  };

  const updateQuestion = (id: string, updates: Partial<Question>) => {
    setSurvey(prev => ({
      ...prev,
      questions: prev.questions.map(q => 
        q.id === id ? { ...q, ...updates } : q
      )
    }));
  };

  const deleteQuestion = (id: string) => {
    setSurvey(prev => ({
      ...prev,
      questions: prev.questions.filter(q => q.id !== id)
    }));
  };

  const addOption = (questionId: string) => {
    setSurvey(prev => ({
      ...prev,
      questions: prev.questions.map(q => 
        q.id === questionId 
          ? { ...q, options: [...(q.options || []), ''] }
          : q
      )
    }));
  };

  const updateOption = (questionId: string, optionIndex: number, value: string) => {
    setSurvey(prev => ({
      ...prev,
      questions: prev.questions.map(q => 
        q.id === questionId 
          ? { 
              ...q, 
              options: q.options?.map((opt, idx) => 
                idx === optionIndex ? value : opt
              )
            }
          : q
      )
    }));
  };

  const removeOption = (questionId: string, optionIndex: number) => {
    setSurvey(prev => ({
      ...prev,
      questions: prev.questions.map(q => 
        q.id === questionId 
          ? { 
              ...q, 
              options: q.options?.filter((_, idx) => idx !== optionIndex)
            }
          : q
      )
    }));
  };

  const generateSurveyLink = () => {
    const surveyData = encodeURIComponent(JSON.stringify(survey));
    const link = `${window.location.origin}/survey/preview?data=${surveyData}`;
    
    navigator.clipboard.writeText(link).then(() => {
      toast.success("Survey link copied to clipboard!");
    });
  };

  const exportSurvey = () => {
    const data = JSON.stringify(survey, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${survey.title || 'survey'}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    toast.success("Survey exported successfully!");
  };

  const loadSurveyTemplate = (template: string) => {
    const templates = {
      'brand-perception': {
        title: "Brand Perception Study",
        description: "Help us understand how you perceive our brand and products",
        questions: [
          {
            id: '1',
            type: 'scale' as const,
            question: "How likely are you to recommend our brand to others?",
            required: true
          },
          {
            id: '2',
            type: 'multiple-choice' as const,
            question: "What words best describe our brand?",
            options: ["Trustworthy", "Innovative", "Affordable", "Premium", "Reliable"],
            required: true
          },
          {
            id: '3',
            type: 'text' as const,
            question: "What initially attracted you to our product?",
            required: false
          }
        ],
        settings: {
          collectEmail: true,
          allowAnonymous: false,
          showProgress: true
        }
      },
      'customer-feedback': {
        title: "Customer Experience Feedback",
        description: "Share your experience to help us improve",
        questions: [
          {
            id: '1',
            type: 'scale' as const,
            question: "How satisfied are you with your recent purchase?",
            required: true
          },
          {
            id: '2',
            type: 'multiple-choice' as const,
            question: "How did you hear about us?",
            options: ["Social Media", "Search Engine", "Friend Referral", "Advertisement", "Other"],
            required: true
          },
          {
            id: '3',
            type: 'text' as const,
            question: "What could we do to improve your experience?",
            required: false
          }
        ],
        settings: {
          collectEmail: false,
          allowAnonymous: true,
          showProgress: true
        }
      }
    };

    if (template in templates) {
      setSurvey(templates[template as keyof typeof templates]);
      toast.success("Survey template loaded!");
    }
  };

  if (previewMode) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Survey Preview</h2>
          <Button onClick={() => setPreviewMode(false)} variant="outline">
            Back to Editor
          </Button>
        </div>

        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle>{survey.title || "Untitled Survey"}</CardTitle>
            {survey.description && (
              <CardDescription>{survey.description}</CardDescription>
            )}
          </CardHeader>
          <CardContent className="space-y-6">
            {survey.questions.map((question, index) => (
              <div key={question.id} className="space-y-2">
                <Label className="flex items-center gap-1">
                  {question.question}
                  {question.required && <span className="text-red-500">*</span>}
                </Label>
                
                {question.type === 'text' && (
                  <Input placeholder="Type your answer here..." />
                )}
                
                {question.type === 'multiple-choice' && (
                  <div className="space-y-2">
                    {question.options?.map((option, idx) => (
                      <div key={idx} className="flex items-center space-x-2">
                        <input type="radio" name={question.id} />
                        <span>{option}</span>
                      </div>
                    ))}
                  </div>
                )}
                
                {question.type === 'scale' && (
                  <div className="flex space-x-2">
                    {Array.from({ length: 10 }, (_, i) => (
                      <Button key={i + 1} variant="outline" size="sm">
                        {i + 1}
                      </Button>
                    ))}
                  </div>
                )}
                
                {question.type === 'boolean' && (
                  <div className="flex space-x-4">
                    <Button variant="outline" size="sm">Yes</Button>
                    <Button variant="outline" size="sm">No</Button>
                  </div>
                )}
                
                {question.type === 'email' && (
                  <Input type="email" placeholder="your@email.com" />
                )}
              </div>
            ))}
            
            <Button className="w-full">Submit Survey</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-blue-500" />
            Survey Builder
          </CardTitle>
          <CardDescription>
            Create custom surveys to gather customer insights and feedback
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Quick Templates */}
          <div>
            <Label>Quick Start Templates</Label>
            <div className="flex gap-2 mt-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => loadSurveyTemplate('brand-perception')}
              >
                Brand Perception
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => loadSurveyTemplate('customer-feedback')}
              >
                Customer Feedback
              </Button>
            </div>
          </div>

          {/* Basic Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="survey-title">Survey Title</Label>
              <Input
                id="survey-title"
                value={survey.title}
                onChange={(e) => setSurvey(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Enter survey title..."
              />
            </div>
            <div>
              <Label htmlFor="survey-description">Description</Label>
              <Input
                id="survey-description"
                value={survey.description}
                onChange={(e) => setSurvey(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Brief description..."
              />
            </div>
          </div>

          {/* Settings */}
          <div>
            <Label className="flex items-center gap-2 mb-3">
              <Settings className="h-4 w-4" />
              Survey Settings
            </Label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="collect-email" className="text-sm">Collect Email</Label>
                <Switch
                  id="collect-email"
                  checked={survey.settings.collectEmail}
                  onCheckedChange={(checked) => 
                    setSurvey(prev => ({
                      ...prev,
                      settings: { ...prev.settings, collectEmail: checked }
                    }))
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="allow-anonymous" className="text-sm">Allow Anonymous</Label>
                <Switch
                  id="allow-anonymous"
                  checked={survey.settings.allowAnonymous}
                  onCheckedChange={(checked) => 
                    setSurvey(prev => ({
                      ...prev,
                      settings: { ...prev.settings, allowAnonymous: checked }
                    }))
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="show-progress" className="text-sm">Show Progress</Label>
                <Switch
                  id="show-progress"
                  checked={survey.settings.showProgress}
                  onCheckedChange={(checked) => 
                    setSurvey(prev => ({
                      ...prev,
                      settings: { ...prev.settings, showProgress: checked }
                    }))
                  }
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Questions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Questions ({survey.questions.length})</CardTitle>
            <Button onClick={addQuestion} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Question
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {survey.questions.map((question, index) => (
            <Card key={question.id} className="p-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Badge variant="secondary">Question {index + 1}</Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteQuestion(question.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Question Text</Label>
                    <Input
                      value={question.question}
                      onChange={(e) => updateQuestion(question.id, { question: e.target.value })}
                      placeholder="Enter your question..."
                    />
                  </div>
                  <div>
                    <Label>Question Type</Label>
                    <Select
                      value={question.type}
                      onValueChange={(value) => updateQuestion(question.id, { type: value as Question['type'] })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {questionTypes.map(type => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {question.type === 'multiple-choice' && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Label>Options</Label>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => addOption(question.id)}
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Add Option
                      </Button>
                    </div>
                    <div className="space-y-2">
                      {question.options?.map((option, optionIndex) => (
                        <div key={optionIndex} className="flex items-center gap-2">
                          <Input
                            value={option}
                            onChange={(e) => updateOption(question.id, optionIndex, e.target.value)}
                            placeholder={`Option ${optionIndex + 1}`}
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeOption(question.id, optionIndex)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={question.required}
                      onCheckedChange={(checked) => updateQuestion(question.id, { required: checked })}
                    />
                    <Label className="text-sm">Required</Label>
                  </div>
                </div>
              </div>
            </Card>
          ))}

          {survey.questions.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No questions added yet. Click "Add Question" to get started.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      {survey.questions.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => setPreviewMode(true)}>
                <Eye className="h-4 w-4 mr-2" />
                Preview Survey
              </Button>
              <Button variant="outline" onClick={generateSurveyLink}>
                <Share className="h-4 w-4 mr-2" />
                Generate Link
              </Button>
              <Button variant="outline" onClick={exportSurvey}>
                <Copy className="h-4 w-4 mr-2" />
                Export Survey
              </Button>
              <Button variant="outline">
                <BarChart3 className="h-4 w-4 mr-2" />
                View Results
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}