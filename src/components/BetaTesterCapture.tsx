import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Mail, User, Building, ArrowRight, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface BetaTesterCaptureProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
  diagnosticData: {
    overallScore: number;
    scores: Record<string, number>;
  };
}

export default function BetaTesterCapture({ 
  isOpen, 
  onClose, 
  onComplete, 
  diagnosticData 
}: BetaTesterCaptureProps) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    company: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async () => {
    if (!formData.email.trim()) {
      toast({
        title: "Email required",
        description: "Please enter your email to receive your detailed results.",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await supabase.functions.invoke('save-beta-tester', {
        body: {
          name: formData.name.trim() || null,
          email: formData.email.trim(),
          company: formData.company.trim() || null,
          overallScore: diagnosticData.overallScore,
          categoryScores: diagnosticData.scores
        }
      });

      if (error) {
        console.error('Error saving beta tester data:', error);
        toast({
          title: "Error saving data",
          description: "We'll still show your results, but couldn't save your contact info.",
          variant: "destructive"
        });
      } else {
        toast({
          title: "Thank you!",
          description: "Your detailed results will be sent to your email shortly.",
          variant: "default"
        });
      }
    } catch (error) {
      console.error('Error submitting form:', error);
      toast({
        title: "Submission failed",
        description: "We'll still show your results, but couldn't save your contact info.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
      onComplete();
    }
  };

  const handleSkip = () => {
    onComplete();
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-primary" />
            Get Your Detailed Results
          </DialogTitle>
          <DialogDescription>
            Enter your details to receive a personalized IDEA Brand Report via email
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email" className="flex items-center gap-2">
              <Mail className="w-4 h-4" />
              Email Address *
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="your@email.com"
              value={formData.email}
              onChange={(e) => handleInputChange('email', e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="name" className="flex items-center gap-2">
              <User className="w-4 h-4" />
              Full Name
            </Label>
            <Input
              id="name"
              placeholder="Your name"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="company" className="flex items-center gap-2">
              <Building className="w-4 h-4" />
              Company (Optional)
            </Label>
            <Input
              id="company"
              placeholder="Your company"
              value={formData.company}
              onChange={(e) => handleInputChange('company', e.target.value)}
            />
          </div>

          <div className="flex gap-2 pt-4">
            <Button
              variant="outline"
              onClick={handleSkip}
              disabled={isSubmitting}
              className="flex-1"
            >
              <X className="w-4 h-4 mr-2" />
              Skip & Continue
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex-1"
            >
              {isSubmitting ? (
                'Sending...'
              ) : (
                <>
                  Send Results
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          </div>

          <p className="text-xs text-muted-foreground text-center">
            We'll use your email only to send your results and occasional brand insights. 
            No spam, unsubscribe anytime.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}