/**
 * ChapterProgress Component Tests
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ChapterProgress } from './ChapterProgress';
import { DEFAULT_BOOK_STRUCTURE } from '@/types/chapter';

describe('ChapterProgress', () => {
  const mockChapter = DEFAULT_BOOK_STRUCTURE.chapters[0]; // Chapter 1

  it('should render chapter number and title', () => {
    render(
      <ChapterProgress
        currentChapter={mockChapter}
        totalChapters={11}
        completedChapters={0}
      />
    );

    expect(screen.getByText(/Chapter 1 of 11/i)).toBeInTheDocument();
    expect(screen.getByText(mockChapter.title)).toBeInTheDocument();
  });

  it('should render progress bar with correct percentage', () => {
    render(
      <ChapterProgress
        currentChapter={mockChapter}
        totalChapters={11}
        completedChapters={3}
      />
    );

    expect(screen.getByText(/3 of 11 chapters completed/i)).toBeInTheDocument();
    expect(screen.getByText(/27%/i)).toBeInTheDocument();
  });

  it('should render description when showDescription is true', () => {
    render(
      <ChapterProgress
        currentChapter={mockChapter}
        totalChapters={11}
        completedChapters={0}
        showDescription={true}
      />
    );

    expect(screen.getByText(mockChapter.description)).toBeInTheDocument();
  });

  it('should not render description when showDescription is false', () => {
    render(
      <ChapterProgress
        currentChapter={mockChapter}
        totalChapters={11}
        completedChapters={0}
        showDescription={false}
      />
    );

    expect(screen.queryByText(mockChapter.description)).not.toBeInTheDocument();
  });

  it('should render in compact mode', () => {
    render(
      <ChapterProgress
        currentChapter={mockChapter}
        totalChapters={11}
        completedChapters={0}
        compact={true}
      />
    );

    // In compact mode, should still show chapter number and title
    expect(screen.getByText(/Chapter 1 of 11/i)).toBeInTheDocument();
    expect(screen.getByText(mockChapter.title)).toBeInTheDocument();
  });

  it('should display category color', () => {
    render(
      <ChapterProgress
        currentChapter={mockChapter}
        totalChapters={11}
        completedChapters={0}
      />
    );

    expect(screen.getByText(mockChapter.category)).toBeInTheDocument();
  });

  it('should handle different chapters correctly', () => {
    const chapter5 = DEFAULT_BOOK_STRUCTURE.chapters[4]; // Chapter 5
    render(
      <ChapterProgress
        currentChapter={chapter5}
        totalChapters={11}
        completedChapters={4}
      />
    );

    expect(screen.getByText(/Chapter 5 of 11/i)).toBeInTheDocument();
    expect(screen.getByText(chapter5.title)).toBeInTheDocument();
    expect(screen.getByText(/4 of 11 chapters completed/i)).toBeInTheDocument();
  });

  it('should calculate progress percentage correctly', () => {
    render(
      <ChapterProgress
        currentChapter={mockChapter}
        totalChapters={11}
        completedChapters={5}
      />
    );

    // 5/11 = 45.45%, rounds to 45%
    expect(screen.getByText(/45%/i)).toBeInTheDocument();
  });

  it('should show 100% when all chapters completed', () => {
    render(
      <ChapterProgress
        currentChapter={DEFAULT_BOOK_STRUCTURE.chapters[10]} // Last chapter
        totalChapters={11}
        completedChapters={11}
      />
    );

    expect(screen.getByText(/11 of 11 chapters completed/i)).toBeInTheDocument();
    expect(screen.getByText(/100%/i)).toBeInTheDocument();
  });
});
