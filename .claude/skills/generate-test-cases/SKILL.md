---
name: generate-test-cases
description: >-
  Generate test cases using Test Case Design Techniques (Equivalence Partitioning,
  Boundary Value Analysis, Decision Table Testing, State Transition Testing, etc.).
  Supports multiple formats (Jest, Pytest, Playwright). Use when user asks to generate,
  create, or design test cases for a feature, function, or workflow.
disable-model-invocation: false
---

# Generate Test Cases Using Design Techniques

When the user invokes `/generate-test-cases` or asks to generate/create test cases, help them design comprehensive test cases using industry-standard Test Case Design Techniques.

## Arguments

`$ARGUMENTS` may contain:
- Function/feature name to test: `login`, `order-creation`, `balance-transfer`
- Output format: `jest`, `pytest`, `playwright`, `typescript`, `python`
- Technique(s): `equivalence`, `boundary`, `decision-table`, `state-transition`, `all`
- Target file path: `tests/api/test_orders.py`, `tests/ui/auth.spec.ts`
- Complexity level: `basic`, `comprehensive` (default: comprehensive)

If incomplete, prompt the user to provide missing context.

## Test Case Generation Workflow Checklist

Use this checklist to track progress through test case creation:

- [ ] **Step 1:** Understand the feature
- [ ] **Step 2:** Identify applicable techniques  
- [ ] **Step 3:** Define test cases
- [ ] **Step 4:** Format for target framework
- [ ] **Step 5:** Save and tag test cases
- [ ] **Step 6:** Review and validate

---

## How to Use This Skill

### Step 1: Understand the Feature
Ask the user:
1. What is the feature/function you want to test? (e.g., "order creation", "user login")
2. What are the input parameters/values?
3. What are the expected behaviors/outputs?
4. Are there any conditions, state changes, or business rules involved?

### Step 2: Identify Applicable Techniques
Based on the feature characteristics, determine which techniques are most suitable:

**Use Equivalence Partitioning when:**
- Input has defined valid/invalid ranges
- Multiple values should behave identically
- Examples: age (18-65), email format, order quantity

**Use Boundary Value Analysis when:**
- Input values have edges/boundaries
- Off-by-one errors are likely
- Examples: min/max amounts, date boundaries

**Use Decision Table Testing when:**
- Multiple conditions determine output
- Complex business rules apply
- Examples: loan approval (income + credit score + debts), order status transitions

**Use State Transition Testing when:**
- System has defined states
- State changes matter
- Examples: order workflow (pending → processing → shipped), user status (guest → authenticated → locked)

**Use Error Guessing when:**
- Testing edge cases and error scenarios
- Special inputs: null, empty, special chars, very large values
- Examples: empty password, null user ID, overflow values

**Completed** ☐

### Step 3: Generate Test Cases
Create test cases that:
1. Cover all partitions (equivalence classes)
2. Include boundary values
3. Test condition combinations (decision table)
4. Cover state transitions
5. Include error scenarios and edge cases

### Step 4: Format for Target Framework
Generate test code in the requested format (Jest, Pytest, Playwright, etc.) with:
- Clear test names describing what is being tested
- Setup/teardown where needed
- Assertions for expected behavior
- Comments explaining the technique used
- Proper test tagging (see "Test Tagging System" section below)

### Step 5: Save and Tag Test Cases
Save generated test cases with proper structure and tags.

## Test Case Design Techniques Reference

See **references/TECHNIQUES_GUIDE.md** for detailed explanations of all 6 techniques with code examples.

Quick overview:

### 1. Equivalence Partitioning
Divides input data into groups where all values behave identically.
- **Example:** Age field (valid: 18-65, too young: <18, too old: >65)
- **Test from each:** 30 (valid), 5 (too young), 100 (too old)

### 2. Boundary Value Analysis (BVA)
Tests values at edges between partitions.
- **Example:** Age boundaries at 18 and 65
- **Test:** 17, 18, 19, 64, 65, 66

### 3. Decision Table Testing
Maps condition combinations to expected outputs.
- **Example:** Loan approval depends on (Income: High/Low, Credit: Good/Bad, Debts: Yes/No)
- **Creates:** 2³ = 8 test cases covering all combinations

### 4. State Transition Testing
Tests valid/invalid state changes and actions.
- **Example:** Order: New → Processing → Shipped → Delivered
- **Tests:** Each valid transition, invalid transitions, edge cases

### 5. Error Guessing
Tests likely error scenarios based on experience.
- **Example:** Empty string, null, special chars, overflow, negative numbers

### 6. Use Case Testing
Tests complete user workflows end-to-end.
- **Example:** Browse → Add to cart → Checkout → Payment → Confirmation

## Test Case Output Structure

Generated test cases should be saved with the following folder structure:

```
test-cases/
├── {feature}/
│   ├── {YYYY-MM-DD}/
│   │   └── test_cases.md
│   ├── {YYYY-MM-DD}/
│   │   └── test_cases.md
│   └── {YYYY-MM-DD}/
│       └── test_cases.md
├── order-creation/
│   ├── 2026-06-10/
│   │   └── test_cases.md
│   └── 2026-06-11/
│       └── test_cases.md
├── user-registration/
│   └── 2026-06-10/
│       └── test_cases.md
└── authentication/
    └── 2026-06-10/
        └── test_cases.md
```

**Location:** `test-cases/{feature}/{date}/test_cases.md`

**Example paths:**
- `test-cases/order-creation/2026-06-10/test_cases.md`
- `test-cases/authentication/2026-06-10/test_cases.md`
- `test-cases/deposit-validation/2026-06-10/test_cases.md`

---

## Test Tagging System

Each test case should be tagged with appropriate markers to enable filtering and categorization.

### Standard Tags

#### Priority Tags
- `@critical` — Mission-critical functionality (breaks product)
- `@high` — Important but not critical
- `@medium` — Nice-to-have functionality
- `@low` — Minor edge cases

#### Execution Tags
- `@smoke` — Quick smoke tests (fast execution)
- `@regression` — Catch regression bugs
- `@sanity` — Basic sanity checks
- `@e2e` — End-to-end integration tests
- `@unit` — Unit test level

#### Feature Tags
- `@orders` — Order creation, management, filling
- `@auth` — Authentication and authorization
- `@deposits` — Deposit functionality
- `@withdrawals` — Withdrawal functionality
- `@balances` — Balance management and transfers
- `@wallets` — Wallet operations
- `@settlements` — Settlement and reconciliation
- `@trading` — Trading operations
- `@validation` — Input validation

#### Technique Tags
- `@equivalence` — Uses Equivalence Partitioning
- `@boundary` — Uses Boundary Value Analysis
- `@decision-table` — Uses Decision Table Testing
- `@state-transition` — Uses State Transition Testing
- `@error-guessing` — Uses Error Guessing
- `@use-case` — Uses Use Case Testing

#### Status Tags
- `@manual` — Requires manual verification
- `@automated` — Fully automated
- `@flaky` — Known to be flaky/unreliable
- `@skip` — Skip during CI/CD

### Example Test Case with Tags

```markdown
## Test Case: Create Buy Order with Valid Amount

**Tags:** @orders @critical @smoke @boundary @automated

**Technique:** Boundary Value Analysis

**Feature:** Order Creation

**Priority:** Critical (affects core trading functionality)

**Preconditions:**
- User is authenticated
- User has sufficient balance: $10,000 USD

**Test Data:**
- Amount: $100 (valid boundary)
- Price: $50,000
- Order Type: Buy

**Expected Result:**
- Order created successfully
- Status: PENDING
- Amount locked in balance

---

## Test Case: Reject Order with Zero Amount

**Tags:** @orders @critical @boundary @error-guessing @automated

**Technique:** Boundary Value Analysis + Error Guessing

**Feature:** Order Creation

**Priority:** Critical

**Preconditions:**
- User is authenticated

**Test Data:**
- Amount: 0 (boundary edge)
- Price: $50,000
- Order Type: Buy

**Expected Result:**
- Order rejected
- Error: "Amount must be greater than 0"
- User balance unchanged
```

### Using Tags in Pytest

```python
# Run only critical tests
pytest -m critical

# Run smoke tests
pytest -m smoke

# Run order tests
pytest -m orders

# Combine tags (AND)
pytest -m "critical and orders"

# Exclude flaky tests
pytest -m "not flaky"

# Run everything except manual tests
pytest -m "not manual"
```

### Using Tags in Playwright

```typescript
// Run critical tests
npx playwright test --grep "@critical"

// Run smoke tests
npx playwright test --grep "@smoke"

// Run order tests
npx playwright test --grep "@orders"

// Run multiple tags
npx playwright test --grep "@critical|@smoke"

// Exclude flaky
npx playwright test --grep -v "@flaky"
```

---

## Reference Documentation

Navigate to the `references/` folder for detailed guides:

- **QUICK_REFERENCE.md** — One-page technique selection guide
- **TECHNIQUES_GUIDE.md** — Step-by-step how to apply each technique
- **EXAMPLES.md** — Real-world examples from CryptoSandboxQA

## Output Examples

### Jest/TypeScript
```typescript
describe('User Authentication', () => {
  describe('Equivalence Partitioning - Valid/Invalid Emails', () => {
    it('should accept valid email format', () => {
      // Test with representative from valid partition
    });
    it('should reject invalid email format', () => {
      // Test with representative from invalid partition
    });
  });

  describe('Boundary Value Analysis - Password Length', () => {
    it('should reject password with 7 characters (below min of 8)', () => {
      // Boundary test
    });
    it('should accept password with 8 characters (at boundary)', () => {
      // Boundary test
    });
    it('should accept password with 9 characters (above boundary)', () => {
      // Boundary test
    });
  });
});
```

### Pytest/Python
```python
@pytest.mark.parametrize("balance,amount,expected", [
    (1000, 500, True),      # Valid partition
    (100, 500, False),       # Insufficient balance partition
    (1000, 1000, True),      # Boundary: exact balance
    (1000, 1001, False),     # Boundary: exceeds balance
])
def test_withdraw_amount(balance, amount, expected):
    # Test cases covering equivalence partitioning + BVA
    pass
```

### Playwright
```typescript
test.describe('Order Creation', () => {
  test('should create order with valid quantity (equivalence partition)', async ({ page }) => {
    // Test representative value from valid partition
  });

  test('should reject zero quantity (boundary)', async ({ page }) => {
    // Test at boundary
  });

  test('should reject negative quantity (boundary)', async ({ page }) => {
    // Test outside boundary
  });
});
```

## Decision Table Format

| Condition 1 | Condition 2 | Condition 3 | Expected Output |
|------------|------------|------------|-----------------|
| T | T | T | Action A |
| T | T | F | Action B |
| ... | ... | ... | ... |

## After Generation

1. Show the user the generated test cases
2. Explain which technique(s) were used for each test
3. Ask if they want to:
   - Add more edge cases
   - Change the output format
   - Save to a specific file
   - Adjust the complexity level

## Common Patterns for CryptoSandboxQA

### Order Creation Testing
- **Partitions:** Valid amount, insufficient balance, zero amount, negative amount
- **Boundaries:** Min order (0.0001), max order (user balance), balance edge cases
- **Decision Table:** Order type (buy/sell) × Market/Limit × Valid balance/Invalid
- **Errors:** Null amount, invalid asset, locked balance

### Authentication Testing
- **Partitions:** Valid credentials, invalid email, wrong password, locked account
- **Boundaries:** Password length (min/max), rate limiting
- **Decision Table:** (Email exists Y/N) × (Password correct Y/N) × (2FA enabled Y/N)
- **State Transition:** Guest → Authenticating → Authenticated → Locked

### Deposit/Withdrawal Testing
- **Partitions:** Valid amount, exceeds balance, zero, negative
- **Boundaries:** Min deposit (set threshold), max per transaction
- **Decision Table:** (Amount valid Y/N) × (Balance sufficient Y/N) × (Limits Y/N)
- **Errors:** Network timeout, invalid wallet address, duplicate deposits