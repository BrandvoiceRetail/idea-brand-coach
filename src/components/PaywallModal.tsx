import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Zap, Crown, Star } from "lucide-react";

interface PaywallModalProps {
  isOpen: boolean;
  onClose: () => void;
  feature: string;
}

export const PaywallModal: React.FC<PaywallModalProps> = ({
  isOpen,
  onClose,
  feature
}) => {
  const [selectedPlan, setSelectedPlan] = useState<'starter' | 'pro' | 'enterprise'>('pro');

  const plans = [
    {
      id: 'starter',
      name: 'Starter',
      price: '$29',
      period: '/month',
      description: 'Perfect for solopreneurs and small businesses',
      features: [
        'Complete IDEA Strategic Brand Framework™ access',
        'Avatar 2.0 Builder',
        'Basic AI copy generation',
        '50 AI suggestions/month',
        'Brand Canvas builder',
        'Email support'
      ],
      icon: <Star className="h-6 w-6" />,
      color: 'from-blue-500 to-blue-600'
    },
    {
      id: 'pro',
      name: 'Professional',
      price: '$79',
      period: '/month',
      description: 'Most popular for growing businesses',
      features: [
        'Everything in Starter',
        'Unlimited AI suggestions',
        'Advanced copy variations',
        'Brand Copy Generator',
        'Multi-brand management',
        'Priority support',
        'Advanced analytics',
        'Export capabilities'
      ],
      icon: <Crown className="h-6 w-6" />,
      color: 'from-purple-500 to-purple-600',
      popular: true
    },
    {
      id: 'enterprise',
      name: 'Enterprise',
      price: '$199',
      period: '/month',
      description: 'For agencies and large teams',
      features: [
        'Everything in Professional',
        'Team collaboration tools',
        'White-label options',
        'Custom integrations',
        'Dedicated account manager',
        'Custom training sessions',
        'Advanced reporting',
        'API access'
      ],
      icon: <Zap className="h-6 w-6" />,
      color: 'from-orange-500 to-orange-600'
    }
  ];

  const handleUpgrade = (planId: string) => {
    // This would integrate with your payment processor
    console.log(`Upgrading to ${planId} plan`);
    // For now, just close the modal
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="text-center">
          <DialogTitle className="text-3xl font-bold mb-2">
            Unlock {feature}
          </DialogTitle>
          <DialogDescription className="text-lg">
            Choose a plan that fits your brand building needs
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 py-6">
          {plans.map((plan) => (
            <Card 
              key={plan.id}
              className={`relative cursor-pointer transition-all duration-300 ${
                selectedPlan === plan.id 
                  ? 'ring-2 ring-primary shadow-lg scale-105' 
                  : 'hover:shadow-md'
              } ${plan.popular ? 'border-primary' : ''}`}
              onClick={() => setSelectedPlan(plan.id as typeof selectedPlan)}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <Badge className="bg-primary text-primary-foreground px-3 py-1">
                    Most Popular
                  </Badge>
                </div>
              )}
              
              <CardHeader className="text-center pb-4">
                <div className={`w-12 h-12 bg-gradient-to-r ${plan.color} rounded-full flex items-center justify-center mx-auto mb-3 text-white`}>
                  {plan.icon}
                </div>
                <CardTitle className="text-xl">{plan.name}</CardTitle>
                <div className="flex items-baseline justify-center gap-1">
                  <span className="text-3xl font-bold">{plan.price}</span>
                  <span className="text-muted-foreground">{plan.period}</span>
                </div>
                <CardDescription className="text-sm">{plan.description}</CardDescription>
              </CardHeader>
              
              <CardContent className="space-y-3">
                {plan.features.map((feature, index) => (
                  <div key={index} className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">{feature}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
          <Button 
            onClick={() => handleUpgrade(selectedPlan)}
            size="lg"
            className="text-lg px-8 py-6 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
          >
            Start {plans.find(p => p.id === selectedPlan)?.name} Plan
          </Button>
          
          <Button 
            variant="outline" 
            onClick={onClose}
            size="lg"
            className="text-lg px-8 py-6"
          >
            Continue with Free Plan
          </Button>
        </div>

        <div className="text-center text-sm text-muted-foreground pt-4">
          <p>✓ 14-day free trial • ✓ Cancel anytime • ✓ No setup fees</p>
        </div>
      </DialogContent>
    </Dialog>
  );
};