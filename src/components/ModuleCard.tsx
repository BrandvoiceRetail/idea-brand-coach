import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, LucideIcon } from "lucide-react";

interface ModuleCardProps {
  title: string;
  description: string;
  icon: LucideIcon;
  href: string;
  status?: "available" | "coming-soon";
  className?: string;
}

export function ModuleCard({ 
  title, 
  description, 
  icon: Icon, 
  href, 
  status = "available",
  className = ""
}: ModuleCardProps) {
  return (
    <Card className={`bg-gradient-card shadow-card hover:shadow-brand transition-all duration-300 group ${className}`}>
      <CardHeader>
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 bg-gradient-secondary rounded-lg flex items-center justify-center group-hover:shadow-glow transition-all duration-300">
            <Icon className="w-6 h-6 text-secondary-foreground" />
          </div>
          <div className="flex-1">
            <CardTitle className="text-lg font-semibold">{title}</CardTitle>
            {status === "coming-soon" && (
              <span className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded-full">
                Coming Soon
              </span>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <CardDescription className="text-sm text-muted-foreground mb-4">
          {description}
        </CardDescription>
        <Button 
          variant={status === "available" ? "coach" : "outline"} 
          className="w-full group/btn"
          asChild
          disabled={status === "coming-soon"}
        >
          <Link to={status === "available" ? href : "#"} className="flex items-center justify-center space-x-2">
            <span>{status === "available" ? "Get Started" : "Coming Soon"}</span>
            {status === "available" && (
              <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
            )}
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}