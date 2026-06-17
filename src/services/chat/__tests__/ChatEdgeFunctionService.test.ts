import { describe, it, expect } from 'vitest';
import { ChatEdgeFunctionService, ConsultantRequestParams } from '../ChatEdgeFunctionService';

const base: ConsultantRequestParams = {
  message: 'hello',
  productContext: null,
  hasUploadedDocuments: false,
};

describe('ChatEdgeFunctionService.buildRequestBody — tool_loop', () => {
  const svc = new ChatEdgeFunctionService();

  it('sets tool_loop:true when the PostHog flag (toolLoop) is on', () => {
    expect(svc.buildRequestBody({ ...base, toolLoop: true }).tool_loop).toBe(true);
  });

  it('sets tool_loop:false when toolLoop is off', () => {
    expect(svc.buildRequestBody({ ...base, toolLoop: false }).tool_loop).toBe(false);
  });

  it('defaults tool_loop:false when toolLoop is omitted', () => {
    expect(svc.buildRequestBody(base).tool_loop).toBe(false);
  });
});
