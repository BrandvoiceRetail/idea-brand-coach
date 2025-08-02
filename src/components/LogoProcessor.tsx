import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { removeBackground, loadImageFromUrl } from '@/utils/backgroundRemoval';
import { Loader2 } from 'lucide-react';

export const LogoProcessor = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [processedImageUrl, setProcessedImageUrl] = useState<string | null>(null);
  const { toast } = useToast();

  const processLogo = async () => {
    setIsProcessing(true);
    try {
      toast({
        title: "Processing Logo",
        description: "Removing background from your logo...",
      });

      // Load the current black logo
      const img = await loadImageFromUrl('/lovable-uploads/9d0d469a-cd07-4743-9db7-d82dea0751e5.png');
      
      // Remove background
      const processedBlob = await removeBackground(img);
      
      // Create URL for the processed image
      const url = URL.createObjectURL(processedBlob);
      setProcessedImageUrl(url);
      
      toast({
        title: "Success!",
        description: "Background removed successfully. You can now download the processed logo.",
      });
    } catch (error) {
      console.error('Error processing logo:', error);
      toast({
        title: "Error",
        description: "Failed to remove background. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadProcessedLogo = () => {
    if (processedImageUrl) {
      const link = document.createElement('a');
      link.href = processedImageUrl;
      link.download = 'idea-brand-coach-logo-no-bg.png';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <div className="max-w-md mx-auto p-6 bg-card rounded-lg shadow-lg">
      <h3 className="text-lg font-semibold mb-4">Logo Background Removal</h3>
      
      <div className="space-y-4">
        <div className="text-center">
          <img 
            src="/lovable-uploads/9d0d469a-cd07-4743-9db7-d82dea0751e5.png" 
            alt="Original Logo" 
            className="h-32 w-auto mx-auto mb-2 border rounded"
          />
          <p className="text-sm text-muted-foreground">Original Logo</p>
        </div>

        <Button 
          onClick={processLogo} 
          disabled={isProcessing}
          className="w-full"
        >
          {isProcessing ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Processing...
            </>
          ) : (
            'Remove Background'
          )}
        </Button>

        {processedImageUrl && (
          <div className="text-center space-y-2">
            <img 
              src={processedImageUrl} 
              alt="Processed Logo" 
              className="h-32 w-auto mx-auto border rounded bg-checkered"
              style={{ backgroundColor: '#f0f0f0' }}
            />
            <p className="text-sm text-muted-foreground">Processed Logo (Transparent Background)</p>
            <Button onClick={downloadProcessedLogo} variant="outline" className="w-full">
              Download Processed Logo
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};