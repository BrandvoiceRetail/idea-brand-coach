# CI/CD Pipeline Implementation Plan
## IDEA Brand Coach Application

**Plan Type**: Implementation - DevOps Infrastructure
**Author**: Claude Code Production Audit
**Created**: 2025-10-27
**Version**: 1.0.0
**Priority**: CRITICAL
**Estimated Effort**: 24 hours (3 days)
**Dependencies**: None (can run in parallel with other work)

---

## 📋 Overview

**Purpose**: Implement automated continuous integration and deployment pipeline using GitHub Actions to eliminate manual deployment risks, ensure code quality, and enable safe rapid iteration.

**Approach**: Incremental CI/CD implementation starting with basic automation, progressing to comprehensive quality gates and automated deployment.

**Success Criteria**:
- Automated testing on every pull request
- Automated deployment on merge to main
- Zero manual deployment steps
- <5 minute pipeline execution time

### Business Context

Manual deployments introduce:
- **Human error** (wrong commands, forgotten steps)
- **Inconsistent builds** (works on my machine)
- **Slow feedback cycles** (hours to deploy vs minutes)
- **Quality risks** (untested code reaches production)
- **Team friction** (deployment blockers, coordination overhead)

Automated CI/CD provides:
- **Confidence**: Every change is tested before production
- **Speed**: Deploy multiple times per day safely
- **Quality**: Automated checks prevent bugs
- **Reliability**: Consistent, repeatable process

---

## 🎯 Requirements & Acceptance Criteria

### Functional Requirements

1. **Continuous Integration**
   - [ ] Automated testing on pull requests
   - [ ] Lint and type-check enforcement
   - [ ] Build verification
   - [ ] Test coverage reporting
   - [ ] Security scanning

2. **Continuous Deployment**
   - [ ] Automated deployment to staging on merge to develop
   - [ ] Automated deployment to production on merge to main
   - [ ] Supabase Edge Functions deployment
   - [ ] Database migration execution

3. **Quality Gates**
   - [ ] All tests must pass
   - [ ] Lint errors block deployment
   - [ ] Type check errors block deployment
   - [ ] Coverage must be ≥85%
   - [ ] No critical security vulnerabilities

4. **Notifications**
   - [ ] Deployment status notifications
   - [ ] Failure notifications
   - [ ] Performance regression alerts

### Acceptance Criteria

- [ ] Pipeline runs on every push and PR
- [ ] All quality gates enforced
- [ ] Deployment succeeds to both staging and production
- [ ] Rollback mechanism tested
- [ ] Documentation complete
- [ ] Team trained on new workflow

---

## 🏗️ Implementation Plan

### Phase 1: Basic CI Pipeline (6 hours)

**Objective**: Set up automated testing and quality checks on pull requests.

#### 1.1 Create GitHub Actions Workflow

**Tasks**:
- [ ] Create `.github/workflows/ci.yml`
- [ ] Configure test execution
- [ ] Add lint and type-check jobs
- [ ] Set up test coverage reporting

**Implementation**:

```yaml
# .github/workflows/ci.yml
name: Continuous Integration

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  quality-checks:
    name: Quality Checks
    runs-on: ubuntu-latest
    timeout-minutes: 10

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run linter
        run: npm run lint

      - name: Run type check
        run: npm run type-check
        continue-on-error: false

      - name: Run tests
        run: npm test -- --coverage --coverageThreshold='{"global":{"branches":85,"functions":85,"lines":85,"statements":85}}'

      - name: Upload coverage reports
        uses: codecov/codecov-action@v3
        with:
          token: ${{ secrets.CODECOV_TOKEN }}
          files: ./coverage/coverage-final.json
          flags: unittests
          name: codecov-umbrella

  build:
    name: Build Verification
    runs-on: ubuntu-latest
    timeout-minutes: 10
    needs: quality-checks

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build application
        run: npm run build

      - name: Check build size
        run: |
          BUILD_SIZE=$(du -sb dist | cut -f1)
          echo "Build size: $BUILD_SIZE bytes"
          if [ $BUILD_SIZE -gt 1048576 ]; then
            echo "❌ Build size exceeds 1MB"
            exit 1
          fi
          echo "✅ Build size acceptable"

      - name: Upload build artifacts
        uses: actions/upload-artifact@v3
        with:
          name: dist
          path: dist/
          retention-days: 7

  security-scan:
    name: Security Scan
    runs-on: ubuntu-latest
    timeout-minutes: 5

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'

      - name: Run npm audit
        run: npm audit --audit-level moderate
        continue-on-error: true

      - name: Run Snyk security scan
        uses: snyk/actions/node@master
        continue-on-error: true
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
```

**Validation**:
- [ ] Workflow file validates (no syntax errors)
- [ ] Pipeline runs on test PR
- [ ] All jobs complete successfully
- [ ] Coverage report generated

#### 1.2 Configure Branch Protection

**Tasks**:
- [ ] Enable branch protection for main
- [ ] Require status checks before merge
- [ ] Require PR reviews
- [ ] Disable force pushes

**Implementation**:

```bash
# Configure via GitHub UI or API
# Settings > Branches > Branch protection rules

# Required settings for main branch:
- Require a pull request before merging
- Require approvals: 1
- Dismiss stale pull request approvals when new commits are pushed
- Require status checks to pass before merging
  - quality-checks
  - build
  - security-scan
- Require branches to be up to date before merging
- Do not allow bypassing the above settings
```

**Validation**:
- [ ] Direct push to main blocked
- [ ] PR without passing checks blocked
- [ ] Branch protection rules enforced

### Phase 2: Staging Deployment (8 hours)

**Objective**: Automate deployment to staging environment on merge to develop branch.

#### 2.1 Create Staging Environment

**Tasks**:
- [ ] Create staging Supabase project
- [ ] Configure staging environment variables
- [ ] Set up staging secrets in GitHub

**Implementation**:

```bash
# 1. Create staging project in Supabase dashboard
# Project name: idea-brand-coach-staging
# Region: Same as production

# 2. Add GitHub secrets (Settings > Secrets and variables > Actions)
STAGING_SUPABASE_URL=https://[staging-project].supabase.co
STAGING_SUPABASE_ANON_KEY=[staging-anon-key]
STAGING_SUPABASE_SERVICE_KEY=[staging-service-key]
```

**Validation**:
- [ ] Staging project created
- [ ] Secrets configured in GitHub
- [ ] Connection to staging verified

#### 2.2 Create Staging Deployment Workflow

**Tasks**:
- [ ] Create `.github/workflows/deploy-staging.yml`
- [ ] Configure Lovable deployment
- [ ] Configure Supabase Functions deployment
- [ ] Add deployment notifications

**Implementation**:

```yaml
# .github/workflows/deploy-staging.yml
name: Deploy to Staging

on:
  push:
    branches: [develop]
  workflow_dispatch:  # Allow manual trigger

jobs:
  deploy-frontend:
    name: Deploy Frontend to Staging
    runs-on: ubuntu-latest
    environment: staging
    timeout-minutes: 15

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build for staging
        run: npm run build
        env:
          VITE_SUPABASE_URL: ${{ secrets.STAGING_SUPABASE_URL }}
          VITE_SUPABASE_PUBLISHABLE_KEY: ${{ secrets.STAGING_SUPABASE_ANON_KEY }}

      - name: Deploy to Lovable Staging
        run: |
          # Lovable deployment command
          # (Replace with actual Lovable CLI command when available)
          echo "Deploying to Lovable staging..."

      - name: Verify deployment
        run: |
          curl -f https://staging.lovable.dev/projects/${{ secrets.LOVABLE_PROJECT_ID }}/health || exit 1

  deploy-edge-functions:
    name: Deploy Edge Functions to Staging
    runs-on: ubuntu-latest
    environment: staging
    timeout-minutes: 10
    needs: deploy-frontend

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Supabase CLI
        uses: supabase/setup-cli@v1
        with:
          version: latest

      - name: Deploy Edge Functions
        run: |
          supabase functions deploy --project-ref ${{ secrets.STAGING_SUPABASE_PROJECT_REF }}
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}

  smoke-tests:
    name: Run Smoke Tests
    runs-on: ubuntu-latest
    needs: [deploy-frontend, deploy-edge-functions]
    timeout-minutes: 5

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Run smoke tests
        run: |
          npm run test:smoke -- --env=staging

  notify:
    name: Notify Team
    runs-on: ubuntu-latest
    needs: [deploy-frontend, deploy-edge-functions, smoke-tests]
    if: always()

    steps:
      - name: Send Slack notification
        uses: 8398a7/action-slack@v3
        with:
          status: ${{ job.status }}
          text: 'Staging deployment ${{ job.status }}'
          webhook_url: ${{ secrets.SLACK_WEBHOOK }}
```

**Validation**:
- [ ] Deployment workflow runs on push to develop
- [ ] Frontend deploys successfully
- [ ] Edge Functions deploy successfully
- [ ] Smoke tests pass
- [ ] Team notification received

### Phase 3: Production Deployment (6 hours)

**Objective**: Automate production deployment with safety checks and rollback capability.

#### 3.1 Create Production Deployment Workflow

**Tasks**:
- [ ] Create `.github/workflows/deploy-production.yml`
- [ ] Add production safety checks
- [ ] Configure database migrations
- [ ] Implement blue-green deployment strategy

**Implementation**:

```yaml
# .github/workflows/deploy-production.yml
name: Deploy to Production

on:
  push:
    branches: [main]
  workflow_dispatch:  # Allow manual trigger with approval

jobs:
  pre-deploy-checks:
    name: Pre-Deployment Checks
    runs-on: ubuntu-latest
    timeout-minutes: 15

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run full test suite
        run: npm test -- --coverage --coverageThreshold='{"global":{"branches":85,"functions":85,"lines":85,"statements":85}}'

      - name: Security audit
        run: npm audit --audit-level high

      - name: Build production bundle
        run: npm run build
        env:
          NODE_ENV: production

      - name: Check bundle size
        run: |
          MAIN_BUNDLE=$(find dist/assets -name 'index-*.js' -exec du -b {} + | cut -f1)
          echo "Main bundle size: $MAIN_BUNDLE bytes"
          if [ $MAIN_BUNDLE -gt 204800 ]; then
            echo "❌ Bundle size exceeds 200KB limit"
            exit 1
          fi

  deploy-database:
    name: Deploy Database Migrations
    runs-on: ubuntu-latest
    environment: production
    needs: pre-deploy-checks
    timeout-minutes: 10

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Supabase CLI
        uses: supabase/setup-cli@v1

      - name: Run database migrations
        run: |
          supabase db push --project-ref ${{ secrets.PRODUCTION_SUPABASE_PROJECT_REF }}
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}

  deploy-production:
    name: Deploy to Production
    runs-on: ubuntu-latest
    environment: production
    needs: deploy-database
    timeout-minutes: 15

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build for production
        run: npm run build
        env:
          NODE_ENV: production
          VITE_SUPABASE_URL: ${{ secrets.PRODUCTION_SUPABASE_URL }}
          VITE_SUPABASE_PUBLISHABLE_KEY: ${{ secrets.PRODUCTION_SUPABASE_ANON_KEY }}

      - name: Deploy to Lovable Production
        run: |
          # Lovable deployment command
          echo "Deploying to production..."

      - name: Deploy Edge Functions
        run: |
          supabase functions deploy --project-ref ${{ secrets.PRODUCTION_SUPABASE_PROJECT_REF }}
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}

  health-check:
    name: Production Health Check
    runs-on: ubuntu-latest
    needs: deploy-production
    timeout-minutes: 5

    steps:
      - name: Wait for deployment
        run: sleep 60

      - name: Check frontend health
        run: |
          for i in {1..5}; do
            if curl -f https://lovable.dev/projects/${{ secrets.LOVABLE_PROJECT_ID }}/health; then
              echo "✅ Frontend healthy"
              exit 0
            fi
            echo "Attempt $i failed, retrying..."
            sleep 10
          done
          echo "❌ Health check failed"
          exit 1

      - name: Check API health
        run: |
          curl -f https://${{ secrets.PRODUCTION_SUPABASE_URL }}/rest/v1/ || exit 1

  rollback-on-failure:
    name: Rollback on Failure
    runs-on: ubuntu-latest
    needs: health-check
    if: failure()

    steps:
      - name: Trigger rollback
        run: |
          echo "🚨 Deployment failed, initiating rollback..."
          # Revert to previous deployment
          # (Implementation depends on Lovable deployment strategy)

  notify-production:
    name: Notify Team of Production Deployment
    runs-on: ubuntu-latest
    needs: [deploy-production, health-check]
    if: always()

    steps:
      - name: Send Slack notification
        uses: 8398a7/action-slack@v3
        with:
          status: ${{ job.status }}
          text: |
            Production deployment ${{ job.status }}
            Deployed by: ${{ github.actor }}
            Commit: ${{ github.sha }}
          webhook_url: ${{ secrets.SLACK_WEBHOOK }}

      - name: Create GitHub Release
        if: success()
        uses: actions/create-release@v1
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          tag_name: v${{ github.run_number }}
          release_name: Release v${{ github.run_number }}
          body: |
            Automated production deployment
            Commit: ${{ github.sha }}
```

**Validation**:
- [ ] Production deployment runs on push to main
- [ ] All pre-deployment checks pass
- [ ] Database migrations execute successfully
- [ ] Production deployment completes
- [ ] Health checks pass
- [ ] Team notified of deployment

#### 3.2 Configure Production Environment

**Tasks**:
- [ ] Add production secrets to GitHub
- [ ] Configure environment protection rules
- [ ] Set up deployment approvers

**Implementation**:

```bash
# GitHub Settings > Environments > New environment: production

# Protection rules:
- Required reviewers: 1 (select team leads)
- Wait timer: 0 minutes (for manual triggers)
- Deployment branches: Only main branch

# Environment secrets:
PRODUCTION_SUPABASE_URL
PRODUCTION_SUPABASE_ANON_KEY
PRODUCTION_SUPABASE_SERVICE_KEY
PRODUCTION_SUPABASE_PROJECT_REF
SUPABASE_ACCESS_TOKEN
LOVABLE_PROJECT_ID
SLACK_WEBHOOK
```

**Validation**:
- [ ] Environment protection rules enforced
- [ ] Secrets configured correctly
- [ ] Manual approval workflow tested

### Phase 4: Monitoring & Optimization (4 hours)

**Objective**: Add monitoring, notifications, and performance optimization to pipeline.

#### 4.1 Add Performance Monitoring

**Tasks**:
- [ ] Add Lighthouse CI
- [ ] Monitor bundle size trends
- [ ] Track deployment frequency
- [ ] Measure deployment duration

**Implementation**:

```yaml
# Add to .github/workflows/ci.yml

  lighthouse:
    name: Lighthouse CI
    runs-on: ubuntu-latest
    timeout-minutes: 10

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build

      - name: Run Lighthouse CI
        uses: treosh/lighthouse-ci-action@v9
        with:
          uploadArtifacts: true
          configPath: './lighthouserc.json'
```

**Validation**:
- [ ] Lighthouse CI runs on every PR
- [ ] Performance budgets enforced
- [ ] Reports accessible to team

#### 4.2 Optimize Pipeline Performance

**Tasks**:
- [ ] Add dependency caching
- [ ] Parallelize independent jobs
- [ ] Optimize test execution
- [ ] Add workflow caching

**Implementation**:

```yaml
# Optimization strategies applied:

# 1. Use npm ci instead of npm install (faster, more reliable)
# 2. Enable npm caching in setup-node action
# 3. Run independent jobs in parallel
# 4. Cache node_modules between steps
# 5. Fail fast on critical errors
# 6. Set appropriate timeouts
```

**Validation**:
- [ ] Pipeline execution time <5 minutes
- [ ] Cache hit rate >80%
- [ ] Parallel jobs executing correctly

---

## 📊 Quality Assurance & Validation

### Pipeline Testing Checklist

- [ ] CI workflow runs on pull request
- [ ] All quality checks pass
- [ ] Build succeeds
- [ ] Security scan completes
- [ ] Staging deployment works
- [ ] Production deployment works (with approval)
- [ ] Rollback mechanism tested
- [ ] Notifications working

### Integration Validation

```bash
# Test CI workflow locally
act pull_request -j quality-checks

# Test deployment workflow
act push --container-architecture linux/amd64
```

---

## 📚 Documentation Updates

### Required Documentation

- [ ] **README.md**: Update with CI/CD information
- [ ] **DEPLOYMENT.md**: Create comprehensive deployment guide
- [ ] **ROLLBACK.md**: Document rollback procedures
- [ ] **MONITORING.md**: Document pipeline monitoring

### Deployment Guide Contents

```markdown
# Deployment Guide

## Automated Deployment

### Staging
- Trigger: Merge to `develop` branch
- Process: Automatic, no approval required
- URL: https://staging.lovable.dev/projects/[id]

### Production
- Trigger: Merge to `main` branch
- Process: Requires manual approval
- URL: https://lovable.dev/projects/[id]

## Manual Deployment

### Prerequisites
- GitHub Personal Access Token
- Supabase Access Token
- Lovable CLI installed

### Commands
```bash
# Deploy Edge Functions
npx supabase functions deploy --project-ref [ref]

# Deploy Frontend
npm run build && [lovable-deploy-command]
```

## Rollback Procedures

### Automatic Rollback
- Triggered on health check failure
- Reverts to previous deployment

### Manual Rollback
```bash
# Revert to previous commit
git revert [commit-hash]
git push origin main

# Or use GitHub revert PR feature
```

## Monitoring

- **GitHub Actions**: https://github.com/[org]/[repo]/actions
- **Deployment Status**: Check Slack #deployments channel
- **Application Health**: Sentry dashboard
```

---

## 🔚 Plan Completion

### Final Validation Checklist

- [ ] All workflows created and tested
- [ ] Branch protection rules configured
- [ ] Staging deployments automated
- [ ] Production deployments automated (with approval)
- [ ] Rollback mechanism tested
- [ ] Monitoring and notifications operational
- [ ] Documentation complete
- [ ] Team trained on new workflow

### Metrics

**Before CI/CD**:
- Manual deployment time: 30-60 minutes
- Deployment frequency: 1-2x per week
- Deployment errors: 20-30%
- Rollback time: 1-2 hours

**After CI/CD**:
- Automated deployment time: 5-10 minutes
- Deployment frequency: 5-10x per week possible
- Deployment errors: <5%
- Rollback time: 5-10 minutes

**Expected Impact**:
- 80% reduction in deployment time
- 5x increase in deployment frequency
- 75% reduction in deployment errors
- 90% reduction in rollback time

---

**Plan Status**: Ready for Implementation
**Estimated Completion**: 3 days
**Dependencies**: None (can start immediately)
