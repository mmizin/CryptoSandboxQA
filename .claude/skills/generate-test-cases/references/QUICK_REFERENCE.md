# Test Case Design Techniques - Quick Reference Card

## 1️⃣ EQUIVALENCE PARTITIONING
**What:** Divide inputs into groups where all values behave identically  
**When:** Range-based inputs, many similar values  
**Example:** Age 18-65 (valid), <18 (too young), >65 (too old)  
**Test:** One value per partition  

```python
# Instead of testing every number 0-1000
# Test: 30 (valid), 5 (invalid), 100 (invalid)
```

---

## 2️⃣ BOUNDARY VALUE ANALYSIS (BVA)
**What:** Test values at edges between partitions  
**When:** Numeric ranges, off-by-one errors likely  
**Example:** Age at 18 → test 17, 18, 19  
**Test:** Just before, at, just after boundary  

```python
# Test boundaries: 17 (fail), 18 (pass), 19 (pass)
# Test boundaries: 64 (pass), 65 (pass), 66 (fail)
```

---

## 3️⃣ DECISION TABLE TESTING
**What:** Map condition combinations to outputs  
**When:** Multiple conditions determine outcome  
**Example:** (Income: H/L) × (Credit: G/B) × (Debts: Y/N) = 8 rules  
**Test:** All combinations  

```python
# For 3 conditions → 2³ = 8 test cases
# Systematically covers every combination
```

---

## 4️⃣ STATE TRANSITION TESTING
**What:** Test valid/invalid state changes  
**When:** Stateful systems (workflows, auth)  
**Example:** Order: PENDING → FILLED → SETTLED  
**Test:** Each transition and invalid transitions  

```python
# Valid: PENDING → FILLED
# Invalid: FILLED → PENDING (reject)
```

---

## 5️⃣ ERROR GUESSING
**What:** Intuitively identify likely problems  
**When:** Edge cases, unusual inputs  
**Example:** null, empty, very large, special chars  
**Test:** Common mistakes and error scenarios  

```python
# Test: null, "", -1, overflow, XSS, SQL injection, etc.
```

---

## 6️⃣ USE CASE TESTING
**What:** Test real-world user workflows  
**When:** End-to-end, user-facing features  
**Example:** Browse → Add cart → Checkout → Confirm  
**Test:** Complete user journeys  

```python
# Full workflow from start to finish
# Tests integration of all components
```

---

## Quick Selection Guide

| Input Type | Primary Technique | Secondary |
|------------|-------------------|-----------|
| **Range** (age, amount) | Equivalence + Boundary | Error Guessing |
| **Multiple conditions** (rules) | Decision Table | Equivalence |
| **States** (workflow) | State Transition | Use Case |
| **Format** (email, password) | Equivalence + Error | Boundary |
| **User workflow** | Use Case | State Transition |
| **Any feature** | Start with Equivalence + Boundary, add others as needed |  |

---

## Test Count Estimates

| Technique | Complexity | Effort | Coverage |
|-----------|-----------|--------|----------|
| Equivalence | Low | Low | Medium |
| Boundary | Low | Very Low | Medium-High |
| Decision Table | Medium-High | Medium-High | Very High |
| State Transition | Medium | Medium | High |
| Error Guessing | N/A | Low | Medium |
| Use Case | Medium | Medium | Medium |

---

## Testing Strategy by Feature Type

### 🔐 Authentication
```
1. Equivalence Partition: valid user, invalid user, locked user
2. Boundary: password length edges
3. Decision Table: (user exists Y/N) × (pwd correct Y/N) × (2FA Y/N)
4. State Transition: Guest → Authenticating → Auth → Locked
5. Error Guess: null fields, SQL injection, rate limiting
```

### 💰 Financial Transaction
```
1. Equivalence: valid amount, insufficient, zero, negative
2. Boundary: min/max transaction size, balance edges
3. Decision Table: (amount valid Y/N) × (balance sufficient Y/N) × (limits Y/N)
4. State Transition: PENDING → PROCESSING → COMPLETED
5. Error Guess: race conditions, decimal precision, overflow
```

### 📝 Form Validation
```
1. Equivalence: valid input, invalid type, wrong format
2. Boundary: min/max length, edge characters
3. Error Guess: null, empty, XSS, special chars
4. Use Case: full form fill → submit → confirmation
```

### 📊 Order Management
```
1. Equivalence: valid order, invalid qty, invalid type
2. Boundary: min order, max order, market price edges
3. Decision Table: (type valid Y/N) × (qty valid Y/N) × (balance Y/N)
4. State Transition: PENDING → PARTIAL → FILLED → SETTLED
5. Use Case: browse → select → enter qty → confirm → fill → settle
```

---

## Skill Invocation

```bash
# Basic usage
/generate-test-cases feature-name

# With options
/generate-test-cases order-creation jest  # Format
/generate-test-cases login pytest comprehensive  # Complexity
/generate-test-cases deposit equivalence boundary  # Specific techniques

# With file target
/generate-test-cases auth typescript tests/ui/auth.spec.ts
```

---

## Common Pitfalls to Avoid

❌ **Only testing the happy path** - Test error cases too!  
❌ **Too many similar tests** - Use parametrization to consolidate  
❌ **No documentation** - Explain why each edge case matters  
❌ **Mixing unrelated assertions** - One test = one behavior  
❌ **Using only one technique** - Combine for best coverage  
❌ **Not testing state transitions** - Stateful features need transition tests  
❌ **Ignoring concurrency** - Test race conditions for shared resources  

---

## Technique Combinations That Work Well

**Robust API Testing:**
```
Equivalence + Boundary + Error Guessing + Decision Table
```

**Complex Workflow Testing:**
```
State Transition + Use Case + Decision Table + Error Guessing
```

**Input Validation Testing:**
```
Equivalence + Boundary + Error Guessing
```

**Financial/Compliance:**
```
Decision Table + Boundary + State Transition + Error Guessing
```

---

## Formula for Test Case Count

### Conservative (minimum coverage):
```
Tests = (# equivalence partitions) + (# boundaries × 3) + (error cases)
```

### Comprehensive (high confidence):
```
Tests = Conservative + (# decision table rules) + (state transitions)
```

### Example: Order Creation
```
Partitions: 5 (valid, zero, negative, non-numeric, null)
Boundaries: 3 (min, max, edge amounts) × 3 = 9
Decision: 8 (valid type × valid amount × sufficient balance)
Errors: 5 (special cases)
States: 4 (transitions)
─────────────────────────────────
Total ≈ 5 + 9 + 8 + 5 + 4 = 31 comprehensive test cases
```

---

## Resources

- **SKILL.md** - Main skill documentation with step-by-step process
- **TECHNIQUES_GUIDE.md** - Detailed explanation of each technique with examples
- **EXAMPLES.md** - Real-world examples from CryptoSandboxQA
- **QUICK_REFERENCE.md** - This file

---

## Next Steps After Generation

1. ✅ Review generated test cases
2. ✅ Verify technique selection
3. ✅ Add data fixtures/setup
4. ✅ Run tests to ensure they work
5. ✅ Commit tests with clear messages
6. ✅ Monitor for missed edge cases during real testing