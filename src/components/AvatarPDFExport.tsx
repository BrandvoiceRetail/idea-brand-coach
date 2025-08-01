import React, { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, Building2, Target, MessageSquare, TrendingUp, Users, Heart, ShoppingCart, Lightbulb } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Avatar {
  name: string;
  demographics: {
    age: string;
    income: string;
    location: string;
    lifestyle: string;
  };
  psychographics: {
    values: string[];
    fears: string[];
    desires: string[];
    triggers: string[];
  };
  buyingBehavior: {
    intent: string;
    decisionFactors: string[];
    shoppingStyle: string;
    priceConsciousness: string;
  };
  voiceOfCustomer: string;
}

interface AvatarPDFExportProps {
  avatar: Avatar;
  analysisResults?: {
    keyPhrases: string[];
    sentiment: {
      positive: number;
      negative: number;
      neutral: number;
    };
    insights: string[];
  };
}

export const AvatarPDFExport: React.FC<AvatarPDFExportProps> = ({ avatar, analysisResults }) => {
  const { toast } = useToast();
  const contentRef = useRef<HTMLDivElement>(null);

  const handleExport = async () => {
    // For now, we'll create a comprehensive HTML version that can be printed to PDF
    // In a real implementation, you'd use a library like react-pdf or puppeteer
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const htmlContent = generatePDFContent();
    
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.focus();
    
    // Auto-trigger print dialog
    setTimeout(() => {
      printWindow.print();
    }, 500);

    toast({
      title: "Export Ready",
      description: "Print dialog opened. Save as PDF or print directly."
    });
  };

  const generatePDFContent = () => {
    return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Customer Avatar Report - ${avatar.name || 'Unnamed Avatar'}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          line-height: 1.6;
          color: #1a1a1a;
          background: white;
        }
        .container { max-width: 800px; margin: 0 auto; padding: 40px 20px; }
        .header { 
          text-align: center; 
          border-bottom: 3px solid #3b82f6; 
          padding-bottom: 30px; 
          margin-bottom: 40px;
        }
        .logo-placeholder {
          width: 120px;
          height: 60px;
          background: linear-gradient(135deg, #3b82f6, #8b5cf6);
          margin: 0 auto 20px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: bold;
        }
        h1 { 
          font-size: 28px; 
          font-weight: 700; 
          color: #1e40af; 
          margin-bottom: 8px; 
        }
        h2 { 
          font-size: 20px; 
          font-weight: 600; 
          color: #1e40af; 
          margin: 30px 0 15px; 
          padding-bottom: 8px;
          border-bottom: 2px solid #e5e7eb;
        }
        h3 { 
          font-size: 16px; 
          font-weight: 600; 
          color: #374151; 
          margin: 20px 0 10px; 
        }
        .subtitle { color: #6b7280; font-size: 16px; }
        .section { 
          background: #f9fafb; 
          padding: 25px; 
          margin: 20px 0; 
          border-radius: 12px;
          border-left: 4px solid #3b82f6;
        }
        .grid { 
          display: grid; 
          grid-template-columns: 1fr 1fr; 
          gap: 20px; 
          margin: 15px 0; 
        }
        .metric { 
          background: white; 
          padding: 15px; 
          border-radius: 8px; 
          border: 1px solid #e5e7eb;
        }
        .metric-label { 
          font-size: 12px; 
          color: #6b7280; 
          text-transform: uppercase; 
          letter-spacing: 0.5px;
        }
        .metric-value { 
          font-size: 18px; 
          font-weight: 600; 
          color: #1f2937; 
          margin-top: 4px;
        }
        .tag { 
          display: inline-block; 
          background: #eff6ff; 
          color: #1e40af; 
          padding: 4px 12px; 
          border-radius: 16px; 
          font-size: 12px; 
          margin: 2px; 
          border: 1px solid #bfdbfe;
        }
        .insight-box { 
          background: #fef3c7; 
          border: 1px solid #f59e0b; 
          padding: 15px; 
          border-radius: 8px; 
          margin: 10px 0; 
        }
        .insight-box h4 { 
          color: #92400e; 
          margin-bottom: 8px; 
          font-size: 14px;
        }
        ul { padding-left: 20px; }
        li { margin: 8px 0; }
        .progress-bar {
          background: #e5e7eb;
          height: 8px;
          border-radius: 4px;
          overflow: hidden;
          margin: 5px 0;
        }
        .progress-fill {
          height: 100%;
          border-radius: 4px;
        }
        .positive { background: #10b981; }
        .negative { background: #ef4444; }
        .neutral { background: #6b7280; }
        @media print { 
          body { background: white; }
          .container { padding: 20px; }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo-placeholder">YOUR LOGO</div>
          <h1>Customer Avatar Report</h1>
          <p class="subtitle">${avatar.name || 'Complete Customer Profile'}</p>
          <p style="color: #6b7280; font-size: 14px; margin-top: 10px;">Generated on ${new Date().toLocaleDateString()}</p>
        </div>

        <div class="section">
          <h2>Executive Summary</h2>
          <p><strong>Avatar Name:</strong> ${avatar.name || 'Unnamed Avatar'}</p>
          <div class="grid">
            <div class="metric">
              <div class="metric-label">Primary Age Group</div>
              <div class="metric-value">${avatar.demographics.age || 'Not specified'}</div>
            </div>
            <div class="metric">
              <div class="metric-label">Income Level</div>
              <div class="metric-value">${avatar.demographics.income || 'Not specified'}</div>
            </div>
            <div class="metric">
              <div class="metric-label">Location</div>
              <div class="metric-value">${avatar.demographics.location || 'Not specified'}</div>
            </div>
            <div class="metric">
              <div class="metric-label">Lifestyle</div>
              <div class="metric-value">${avatar.demographics.lifestyle || 'Not specified'}</div>
            </div>
          </div>
        </div>

        <div class="section">
          <h2>🎯 Marketing Strategy Guidelines</h2>
          <h3>Core Values & Motivations</h3>
          <div>
            ${avatar.psychographics.values.map(value => `<span class="tag">${value}</span>`).join('')}
          </div>
          
          <h3>Pain Points to Address</h3>
          <ul>
            ${avatar.psychographics.fears.map(fear => `<li>${fear}</li>`).join('')}
          </ul>
          
          <h3>Desires & Aspirations</h3>
          <ul>
            ${avatar.psychographics.desires.map(desire => `<li>${desire}</li>`).join('')}
          </ul>
        </div>

        <div class="section">
          <h2>🛒 Buying Behavior Insights</h2>
          <div class="grid">
            <div>
              <h3>Purchase Intent</h3>
              <p>${avatar.buyingBehavior.intent || 'Not specified'}</p>
            </div>
            <div>
              <h3>Shopping Style</h3>
              <p>${avatar.buyingBehavior.shoppingStyle || 'Not specified'}</p>
            </div>
          </div>
          
          <h3>Key Decision Factors</h3>
          <div>
            ${avatar.buyingBehavior.decisionFactors.map(factor => `<span class="tag">${factor}</span>`).join('')}
          </div>
          
          <h3>Price Sensitivity</h3>
          <p>${avatar.buyingBehavior.priceConsciousness || 'Not specified'}</p>
        </div>

        ${analysisResults ? `
        <div class="section">
          <h2>📊 Voice of Customer Analysis</h2>
          
          <h3>Sentiment Breakdown</h3>
          <div style="margin: 15px 0;">
            <div style="display: flex; align-items: center; margin: 8px 0;">
              <span style="width: 80px; font-size: 12px;">Positive:</span>
              <div class="progress-bar" style="flex: 1; margin: 0 10px;">
                <div class="progress-fill positive" style="width: ${analysisResults.sentiment.positive}%"></div>
              </div>
              <span style="font-size: 12px;">${analysisResults.sentiment.positive}%</span>
            </div>
            <div style="display: flex; align-items: center; margin: 8px 0;">
              <span style="width: 80px; font-size: 12px;">Negative:</span>
              <div class="progress-bar" style="flex: 1; margin: 0 10px;">
                <div class="progress-fill negative" style="width: ${analysisResults.sentiment.negative}%"></div>
              </div>
              <span style="font-size: 12px;">${analysisResults.sentiment.negative}%</span>
            </div>
            <div style="display: flex; align-items: center; margin: 8px 0;">
              <span style="width: 80px; font-size: 12px;">Neutral:</span>
              <div class="progress-bar" style="flex: 1; margin: 0 10px;">
                <div class="progress-fill neutral" style="width: ${analysisResults.sentiment.neutral}%</div>
              </div>
              <span style="font-size: 12px;">${analysisResults.sentiment.neutral}%</span>
            </div>
          </div>

          <h3>Key Phrases</h3>
          <div>
            ${analysisResults.keyPhrases.map(phrase => `<span class="tag">${phrase}</span>`).join('')}
          </div>

          ${analysisResults.insights.length > 0 ? `
          <h3>Strategic Insights</h3>
          <ul>
            ${analysisResults.insights.map(insight => `<li>${insight}</li>`).join('')}
          </ul>
          ` : ''}
        </div>
        ` : ''}

        <div class="section">
          <h2>💡 Actionable Recommendations</h2>
          
          <div class="insight-box">
            <h4>🎨 Content Strategy</h4>
            <ul>
              <li>Create content addressing: ${avatar.psychographics.fears.slice(0, 2).join(', ')}</li>
              <li>Highlight outcomes: ${avatar.psychographics.desires.slice(0, 2).join(', ')}</li>
              <li>Use messaging that resonates with: ${avatar.psychographics.values.slice(0, 3).join(', ')}</li>
            </ul>
          </div>

          <div class="insight-box">
            <h4>🎯 Channel Recommendations</h4>
            <ul>
              <li>Focus on channels where ${avatar.demographics.age} ${avatar.demographics.lifestyle} consumers are active</li>
              <li>Tailor messaging for ${avatar.buyingBehavior.shoppingStyle} shopping behavior</li>
              <li>Consider ${avatar.buyingBehavior.priceConsciousness} pricing strategies</li>
            </ul>
          </div>

          <div class="insight-box">
            <h4>🔄 Optimization Tips</h4>
            <ul>
              <li>A/B test messaging focused on top decision factors</li>
              <li>Monitor engagement with content addressing key pain points</li>
              <li>Track conversion rates by emphasizing core desires</li>
            </ul>
          </div>
        </div>

        <div class="section">
          <h2>📈 Implementation Checklist</h2>
          <ul style="list-style: none; padding-left: 0;">
            <li>☐ Update website copy to address key pain points</li>
            <li>☐ Create content calendar targeting core desires</li>
            <li>☐ Optimize ad targeting based on demographics</li>
            <li>☐ Review pricing strategy for price consciousness level</li>
            <li>☐ Test messaging variants for key values</li>
            <li>☐ Implement feedback collection system</li>
            <li>☐ Set up analytics tracking for avatar-specific metrics</li>
          </ul>
        </div>

        <div style="text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 12px;">
          <p>This report was generated using advanced customer avatar analysis</p>
          <p>For best results, update avatar data quarterly based on new customer insights</p>
        </div>
      </div>
    </body>
    </html>`;
  };

  // Preview component for showing the layout
  return (
    <div className="w-full">
      <div ref={contentRef} className="bg-background border rounded-lg p-6 mb-6">
        <div className="text-center border-b pb-6 mb-6">
          <div className="w-24 h-12 bg-gradient-to-r from-primary to-purple-600 rounded-lg mx-auto mb-4 flex items-center justify-center text-primary-foreground text-xs font-bold">
            YOUR LOGO
          </div>
          <h1 className="text-2xl font-bold text-primary mb-2">Customer Avatar Report</h1>
          <p className="text-muted-foreground">{avatar.name || 'Complete Customer Profile'}</p>
        </div>

        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              Executive Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Age Group</p>
                <p className="font-semibold">{avatar.demographics.age || 'Not specified'}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Income Level</p>
                <p className="font-semibold">{avatar.demographics.income || 'Not specified'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="w-5 h-5" />
              Marketing Strategy Guidelines
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-medium mb-2">Core Values</h4>
              <div className="flex flex-wrap gap-1">
                {avatar.psychographics.values.map((value, index) => (
                  <span key={index} className="bg-primary/10 text-primary px-2 py-1 rounded-full text-xs">
                    {value}
                  </span>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5" />
              Buying Behavior Insights
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p><strong>Shopping Style:</strong> {avatar.buyingBehavior.shoppingStyle || 'Not specified'}</p>
              <p><strong>Price Consciousness:</strong> {avatar.buyingBehavior.priceConsciousness || 'Not specified'}</p>
            </div>
          </CardContent>
        </Card>

        {analysisResults && (
          <Card className="mb-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5" />
                Voice of Customer Analysis
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs w-16">Positive:</span>
                  <div className="flex-1 bg-secondary/20 rounded-full h-2">
                    <div 
                      className="bg-green-500 h-2 rounded-full" 
                      style={{ width: `${analysisResults.sentiment.positive}%` }}
                    />
                  </div>
                  <span className="text-xs">{analysisResults.sentiment.positive}%</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="w-5 h-5" />
              Actionable Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <h4 className="font-medium text-amber-800 mb-2">Content Strategy</h4>
              <ul className="text-sm text-amber-700 space-y-1">
                <li>• Address key pain points in messaging</li>
                <li>• Highlight desired outcomes</li>
                <li>• Align with core values</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>

      <Button 
        onClick={handleExport}
        className="w-full"
        size="lg"
      >
        <Download className="w-4 h-4 mr-2" />
        Export Professional PDF Report
      </Button>
    </div>
  );
};