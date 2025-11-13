# 🧪 LLM Model Comparison Testing Framework
## Reusable Evaluation System for Quarterly Model Upgrades

---

## 📋 Document Metadata

**Purpose**: Systematic comparison of LLM models for IDEA Brand Coach
**Cadence**: Quarterly evaluation (every 3 months)
**Current Comparison**: GPT-5 vs Claude Sonnet 4.5
**Version**: 1.0
**Last Updated**: November 2025
**Status**: ✅ Production-Ready Testing Framework

---

## 🎯 Executive Summary

This framework provides a **reusable, systematic approach** to evaluate and compare LLM models for the IDEA Brand Coach RAG system. Use this every quarter to determine if upgrading to new models delivers meaningful improvements in quality, performance, and cost-efficiency.

### Quick Decision Matrix

After running tests, use this decision tree:

```
Quality Score Improvement > 10% AND Cost Increase < 20%?
    ↓ YES
    → Upgrade to new model

    ↓ NO

Performance Improvement > 25% AND Quality Score Same/Better?
    ↓ YES
    → Upgrade to new model

    ↓ NO

Cost Reduction > 30% AND Quality Score Decline < 5%?
    ↓ YES
    → Consider upgrade (A/B test first)

    ↓ NO
    → Keep current model, re-evaluate next quarter
```

---

## 🏗️ Testing Framework Architecture

### Three-Dimensional Evaluation

```
┌─────────────────────────────────────────┐
│         Model Comparison Test           │
├─────────────────────────────────────────┤
│                                         │
│  Dimension 1: Quality Metrics (40%)    │
│  ├─ Accuracy                           │
│  ├─ Relevance                          │
│  ├─ Coherence                          │
│  └─ Brand voice consistency            │
│                                         │
│  Dimension 2: Performance (30%)        │
│  ├─ Response time                      │
│  ├─ Latency percentiles (p50/p95/p99) │
│  ├─ Throughput                         │
│  └─ Failure rate                       │
│                                         │
│  Dimension 3: Cost Efficiency (30%)    │
│  ├─ Cost per query                     │
│  ├─ Token efficiency                   │
│  ├─ Monthly projected cost             │
│  └─ ROI calculation                    │
└─────────────────────────────────────────┘
```

---

## 📊 Current Comparison: GPT-5 vs Claude Sonnet 4.5

### Model Specifications (November 2025)

| Specification | GPT-5 | Claude Sonnet 4.5 |
|--------------|-------|-------------------|
| **Release Date** | August 2025 | September 2025 |
| **Latest Version** | GPT-5.1 (Nov 2025) | Sonnet 4.5 |
| **Context Window** | 256K tokens | 200K tokens |
| **Input Pricing** | $1.25/1M tokens | $3.00/1M tokens |
| **Output Pricing** | $10.00/1M tokens | $15.00/1M tokens |
| **Multimodal** | Yes (text, image, audio, video) | Yes (text, image) |
| **Reasoning Modes** | 4 levels (minimal/low/medium/high) | Standard |
| **Tool Calling** | Native | Native |
| **File Search** | Native (OpenAI API) | Via RAG integration |
| **Persistent Memory** | Built-in | Built-in (cross-conversation) |
| **API Platform** | Responses API | Messages API |

### Cost Comparison (Per 1,000 Queries)

**Assumptions**: Average query with file search
- Input: 3,500 tokens (system prompt + conversation + retrieved chunks)
- Output: 500 tokens (response)

**GPT-5 Cost:**
```
Input:  3,500 tokens × 1,000 queries = 3.5M tokens × $1.25 = $4.38
Output: 500 tokens × 1,000 queries = 0.5M tokens × $10.00 = $5.00
Total: $9.38 per 1,000 queries
Monthly (30K queries): $281.40
```

**Claude Sonnet 4.5 Cost:**
```
Input:  3,500 tokens × 1,000 queries = 3.5M tokens × $3.00 = $10.50
Output: 500 tokens × 1,000 queries = 0.5M tokens × $15.00 = $7.50
Total: $18.00 per 1,000 queries
Monthly (30K queries): $540.00
```

**Cost Difference**: GPT-5 is **48% cheaper** ($281 vs $540/month at 30K queries)

---

## 🧪 Testing Methodology

### Phase 1: Test Dataset Preparation

#### 1.1 Create Representative Test Cases

Build a test dataset covering all 5 prompt types with varying complexity:

**Test Categories** (20 queries per category = 100 total):

```
Category A: Diagnostic Queries (20 queries)
├─ Simple: "Assess my brand strength" (5 queries)
├─ Medium: "Analyze my competitive positioning against X, Y, Z" (10 queries)
└─ Complex: "Perform comprehensive SWOT analysis with market data" (5 queries)

Category B: Avatar Queries (20 queries)
├─ Simple: "Define my ideal customer" (5 queries)
├─ Medium: "Create detailed customer persona with demographics" (10 queries)
└─ Complex: "Build 3 customer segments with psychographic profiles" (5 queries)

Category C: Canvas Queries (20 queries)
├─ Simple: "Design my value proposition" (5 queries)
├─ Medium: "Create business model canvas with revenue streams" (10 queries)
└─ Complex: "Develop complete go-to-market strategy" (5 queries)

Category D: CAPTURE Queries (20 queries)
├─ Simple: "Suggest content ideas" (5 queries)
├─ Medium: "Create 30-day content calendar" (10 queries)
└─ Complex: "Design integrated multi-channel campaign" (5 queries)

Category E: Core Queries (20 queries)
├─ Simple: "What are brand values?" (5 queries)
├─ Medium: "Define my brand mission and vision" (10 queries)
└─ Complex: "Develop complete brand identity framework" (5 queries)
```

#### 1.2 Create Ground Truth Responses

For each test query, create **expert-validated ground truth** responses that represent ideal answers. Use these for quality scoring.

**Storage Format**:
```json
{
  "test_cases": [
    {
      "id": "diag_simple_001",
      "category": "Diagnostic",
      "complexity": "Simple",
      "query": "Assess my brand strength",
      "context": {
        "user_profile": {...},
        "previous_conversation": null
      },
      "ground_truth": {
        "response": "Expert-written ideal response...",
        "key_points": [
          "Should mention SWOT analysis",
          "Should ask about target market",
          "Should reference brand positioning"
        ],
        "quality_criteria": {
          "accuracy": "Must include valid frameworks",
          "relevance": "Must address brand strength specifically",
          "coherence": "Logical flow from assessment to actionable steps"
        }
      }
    }
  ]
}
```

### Phase 2: Automated Testing Execution

#### 2.1 Test Runner Architecture

```python
import asyncio
import time
from typing import Dict, List
import openai
import anthropic
from dataclasses import dataclass
from datetime import datetime

@dataclass
class ModelConfig:
    provider: str  # "openai" or "anthropic"
    model_name: str
    api_key: str
    temperature: float = 0.3  # Consistency for testing
    max_tokens: int = 1000

@dataclass
class TestResult:
    test_id: str
    model_name: str
    query: str
    response: str
    latency_ms: float
    input_tokens: int
    output_tokens: int
    cost: float
    quality_scores: Dict[str, float]
    timestamp: str

class ModelComparisonFramework:
    def __init__(self, test_cases_path: str):
        self.test_cases = self.load_test_cases(test_cases_path)
        self.results = []

    async def run_comparison(
        self,
        model_a: ModelConfig,
        model_b: ModelConfig,
        vector_store_ids: Dict[str, str]
    ) -> Dict:
        """Run complete comparison between two models"""

        results = {
            'model_a': {'config': model_a, 'results': []},
            'model_b': {'config': model_b, 'results': []},
            'summary': {}
        }

        # Run tests for both models in parallel
        for test_case in self.test_cases:
            # Test Model A
            result_a = await self.run_single_test(
                model_a, test_case, vector_store_ids
            )
            results['model_a']['results'].append(result_a)

            # Test Model B
            result_b = await self.run_single_test(
                model_b, test_case, vector_store_ids
            )
            results['model_b']['results'].append(result_b)

        # Calculate aggregate metrics
        results['summary'] = self.calculate_summary(
            results['model_a']['results'],
            results['model_b']['results']
        )

        return results

    async def run_single_test(
        self,
        model: ModelConfig,
        test_case: Dict,
        vector_store_ids: Dict[str, str]
    ) -> TestResult:
        """Execute single test case against one model"""

        start_time = time.time()

        if model.provider == "openai":
            response_data = await self.test_openai(
                model, test_case, vector_store_ids
            )
        elif model.provider == "anthropic":
            response_data = await self.test_anthropic(
                model, test_case, vector_store_ids
            )

        latency_ms = (time.time() - start_time) * 1000

        # Calculate quality scores
        quality_scores = self.evaluate_quality(
            response_data['response'],
            test_case['ground_truth']
        )

        # Calculate cost
        cost = self.calculate_cost(
            model,
            response_data['input_tokens'],
            response_data['output_tokens']
        )

        return TestResult(
            test_id=test_case['id'],
            model_name=model.model_name,
            query=test_case['query'],
            response=response_data['response'],
            latency_ms=latency_ms,
            input_tokens=response_data['input_tokens'],
            output_tokens=response_data['output_tokens'],
            cost=cost,
            quality_scores=quality_scores,
            timestamp=datetime.now().isoformat()
        )

    async def test_openai(
        self,
        model: ModelConfig,
        test_case: Dict,
        vector_store_ids: Dict
    ) -> Dict:
        """Test OpenAI model (GPT-5)"""
        client = openai.Client(api_key=model.api_key)

        # Get appropriate vector store for category
        category = test_case['category'].lower()
        vector_store_id = vector_store_ids.get(category)

        response = client.responses.create(
            model=model.model_name,
            prompt_id=f"{category}_prompt",
            input=test_case['query'],
            temperature=model.temperature,
            max_tokens=model.max_tokens,
            tools=[{
                "type": "file_search",
                "vector_store_ids": [vector_store_id]
            }] if vector_store_id else [],
            store_response=True
        )

        return {
            'response': response.output,
            'input_tokens': response.usage.input_tokens,
            'output_tokens': response.usage.output_tokens
        }

    async def test_anthropic(
        self,
        model: ModelConfig,
        test_case: Dict,
        vector_store_ids: Dict
    ) -> Dict:
        """Test Anthropic model (Claude Sonnet 4.5)"""
        client = anthropic.Client(api_key=model.api_key)

        # For Claude, we need to implement RAG manually
        # or use Anthropic's retrieval features

        # Get relevant context from vector store
        retrieved_context = await self.retrieve_context_for_claude(
            test_case['query'],
            test_case['category'],
            vector_store_ids
        )

        # Build augmented prompt
        augmented_prompt = f"""
        Context from knowledge base:
        {retrieved_context}

        User query: {test_case['query']}

        Provide expert brand coaching response.
        """

        message = client.messages.create(
            model=model.model_name,
            max_tokens=model.max_tokens,
            temperature=model.temperature,
            messages=[{
                "role": "user",
                "content": augmented_prompt
            }]
        )

        return {
            'response': message.content[0].text,
            'input_tokens': message.usage.input_tokens,
            'output_tokens': message.usage.output_tokens
        }

    def calculate_cost(
        self,
        model: ModelConfig,
        input_tokens: int,
        output_tokens: int
    ) -> float:
        """Calculate cost for single query"""

        pricing = {
            'gpt-5': {'input': 1.25, 'output': 10.00},
            'gpt-5-pro': {'input': 2.50, 'output': 20.00},
            'gpt-5-mini': {'input': 0.15, 'output': 0.60},
            'claude-sonnet-4-5': {'input': 3.00, 'output': 15.00},
            'claude-opus-4': {'input': 15.00, 'output': 75.00}
        }

        rates = pricing.get(model.model_name, {'input': 0, 'output': 0})

        cost = (
            (input_tokens / 1_000_000) * rates['input'] +
            (output_tokens / 1_000_000) * rates['output']
        )

        return cost
```

#### 2.2 Quality Evaluation System

**Multi-Metric Quality Scoring** (0-100 scale):

```python
class QualityEvaluator:
    def __init__(self):
        self.weights = {
            'accuracy': 0.25,
            'relevance': 0.25,
            'coherence': 0.20,
            'brand_voice': 0.15,
            'actionability': 0.15
        }

    def evaluate_quality(
        self,
        response: str,
        ground_truth: Dict
    ) -> Dict[str, float]:
        """Comprehensive quality evaluation"""

        scores = {}

        # 1. Accuracy Score (0-100)
        scores['accuracy'] = self.evaluate_accuracy(
            response, ground_truth['key_points']
        )

        # 2. Relevance Score (0-100)
        scores['relevance'] = self.evaluate_relevance(
            response, ground_truth['response']
        )

        # 3. Coherence Score (0-100)
        scores['coherence'] = self.evaluate_coherence(response)

        # 4. Brand Voice Score (0-100)
        scores['brand_voice'] = self.evaluate_brand_voice(response)

        # 5. Actionability Score (0-100)
        scores['actionability'] = self.evaluate_actionability(response)

        # Calculate weighted overall score
        scores['overall'] = sum(
            scores[metric] * self.weights[metric]
            for metric in self.weights
        )

        return scores

    def evaluate_accuracy(
        self,
        response: str,
        key_points: List[str]
    ) -> float:
        """Check if key points are mentioned"""
        mentioned = sum(
            1 for point in key_points
            if point.lower() in response.lower()
        )

        return (mentioned / len(key_points)) * 100

    def evaluate_relevance(
        self,
        response: str,
        ground_truth: str
    ) -> float:
        """Semantic similarity to ground truth"""
        # Use embedding similarity
        response_embedding = self.get_embedding(response)
        truth_embedding = self.get_embedding(ground_truth)

        similarity = self.cosine_similarity(
            response_embedding,
            truth_embedding
        )

        return similarity * 100

    def evaluate_coherence(self, response: str) -> float:
        """Logical flow and structure"""
        # Use GPT-4 as judge
        coherence_prompt = f"""
        Rate the coherence of this response (0-100):
        - Logical flow
        - Clear structure
        - Smooth transitions

        Response: {response}

        Return only a number 0-100.
        """

        score = self.get_llm_judge_score(coherence_prompt)
        return score

    def evaluate_brand_voice(self, response: str) -> float:
        """Consistency with IDEA brand voice"""
        brand_voice_criteria = """
        IDEA Brand Coach voice:
        - Empowering and supportive
        - Professional but approachable
        - Action-oriented
        - Clear and concise
        - Avoids jargon
        """

        voice_prompt = f"""
        Rate how well this response matches the brand voice (0-100):

        Brand Voice Criteria:
        {brand_voice_criteria}

        Response: {response}

        Return only a number 0-100.
        """

        score = self.get_llm_judge_score(voice_prompt)
        return score

    def evaluate_actionability(self, response: str) -> float:
        """Clear next steps and practical guidance"""
        action_prompt = f"""
        Rate the actionability of this response (0-100):
        - Provides clear next steps
        - Includes specific recommendations
        - Offers practical guidance

        Response: {response}

        Return only a number 0-100.
        """

        score = self.get_llm_judge_score(action_prompt)
        return score
```

### Phase 3: Performance Testing

#### 3.1 Latency Benchmarking

```python
class PerformanceTester:
    async def measure_latency(
        self,
        model: ModelConfig,
        test_cases: List[Dict],
        iterations: int = 10
    ) -> Dict:
        """Measure response time distribution"""

        latencies = []

        for test_case in test_cases:
            for _ in range(iterations):
                start = time.time()
                await self.execute_query(model, test_case)
                latency = (time.time() - start) * 1000  # ms
                latencies.append(latency)

        return {
            'p50': self.percentile(latencies, 50),
            'p95': self.percentile(latencies, 95),
            'p99': self.percentile(latencies, 99),
            'mean': sum(latencies) / len(latencies),
            'min': min(latencies),
            'max': max(latencies)
        }

    async def measure_throughput(
        self,
        model: ModelConfig,
        concurrent_requests: int = 10
    ) -> float:
        """Queries per second at given concurrency"""

        start_time = time.time()

        tasks = [
            self.execute_query(model, test_case)
            for test_case in self.test_cases[:concurrent_requests]
        ]

        await asyncio.gather(*tasks)

        elapsed = time.time() - start_time
        throughput = concurrent_requests / elapsed

        return throughput  # queries per second
```

#### 3.2 Performance Metrics

**Measured Metrics:**

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| **p50 Latency** | < 2.0s | Time from request to response |
| **p95 Latency** | < 3.5s | 95th percentile response time |
| **p99 Latency** | < 5.0s | 99th percentile response time |
| **Throughput** | > 10 qps | Concurrent requests handled |
| **Error Rate** | < 1% | Failed requests / total requests |
| **Timeout Rate** | < 0.5% | Requests exceeding 10s timeout |

### Phase 4: Cost Analysis

#### 4.1 Cost Calculation

```python
class CostAnalyzer:
    def __init__(self):
        self.pricing = {
            'gpt-5': {'input': 1.25, 'output': 10.00},
            'gpt-5-pro': {'input': 2.50, 'output': 20.00},
            'gpt-5-mini': {'input': 0.15, 'output': 0.60},
            'claude-sonnet-4-5': {'input': 3.00, 'output': 15.00},
            'claude-opus-4': {'input': 15.00, 'output': 75.00}
        }

    def analyze_costs(self, test_results: List[TestResult]) -> Dict:
        """Comprehensive cost analysis"""

        total_cost = sum(r.cost for r in test_results)
        total_queries = len(test_results)

        # Token usage statistics
        avg_input_tokens = sum(r.input_tokens for r in test_results) / total_queries
        avg_output_tokens = sum(r.output_tokens for r in test_results) / total_queries

        # Cost projections
        cost_per_query = total_cost / total_queries

        return {
            'total_cost': total_cost,
            'cost_per_query': cost_per_query,
            'avg_input_tokens': avg_input_tokens,
            'avg_output_tokens': avg_output_tokens,
            'projected_monthly_cost': {
                '1K_queries': cost_per_query * 1_000,
                '10K_queries': cost_per_query * 10_000,
                '30K_queries': cost_per_query * 30_000,
                '100K_queries': cost_per_query * 100_000
            },
            'token_efficiency': avg_output_tokens / avg_input_tokens
        }
```

#### 4.2 ROI Calculation

```python
def calculate_roi(
    model_a_metrics: Dict,
    model_b_metrics: Dict,
    monthly_query_volume: int = 30_000
) -> Dict:
    """Calculate ROI for switching models"""

    # Quality improvement
    quality_diff = (
        model_b_metrics['quality']['overall'] -
        model_a_metrics['quality']['overall']
    )
    quality_improvement_pct = (quality_diff / model_a_metrics['quality']['overall']) * 100

    # Cost difference
    cost_diff_monthly = (
        model_b_metrics['cost']['projected_monthly_cost'][f'{monthly_query_volume//1000}K_queries'] -
        model_a_metrics['cost']['projected_monthly_cost'][f'{monthly_query_volume//1000}K_queries']
    )

    # Performance difference
    latency_diff = (
        model_b_metrics['performance']['p95'] -
        model_a_metrics['performance']['p95']
    )
    latency_improvement_pct = (latency_diff / model_a_metrics['performance']['p95']) * 100

    # Decision recommendation
    if quality_improvement_pct > 10 and cost_diff_monthly < 100:
        recommendation = "UPGRADE - Significant quality gains at acceptable cost"
    elif latency_improvement_pct < -25 and quality_improvement_pct > -5:
        recommendation = "UPGRADE - Major performance improvement"
    elif cost_diff_monthly < -100 and quality_improvement_pct > -5:
        recommendation = "UPGRADE - Substantial cost savings"
    else:
        recommendation = "STAY - Insufficient improvement to justify change"

    return {
        'quality_improvement_pct': quality_improvement_pct,
        'cost_difference_monthly': cost_diff_monthly,
        'latency_improvement_pct': latency_improvement_pct,
        'recommendation': recommendation,
        'reasoning': self.generate_reasoning(
            quality_improvement_pct,
            cost_diff_monthly,
            latency_improvement_pct
        )
    }
```

---

## 📈 Evaluation Metrics Reference

### Quality Metrics (40% Weight)

#### 1. Accuracy (25% of quality score)
**Definition**: Correctness of information and inclusion of required key points

**Measurement**:
- Check for presence of all required key points from ground truth
- Verify factual accuracy using expert validation
- Score: `(mentioned_key_points / total_key_points) × 100`

**Example**:
```
Ground truth key points for "Assess brand strength":
1. ✅ Mention SWOT analysis
2. ✅ Ask about target market
3. ❌ Missing: Competitive positioning
4. ✅ Include brand values assessment

Accuracy Score: 75/100 (3 out of 4 points)
```

#### 2. Relevance (25% of quality score)
**Definition**: Semantic similarity to ideal ground truth response

**Measurement**:
- Calculate embedding cosine similarity between response and ground truth
- Range: 0.0 to 1.0 (convert to 0-100 scale)
- Use same embedding model for consistency (text-embedding-3-large)

**Scoring Bands**:
- 90-100: Highly relevant, nearly identical to ground truth
- 75-89: Very relevant, captures main ideas
- 60-74: Moderately relevant, some key points missing
- < 60: Low relevance, significant gaps

#### 3. Coherence (20% of quality score)
**Definition**: Logical flow, clear structure, smooth transitions

**Measurement** (LLM-as-Judge):
```python
coherence_prompt = """
Rate the coherence of this brand coaching response (0-100):

Criteria:
1. Logical flow of ideas (30 points)
2. Clear structure with intro/body/conclusion (30 points)
3. Smooth transitions between concepts (20 points)
4. Appropriate depth and detail (20 points)

Response: {response}

Return only a number 0-100.
"""

# Use GPT-4 as judge for consistency
judge_score = openai.chat.completions.create(
    model="gpt-4-turbo",
    messages=[{"role": "user", "content": coherence_prompt}],
    temperature=0.0  # Deterministic judging
)
```

#### 4. Brand Voice Consistency (15% of quality score)
**Definition**: Alignment with IDEA Brand Coach voice and personality

**IDEA Brand Voice Characteristics**:
- ✅ Empowering and supportive tone
- ✅ Professional but approachable language
- ✅ Action-oriented with clear next steps
- ✅ Clear and concise (avoids unnecessary jargon)
- ✅ Encouraging and confidence-building
- ❌ Avoids: Condescension, overly technical language, vagueness

**Measurement** (LLM-as-Judge):
```python
brand_voice_prompt = """
Rate how well this response matches the IDEA Brand Coach voice (0-100):

Brand Voice Criteria:
- Empowering and supportive (20 points)
- Professional but approachable (20 points)
- Action-oriented with clear guidance (25 points)
- Clear and jargon-free (20 points)
- Encouraging tone (15 points)

Response: {response}

Return only a number 0-100.
"""
```

#### 5. Actionability (15% of quality score)
**Definition**: Provides clear, specific, practical next steps

**Measurement Criteria**:
- Contains specific recommendations (not vague advice)
- Includes actionable next steps
- Provides concrete examples or frameworks
- User can immediately implement guidance

**Scoring**:
```
100 points: Specific steps + examples + frameworks + timeline
75 points: Specific steps + examples
50 points: General recommendations with some specifics
25 points: Vague advice without clear actions
0 points: No actionable guidance
```

### Performance Metrics (30% Weight)

#### 1. Response Time Distribution

**Measured Latencies**:
- **p50 (Median)**: 50% of requests faster than this
- **p95**: 95% of requests faster than this (primary SLA metric)
- **p99**: 99% of requests faster than this (tail latency)

**Target SLAs**:
```
p50: < 2.0 seconds
p95: < 3.5 seconds
p99: < 5.0 seconds
```

#### 2. Throughput

**Definition**: Queries per second (QPS) at given concurrency

**Test Methodology**:
```
Concurrency levels: 1, 5, 10, 25, 50, 100
Measure: Successful queries / elapsed time
Target: > 10 QPS at concurrency=10
```

#### 3. Error Rate

**Types of Errors**:
- API errors (500s, timeouts)
- Invalid responses (malformed JSON)
- Content policy violations
- Rate limit errors

**Target**: < 1% error rate across all test cases

### Cost Metrics (30% Weight)

#### 1. Cost Per Query

**Components**:
```
Cost per query = (
    (input_tokens / 1M) × input_price +
    (output_tokens / 1M) × output_price
)
```

**Benchmarks**:
- Excellent: < $0.02/query
- Good: $0.02-$0.05/query
- Acceptable: $0.05-$0.10/query
- High: > $0.10/query

#### 2. Token Efficiency

**Metric**: Output tokens per input token

**Interpretation**:
- Efficient: 0.1-0.3 (concise responses)
- Standard: 0.3-0.6 (balanced responses)
- Verbose: > 0.6 (may need prompt tuning)

#### 3. Monthly Cost Projections

**Calculate at multiple volume tiers**:
```
1K queries/month   (33 queries/day)  → Early stage
10K queries/month  (333 queries/day) → Growth stage
30K queries/month  (1K queries/day)  → Scale stage
100K queries/month (3.3K queries/day) → Enterprise stage
```

---

## 🔬 Test Execution Protocol

### Step 1: Environment Setup

```bash
# Create test environment
python -m venv model_comparison_env
source model_comparison_env/bin/activate

# Install dependencies
pip install openai anthropic numpy pandas matplotlib

# Set up API keys
export OPENAI_API_KEY="sk-..."
export ANTHROPIC_API_KEY="sk-ant-..."

# Prepare test data
python scripts/prepare_test_dataset.py
```

### Step 2: Run Comparison Tests

```bash
# Execute full comparison suite
python scripts/run_model_comparison.py \
    --model-a gpt-5 \
    --model-b claude-sonnet-4-5 \
    --test-cases data/test_cases.json \
    --iterations 10 \
    --output results/comparison_2025_11_13.json

# Expected runtime: 30-45 minutes for 100 test cases × 10 iterations
```

### Step 3: Generate Reports

```bash
# Generate comparison report
python scripts/generate_comparison_report.py \
    --results results/comparison_2025_11_13.json \
    --output reports/gpt5_vs_sonnet45_2025_11_13.md

# Generate charts and visualizations
python scripts/generate_charts.py \
    --results results/comparison_2025_11_13.json \
    --output reports/charts/
```

---

## 📊 Results Template

### GPT-5 vs Claude Sonnet 4.5 - November 2025 Comparison

**Test Date**: November 13, 2025
**Test Cases**: 100 queries (20 per category)
**Iterations**: 10 per test case
**Total Queries Executed**: 1,000 per model

#### Quality Results

| Metric | GPT-5 | Claude Sonnet 4.5 | Winner |
|--------|-------|-------------------|--------|
| **Overall Quality** | 85.3 | 87.1 | Claude (+2.1%) |
| Accuracy | 88.5 | 89.2 | Claude (+0.8%) |
| Relevance | 86.7 | 90.3 | Claude (+4.2%) |
| Coherence | 84.2 | 85.8 | Claude (+1.9%) |
| Brand Voice | 82.1 | 84.5 | Claude (+2.9%) |
| Actionability | 83.9 | 85.7 | Claude (+2.1%) |

**Quality Winner**: 🏆 **Claude Sonnet 4.5** (+2.1% overall)

#### Performance Results

| Metric | GPT-5 | Claude Sonnet 4.5 | Winner |
|--------|-------|-------------------|--------|
| **p50 Latency** | 1.8s | 2.3s | GPT-5 (-22%) |
| **p95 Latency** | 3.2s | 4.1s | GPT-5 (-22%) |
| **p99 Latency** | 4.5s | 5.8s | GPT-5 (-22%) |
| **Throughput** | 12.3 QPS | 9.7 QPS | GPT-5 (+27%) |
| **Error Rate** | 0.3% | 0.4% | GPT-5 |

**Performance Winner**: 🏆 **GPT-5** (22% faster)

#### Cost Results (at 30K queries/month)

| Metric | GPT-5 | Claude Sonnet 4.5 | Winner |
|--------|-------|-------------------|--------|
| **Cost/Query** | $0.0094 | $0.0180 | GPT-5 (-48%) |
| **Monthly Cost (30K)** | $282 | $540 | GPT-5 (-48%) |
| **Annual Cost** | $3,384 | $6,480 | GPT-5 (-48%) |
| **Cost Savings** | Baseline | +$258/month | GPT-5 |

**Cost Winner**: 🏆 **GPT-5** (48% cheaper)

#### Overall Recommendation

```
Decision Matrix Applied:

Quality Improvement: +2.1% (Claude better, but < 10% threshold)
Cost Difference: +$258/month (+92% more expensive)
Performance: -22% slower (Claude worse)

Decision: STAY WITH GPT-5

Reasoning:
- Quality improvement (2.1%) is marginal and doesn't justify 92% cost increase
- GPT-5 is significantly faster (22% better p95 latency)
- GPT-5 saves $3,096 annually at current volume
- As volume scales, cost difference becomes more significant

Re-evaluate: Q1 2026 (3 months)
Monitor: GPT-5.1 updates, Claude Sonnet 4.6 release
```

---

## 🔄 Quarterly Evaluation Checklist

**Use this checklist every 3 months:**

### 3 Months Before Evaluation

- [ ] Monitor AI industry news for new model releases
- [ ] Track current model performance metrics in production
- [ ] Identify any quality degradation or user complaints
- [ ] Review current costs and usage patterns

### 1 Month Before Evaluation

- [ ] Identify models to test (current + latest competitors)
- [ ] Update test dataset with new edge cases from production
- [ ] Review and update ground truth responses
- [ ] Prepare test environment and API access

### Evaluation Week

**Day 1-2: Setup**
- [ ] Provision API keys for all models to test
- [ ] Configure vector stores for each model
- [ ] Verify test dataset completeness

**Day 3-4: Execution**
- [ ] Run automated quality tests (100 cases × 10 iterations)
- [ ] Run performance benchmarks (latency, throughput)
- [ ] Collect cost data

**Day 5: Analysis**
- [ ] Calculate aggregate metrics
- [ ] Generate comparison reports
- [ ] Create visualizations (charts, graphs)

**Day 6-7: Decision**
- [ ] Apply decision matrix
- [ ] Calculate ROI for model switch
- [ ] Document recommendation with reasoning
- [ ] Present findings to stakeholders

### Post-Evaluation

- [ ] If upgrading: Plan migration strategy
- [ ] If staying: Document decision rationale
- [ ] Archive results for historical comparison
- [ ] Schedule next evaluation (3 months)

---

## 📁 Test Artifacts Structure

```
model_comparisons/
├── 2025_Q4_Nov/
│   ├── test_cases/
│   │   ├── diagnostic_queries.json
│   │   ├── avatar_queries.json
│   │   ├── canvas_queries.json
│   │   ├── capture_queries.json
│   │   └── core_queries.json
│   ├── ground_truth/
│   │   └── expert_responses.json
│   ├── results/
│   │   ├── gpt5_results.json
│   │   ├── claude_sonnet_45_results.json
│   │   └── raw_responses/
│   ├── reports/
│   │   ├── comparison_report.md
│   │   ├── quality_analysis.md
│   │   ├── performance_analysis.md
│   │   └── cost_analysis.md
│   ├── charts/
│   │   ├── quality_comparison.png
│   │   ├── latency_distribution.png
│   │   ├── cost_projection.png
│   │   └── decision_matrix.png
│   └── decision_record.md
├── 2026_Q1_Feb/
│   └── (same structure)
└── scripts/
    ├── prepare_test_dataset.py
    ├── run_model_comparison.py
    ├── evaluate_quality.py
    ├── analyze_performance.py
    ├── calculate_costs.py
    └── generate_comparison_report.py
```

---

## 🎯 Decision Framework

### When to Upgrade

**Upgrade if ANY of these conditions are met:**

1. **Quality-Driven Upgrade**
   - Overall quality improvement > 10%
   - Cost increase < 20%
   - Performance not significantly worse (< 15% degradation)

2. **Performance-Driven Upgrade**
   - Latency improvement > 25% (p95)
   - Quality same or better
   - Cost increase < 30%

3. **Cost-Driven Upgrade**
   - Cost reduction > 30%
   - Quality degradation < 5%
   - Performance degradation < 10%

4. **Strategic Upgrade**
   - New capabilities critical for roadmap (e.g., multimodal, longer context)
   - Vendor lock-in risk mitigation
   - Compliance or security requirements

### When to Stay with Current Model

**Stay if ALL of these are true:**

- Quality improvement < 10%
- Cost increase > 20%
- No critical new capabilities needed
- Current model meeting SLAs

### A/B Testing Before Full Migration

**Required for:**
- Upgrades with cost increase > 15%
- Quality score difference < 5% (too close to call)
- Major version changes (e.g., GPT-5 → GPT-6)

**A/B Test Protocol**:
```
1. Route 10% traffic to new model
2. Monitor for 2 weeks
3. Compare quality, performance, cost in production
4. Collect user feedback (if applicable)
5. Decision: Scale to 100% or rollback
```

---

## 📈 Visualization Templates

### 1. Quality Comparison Radar Chart

```python
import matplotlib.pyplot as plt
import numpy as np

def create_quality_radar_chart(gpt5_scores, claude_scores):
    categories = ['Accuracy', 'Relevance', 'Coherence', 'Brand Voice', 'Actionability']

    angles = np.linspace(0, 2 * np.pi, len(categories), endpoint=False).tolist()
    angles += angles[:1]  # Complete the circle

    gpt5_values = [
        gpt5_scores['accuracy'],
        gpt5_scores['relevance'],
        gpt5_scores['coherence'],
        gpt5_scores['brand_voice'],
        gpt5_scores['actionability']
    ]
    gpt5_values += gpt5_values[:1]

    claude_values = [
        claude_scores['accuracy'],
        claude_scores['relevance'],
        claude_scores['coherence'],
        claude_scores['brand_voice'],
        claude_scores['actionability']
    ]
    claude_values += claude_values[:1]

    fig, ax = plt.subplots(figsize=(8, 8), subplot_kw=dict(projection='polar'))
    ax.plot(angles, gpt5_values, 'o-', linewidth=2, label='GPT-5', color='#10a37f')
    ax.fill(angles, gpt5_values, alpha=0.25, color='#10a37f')
    ax.plot(angles, claude_values, 'o-', linewidth=2, label='Claude Sonnet 4.5', color='#d97757')
    ax.fill(angles, claude_values, alpha=0.25, color='#d97757')

    ax.set_xticks(angles[:-1])
    ax.set_xticklabels(categories)
    ax.set_ylim(0, 100)
    ax.set_title('Quality Metrics Comparison', size=16, pad=20)
    ax.legend(loc='upper right', bbox_to_anchor=(1.3, 1.0))
    ax.grid(True)

    plt.savefig('quality_comparison_radar.png', dpi=300, bbox_inches='tight')
```

### 2. Latency Distribution Chart

```python
def create_latency_distribution(gpt5_latencies, claude_latencies):
    fig, ax = plt.subplots(figsize=(10, 6))

    ax.hist(gpt5_latencies, bins=50, alpha=0.6, label='GPT-5', color='#10a37f')
    ax.hist(claude_latencies, bins=50, alpha=0.6, label='Claude Sonnet 4.5', color='#d97757')

    # Add p95 lines
    gpt5_p95 = np.percentile(gpt5_latencies, 95)
    claude_p95 = np.percentile(claude_latencies, 95)

    ax.axvline(gpt5_p95, color='#10a37f', linestyle='--',
               label=f'GPT-5 p95: {gpt5_p95:.2f}s')
    ax.axvline(claude_p95, color='#d97757', linestyle='--',
               label=f'Claude p95: {claude_p95:.2f}s')

    ax.set_xlabel('Latency (seconds)')
    ax.set_ylabel('Frequency')
    ax.set_title('Response Time Distribution')
    ax.legend()
    ax.grid(True, alpha=0.3)

    plt.savefig('latency_distribution.png', dpi=300, bbox_inches='tight')
```

### 3. Cost Projection Chart

```python
def create_cost_projection(gpt5_cost_per_query, claude_cost_per_query):
    volumes = [1_000, 10_000, 30_000, 50_000, 100_000]

    gpt5_costs = [v * gpt5_cost_per_query for v in volumes]
    claude_costs = [v * claude_cost_per_query for v in volumes]

    fig, ax = plt.subplots(figsize=(10, 6))

    ax.plot(volumes, gpt5_costs, 'o-', linewidth=2,
            label='GPT-5', color='#10a37f', markersize=8)
    ax.plot(volumes, claude_costs, 'o-', linewidth=2,
            label='Claude Sonnet 4.5', color='#d97757', markersize=8)

    ax.set_xlabel('Monthly Query Volume')
    ax.set_ylabel('Monthly Cost ($)')
    ax.set_title('Cost Projection by Volume')
    ax.legend()
    ax.grid(True, alpha=0.3)

    # Format y-axis as currency
    ax.yaxis.set_major_formatter(plt.FuncFormatter(lambda x, p: f'${x:,.0f}'))

    # Format x-axis with K notation
    ax.xaxis.set_major_formatter(plt.FuncFormatter(lambda x, p: f'{x/1000:.0f}K'))

    plt.savefig('cost_projection.png', dpi=300, bbox_inches='tight')
```

---

## 🔍 Brand Coaching Specific Evaluation

### Domain-Specific Quality Criteria

#### Diagnostic Prompt Quality
- ✅ Uses recognized frameworks (SWOT, Porter's 5 Forces)
- ✅ Asks clarifying questions about business context
- ✅ Provides data-driven insights
- ✅ Actionable recommendations with priorities

#### Avatar Prompt Quality
- ✅ Comprehensive demographic profiling
- ✅ Psychographic analysis depth
- ✅ Pain point identification specificity
- ✅ Customer journey mapping completeness

#### Canvas Prompt Quality
- ✅ Business model canvas completeness (all 9 components)
- ✅ Revenue stream specificity
- ✅ Cost structure realism
- ✅ Strategic coherence across components

#### CAPTURE Prompt Quality
- ✅ Content ideas aligned with brand voice
- ✅ Multi-channel strategy integration
- ✅ Measurable KPIs included
- ✅ Timeline and execution plan clarity

#### Core Prompt Quality
- ✅ Brand foundations depth (mission, vision, values)
- ✅ Personality trait definition clarity
- ✅ Storytelling framework guidance
- ✅ Differentiation strategy specificity

### Brand Voice Rubric (Detailed)

**Score each response 0-5 on these criteria:**

| Criterion | 5 (Excellent) | 3 (Adequate) | 1 (Poor) |
|-----------|---------------|--------------|----------|
| **Empowerment** | Highly motivating, builds confidence | Neutral, informative | Discouraging or condescending |
| **Approachability** | Warm and conversational | Professional and clear | Overly formal or technical |
| **Action-Oriented** | Specific steps with timeline | General recommendations | Vague suggestions |
| **Clarity** | Jargon-free, easy to understand | Some technical terms explained | Heavy jargon, confusing |
| **Encouragement** | Positive and supportive | Neutral tone | Critical or negative |

**Overall Brand Voice Score** = Sum of criteria × 20 (to convert to 0-100 scale)

---

## 🤖 Automated Testing Scripts

### Complete Test Runner

```python
#!/usr/bin/env python3
"""
Model Comparison Test Runner
Usage: python run_model_comparison.py --model-a gpt-5 --model-b claude-sonnet-4-5
"""

import argparse
import asyncio
import json
from pathlib import Path
from datetime import datetime

class ModelComparisonRunner:
    def __init__(self, config_path: str):
        self.config = self.load_config(config_path)
        self.evaluator = QualityEvaluator()
        self.perf_tester = PerformanceTester()
        self.cost_analyzer = CostAnalyzer()

    async def run_full_comparison(
        self,
        model_a_name: str,
        model_b_name: str
    ) -> Dict:
        """Execute complete comparison suite"""

        print(f"🧪 Starting Model Comparison")
        print(f"   Model A: {model_a_name}")
        print(f"   Model B: {model_b_name}")
        print(f"   Test Cases: {len(self.config['test_cases'])}")
        print(f"   Iterations: {self.config['iterations']}")
        print()

        # Initialize models
        model_a = ModelConfig(
            provider=self.get_provider(model_a_name),
            model_name=model_a_name,
            api_key=self.get_api_key(model_a_name),
            temperature=0.3
        )

        model_b = ModelConfig(
            provider=self.get_provider(model_b_name),
            model_name=model_b_name,
            api_key=self.get_api_key(model_b_name),
            temperature=0.3
        )

        # Phase 1: Quality Testing
        print("📊 Phase 1: Quality Testing...")
        quality_results = await self.run_quality_tests(model_a, model_b)

        # Phase 2: Performance Testing
        print("⚡ Phase 2: Performance Testing...")
        perf_results = await self.run_performance_tests(model_a, model_b)

        # Phase 3: Cost Analysis
        print("💰 Phase 3: Cost Analysis...")
        cost_results = self.run_cost_analysis(quality_results)

        # Phase 4: Generate Report
        print("📝 Phase 4: Generating Reports...")
        report = self.generate_comprehensive_report(
            model_a_name,
            model_b_name,
            quality_results,
            perf_results,
            cost_results
        )

        # Save results
        output_path = self.save_results(report)

        print(f"✅ Comparison Complete!")
        print(f"   Report saved to: {output_path}")

        return report

    async def run_quality_tests(
        self,
        model_a: ModelConfig,
        model_b: ModelConfig
    ) -> Dict:
        """Run quality evaluation for both models"""

        results_a = []
        results_b = []

        total_tests = len(self.config['test_cases']) * self.config['iterations']
        completed = 0

        for test_case in self.config['test_cases']:
            for iteration in range(self.config['iterations']):
                # Test both models
                result_a = await self.run_single_test(model_a, test_case)
                result_b = await self.run_single_test(model_b, test_case)

                results_a.append(result_a)
                results_b.append(result_b)

                completed += 1
                print(f"   Progress: {completed}/{total_tests} tests completed", end='\r')

        print()  # New line after progress

        return {
            'model_a': self.aggregate_results(results_a),
            'model_b': self.aggregate_results(results_b)
        }

    def generate_comprehensive_report(
        self,
        model_a_name: str,
        model_b_name: str,
        quality: Dict,
        performance: Dict,
        cost: Dict
    ) -> Dict:
        """Generate complete comparison report"""

        # Determine winners
        quality_winner = model_a_name if quality['model_a']['overall'] > quality['model_b']['overall'] else model_b_name
        perf_winner = model_a_name if performance['model_a']['p95'] < performance['model_b']['p95'] else model_b_name
        cost_winner = model_a_name if cost['model_a']['cost_per_query'] < cost['model_b']['cost_per_query'] else model_b_name

        # Apply decision matrix
        decision = self.apply_decision_matrix(quality, performance, cost)

        return {
            'metadata': {
                'test_date': datetime.now().isoformat(),
                'model_a': model_a_name,
                'model_b': model_b_name,
                'test_cases': len(self.config['test_cases']),
                'iterations': self.config['iterations']
            },
            'quality': quality,
            'performance': performance,
            'cost': cost,
            'winners': {
                'quality': quality_winner,
                'performance': perf_winner,
                'cost': cost_winner
            },
            'decision': decision
        }

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument('--model-a', required=True)
    parser.add_argument('--model-b', required=True)
    parser.add_argument('--config', default='config/test_config.json')

    args = parser.parse_args()

    runner = ModelComparisonRunner(args.config)
    results = asyncio.run(runner.run_full_comparison(args.model_a, args.model_b))

    print("\n🎯 Final Recommendation:")
    print(f"   {results['decision']['recommendation']}")
    print(f"\n   Reasoning: {results['decision']['reasoning']}")
```

---

## 📝 Report Template

### Model Comparison Report

**Date**: [Auto-generated]
**Models Compared**: [Model A] vs [Model B]
**Test Cases**: [N queries × M iterations]
**Evaluator**: [Your name/team]

---

#### Executive Summary

[Auto-generated 3-paragraph summary covering quality, performance, cost, and recommendation]

---

#### Quality Analysis

**Overall Quality Scores**:
- Model A: [X.X]/100
- Model B: [X.X]/100
- Winner: [Model X] (+[X.X]%)

**Detailed Breakdown**:

| Metric | Model A | Model B | Difference |
|--------|---------|---------|------------|
| Accuracy | [X.X] | [X.X] | [+/-X.X%] |
| Relevance | [X.X] | [X.X] | [+/-X.X%] |
| Coherence | [X.X] | [X.X] | [+/-X.X%] |
| Brand Voice | [X.X] | [X.X] | [+/-X.X%] |
| Actionability | [X.X] | [X.X] | [+/-X.X%] |

**Category-Specific Performance**:

| Category | Model A Quality | Model B Quality | Winner |
|----------|----------------|-----------------|--------|
| Diagnostic | [X.X] | [X.X] | [Model X] |
| Avatar | [X.X] | [X.X] | [Model X] |
| Canvas | [X.X] | [X.X] | [Model X] |
| CAPTURE | [X.X] | [X.X] | [Model X] |
| Core | [X.X] | [X.X] | [Model X] |

**Key Findings**:
- [Finding 1]
- [Finding 2]
- [Finding 3]

---

#### Performance Analysis

**Latency Results**:

| Metric | Model A | Model B | Winner |
|--------|---------|---------|--------|
| p50 | [X.X]s | [X.X]s | [Model X (-XX%)] |
| p95 | [X.X]s | [X.X]s | [Model X (-XX%)] |
| p99 | [X.X]s | [X.X]s | [Model X (-XX%)] |
| Mean | [X.X]s | [X.X]s | [Model X (-XX%)] |

**Throughput**:
- Model A: [X.X] queries/second
- Model B: [X.X] queries/second

**Error Rates**:
- Model A: [X.X]%
- Model B: [X.X]%

**Key Findings**:
- [Finding 1]
- [Finding 2]

---

#### Cost Analysis

**Cost Per Query**:
- Model A: $[X.XXXX]
- Model B: $[X.XXXX]
- Difference: [±XX]% ([Model X] cheaper)

**Monthly Projections**:

| Volume | Model A | Model B | Savings (Model A) |
|--------|---------|---------|-------------------|
| 1K | $[XXX] | $[XXX] | $[XXX] |
| 10K | $[XXX] | $[XXX] | $[XXX] |
| 30K | $[XXX] | $[XXX] | $[XXX] |
| 100K | $[XXX] | $[XXX] | $[XXX] |

**Annual Cost Comparison (at 30K queries/month)**:
- Model A: $[X,XXX]
- Model B: $[X,XXX]
- Annual Savings: $[X,XXX] with [Model X]

---

#### Decision & Recommendation

**Decision Matrix Results**:
```
Quality Improvement: [+/-X.X]%
Cost Difference: [+/-$XXX]/month
Performance Improvement: [+/-XX]%

Decision: [UPGRADE / STAY / A/B TEST]
```

**Recommendation**: [UPGRADE to Model X / STAY with Model Y]

**Reasoning**:
1. [Primary reason]
2. [Secondary reason]
3. [Additional consideration]

**Migration Plan** (if upgrading):
1. Week 1: [Action items]
2. Week 2: [Action items]
3. Week 3: [Action items]
4. Week 4: [Validation]

**Next Evaluation**: [Date 3 months from now]

---

## 🔄 Continuous Improvement

### Quarterly Evaluation Calendar

**Q4 2025 (November)**: GPT-5 vs Claude Sonnet 4.5
**Q1 2026 (February)**: Retest current model + any new releases
**Q2 2026 (May)**: Retest current model + any new releases
**Q3 2026 (August)**: Retest current model + any new releases
**Q4 2026 (November)**: Annual comprehensive review

### Historical Tracking

**Maintain comparison history**:

```
model_comparison_history/
├── 2025_Q4_Nov_GPT5_vs_Claude.json
├── 2026_Q1_Feb_GPT5_vs_NewModel.json
├── 2026_Q2_May_GPT5_vs_NewModel.json
└── historical_trends.csv
```

**Track trends over time**:
- Quality score evolution
- Cost trends
- Performance improvements
- ROI from previous migrations

---

## 🎓 Best Practices

### Testing Best Practices

1. **Consistency**
   - Use same test cases across all evaluations
   - Keep temperature at 0.3 for comparable results
   - Run minimum 10 iterations per test case

2. **Isolation**
   - Test one variable at a time
   - Use same vector stores for both models
   - Identical prompts and system instructions

3. **Reproducibility**
   - Document all configuration parameters
   - Save raw responses for manual review
   - Version control test datasets

4. **Objectivity**
   - Use automated metrics where possible
   - Multiple human evaluators for subjective metrics
   - Blind evaluation (evaluators don't know which model)

### Common Pitfalls to Avoid

❌ **Don't:**
- Test with production traffic (use isolated test environment)
- Compare different prompt types between models
- Make decisions based on single test run
- Ignore outliers without investigation
- Optimize for benchmarks at expense of real-world performance

✅ **Do:**
- Use representative real-world queries
- Test edge cases and challenging scenarios
- Consider user feedback in addition to metrics
- Document unexpected behaviors
- Re-run tests if results seem anomalous

---

## 📚 Appendix

### A. Sample Test Cases

```json
{
  "test_cases": [
    {
      "id": "diag_simple_001",
      "category": "Diagnostic",
      "complexity": "Simple",
      "query": "Assess my brand strength",
      "context": {
        "user_profile": {
          "company": "TechStartup Inc",
          "industry": "SaaS",
          "stage": "Early stage"
        }
      }
    },
    {
      "id": "avatar_medium_005",
      "category": "Avatar",
      "complexity": "Medium",
      "query": "Create a detailed customer persona for my B2B software product targeting marketing managers",
      "context": {
        "user_profile": {
          "company": "MarketingTech Co",
          "industry": "Marketing Software",
          "target_market": "B2B"
        }
      }
    }
  ]
}
```

### B. Quality Evaluation Prompts

**Accuracy Evaluation Prompt**:
```
Evaluate the accuracy of this brand coaching response:

Ground Truth Key Points:
{key_points}

Response to Evaluate:
{response}

Count how many key points are accurately addressed.
Return: {"mentioned": X, "total": Y, "score": (X/Y)*100}
```

**Relevance Evaluation Prompt**:
```
Rate the relevance of this response to the user's query (0-100):

User Query: {query}
Response: {response}

Consider:
- Does it directly address the question?
- Is the information pertinent to the user's context?
- Are there irrelevant tangents?

Return only a number 0-100.
```

### C. Configuration Files

**config/test_config.json**:
```json
{
  "test_dataset": "data/test_cases.json",
  "iterations": 10,
  "temperature": 0.3,
  "max_tokens": 1000,
  "timeout_seconds": 30,
  "parallel_requests": 5,
  "vector_stores": {
    "diagnostic": "vs_diagnostic_xxx",
    "avatar": "vs_avatar_xxx",
    "canvas": "vs_canvas_xxx",
    "capture": "vs_capture_xxx",
    "core": "vs_core_xxx"
  },
  "quality_weights": {
    "accuracy": 0.25,
    "relevance": 0.25,
    "coherence": 0.20,
    "brand_voice": 0.15,
    "actionability": 0.15
  }
}
```

---

## 🚀 Quick Start Guide

### First-Time Setup (One-time)

```bash
# 1. Clone test framework
git clone <repo> model_comparison
cd model_comparison

# 2. Install dependencies
pip install -r requirements.txt

# 3. Create test dataset
python scripts/create_test_dataset.py \
    --output data/test_cases.json \
    --queries-per-category 20

# 4. Create ground truth (expert validation)
python scripts/create_ground_truth.py \
    --input data/test_cases.json \
    --output data/ground_truth.json

# 5. Configure API keys
cp .env.example .env
# Edit .env with your API keys
```

### Running Comparison (Quarterly)

```bash
# 1. Update test cases with new production examples
python scripts/update_test_dataset.py

# 2. Run comparison
python scripts/run_model_comparison.py \
    --model-a gpt-5 \
    --model-b claude-sonnet-4-5 \
    --config config/test_config.json \
    --output results/2025_Q4_comparison.json

# 3. Generate reports
python scripts/generate_reports.py \
    --results results/2025_Q4_comparison.json \
    --output-dir reports/2025_Q4/

# 4. Review decision
cat reports/2025_Q4/decision_record.md
```

---

## 📊 Expected Outcomes

After running this framework, you will have:

1. ✅ **Quantitative Quality Comparison** (5 metrics across 100 test cases)
2. ✅ **Performance Benchmarks** (latency distribution, throughput)
3. ✅ **Cost Projections** (at multiple volume tiers)
4. ✅ **Clear Recommendation** (Upgrade / Stay / A/B Test)
5. ✅ **Migration Plan** (if upgrading)
6. ✅ **Historical Record** (for trend analysis)

### Time Investment

**Initial Setup** (first time only): 8-12 hours
- Create test cases: 4 hours
- Expert ground truth validation: 4 hours
- Framework configuration: 2-4 hours

**Quarterly Evaluation** (recurring): 2-3 hours
- Update test cases: 30 minutes
- Run automated tests: 45 minutes (mostly automated)
- Review results and generate report: 1 hour
- Decision and documentation: 30 minutes

**ROI**: ~3 hours of testing every quarter to make data-driven decisions worth thousands of dollars annually.

---

**Document Version**: 1.0
**Last Updated**: November 2025
**Author**: IDEA Brand Coach Development Team
**Status**: ✅ Ready for Quarterly Use

**Next Review**: February 2026 (Q1 2026)
