# Synthesis Prompt - Multi-Domain Response Aggregator

**Status:** ⏳ In Progress
**Domain:** Multi-Domain Response Aggregation
**Tools:** None (receives outputs from specialized prompts)
**Output Format:** Natural language response
**Last Updated:** 2025-11-15

---

## Overview

The Synthesis Prompt is the third stage of the IDEA Brand Coach chatbot's multi-stage processing flow (when multiple domains are involved). It receives responses from 2-3 specialized domain prompts and combines them into a single, cohesive answer.

**Key Capabilities:**
- Combines multiple domain perspectives into unified response
- Eliminates redundancy and maintains consistency
- Offers user options to explore specific domains deeper
- Maintains context from all domain responses

---

## Complete Prompt Definition

[To be built using 7-step framework]

---

## Implementation Notes

### System Integration

```python
# Example: Using the Synthesis Prompt
def synthesize_responses(domain_responses, original_query):
    """
    Combines multiple domain responses into cohesive answer

    Args:
        domain_responses: List of dicts with domain and response
            [{"domain": "avatar", "response": "..."},
             {"domain": "capture", "response": "..."}]
        original_query: User's original question

    Returns: Synthesized response string
    """
    synthesis_context = f"""
    Original User Question: {original_query}

    Domain Responses:
    {format_domain_responses(domain_responses)}

    Synthesize these responses into a comprehensive, cohesive answer.
    """

    # Call synthesis prompt...
```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| - | - | Not yet implemented |

---

**Related Prompts:**
- [Router Prompt](./router-prompt.md) - Routes to multiple domains
- [Diagnostic Prompt](./diagnostic-prompt.md) - Brand assessment
- [Avatar Prompt](./avatar-prompt.md) - Customer personas
- [Canvas Prompt](./canvas-prompt.md) - Business models
- [CAPTURE Prompt](./capture-prompt.md) - Marketing strategy
- [Core Prompt](./core-prompt.md) - Brand foundations
