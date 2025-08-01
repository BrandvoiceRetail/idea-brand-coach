import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle, TrendingUp, Target, Users, Zap, ArrowRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function BrandDiagnostic() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    company: "",
    industry: "",
    role: "",
    teamSize: "",
    currentChallenge: ""
  });

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleStartDiagnostic = () => {
    if (!formData.fullName || !formData.email || !formData.company) {
      toast({
        title: "Missing Information",
        description: "Please fill in your name, email, and company to continue.",
        variant: "destructive"
      });
      return;
    }

    // Store user data for the diagnostic
    localStorage.setItem('diagnosticUserData', JSON.stringify(formData));
    
    toast({
      title: "Starting Your Brand Diagnostic",
      description: "Let's discover your brand's potential!"
    });

    navigate('/diagnostic');
  };

  const benefits = [
    {
      icon: <Target className="h-8 w-8 text-primary" />,
      title: "Identify Strategic Gaps",
      description: "Discover exactly where your brand strategy needs attention and improvement."
    },
    {
      icon: <TrendingUp className="h-8 w-8 text-primary" />,
      title: "Boost Market Position",
      description: "Understand how to differentiate and position your brand for maximum impact."
    },
    {
      icon: <Users className="h-8 w-8 text-primary" />,
      title: "Connect With Customers",
      description: "Learn which emotional triggers resonate most with your target audience."
    },
    {
      icon: <Zap className="h-8 w-8 text-primary" />,
      title: "Actionable Insights",
      description: "Get specific, implementable recommendations tailored to your business."
    }
  ];

  const testimonials = [
    {
      name: "Sarah Chen",
      role: "Marketing Director, TechFlow",
      content: "The diagnostic revealed blind spots we never knew existed. Our conversion rates improved 40% after implementing the recommendations."
    },
    {
      name: "Marcus Rodriguez",
      role: "Founder, EcoLiving Co.",
      content: "Finally understood why our messaging wasn't resonating. The emotional triggers framework completely transformed our customer engagement."
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/10">
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-16">
        <div className="text-center max-w-4xl mx-auto mb-16">
          <h1 className="text-5xl font-bold mb-6 bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            Free Brand Diagnostic Tool
          </h1>
          <p className="text-xl text-muted-foreground mb-8 leading-relaxed">
            Discover your brand's hidden potential with our comprehensive diagnostic. 
            Get personalized insights on what's working, what's not, and exactly how to improve your market position.
          </p>
          
          <div className="flex items-center justify-center gap-8 text-sm text-muted-foreground mb-8">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-primary" />
              <span>Free Assessment</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-primary" />
              <span>5-Minute Setup</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-primary" />
              <span>Instant Results</span>
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-2 gap-12 items-start">
          {/* Benefits Section */}
          <div className="space-y-8">
            <div>
              <h2 className="text-3xl font-bold mb-6">What You'll Discover</h2>
              <div className="grid gap-6">
                {benefits.map((benefit, index) => (
                  <Card key={index} className="border-border/50 hover:shadow-lg transition-all duration-300">
                    <CardContent className="pt-6">
                      <div className="flex gap-4">
                        <div className="flex-shrink-0">
                          {benefit.icon}
                        </div>
                        <div>
                          <h3 className="font-semibold text-lg mb-2">{benefit.title}</h3>
                          <p className="text-muted-foreground">{benefit.description}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {/* Testimonials */}
            <div>
              <h3 className="text-2xl font-bold mb-6">What Leaders Are Saying</h3>
              <div className="space-y-4">
                {testimonials.map((testimonial, index) => (
                  <Card key={index} className="border-border/50">
                    <CardContent className="pt-6">
                      <p className="text-muted-foreground mb-4 italic">"{testimonial.content}"</p>
                      <div>
                        <p className="font-semibold">{testimonial.name}</p>
                        <p className="text-sm text-muted-foreground">{testimonial.role}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>

          {/* Form Section */}
          <div className="lg:sticky lg:top-8">
            <Card className="border-border shadow-xl">
              <CardHeader className="text-center">
                <CardTitle className="text-2xl">Start Your Free Diagnostic</CardTitle>
                <CardDescription>
                  Get personalized brand insights in just 5 minutes
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="fullName">Full Name *</Label>
                    <Input
                      id="fullName"
                      placeholder="Your full name"
                      value={formData.fullName}
                      onChange={(e) => handleInputChange('fullName', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email *</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="your@email.com"
                      value={formData.email}
                      onChange={(e) => handleInputChange('email', e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="company">Company *</Label>
                  <Input
                    id="company"
                    placeholder="Your company name"
                    value={formData.company}
                    onChange={(e) => handleInputChange('company', e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="industry">Industry</Label>
                    <Select onValueChange={(value) => handleInputChange('industry', value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select industry" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="technology">Technology</SelectItem>
                        <SelectItem value="healthcare">Healthcare</SelectItem>
                        <SelectItem value="finance">Finance</SelectItem>
                        <SelectItem value="retail">Retail</SelectItem>
                        <SelectItem value="manufacturing">Manufacturing</SelectItem>
                        <SelectItem value="consulting">Consulting</SelectItem>
                        <SelectItem value="education">Education</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="role">Your Role</Label>
                    <Select onValueChange={(value) => handleInputChange('role', value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="founder">Founder/CEO</SelectItem>
                        <SelectItem value="marketing-director">Marketing Director</SelectItem>
                        <SelectItem value="marketing-manager">Marketing Manager</SelectItem>
                        <SelectItem value="brand-manager">Brand Manager</SelectItem>
                        <SelectItem value="consultant">Consultant</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="teamSize">Team Size</Label>
                  <Select onValueChange={(value) => handleInputChange('teamSize', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select team size" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Just me</SelectItem>
                      <SelectItem value="2-5">2-5 people</SelectItem>
                      <SelectItem value="6-20">6-20 people</SelectItem>
                      <SelectItem value="21-50">21-50 people</SelectItem>
                      <SelectItem value="51+">51+ people</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="challenge">Biggest Brand Challenge (Optional)</Label>
                  <Textarea
                    id="challenge"
                    placeholder="What's your biggest brand challenge right now?"
                    value={formData.currentChallenge}
                    onChange={(e) => handleInputChange('currentChallenge', e.target.value)}
                    rows={3}
                  />
                </div>

                <Button 
                  onClick={handleStartDiagnostic}
                  className="w-full text-lg py-6 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
                >
                  Start My Free Diagnostic
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>

                <p className="text-xs text-muted-foreground text-center">
                  By starting the diagnostic, you agree to receive insights and occasional updates about brand strategy. No spam, ever.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}