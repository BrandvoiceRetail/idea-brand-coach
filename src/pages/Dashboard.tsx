import { ModuleCard } from "@/components/ModuleCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Link } from "react-router-dom";
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
  Clock,
  Heart,
  Star,
  Shield,
  Lightbulb,
  Users
} from "lucide-react";

const coreModules = [
  {
    title: "IDEA Diagnostic",
    description: "Complete brand health assessment using the IDEA Strategic Framework",
    icon: Brain,
    href: "/diagnostic",
    status: "available" as const
  },
  {
    title: "Avatar 2.0 Builder", 
    description: "Build behavioral customer profiles with emotional triggers and motivations",
    icon: Users,
    href: "/avatar",
    status: "available" as const
  },
  {
    title: "ValueLens Generator",
    description: "AI-powered copy generator for emotionally resonant messaging",
    icon: Zap,
    href: "/valuelens",
    status: "available" as const
  }
];

const ideaModules = [
  {
    title: "Insight Driven",
    description: "Gather deep insights about customer motivations and emotional triggers",
    icon: Lightbulb,
    href: "/idea/insight",
    status: "available" as const,
    color: "from-yellow-500 to-orange-500"
  },
  {
    title: "Distinctive/Different",
    description: "Stand out at both product and brand level with distinctive assets",
    icon: Star,
    href: "/idea/distinctiveness",
    status: "available" as const,
    color: "from-green-500 to-emerald-500"
  },
  {
    title: "Emotionally Intelligent", 
    description: "Connect with audience through understanding emotional cues",
    icon: Heart,
    href: "/idea/empathy",
    status: "available" as const,
    color: "from-pink-500 to-rose-500"
  },
  {
    title: "Authoritative & Authentic",
    description: "Be genuine, transparent and create an attractive brand persona",
    icon: Shield,
    href: "/idea/authenticity", 
    status: "available" as const,
    color: "from-blue-500 to-indigo-500"
  }
];

const additionalModules = [
  {
    title: "IDEA Framework Hub",
    description: "Complete guide to the IDEA Strategic Brand Framework methodology",
    icon: BookOpen,
    href: "/idea",
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
          Build trust-driven, emotionally resonant brands using the IDEA Strategic Framework. 
          Transform from guessing to knowing your customers.
        </p>
        <Button variant="coach" size="lg" className="shadow-glow">
          Explore IDEA Framework
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
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Core Tools */}
          <div>
            <h2 className="text-2xl font-bold mb-6">Essential Tools</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {coreModules.map((module) => (
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

          {/* IDEA Framework Modules */}
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold">IDEA Strategic Framework</h2>
              <Button variant="outline" size="sm" asChild>
                <Link to="/idea">Learn Framework</Link>
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {ideaModules.map((module) => (
                <Card key={module.title} className={`bg-gradient-to-br ${module.color} text-white shadow-card hover:shadow-brand transition-all duration-300 border-0`}>
                  <CardContent className="p-6">
                    <div className="flex items-start space-x-4">
                      <div className="p-2 bg-white/20 rounded-lg">
                        <module.icon className="w-6 h-6" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg mb-2">{module.title}</h3>
                        <p className="text-white/90 text-sm leading-relaxed">{module.description}</p>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="mt-3 text-white hover:bg-white/20"
                          asChild
                        >
                          <Link to={module.href}>Explore →</Link>
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Additional Modules */}
          <div>
            <h2 className="text-2xl font-bold mb-6">Additional Tools</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {additionalModules.map((module) => (
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