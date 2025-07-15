import { ModuleCard } from "@/components/ModuleCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { 
  Brain, 
  Target, 
  MessageSquare, 
  Search, 
  Zap, 
  BarChart, 
  BookOpen,
  TrendingUp,
  CheckCircle,
  Clock
} from "lucide-react";

const modules = [
  {
    title: "IDEA Diagnostic",
    description: "Get your complete brand health score and identify emotional blockers",
    icon: Brain,
    href: "/diagnostic",
    status: "available" as const
  },
  {
    title: "Avatar 2.0 Builder", 
    description: "Create behavioral avatars with emotional triggers and subconscious motivators",
    icon: Target,
    href: "/avatar",
    status: "available" as const
  },
  {
    title: "ValueLens Generator",
    description: "AI-powered copy generator for emotionally resonant product descriptions",
    icon: Zap,
    href: "/valuelens",
    status: "available" as const
  },
  {
    title: "Brand Canvas",
    description: "Visual drag-and-drop canvas for your IDEA framework strategy",
    icon: MessageSquare,
    href: "/canvas",
    status: "coming-soon" as const
  },
  {
    title: "Listing Optimizer",
    description: "Analyze and optimize your product listings for emotional triggers",
    icon: Search,
    href: "/optimizer",
    status: "coming-soon" as const
  },
  {
    title: "Resources & Library",
    description: "Templates, checklists, and swipe files for brand building",
    icon: BookOpen,
    href: "/resources",
    status: "coming-soon" as const
  }
];

const recentActivity = [
  {
    action: "Completed IDEA Diagnostic",
    time: "2 hours ago",
    status: "completed"
  },
  {
    action: "Created new Avatar: Busy Professional Mom",
    time: "1 day ago",
    status: "completed"
  },
  {
    action: "Generated ValueLens copy for Product A",
    time: "3 days ago",
    status: "completed"
  }
];

export default function Dashboard() {
  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <div className="bg-gradient-hero rounded-lg p-8 text-center">
        <h1 className="text-3xl md:text-4xl font-bold text-primary-foreground mb-4">
          Welcome to IDEA Brand Coach™
        </h1>
        <p className="text-lg text-primary-foreground/90 mb-6 max-w-2xl mx-auto">
          Build emotionally resonant, high-trust brands using behavioral science. 
          Transform struggling sellers into confident brand owners.
        </p>
        <Button variant="coach" size="lg" className="shadow-glow">
          Start Your Brand Journey
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-gradient-card shadow-card">
          <CardContent className="p-6">
            <div className="flex items-center space-x-3">
              <TrendingUp className="w-8 h-8 text-secondary" />
              <div>
                <p className="text-2xl font-bold">67%</p>
                <p className="text-sm text-muted-foreground">Brand Health Score</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-card shadow-card">
          <CardContent className="p-6">
            <div className="flex items-center space-x-3">
              <Target className="w-8 h-8 text-secondary" />
              <div>
                <p className="text-2xl font-bold">3</p>
                <p className="text-sm text-muted-foreground">Avatars Created</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-card shadow-card">
          <CardContent className="p-6">
            <div className="flex items-center space-x-3">
              <Zap className="w-8 h-8 text-secondary" />
              <div>
                <p className="text-2xl font-bold">12</p>
                <p className="text-sm text-muted-foreground">Copy Variants Generated</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Modules */}
        <div className="lg:col-span-2">
          <h2 className="text-2xl font-bold mb-6">Core Modules</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {modules.map((module) => (
              <ModuleCard
                key={module.title}
                title={module.title}
                description={module.description}
                icon={module.icon}
                href={module.href}
                status={module.status}
              />
            ))}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Progress */}
          <Card className="bg-gradient-card shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <BarChart className="w-5 h-5" />
                <span>Your Progress</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span>Brand Foundation</span>
                  <span>67%</span>
                </div>
                <Progress value={67} className="h-2" />
              </div>
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span>Avatar Clarity</span>
                  <span>85%</span>
                </div>
                <Progress value={85} className="h-2" />
              </div>
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span>Message Resonance</span>
                  <span>42%</span>
                </div>
                <Progress value={42} className="h-2" />
              </div>
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card className="bg-gradient-card shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Clock className="w-5 h-5" />
                <span>Recent Activity</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recentActivity.map((activity, index) => (
                  <div key={index} className="flex items-start space-x-3">
                    <CheckCircle className="w-4 h-4 text-secondary mt-1 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{activity.action}</p>
                      <p className="text-xs text-muted-foreground">{activity.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}