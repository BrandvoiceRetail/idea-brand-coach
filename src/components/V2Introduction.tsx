import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

const INTRODUCTION_SEEN_KEY = 'hasSeenV2Introduction';

interface IntroStep {
  icon: string;
  title: string;
  description: string;
}

const STEPS: IntroStep[] = [
  {
    icon: '\u{1F44B}',
    title: 'Meet Trevor, Your Brand Coach',
    description:
      'Trevor is an AI brand strategist trained on the IDEA framework. Ask questions, share your ideas, and get personalized guidance for your brand.',
  },
  {
    icon: '\u{2728}',
    title: 'Everything Saves Automatically',
    description:
      'As you chat with Trevor, your brand details are extracted and saved in real time. No forms to fill out -- just have a conversation.',
  },
  {
    icon: '\u{1F680}',
    title: 'Your Classic Tools Are Still Here',
    description:
      'All the tools you know and love are still available. Switch back to the classic view anytime using the version switcher.',
  },
];

interface V2IntroductionProps {
  onComplete: () => void;
}

export function V2Introduction({ onComplete }: V2IntroductionProps): JSX.Element {
  const [currentStep, setCurrentStep] = useState(0);

  const handleNext = useCallback((): void => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep((prev) => prev + 1);
    } else {
      localStorage.setItem(INTRODUCTION_SEEN_KEY, 'true');
      onComplete();
    }
  }, [currentStep, onComplete]);

  const handleSkip = useCallback((): void => {
    localStorage.setItem(INTRODUCTION_SEEN_KEY, 'true');
    onComplete();
  }, [onComplete]);

  const step = STEPS[currentStep];
  const isLastStep = currentStep === STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="max-w-md w-full mx-4"
      >
        <Card className="border-2">
          <CardContent className="pt-8 pb-6 px-8">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentStep}
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -30 }}
                transition={{ duration: 0.25 }}
                className="text-center space-y-4"
              >
                <span className="text-5xl block" role="img" aria-label={step.title}>
                  {step.icon}
                </span>
                <h2 className="text-xl font-semibold tracking-tight">
                  {step.title}
                </h2>
                <p className="text-muted-foreground leading-relaxed">
                  {step.description}
                </p>
              </motion.div>
            </AnimatePresence>

            <div className="flex justify-center gap-1.5 mt-6">
              {STEPS.map((_, index) => (
                <div
                  key={index}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    index === currentStep
                      ? 'w-6 bg-primary'
                      : 'w-1.5 bg-muted-foreground/30'
                  }`}
                />
              ))}
            </div>

            <div className="flex items-center justify-between mt-8">
              <Button variant="ghost" size="sm" onClick={handleSkip}>
                Skip
              </Button>
              <Button variant="brand" onClick={handleNext}>
                {isLastStep ? "Let's go" : 'Next'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

export function hasSeenV2Introduction(): boolean {
  return localStorage.getItem(INTRODUCTION_SEEN_KEY) === 'true';
}
