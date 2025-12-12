import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, Sparkles, Zap, Crown, ArrowRight, Lock } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { ROUTES } from '@/config/routes';

interface PricingTier {
  id: 'starter' | 'professional' | 'premium';
  name: string;
  icon: React.ElementType;
  monthlyPrice: number;
  setupFee: number;
  description: string;
  features: string[];
  highlighted: boolean;
  cta: string;
  badge?: string;
}

const pricingTiers: PricingTier[] = [
  {
    id: 'starter',
    name: 'Starter',
    icon: Sparkles,
    monthlyPrice: 25,
    setupFee: 100,
    description: 'Perfect for solopreneurs and small businesses starting their brand journey',
    features: [
      'Full brand diagnostic access',
      '50 AI chat messages per month',
      '1 brand avatar',
      'Brand canvas (view only)',
      '30-day chat history',
      'Email support'
    ],
    highlighted: false,
    cta: 'Start with Starter'
  },
  {
    id: 'professional',
    name: 'Professional',
    icon: Zap,
    monthlyPrice: 50,
    setupFee: 100,
    description: 'For growing brands ready to scale with advanced AI-powered tools',
    features: [
      'Everything in Starter, plus:',
      '200 AI chat messages per month',
      '3 brand avatars',
      'Full brand canvas editing',
      'Upload 5 brand documents',
      '1-year chat history',
      'PDF export capabilities',
      'Brand copy generator (limited)',
      'Priority email support'
    ],
    highlighted: true,
    cta: 'Go Professional',
    badge: 'Most Popular'
  },
  {
    id: 'premium',
    name: 'Premium',
    icon: Crown,
    monthlyPrice: 150,
    setupFee: 100,
    description: 'For established brands and agencies requiring unlimited access',
    features: [
      'Everything in Professional, plus:',
      'Unlimited AI chat messages',
      'Unlimited brand avatars',
      'Unlimited document uploads',
      'Unlimited chat history',
      'Export to PDF, Markdown & DOCX',
      'All brand copy templates',
      'Priority support (24-hour response)',
      '1 hour consultation per quarter'
    ],
    highlighted: false,
    cta: 'Unlock Premium'
  }
];

export default function PricingPaywall(): JSX.Element {
  const navigate = useNavigate();
  const { user } = useAuth();

  // TODO: Phase 2 - Fetch user's current subscription from database
  const currentSubscription = null; // Will be fetched from user_subscriptions table

  const handleSelectTier = (tierId: string) => {
    // Store selected tier in localStorage
    localStorage.setItem('selectedTier', tierId);

    // TODO: Phase 2 - When Stripe is integrated, this will create checkout session
    // For now, just navigate to dashboard if authenticated, otherwise to auth
    if (user) {
      // User is authenticated - proceed to app (stripe checkout will be added in Phase 2)
      navigate(ROUTES.HOME_PAGE);
    } else {
      // User not authenticated - need to sign up/sign in first
      navigate(`/auth?plan=${tierId}&redirect=/subscribe`);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/10">
      {/* Header */}
      <div className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="text-center">
            <h1 className="text-3xl font-bold mb-2">Choose Your Plan</h1>
            <p className="text-muted-foreground">
              Select the perfect plan to unlock AI-powered brand building tools
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Pricing Section */}
        <div className="text-center mb-8">
          <p className="text-muted-foreground text-lg mb-2">
            All plans include a one-time <span className="font-bold text-primary">$100 setup fee</span> to ensure you're committed to building a strong brand.
          </p>
          <p className="text-sm text-muted-foreground">
            Cancel anytime. No long-term commitments.
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          {pricingTiers.map((tier) => {
            const Icon = tier.icon;
            return (
              <Card
                key={tier.id}
                className={`relative ${
                  tier.highlighted
                    ? 'border-2 border-primary shadow-lg scale-105 md:scale-110'
                    : 'border-border'
                }`}
              >
                {tier.badge && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary text-primary-foreground px-4 py-1">
                      {tier.badge}
                    </Badge>
                  </div>
                )}
                <CardHeader className="text-center pb-8">
                  <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                    <Icon className="w-6 h-6 text-primary" />
                  </div>
                  <CardTitle className="text-2xl mb-2">{tier.name}</CardTitle>
                  <CardDescription className="text-sm min-h-[3rem]">
                    {tier.description}
                  </CardDescription>
                  <div className="mt-4">
                    <div className="text-4xl font-bold text-primary">
                      ${tier.monthlyPrice}
                      <span className="text-lg text-muted-foreground font-normal">/month</span>
                    </div>
                    <div className="text-sm text-muted-foreground mt-2">
                      + ${tier.setupFee} one-time setup fee
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="space-y-3 mb-6">
                    {tier.features.map((feature, index) => (
                      <li key={index} className="flex items-start gap-3">
                        <Check className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    onClick={() => handleSelectTier(tier.id)}
                    className={`w-full ${
                      tier.highlighted
                        ? 'bg-primary hover:bg-primary/90'
                        : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                    }`}
                    size="lg"
                  >
                    {/* TODO: Phase 2 - Show "Upgrade" or "Current Plan" based on subscription status */}
                    {tier.cta}
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                  <p className="text-xs text-center text-muted-foreground">
                    Total first payment: ${tier.monthlyPrice + tier.setupFee}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Trust & Guarantee Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <Card className="text-center">
            <CardContent className="pt-6">
              <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center mx-auto mb-3">
                <Check className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="font-semibold mb-2">30-Day Money-Back Guarantee</h3>
              <p className="text-sm text-muted-foreground">
                Not satisfied? Get a full refund within 30 days, no questions asked.
              </p>
            </CardContent>
          </Card>
          <Card className="text-center">
            <CardContent className="pt-6">
              <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center mx-auto mb-3">
                <Lock className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="font-semibold mb-2">Secure Payment</h3>
              <p className="text-sm text-muted-foreground">
                Your payment information is encrypted and processed securely via Stripe.
              </p>
            </CardContent>
          </Card>
          <Card className="text-center">
            <CardContent className="pt-6">
              <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900/20 flex items-center justify-center mx-auto mb-3">
                <Zap className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
              <h3 className="font-semibold mb-2">Cancel Anytime</h3>
              <p className="text-sm text-muted-foreground">
                No long-term commitment. Cancel your subscription anytime from your account settings.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* FAQ Section */}
        <Card>
          <CardHeader>
            <CardTitle>Frequently Asked Questions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">Why is there a setup fee?</h4>
              <p className="text-sm text-muted-foreground">
                The one-time $100 setup fee ensures you're committed to building a strong brand. It covers your initial diagnostic analysis, account setup, and personalized onboarding.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Can I upgrade or downgrade later?</h4>
              <p className="text-sm text-muted-foreground">
                Yes! You can change your plan anytime from your account settings. Upgrades take effect immediately, and downgrades apply at your next billing cycle.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-2">What if I exceed my usage limits?</h4>
              <p className="text-sm text-muted-foreground">
                We'll send you a notification when you're approaching your limits. You can either upgrade to a higher tier or wait until your next billing cycle for limits to reset.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Is my data secure?</h4>
              <p className="text-sm text-muted-foreground">
                Absolutely. All data is encrypted in transit and at rest. We never share your information with third parties, and you maintain full control over your data.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
