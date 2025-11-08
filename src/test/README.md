# Test Suite Documentation

## Overview
Comprehensive unit tests for the IDEA Brand Coach P0 implementation (Phases 1-3).

## Running Tests

```bash
# Run all tests
npm run test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run tests with UI
npm run test:ui
```

## Test Structure

### Service Layer Tests (`src/services/__tests__/`)

#### SupabaseDiagnosticService
- ✅ Score calculation from answers
- ✅ Diagnostic save with profile update
- ✅ Embedding generation trigger
- ✅ localStorage sync functionality
- ✅ Error handling for unauthenticated users

#### SupabaseAuthService
- ✅ User signup with email confirmation
- ✅ User signin with credentials
- ✅ Password reset flow
- ✅ Password update
- ✅ Session management
- ✅ Error handling for invalid credentials

#### SupabaseUserProfileService
- ✅ Profile retrieval
- ✅ Profile updates
- ✅ Diagnostic status check
- ✅ Error handling for missing profiles

#### SupabaseChatService
- ✅ Message sending to Brand Coach
- ✅ Chat history retrieval
- ✅ Chat history clearing
- ✅ AI response handling
- ✅ Error handling for API failures

## Test Coverage Goals

- **Service Layer**: 80%+ coverage
- **Critical Paths**: 100% coverage
  - Authentication flows
  - Diagnostic data sync
  - Chat message persistence

## Mocking Strategy

### Supabase Client
All Supabase client calls are mocked in `src/test/setup.ts`:
- Auth methods (signUp, signIn, signOut, etc.)
- Database queries (from, select, insert, update, delete)
- Edge function invocations

### localStorage
Mocked using `vi.spyOn` for sync tests

## Adding New Tests

1. Create test file in appropriate `__tests__/` directory
2. Import service/component under test
3. Mock external dependencies
4. Write test cases covering:
   - Happy paths
   - Error cases
   - Edge cases
   - Authentication states

## CI/CD Integration

Tests run automatically on:
- Pull requests
- Main branch commits
- Before deployment

## Test Utilities

Located in `src/test/`:
- `setup.ts` - Global test configuration
- Mock factories (to be added as needed)
- Test helpers (to be added as needed)

## Known Limitations

- Edge functions are not tested (Deno runtime required)
- Component integration tests pending (Phase 4)
- E2E tests pending (Phase 4)

## Next Steps

Phase 4 will add:
- React component tests
- Integration tests
- E2E tests with Playwright
- Visual regression tests
