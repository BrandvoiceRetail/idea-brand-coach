/**
 * GroundedStrip tests — proves the provenance strip is props-driven and honest:
 * present fields are listed, missing fields are flagged "may drift", and an empty
 * field list renders the honest "not grounded yet" state (never a fake checkmark).
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GroundedStrip } from '../GroundedStrip';

describe('GroundedStrip', () => {
  it('lists present fields under "Grounded in"', () => {
    render(
      <GroundedStrip
        fields={[
          { label: 'Signature', present: true },
          { label: 'Avatar', present: true },
        ]}
      />,
    );
    const strip = screen.getByTestId('v4-grounded-strip');
    expect(strip).toHaveAttribute('data-grounded', 'fields');
    expect(strip).toHaveTextContent(/Grounded in/i);
    expect(strip).toHaveTextContent(/Signature/);
    expect(strip).toHaveTextContent(/Avatar/);
  });

  it('flags a missing field with its drift note', () => {
    render(
      <GroundedStrip
        fields={[{ label: 'Core message', present: false, note: 'unclear — output may drift' }]}
      />,
    );
    expect(screen.getByTestId('v4-grounded-strip')).toHaveTextContent(/may drift/i);
  });

  it('falls back to a default drift message when a missing field has no note', () => {
    render(<GroundedStrip fields={[{ label: 'Positioning', present: false }]} />);
    expect(screen.getByTestId('v4-grounded-strip')).toHaveTextContent(/missing, output may drift/i);
  });

  it('renders the honest "not grounded yet" state for an empty field list', () => {
    render(<GroundedStrip fields={[]} />);
    const strip = screen.getByTestId('v4-grounded-strip');
    expect(strip).toHaveAttribute('data-grounded', 'empty');
    expect(strip).toHaveTextContent(/not grounded in any brand fields yet/i);
  });
});
