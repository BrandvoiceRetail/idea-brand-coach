import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useBrand } from '@/contexts/BrandContext';
import { useNavigate } from 'react-router-dom';
import {
  Briefcase,
  CheckCircle2,
  Circle,
  Lightbulb,
  Target,
  Heart,
  Shield,
  ArrowRight,
  FileText,
  Users,
} from 'lucide-react';

interface FrameworkSectionProps {
  title: string;
  icon: React.ReactNode;
  completed: boolean;
  description: string;
  path: string;
}

function FrameworkSection({ title, icon, completed, description, path }: FrameworkSectionProps) {
  const navigate = useNavigate();

  return (
    <div
      className="group p-3 rounded-lg border transition-all hover:shadow-sm cursor-pointer"
      onClick={() => navigate(path)}
    >
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 ${completed ? 'text-green-500' : 'text-muted-foreground'}`}>
          {completed ? <CheckCircle2 className="h-5 w-5" /> : icon}
        </div>
        <div className="flex-1 space-y-1">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium">{title}</h4>
            {completed && (
              <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded">
                Complete
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </div>
  );
}

export function SimpleBrandPanel() {
  const { brandData } = useBrand();
  const navigate = useNavigate();

  // Calculate overall progress
  const sections = [
    { key: 'insight', completed: brandData?.insight?.completed || false },
    { key: 'distinctive', completed: brandData?.distinctive?.completed || false },
    { key: 'empathy', completed: brandData?.empathy?.completed || false },
    { key: 'authentic', completed: brandData?.authentic?.completed || false },
  ];

  const completedCount = sections.filter(s => s.completed).length;
  const progressPercentage = (completedCount / sections.length) * 100;

  const frameworkSections = [
    {
      title: 'Insight',
      icon: <Lightbulb className="h-5 w-5" />,
      completed: brandData?.insight?.completed || false,
      description: 'Discover your brand purpose and market insights',
      path: '/idea/insight',
    },
    {
      title: 'Distinctive',
      icon: <Target className="h-5 w-5" />,
      completed: brandData?.distinctive?.completed || false,
      description: 'Define what makes your brand unique',
      path: '/idea/distinctive',
    },
    {
      title: 'Empathy',
      icon: <Heart className="h-5 w-5" />,
      completed: brandData?.empathy?.completed || false,
      description: 'Connect emotionally with your customers',
      path: '/idea/empathy',
    },
    {
      title: 'Authenticity',
      icon: <Shield className="h-5 w-5" />,
      completed: brandData?.authentic?.completed || false,
      description: 'Establish your brand values and promise',
      path: '/idea/authenticity',
    },
  ];

  const tools = [
    {
      title: 'Brand Avatar',
      icon: <Users className="h-4 w-4" />,
      description: 'Define your ideal customer',
      path: '/avatar',
      completed: brandData?.avatar?.completed || false,
    },
    {
      title: 'Brand Canvas',
      icon: <FileText className="h-4 w-4" />,
      description: 'Visual brand overview',
      path: '/canvas',
      completed: brandData?.brandCanvas?.completed || false,
    },
  ];

  return (
    <Card className="h-full border-0 rounded-none">
      <CardHeader className="pb-3">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-primary" />
            <CardTitle className="text-base font-semibold">Your Brand</CardTitle>
          </div>

          {/* Overall Progress */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">IDEA Framework Progress</span>
              <span className="font-medium">{progressPercentage}%</span>
            </div>
            <Progress value={progressPercentage} className="h-2" />
            <p className="text-xs text-muted-foreground">
              {completedCount} of {sections.length} sections complete
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-3 space-y-4">
        {/* IDEA Framework Sections */}
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-3">
            IDEA Framework
          </h3>
          <div className="space-y-2">
            {frameworkSections.map((section) => (
              <FrameworkSection key={section.title} {...section} />
            ))}
          </div>
        </div>

        {/* Brand Tools */}
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-3">
            Brand Tools
          </h3>
          <div className="space-y-2">
            {tools.map((tool) => (
              <div
                key={tool.title}
                className="group p-3 rounded-lg border transition-all hover:shadow-sm cursor-pointer"
                onClick={() => navigate(tool.path)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {tool.icon}
                    <div>
                      <p className="text-sm font-medium">{tool.title}</p>
                      <p className="text-xs text-muted-foreground">{tool.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {tool.completed && (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    )}
                    <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="pt-2 space-y-2">
          <Button
            className="w-full justify-start"
            variant="outline"
            onClick={() => navigate('/diagnostic')}
          >
            <FileText className="h-4 w-4 mr-2" />
            Take Brand Diagnostic
          </Button>

          <Button
            className="w-full justify-start"
            variant="outline"
            onClick={() => navigate('/idea/consultant')}
          >
            <Briefcase className="h-4 w-4 mr-2" />
            Open Brand Coach
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}