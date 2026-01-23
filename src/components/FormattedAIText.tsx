import React from 'react';

interface FormattedAITextProps {
  text: string;
  className?: string;
}

/**
 * Formats AI-generated text with proper styling for:
 * - Paragraphs (double line breaks)
 * - Bullet points (lines starting with - or •)
 * - Numbered lists (lines starting with 1. 2. etc)
 */
export function FormattedAIText({ text, className = '' }: FormattedAITextProps): JSX.Element {
  if (!text) return <></>;

  // Split into paragraphs (double newline or single newline followed by list item)
  const blocks = text.split(/\n\n+/);

  const renderBlock = (block: string, blockIndex: number): JSX.Element => {
    const lines = block.split('\n').filter(line => line.trim());

    // Check if this block is a list
    const isBulletList = lines.every(line => /^[-•]\s/.test(line.trim()));
    const isNumberedList = lines.every(line => /^\d+[.)]\s/.test(line.trim()));

    if (isBulletList) {
      return (
        <ul key={blockIndex} className="list-disc list-outside ml-4 space-y-1.5 my-2">
          {lines.map((line, i) => (
            <li key={i} className="text-sm leading-relaxed pl-1">
              {line.replace(/^[-•]\s*/, '').trim()}
            </li>
          ))}
        </ul>
      );
    }

    if (isNumberedList) {
      return (
        <ol key={blockIndex} className="list-decimal list-outside ml-4 space-y-1.5 my-2">
          {lines.map((line, i) => (
            <li key={i} className="text-sm leading-relaxed pl-1">
              {line.replace(/^\d+[.)]\s*/, '').trim()}
            </li>
          ))}
        </ol>
      );
    }

    // Check for mixed content (paragraph with inline list)
    const hasMixedContent = lines.some(line => /^[-•]\s/.test(line.trim()) || /^\d+[.)]\s/.test(line.trim()));

    if (hasMixedContent) {
      return (
        <div key={blockIndex} className="space-y-2 my-2">
          {lines.map((line, i) => {
            const trimmed = line.trim();
            if (/^[-•]\s/.test(trimmed)) {
              return (
                <div key={i} className="flex items-start gap-2 ml-2">
                  <span className="text-primary mt-1.5 text-xs">•</span>
                  <span className="text-sm leading-relaxed">{trimmed.replace(/^[-•]\s*/, '')}</span>
                </div>
              );
            }
            if (/^\d+[.)]\s/.test(trimmed)) {
              const num = trimmed.match(/^(\d+)[.)]/)?.[1];
              return (
                <div key={i} className="flex items-start gap-2 ml-2">
                  <span className="text-primary text-sm font-medium min-w-[1.25rem]">{num}.</span>
                  <span className="text-sm leading-relaxed">{trimmed.replace(/^\d+[.)]\s*/, '')}</span>
                </div>
              );
            }
            return (
              <p key={i} className="text-sm leading-relaxed">
                {trimmed}
              </p>
            );
          })}
        </div>
      );
    }

    // Regular paragraph
    return (
      <p key={blockIndex} className="text-sm leading-relaxed my-2 first:mt-0 last:mb-0">
        {block.trim()}
      </p>
    );
  };

  return (
    <div className={`space-y-1 ${className}`}>
      {blocks.map((block, index) => renderBlock(block, index))}
    </div>
  );
}
