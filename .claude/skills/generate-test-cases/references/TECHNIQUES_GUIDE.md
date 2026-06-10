# Test Case Design Techniques - Implementation Guide

This guide explains how to apply each test case design technique in practice when using the `/generate-test-cases` skill.

---

## 1. EQUIVALENCE PARTITIONING

### Concept
Divide input space into logical groups (equivalence classes) where all values are expected to behave identically. Test one representative from each partition.

### How to Apply

**Step 1: Identify Input Domain**
```
Feature: Create Order
Input: Quantity (positive decimal number)
Valid range: 0.0001 to 1,000,000
```

**Step 2: Define Partitions**
```
Partition 1 (Valid): 0.0001 <= quantity <= 1,000,000
  Representative: 100

Partition 2 (Too Small): quantity < 0.0001
  Representative: 0.00001

Partition 3 (Too Large): quantity > 1,000,000
  Representative: 2,000,000

Partition 4 (Invalid Type): non-numeric
  Representative: "abc"

Partition 5 (Null/Empty): null or empty
  Representative: null
```

**Step 3: Generate Test Cases**
```typescript
describe('Order Creation - Equivalence Partitioning', () => {
  // Valid partition
  test('creates order with valid quantity 100', async () => {
    const result = await createOrder({ quantity: 100 });
    expect(result.status).toBe('created');
  });

  // Partition: too small
  test('rejects order with quantity below minimum', async () => {
    const result = await createOrder({ quantity: 0.00001 });
    expect(result.error).toContain('minimum quantity');
  });

  // Partition: too large
  test('rejects order with quantity above maximum', async () => {
    const result = await createOrder({ quantity: 2000000 });
    expect(result.error).toContain('maximum quantity');
  });

  // Partition: invalid type
  test('rejects order with non-numeric quantity', async () => {
    const result = await createOrder({ quantity: 'abc' });
    expect(result.error).toContain('invalid');
  });

  // Partition: null
  test('rejects order with null quantity', async () => {
    const result = await createOrder({ quantity: null });
    expect(result.error).toContain('required');
  });
});
```

### Benefits
- Reduces test cases from infinite possibilities to manageable number
- Systematic coverage of input space
- Cost-effective

### Limitations
- Assumes all values in partition behave identically (may not always be true)
- Doesn't catch boundary defects (use BVA for that)

---

## 2. BOUNDARY VALUE ANALYSIS (BVA)

### Concept
Test values at boundaries between equivalence partitions, since defects cluster at edges (off-by-one errors, etc.).

### How to Apply

**Step 1: Identify Boundaries**
```
Feature: Withdraw from Account
Input: withdrawal_amount
Min boundary: $0 (exclusive)
Max boundary: account_balance

Example:
  If account has $1,000
  Min boundary: $0.01
  Max boundary: $1,000
```

**Step 2: Define Test Values (3-Value Approach)**
```
For min boundary ($0.01):
  - Just below: $0.00 (invalid)
  - At boundary: $0.01 (valid)
  - Just above: $0.02 (valid)

For max boundary ($1,000):
  - Just below: $999.99 (valid)
  - At boundary: $1,000.00 (valid)
  - Just above: $1,000.01 (invalid)
```

**Step 3: Generate Test Cases**
```python
@pytest.mark.parametrize("withdrawal,expected_status", [
    (0.00, "error"),      # Below min boundary
    (0.01, "success"),    # At min boundary
    (0.02, "success"),    # Above min boundary
    (999.99, "success"),  # Below max boundary
    (1000.00, "success"), # At max boundary
    (1000.01, "error"),   # Above max boundary
], ids=[
    "below_min",
    "at_min",
    "above_min",
    "below_max",
    "at_max",
    "above_max"
])
def test_withdrawal_boundaries(withdrawal, expected_status, account_with_balance_1000):
    result = account_with_balance_1000.withdraw(withdrawal)
    assert result['status'] == expected_status
```

### Benefits
- High defect detection rate at boundaries
- Complements equivalence partitioning perfectly
- Targets areas where defects cluster
- Minimal additional test cases

### Limitations
- Limited to identifying boundary errors only
- Doesn't test multiple condition combinations
- Requires careful boundary identification

---

## 3. DECISION TABLE TESTING

### Concept
Create a matrix mapping condition combinations to expected actions/outputs. Ensures all combinations are tested systematically.

### How to Apply

**Step 1: Identify All Conditions and Actions**
```
Feature: Order Approval
Conditions:
  C1: User has sufficient balance? (Yes/No)
  C2: Order type is valid? (Yes/No)
  C3: Daily limit exceeded? (Yes/No)

Actions:
  A1: Approve order
  A2: Reject with insufficient funds error
  A3: Reject with invalid order type error
  A4: Reject with daily limit error
```

**Step 2: Create Decision Table**
```
| C1 (Balance) | C2 (Valid) | C3 (Limit) | Expected Result |
|--------------|-----------|----------|-----------------|
| Y            | Y         | N        | Approve (A1)    |
| Y            | Y         | Y        | Reject (A4)     |
| Y            | N         | N        | Reject (A3)     |
| Y            | N         | Y        | Reject (A3)     |
| N            | Y         | N        | Reject (A2)     |
| N            | Y         | Y        | Reject (A2)     |
| N            | N         | N        | Reject (A2)     |
| N            | N         | Y        | Reject (A2)     |
```

**Step 3: Generate Test Cases**
```python
@pytest.mark.parametrize("has_balance,valid_type,over_limit,expected_action", [
    # Rule 1: All conditions satisfied
    (True, True, False, "approve"),
    # Rule 2: Daily limit exceeded
    (True, True, True, "reject_limit"),
    # Rule 3: Invalid order type
    (True, False, False, "reject_type"),
    (True, False, True, "reject_type"),  # Type error takes precedence
    # Rule 4-7: Insufficient balance (most critical failure)
    (False, True, False, "reject_balance"),
    (False, True, True, "reject_balance"),
    (False, False, False, "reject_balance"),
    (False, False, True, "reject_balance"),
], ids=[
    "all_valid",
    "limit_exceeded",
    "invalid_type_only",
    "invalid_type_and_limit",
    "insufficient_balance_only",
    "insufficient_balance_with_limit",
    "insufficient_balance_invalid_type",
    "all_invalid"
])
def test_order_approval_rules(has_balance, valid_type, over_limit, expected_action):
    user = create_user(balance=1000 if has_balance else 100)
    order = create_order(
        type='valid' if valid_type else 'invalid',
        amount=100 if not over_limit else 10000
    )
    result = approve_order(user, order)
    assert result['action'] == expected_action
```

### When to Use
- Complex business rules
- Multiple interdependent conditions
- Financial/compliance logic
- Risk-critical features

### Benefits
- Ensures all condition combinations tested
- Reveals contradictory rules
- Documents business logic explicitly
- Systematically finds gaps

### Limitations
- Can result in many test cases (2^n combinations)
- Time-consuming to create for many conditions
- May contain redundant cases

---

## 4. STATE TRANSITION TESTING

### Concept
Test system behavior as it transitions between defined states. Validate valid/invalid transitions and actions during changes.

### How to Apply

**Step 1: Identify All States**
```
Feature: Order Lifecycle
States:
  PENDING - Waiting to match
  PARTIALLY_FILLED - Partially matched
  FILLED - Completely matched
  CANCELLED - User cancelled
  REJECTED - System rejected
```

**Step 2: Map Valid Transitions**
```
PENDING
  ├─→ PARTIALLY_FILLED (on partial match)
  ├─→ FILLED (on full match)
  ├─→ CANCELLED (on user cancel)
  └─→ REJECTED (on validation failure)

PARTIALLY_FILLED
  ├─→ FILLED (on remaining match)
  ├─→ CANCELLED (on user cancel)
  └─→ REJECTED (system error)

FILLED
  └─→ (terminal state - no transitions)

CANCELLED
  └─→ (terminal state - no transitions)

REJECTED
  └─→ (terminal state - no transitions)
```

**Step 3: Identify Invalid Transitions**
```
Invalid transitions that should be rejected:
- FILLED → PENDING (can't reopen)
- CANCELLED → PENDING (can't reactivate)
- REJECTED → PARTIALLY_FILLED (can't recover)
- Any state → PENDING (except initial creation)
```

**Step 4: Generate Test Cases**
```typescript
describe('Order State Transitions', () => {
  describe('Valid Transitions from PENDING', () => {
    test('transitions to PARTIALLY_FILLED on partial match', async () => {
      const order = await createOrder();
      expect(order.state).toBe('PENDING');
      
      await matchPartially(order.id);
      const updated = await getOrder(order.id);
      expect(updated.state).toBe('PARTIALLY_FILLED');
    });

    test('transitions to FILLED on complete match', async () => {
      const order = await createOrder();
      await matchFully(order.id);
      const updated = await getOrder(order.id);
      expect(updated.state).toBe('FILLED');
    });

    test('transitions to CANCELLED on user cancel', async () => {
      const order = await createOrder();
      await cancelOrder(order.id);
      const updated = await getOrder(order.id);
      expect(updated.state).toBe('CANCELLED');
    });
  });

  describe('Valid Transitions from PARTIALLY_FILLED', () => {
    test('transitions to FILLED on remaining match', async () => {
      const order = await createPartiallyFilledOrder();
      await matchRemaining(order.id);
      const updated = await getOrder(order.id);
      expect(updated.state).toBe('FILLED');
    });

    test('transitions to CANCELLED on user cancel', async () => {
      const order = await createPartiallyFilledOrder();
      await cancelOrder(order.id);
      const updated = await getOrder(order.id);
      expect(updated.state).toBe('CANCELLED');
    });
  });

  describe('Invalid Transitions (should fail)', () => {
    test('cannot transition FILLED back to PENDING', async () => {
      const order = await createFilledOrder();
      const result = await cancelOrder(order.id);
      expect(result.error).toContain('invalid transition');
      
      const updated = await getOrder(order.id);
      expect(updated.state).toBe('FILLED'); // State unchanged
    });

    test('cannot transition CANCELLED back to PENDING', async () => {
      const order = await createCancelledOrder();
      const result = await reactivateOrder(order.id);
      expect(result.error).toContain('terminal state');
    });
  });

  describe('State Actions (ensure correct behavior in each state)', () => {
    test('PENDING state allows cancellation', async () => {
      const order = await createOrder();
      const result = await cancelOrder(order.id);
      expect(result.success).toBe(true);
    });

    test('FILLED state prevents additional modifications', async () => {
      const order = await createFilledOrder();
      const result = await updateOrder(order.id, { price: 100 });
      expect(result.error).toContain('cannot modify');
    });
  });
});
```

### When to Use
- Stateful systems (order workflows, user authentication)
- Complex processes with multiple steps
- State-dependent behavior matters

### Benefits
- Reveals state-related defects
- Validates complex workflows
- Catches transition logic errors
- Ensures reliability

---

## 5. ERROR GUESSING

### Concept
Leverage experience and intuition to identify likely problem areas based on common errors, historical defects, and domain knowledge.

### How to Apply

**Step 1: Identify Common Error Scenarios**
```
For numeric inputs:
  - Zero/negative numbers
  - Very large numbers (overflow)
  - Decimal precision issues

For string inputs:
  - Empty string
  - Very long string
  - Special characters
  - SQL injection patterns
  - XSS patterns

For business logic:
  - Race conditions (concurrent operations)
  - Off-by-one errors
  - Null pointer exceptions
  - Resource exhaustion
```

**Step 2: Generate Error Scenarios**
```python
@pytest.mark.parametrize("input,description", [
    (None, "null value"),
    ("", "empty string"),
    (" ", "whitespace only"),
    ("a" * 10000, "extremely long string"),
    ("<script>alert('xss')</script>", "xss attempt"),
    ("'; DROP TABLE users;--", "sql injection attempt"),
    ("../../etc/passwd", "path traversal attempt"),
    ({"key": None}, "nested null"),
    (float('inf'), "infinity value"),
    (float('nan'), "not a number"),
], ids=[
    "null",
    "empty",
    "whitespace",
    "overflow",
    "xss",
    "sql_injection",
    "path_traversal",
    "nested_null",
    "infinity",
    "nan"
])
@pytest.mark.parametrize("endpoint", ["/api/users", "/api/orders", "/api/deposits"])
def test_error_scenarios(endpoint, input, description):
    """Test various error scenarios across endpoints"""
    response = requests.post(f"{API_URL}{endpoint}", json={"value": input})
    assert response.status_code in [400, 422]
    assert "error" in response.json()
```

**Step 3: Test Recovery**
```python
def test_system_recovery_from_errors():
    """Ensure system handles errors gracefully"""
    # Trigger error
    response = requests.post("/api/orders", json={"quantity": None})
    assert response.status_code != 500
    
    # Verify system still functional
    response = requests.post("/api/orders", json={"quantity": 100})
    assert response.status_code == 201
    assert response.json()['status'] == 'created'
```

---

## 6. USE CASE TESTING

### Concept
Derive test scenarios directly from real-world user workflows and business processes.

### How to Apply

**Step 1: Document Use Case**
```
Use Case: User Places and Fills a Buy Order

Actors:
  - Trader (primary)
  - Exchange System

Preconditions:
  - Trader is authenticated
  - Trader has sufficient balance in quote currency
  - Market is open

Main Flow:
  1. Trader views order book
  2. Trader selects a price level
  3. Trader enters quantity
  4. Trader confirms order
  5. System creates limit order (PENDING)
  6. System matches order against sellers
  7. Order state changes to FILLED
  8. System settles transaction
  9. Trader receives confirmation

Postconditions:
  - Order state is FILLED
  - Trader's quote balance decreased
  - Trader's base balance increased
  - Order appears in history
```

**Step 2: Generate Test Scenarios**
```typescript
describe('Use Case: Buy Order Lifecycle', () => {
  let trader: User;
  let initialQuoteBalance: number;
  let initialBaseBalance: number;

  beforeEach(async () => {
    trader = await createAuthenticatedUser({
      balances: { USD: 10000, BTC: 0 }
    });
    const balances = await getBalances(trader.id);
    initialQuoteBalance = balances.USD;
    initialBaseBalance = balances.BTC;
  });

  test('complete happy path: place, match, and fill buy order', async () => {
    // Step 1: View order book
    const orderBook = await getOrderBook('BTC/USD');
    expect(orderBook.asks.length).toBeGreaterThan(0);

    // Step 2-3: Create order
    const order = await createBuyOrder(trader.id, {
      price: orderBook.asks[0].price,
      quantity: 0.5,
      type: 'limit'
    });
    expect(order.state).toBe('PENDING');

    // Step 4-5: System creates order
    expect(order.id).toBeDefined();
    expect(order.createdAt).toBeDefined();

    // Step 6-7: Matching happens (wait for settlement)
    await waitFor(() => getOrder(order.id).then(o => o.state === 'FILLED'));
    const filledOrder = await getOrder(order.id);
    expect(filledOrder.state).toBe('FILLED');

    // Step 8: Verify settlement
    const finalBalances = await getBalances(trader.id);
    expect(finalBalances.USD).toBeLessThan(initialQuoteBalance);
    expect(finalBalances.BTC).toBeGreaterThan(initialBaseBalance);

    // Step 9: Verify history
    const history = await getOrderHistory(trader.id);
    expect(history).toContainEqual(
      expect.objectContaining({
        id: order.id,
        state: 'FILLED'
      })
    );
  });

  test('market is closed: order rejected', async () => {
    await closeMarket();
    const result = await createBuyOrder(trader.id, {
      price: 50000,
      quantity: 0.5
    });
    expect(result.error).toContain('market closed');
  });

  test('insufficient balance: order rejected', async () => {
    const orderBook = await getOrderBook('BTC/USD');
    const expensiveQuantity = initialQuoteBalance / orderBook.asks[0].price + 1;
    
    const result = await createBuyOrder(trader.id, {
      price: orderBook.asks[0].price,
      quantity: expensiveQuantity
    });
    expect(result.error).toContain('insufficient');
  });

  test('user disconnects during order: graceful handling', async () => {
    const order = await createBuyOrder(trader.id, {
      price: 50000,
      quantity: 0.5
    });
    expect(order.state).toBe('PENDING');

    // Simulate connection loss
    trader.connection.disconnect();
    await wait(100);

    // Order should continue processing server-side
    const finalOrder = await getOrder(order.id);
    expect([PENDING, PARTIALLY_FILLED, FILLED]).toContain(finalOrder.state);
  });
});
```

---

## Combining Techniques: Comprehensive Test Strategy

### For CryptoSandboxQA Order Creation

```
1. EQUIVALENCE PARTITIONING
   ├─ Valid order types (buy, sell)
   ├─ Valid amount ranges
   ├─ Invalid order types
   └─ Invalid amounts

2. BOUNDARY VALUE ANALYSIS
   ├─ Min order amount
   ├─ Max order amount
   ├─ Min balance for margin
   └─ Max concurrent orders

3. DECISION TABLE
   ├─ (Order type: buy/sell) × (Valid amount: yes/no) × (Balance sufficient: yes/no)

4. STATE TRANSITION
   ├─ PENDING → FILLED → SETTLED
   ├─ PENDING → CANCELLED
   └─ Invalid transitions

5. ERROR GUESSING
   ├─ Null amount
   ├─ Negative amount
   ├─ Non-numeric input
   ├─ Race condition (concurrent orders)
   └─ Network timeout

6. USE CASE
   ├─ User browses → selects → enters amount → confirms → receives confirmation
```

This combined approach ensures comprehensive coverage and high confidence in the feature's reliability.