# Practical Examples for /generate-test-cases

Real-world examples of using the `/generate-test-cases` skill on CryptoSandboxQA features.

---

## Example 1: Testing User Registration with Equivalence Partitioning

### User Request
```
/generate-test-cases registration jest
```

### Feature Context
Feature: User Registration
- Input: email, password, firstName, lastName, username
- Valid email: standard format
- Valid password: 8+ characters, mix of upper/lower/numbers
- Valid name: 2-50 characters, no special chars
- Valid username: 3-20 chars, alphanumeric + underscore

### Analysis
Using **Equivalence Partitioning** to divide email validity:

```
Equivalence Classes:
1. Valid emails (test: "user@example.com")
2. Invalid format emails (test: "userexample.com")
3. Special char emails (test: "user+tag@example.com")
4. Very long emails (test: "a"*100 + "@example.com")
5. Null/empty emails (test: null, "")
```

### Generated Test Cases

```typescript
describe('User Registration', () => {
  describe('Email Validation - Equivalence Partitioning', () => {
    // Partition 1: Valid email format
    test('accepts valid email address', async () => {
      const result = await register({
        email: 'john.doe@example.com',
        password: 'SecurePass123',
        firstName: 'John',
        lastName: 'Doe',
        username: 'johndoe'
      });
      expect(result.status).toBe('created');
      expect(result.userId).toBeDefined();
    });

    // Partition 2: Invalid format - missing @
    test('rejects email without @ symbol', async () => {
      const result = await register({
        email: 'johndoeexample.com',
        password: 'SecurePass123',
        firstName: 'John',
        lastName: 'Doe',
        username: 'johndoe'
      });
      expect(result.error).toContain('valid email');
    });

    // Partition 3: Invalid format - missing domain
    test('rejects email without domain', async () => {
      const result = await register({
        email: 'johndoe@',
        password: 'SecurePass123',
        firstName: 'John',
        lastName: 'Doe',
        username: 'johndoe'
      });
      expect(result.error).toContain('valid email');
    });

    // Partition 4: Email with plus addressing (valid but special)
    test('accepts email with plus addressing', async () => {
      const result = await register({
        email: 'john+tag@example.com',
        password: 'SecurePass123',
        firstName: 'John',
        lastName: 'Doe',
        username: 'johndoe'
      });
      expect(result.status).toBe('created');
    });

    // Partition 5: Very long email
    test('rejects excessively long email address', async () => {
      const longEmail = 'a'.repeat(256) + '@example.com';
      const result = await register({
        email: longEmail,
        password: 'SecurePass123',
        firstName: 'John',
        lastName: 'Doe',
        username: 'johndoe'
      });
      expect(result.error).toContain('too long');
    });

    // Partition 6: Null email
    test('rejects null email', async () => {
      const result = await register({
        email: null,
        password: 'SecurePass123',
        firstName: 'John',
        lastName: 'Doe',
        username: 'johndoe'
      });
      expect(result.error).toContain('required');
    });

    // Partition 7: Empty email
    test('rejects empty email', async () => {
      const result = await register({
        email: '',
        password: 'SecurePass123',
        firstName: 'John',
        lastName: 'Doe',
        username: 'johndoe'
      });
      expect(result.error).toContain('required');
    });
  });

  describe('Password Validation - Boundary Value Analysis', () => {
    // Minimum boundary: 8 characters
    test('rejects password with 7 characters (below min)', async () => {
      const result = await register({
        email: 'john@example.com',
        password: 'Pass12!',  // 7 chars
        firstName: 'John',
        lastName: 'Doe',
        username: 'johndoe'
      });
      expect(result.error).toContain('at least 8');
    });

    test('accepts password with exactly 8 characters (at boundary)', async () => {
      const result = await register({
        email: 'john@example.com',
        password: 'Pass1234',  // exactly 8
        firstName: 'John',
        lastName: 'Doe',
        username: 'johndoe'
      });
      expect(result.status).toBe('created');
    });

    test('accepts password with 9 characters (above boundary)', async () => {
      const result = await register({
        email: 'john@example.com',
        password: 'Password1',  // 9 chars
        firstName: 'John',
        lastName: 'Doe',
        username: 'johndoe'
      });
      expect(result.status).toBe('created');
    });

    // Maximum boundary test if it exists
    test('accepts very long password (if no max enforced)', async () => {
      const result = await register({
        email: 'john@example.com',
        password: 'P' + 'a'.repeat(1000) + '1',
        firstName: 'John',
        lastName: 'Doe',
        username: 'johndoe'
      });
      expect([201, 400].includes(result.statusCode)); // Either works or has max limit
    });
  });

  describe('Username Validation - Equivalence Partitioning', () => {
    // Partition 1: Valid username
    test('accepts valid alphanumeric username', async () => {
      const result = await register({
        email: 'john@example.com',
        password: 'SecurePass123',
        firstName: 'John',
        lastName: 'Doe',
        username: 'john_doe_123'
      });
      expect(result.status).toBe('created');
    });

    // Partition 2: Too short
    test('rejects username shorter than 3 characters', async () => {
      const result = await register({
        email: 'john@example.com',
        password: 'SecurePass123',
        firstName: 'John',
        lastName: 'Doe',
        username: 'ab'
      });
      expect(result.error).toContain('at least 3');
    });

    // Partition 3: Contains invalid chars
    test('rejects username with special characters', async () => {
      const result = await register({
        email: 'john@example.com',
        password: 'SecurePass123',
        firstName: 'John',
        lastName: 'Doe',
        username: 'john@doe'  // @ not allowed
      });
      expect(result.error).toContain('alphanumeric');
    });

    // Partition 4: Already taken
    test('rejects duplicate username', async () => {
      await register({  // Create first user
        email: 'john@example.com',
        password: 'SecurePass123',
        firstName: 'John',
        lastName: 'Doe',
        username: 'johndoe'
      });

      const result = await register({  // Try to create duplicate
        email: 'jane@example.com',
        password: 'SecurePass123',
        firstName: 'Jane',
        lastName: 'Doe',
        username: 'johndoe'  // Same username
      });
      expect(result.error).toContain('already taken');
    });
  });

  describe('Combined Decision Table - Multiple Conditions', () => {
    // Tests the combination of multiple validations
    test.each([
      {
        email: 'valid@example.com',
        password: 'ValidPass123',
        firstName: 'John',
        lastName: 'Doe',
        username: 'johndoe',
        expectedStatus: 'created',
        description: 'All fields valid'
      },
      {
        email: 'invalid-email',
        password: 'ValidPass123',
        firstName: 'John',
        lastName: 'Doe',
        username: 'johndoe',
        expectedStatus: 'error',
        description: 'Invalid email'
      },
      {
        email: 'valid@example.com',
        password: 'short',
        firstName: 'John',
        lastName: 'Doe',
        username: 'johndoe',
        expectedStatus: 'error',
        description: 'Password too short'
      },
      {
        email: 'valid@example.com',
        password: 'ValidPass123',
        firstName: '',
        lastName: 'Doe',
        username: 'johndoe',
        expectedStatus: 'error',
        description: 'Missing first name'
      }
    ])('$description', async ({ email, password, firstName, lastName, username, expectedStatus }) => {
      const result = await register({ email, password, firstName, lastName, username });
      if (expectedStatus === 'created') {
        expect(result.status).toBe('created');
      } else {
        expect(result.error).toBeDefined();
      }
    });
  });

  describe('Error Guessing - Edge Cases', () => {
    test('handles email with whitespace', async () => {
      const result = await register({
        email: ' john@example.com ',
        password: 'SecurePass123',
        firstName: 'John',
        lastName: 'Doe',
        username: 'johndoe'
      });
      // Should either trim or reject
      expect(['created', 'error']).toContain(result.status || result.error);
    });

    test('handles null firstName', async () => {
      const result = await register({
        email: 'john@example.com',
        password: 'SecurePass123',
        firstName: null,
        lastName: 'Doe',
        username: 'johndoe'
      });
      expect(result.error).toContain('required');
    });

    test('handles special characters in name fields', async () => {
      const result = await register({
        email: 'john@example.com',
        password: 'SecurePass123',
        firstName: "John<script>alert('xss')</script>",
        lastName: 'Doe',
        username: 'johndoe'
      });
      expect(result.error).toBeDefined();
    });
  });
});
```

---

## Example 2: Testing Order Creation with State Transitions & Decision Tables

### User Request
```
/generate-test-cases order-creation pytest state-transition decision-table
```

### Feature Context
Feature: Create Buy/Sell Order
- Inputs: type (buy/sell), amount, price
- Business Rules:
  - C1: Order type valid? (buy/sell only)
  - C2: Amount positive? (> 0)
  - C3: User balance sufficient? (yes/no)
  - C4: Order type is buy AND price is reasonable? (for market orders)

### Analysis
Using **Decision Table** + **State Transitions**:

```
Decision Table (3 conditions = 8 test cases):
| Valid Type | Amount > 0 | Sufficient Balance | Expected Result |
|------------|-----------|-------------------|-----------------|
| Y          | Y         | Y                 | CREATE (PENDING)|
| Y          | Y         | N                 | ERROR           |
| Y          | N         | Y                 | ERROR           |
| Y          | N         | N                 | ERROR           |
| N          | Y         | Y                 | ERROR           |
| N          | Y         | N                 | ERROR           |
| N          | N         | Y                 | ERROR           |
| N          | N         | N                 | ERROR           |

State Transitions:
PENDING → (PARTIALLY_FILLED | FILLED | CANCELLED | REJECTED)
```

### Generated Test Cases

```python
import pytest
from decimal import Decimal

class TestOrderCreation:
    """Test order creation using Decision Table + State Transitions"""

    @pytest.fixture
    def user_with_balance(self):
        """Create user with known balance"""
        return create_user(
            email="trader@example.com",
            balances={"USD": 10000, "BTC": 1.0}
        )

    @pytest.mark.parametrize(
        "order_type,amount,has_balance,expected_status,expected_state",
        [
            # Rule 1: All conditions valid
            ("buy", Decimal("100"), True, 201, "PENDING"),
            ("sell", Decimal("0.5"), True, 201, "PENDING"),

            # Rule 2: Invalid order type
            ("invalid", Decimal("100"), True, 400, None),

            # Rule 3: Invalid amount (zero)
            ("buy", Decimal("0"), True, 400, None),

            # Rule 4: Invalid amount (negative)
            ("buy", Decimal("-100"), True, 400, None),

            # Rule 5: Insufficient balance
            ("buy", Decimal("20000"), True, 400, None),

            # Rule 6: Invalid type + zero amount
            ("invalid", Decimal("0"), True, 400, None),

            # Rule 7: Invalid type + insufficient balance
            ("invalid", Decimal("20000"), True, 400, None),

            # Rule 8: Zero amount + insufficient balance
            ("buy", Decimal("0"), False, 400, None),
        ],
        ids=[
            "buy_valid_all",
            "sell_valid_all",
            "invalid_type",
            "zero_amount",
            "negative_amount",
            "insufficient_balance",
            "invalid_type_zero_amount",
            "invalid_type_insufficient_balance",
            "zero_amount_insufficient_balance"
        ]
    )
    def test_order_creation_decision_table(
        self, user_with_balance, order_type, amount, has_balance,
        expected_status, expected_state
    ):
        """Test all combinations of order creation conditions"""
        user = user_with_balance if has_balance else create_user(
            email="poor@example.com",
            balances={"USD": 100, "BTC": 0.001}
        )

        response = create_order(
            user_id=user.id,
            order_type=order_type,
            amount=amount,
            price=Decimal("50000")
        )

        assert response['status_code'] == expected_status
        
        if expected_state:
            assert response['data']['state'] == expected_state
            assert response['data']['user_id'] == user.id
            assert response['data']['type'] == order_type
        else:
            assert 'error' in response['data']

    class TestOrderStateTransitions:
        """Test valid and invalid state transitions"""

        def test_valid_transition_pending_to_filled(self):
            """Transition: PENDING → FILLED (complete match)"""
            order = create_order(
                order_type="buy",
                amount=1.0,
                price=Decimal("50000")
            )
            assert order['state'] == 'PENDING'

            # Simulate matching
            match_order(order.id, matched_amount=1.0)

            updated_order = get_order(order.id)
            assert updated_order['state'] == 'FILLED'
            assert updated_order['filled_amount'] == Decimal("1.0")

        def test_valid_transition_pending_to_partially_filled(self):
            """Transition: PENDING → PARTIALLY_FILLED (partial match)"""
            order = create_order(
                order_type="buy",
                amount=1.0,
                price=Decimal("50000")
            )
            assert order['state'] == 'PENDING'

            # Partial match
            match_order(order.id, matched_amount=0.3)

            updated_order = get_order(order.id)
            assert updated_order['state'] == 'PARTIALLY_FILLED'
            assert updated_order['filled_amount'] == Decimal("0.3")

        def test_valid_transition_pending_to_cancelled(self):
            """Transition: PENDING → CANCELLED (user cancels)"""
            order = create_order(
                order_type="buy",
                amount=1.0,
                price=Decimal("50000")
            )
            assert order['state'] == 'PENDING'

            cancel_order(order.id)

            updated_order = get_order(order.id)
            assert updated_order['state'] == 'CANCELLED'
            assert updated_order['cancelled_at'] is not None

        def test_valid_transition_partially_filled_to_filled(self):
            """Transition: PARTIALLY_FILLED → FILLED (complete remaining)"""
            order = create_order(
                order_type="buy",
                amount=1.0,
                price=Decimal("50000")
            )
            match_order(order.id, matched_amount=0.3)  # Partial
            assert get_order(order.id)['state'] == 'PARTIALLY_FILLED'

            # Match remaining
            match_order(order.id, matched_amount=0.7)

            updated_order = get_order(order.id)
            assert updated_order['state'] == 'FILLED'
            assert updated_order['filled_amount'] == Decimal("1.0")

        def test_invalid_transition_filled_to_cancelled(self):
            """Invalid: FILLED → CANCELLED (can't cancel filled order)"""
            order = create_filled_order()
            assert order['state'] == 'FILLED'

            result = cancel_order(order.id)

            assert result['error'] is not None
            assert 'invalid transition' in result['error'].lower()
            
            # Verify state unchanged
            updated = get_order(order.id)
            assert updated['state'] == 'FILLED'

        def test_invalid_transition_cancelled_to_pending(self):
            """Invalid: CANCELLED → PENDING (can't reactivate)"""
            order = create_cancelled_order()
            assert order['state'] == 'CANCELLED'

            result = reactivate_order(order.id)

            assert result['error'] is not None
            assert 'terminal' in result['error'].lower()

        def test_invalid_transition_filled_to_partially_filled(self):
            """Invalid: FILLED → PARTIALLY_FILLED (can't go backwards)"""
            order = create_filled_order()
            
            result = unmatch_order(order.id, amount=0.5)

            assert result['error'] is not None
            updated = get_order(order.id)
            assert updated['state'] == 'FILLED'  # Unchanged

        @pytest.mark.parametrize(
            "from_state,action,should_succeed",
            [
                ("PENDING", "modify_price", True),
                ("PENDING", "modify_amount", True),
                ("PENDING", "cancel", True),
                ("PARTIALLY_FILLED", "modify_price", False),
                ("PARTIALLY_FILLED", "cancel", True),
                ("FILLED", "modify_price", False),
                ("FILLED", "modify_amount", False),
                ("FILLED", "cancel", False),
                ("CANCELLED", "modify_price", False),
                ("CANCELLED", "cancel", False),
            ],
            ids=[
                "pending_modify_price",
                "pending_modify_amount",
                "pending_cancel",
                "partial_modify_price",
                "partial_cancel",
                "filled_modify_price",
                "filled_modify_amount",
                "filled_cancel",
                "cancelled_modify_price",
                "cancelled_cancel"
            ]
        )
        def test_state_dependent_actions(self, from_state, action, should_succeed):
            """Test that state determines what actions are allowed"""
            order = create_order_in_state(from_state)

            if action == "modify_price":
                result = modify_order(order.id, price=Decimal("51000"))
            elif action == "modify_amount":
                result = modify_order(order.id, amount=Decimal("2.0"))
            elif action == "cancel":
                result = cancel_order(order.id)

            if should_succeed:
                assert result['error'] is None
            else:
                assert result['error'] is not None
                assert 'cannot' in result['error'].lower() or 'invalid' in result['error'].lower()

    class TestOrderErrorGuessing:
        """Test edge cases and error scenarios"""

        @pytest.mark.parametrize("invalid_input", [
            None,  # null
            "",    # empty
            "invalid",  # non-numeric string
            float('inf'),  # infinity
            float('nan'),  # NaN
            Decimal('-1'),  # negative
        ])
        def test_invalid_amount_values(self, user_with_balance, invalid_input):
            """Test various invalid amount inputs"""
            result = create_order(
                user_id=user_with_balance.id,
                order_type="buy",
                amount=invalid_input,
                price=Decimal("50000")
            )
            assert result['status_code'] in [400, 422]
            assert 'error' in result['data']

        def test_order_with_missing_fields(self, user_with_balance):
            """Test order creation with missing required fields"""
            # Missing price
            result = create_order(
                user_id=user_with_balance.id,
                order_type="buy",
                amount=Decimal("100"),
                price=None
            )
            assert result['status_code'] in [400, 422]

        def test_concurrent_order_creation(self, user_with_balance):
            """Test race condition: create 2 orders simultaneously"""
            import asyncio
            
            async def create():
                return create_order(
                    user_id=user_with_balance.id,
                    order_type="buy",
                    amount=Decimal("100"),
                    price=Decimal("50000")
                )
            
            # Create orders concurrently
            results = asyncio.run(asyncio.gather(create(), create()))
            
            # Both should succeed (no collision)
            assert all(r['status_code'] == 201 for r in results)
            assert results[0]['data']['id'] != results[1]['data']['id']

        def test_order_idempotency(self, user_with_balance):
            """Test that resending same request doesn't create duplicate"""
            order_request = {
                "user_id": user_with_balance.id,
                "order_type": "buy",
                "amount": Decimal("100"),
                "price": Decimal("50000"),
                "idempotency_key": "unique-123"
            }

            result1 = create_order(**order_request)
            result2 = create_order(**order_request)

            assert result1['data']['id'] == result2['data']['id']
            assert get_order_count(user_with_balance.id) == 1
```

---

## Example 3: Quick Reference Command Usage

```bash
# Generate test cases for login with all techniques
/generate-test-cases login

# Generate pytest cases for deposit validation, basic level
/generate-test-cases deposits pytest basic

# Generate Jest tests for balance transfer, equivalence + boundary only
/generate-test-cases balance-transfer jest equivalence boundary

# Generate Playwright tests for checkout flow, comprehensive
/generate-test-cases checkout playwright comprehensive all

# Generate test cases and save to specific file
/generate-test-cases settlement-logic python tests/backend_tests/test_settlement.py
```

---

## When to Use Each Technique

| Feature Type | Best Techniques | Why |
|--------------|-----------------|-----|
| **Input Validation** | Equivalence + Boundary | Covers ranges and edges |
| **Complex Rules** | Decision Table | Ensures all condition combinations |
| **Workflows** | State Transition + Use Case | Tests real-world paths |
| **Security** | Error Guessing | Catches edge cases |
| **User Flows** | Use Case | Tests end-to-end |
| **API** | All (layered approach) | Maximum coverage |

---

## Tips for Effective Test Case Generation

1. **Combine Techniques** - Use equivalence + boundary as foundation, add others as needed
2. **Name Tests Clearly** - Test name should describe what condition is being tested
3. **One Assertion Rule** - Each test should verify one specific behavior
4. **Use Parametrization** - For similar test cases with different inputs
5. **Document Edge Cases** - Explain why edge cases matter
6. **Review with Team** - Ensure test logic matches business requirements
7. **Maintain Test Data** - Use fixtures for consistent setup/teardown