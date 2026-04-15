/**
 * Sample payloads for OpenAPI response `example` / `examples` fields.
 * Illustrative only — IDs, tokens, and dates are placeholders.
 */

const ISO = '2026-04-09T12:00:00.000Z';

export const httpError = {
  badRequest: { statusCode: 400, message: 'Invalid or expired reset code', error: 'Bad Request' },
  badRequestGeneric: { statusCode: 400, message: 'Invalid preset or date range', error: 'Bad Request' },
  unauthorized: { statusCode: 401, message: 'Invalid or missing admin API key', error: 'Unauthorized' },
  forbidden: { statusCode: 403, message: 'Admin access required', error: 'Forbidden' },
  notFound: { statusCode: 404, message: 'User not found', error: 'Not Found' },
  notFoundWallet: { statusCode: 404, message: 'Wallet not found', error: 'Not Found' },
  conflict: { statusCode: 409, message: 'Email already in use', error: 'Conflict' },
  conflictEmail: { statusCode: 409, message: 'Email already registered', error: 'Conflict' },
} as const;

export const auth = {
  accessToken: {
    access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example',
    user: {
      id: '550e8400-e29b-41d4-a716-446655440000',
      email: 'trader@example.com',
      displayName: 'Demo Trader',
      role: 'user',
      emailVerifiedAt: ISO,
      createdAt: ISO,
      updatedAt: ISO,
      profile: { username: 'demotrader', fullName: 'Demo Trader' },
    },
  },
  adminAccessToken: {
    access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.admin',
    user: {
      id: '660e8400-e29b-41d4-a716-446655440001',
      email: 'admin@example.com',
      displayName: 'Admin',
      role: 'admin',
      createdAt: ISO,
      updatedAt: ISO,
    },
  },
  requires2FA: {
    requires2FA: true,
    tempToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.temp2fa',
  },
  forgotPassword: {
    message:
      'If an account exists for this email, a reset code has been sent. Check your inbox.',
  },
  resetPasswordSuccess: { success: true },
  impersonation: {
    access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.imp',
    backToAdminToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.back',
    user: {
      id: '770e8400-e29b-41d4-a716-446655440002',
      email: 'target@example.com',
      displayName: 'Target User',
      role: 'user',
      impersonatedBy: '660e8400-e29b-41d4-a716-446655440001',
    },
  },
  bulkImport: {
    created: 2,
    failed: 0,
    skipped: 1,
    rows: [
      { email: 'new@example.com', status: 'created' as const, userId: '880e8400-e29b-41d4-a716-446655440003' },
      { email: 'dup@example.com', status: 'skipped' as const, message: 'Email already registered' },
    ],
  },
  twoFaStatus: { enabled: true },
  twoFaSetup: {
    qrCodeUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    secret: 'JBSWY3DPEHPK3PXP',
  },
  twoFaEnable: { backupCodes: ['ABCD1234EFGH', 'WXYZ9876KJMN'] },
  twoFaDisable: { success: true },
  twoFaBackupCodesInfo: {
    codes: [],
    message: 'Backup codes are shown only once during 2FA setup. Use regenerate to get new codes.',
  },
  twoFaRegenerate: { codes: ['NEWCODE1AAAA', 'NEWCODE2BBBB', 'NEWCODE3CCCC'] },
  logout: { success: true },
} as const;

export const users = {
  listItem: {
    id: '550e8400-e29b-41d4-a716-446655440000',
    email: 'trader@example.com',
    displayName: 'Demo Trader',
    role: 'user',
    createdAt: ISO,
  },
  withProfile: {
    id: '550e8400-e29b-41d4-a716-446655440000',
    email: 'trader@example.com',
    displayName: 'Demo Trader',
    role: 'user',
    profile: {
      username: 'demotrader',
      fullName: 'Demo Trader',
      photoUrl: null,
      bio: 'QA practice account',
      websiteUrl: null,
      location: 'EU',
      birthday: null,
      languageCode: 'en',
      timezone: 'UTC',
      preferences: {},
    },
    createdAt: ISO,
    updatedAt: ISO,
  },
  bulkExportJson: [
    {
      id: '550e8400-e29b-41d4-a716-446655440000',
      email: 'a@example.com',
      displayName: 'User A',
      role: 'user',
      createdAt: ISO,
    },
  ],
} as const;

export const wallets = {
  row: {
    id: 'aa0e8400-e29b-41d4-a716-446655440010',
    userId: '550e8400-e29b-41d4-a716-446655440000',
    asset: 'USD',
    balance: '10000.50',
    balanceAvailable: '10000.50',
    balanceLocked: '0',
  },
  list: [
    {
      id: 'aa0e8400-e29b-41d4-a716-446655440010',
      userId: '550e8400-e29b-41d4-a716-446655440000',
      asset: 'USD',
      balance: '10000.50',
      balanceAvailable: '10000.50',
      balanceLocked: '0',
    },
    {
      id: 'bb0e8400-e29b-41d4-a716-446655440011',
      userId: '550e8400-e29b-41d4-a716-446655440000',
      asset: 'BTC',
      balance: '0.15',
      balanceAvailable: '0.14',
      balanceLocked: '0.01',
    },
  ],
  /** `POST /wallets/withdraw` — balance + ledger row (no synthetic deposit). Crypto only. */
  debit: {
    userId: '550e8400-e29b-41d4-a716-446655440000',
    balance: {
      id: 'aa0e8400-e29b-41d4-a716-446655440010',
      asset: 'BTC',
      balance: '0.14',
      balanceAvailable: '0.14',
      balanceLocked: '0',
    },
    transaction: {
      id: 'bt-wd-2',
      type: 'withdraw',
      amount: '-0.01',
      balanceBefore: '0.15',
      balanceAfter: '0.14',
      refType: null,
      refId: null,
      createdAt: ISO,
    },
  },
} as const;

export const orders = {
  /** Single order (`mapOrderForResponse`: `type` / `status` replace internal names; includes `trades`). */
  order: {
    id: 'cc0e8400-e29b-41d4-a716-446655440020',
    userId: '550e8400-e29b-41d4-a716-446655440000',
    marketType: 'spot',
    symbol: 'BTC_USD',
    side: 'buy',
    quantity: '0.1',
    price: '65000',
    filledQuantity: '0',
    failureReason: null,
    createdAt: ISO,
    updatedAt: ISO,
    completedAt: null,
    type: 'limit',
    status: 'open',
    trades: [],
  },
  list: {
    data: [
      {
        id: 'cc0e8400-e29b-41d4-a716-446655440020',
        userId: '550e8400-e29b-41d4-a716-446655440000',
        marketType: 'spot',
        symbol: 'BTC_USD',
        side: 'buy',
        quantity: '0.1',
        price: '65000',
        filledQuantity: '0',
        type: 'limit',
        status: 'open',
        trades: [],
        createdAt: ISO,
        updatedAt: ISO,
      },
    ],
    total: 1,
    meta: { total: 1, limit: 50, offset: 0 },
  },
} as const;

export const deposits = {
  fiatCreated: {
    deposit: {
      id: 'dd0e8400-e29b-41d4-a716-446655440030',
      userId: '550e8400-e29b-41d4-a716-446655440000',
      fiatCurrency: 'USD',
      amount: '500',
      fee: '12.5',
      status: 'completed',
      paymentMethodId: null,
      paymentMethodType: 'card',
      createdAt: ISO,
      completedAt: ISO,
    },
    balance: {
      id: 'aa0e8400-e29b-41d4-a716-446655440010',
      asset: 'USD',
      balance: '10000.50',
      balanceAvailable: '10000.50',
      balanceLocked: '0',
    },
    transaction: {
      id: 'bt-2',
      type: 'deposit',
      amount: '500',
      balanceBefore: '9500',
      balanceAfter: '10000',
      refType: 'deposit_fiat',
      refId: 'dd0e8400-e29b-41d4-a716-446655440030',
      createdAt: ISO,
    },
    meta: { userId: '550e8400-e29b-41d4-a716-446655440000' },
  },
  fiatList: {
    data: [
      {
        id: 'dd0e8400-e29b-41d4-a716-446655440030',
        userId: '550e8400-e29b-41d4-a716-446655440000',
        fiatCurrency: 'USD',
        amount: '500',
        fee: '12.5',
        status: 'completed',
        paymentMethodId: null,
        paymentMethodType: 'card',
        createdAt: ISO,
        completedAt: ISO,
      },
    ],
    total: 1,
    meta: { total: 1, limit: 20, offset: 0 },
  },
  /** `GET /deposits/fiat/:id` — same shape as one element of `fiatList.data`. */
  fiatDepositRow: {
    id: 'dd0e8400-e29b-41d4-a716-446655440030',
    userId: '550e8400-e29b-41d4-a716-446655440000',
    fiatCurrency: 'USD',
    amount: '500',
    fee: '12.5',
    status: 'completed',
    paymentMethodId: null,
    paymentMethodType: 'card',
    createdAt: ISO,
    completedAt: ISO,
  },
  cryptoAddress: {
    userId: '550e8400-e29b-41d4-a716-446655440000',
    symbol: 'BTC',
    walletAddress: 'bc1qtraining000000000000000000000000000000000000',
    expiresAt: null,
  },
  cryptoCreated: {
    deposit: {
      id: 'ff0e8400-e29b-41d4-a716-446655440050',
      userId: '550e8400-e29b-41d4-a716-446655440000',
      amount: '0.05',
      walletAddress: 'bc1qabc',
      status: 'completed',
      createdAt: ISO,
      symbol: 'BTC',
    },
    balance: {
      id: 'bb0e8400-e29b-41d4-a716-446655440011',
      asset: 'BTC',
      balance: '0.2',
      balanceAvailable: '0.2',
      balanceLocked: '0',
    },
    transaction: {
      id: 'bt-3',
      type: 'deposit',
      amount: '0.05',
      balanceBefore: '0.15',
      balanceAfter: '0.2',
      refType: 'deposit_crypto',
      refId: 'ff0e8400-e29b-41d4-a716-446655440050',
      createdAt: ISO,
    },
    meta: { userId: '550e8400-e29b-41d4-a716-446655440000' },
  },
  cryptoList: {
    data: [
      {
        id: 'ff0e8400-e29b-41d4-a716-446655440050',
        userId: '550e8400-e29b-41d4-a716-446655440000',
        amount: '0.05',
        walletAddress: 'bc1qabc',
        status: 'completed',
        createdAt: ISO,
        symbol: 'BTC',
      },
    ],
    total: 1,
    meta: { total: 1, limit: 20, offset: 0 },
  },
  /** `GET /deposits/crypto/:id` — same shape as one element of `cryptoList.data`. */
  cryptoDepositRow: {
    id: 'ff0e8400-e29b-41d4-a716-446655440050',
    userId: '550e8400-e29b-41d4-a716-446655440000',
    amount: '0.05',
    walletAddress: 'bc1qabc',
    status: 'completed',
    createdAt: ISO,
    symbol: 'BTC',
  },
} as const;

export const paymentMethods = {
  row: {
    id: 'ee0e8400-e29b-41d4-a716-446655440040',
    userId: '550e8400-e29b-41d4-a716-446655440000',
    type: 'card',
    maskedDetails: '**** **** **** 4242',
    isDefault: true,
    createdAt: ISO,
  },
  list: [
    {
      id: 'ee0e8400-e29b-41d4-a716-446655440040',
      userId: '550e8400-e29b-41d4-a716-446655440000',
      type: 'card',
      maskedDetails: '**** **** **** 4242',
      isDefault: true,
      createdAt: ISO,
    },
  ],
  deleteSuccess: { success: true },
} as const;

export const portfolio = {
  balances: {
    balances: [
      { asset: 'USD', available: '9500.00', locked: '500.50', total: '10000.50' },
      { asset: 'BTC', available: '0.14', locked: '0.01', total: '0.15' },
    ],
  },
  summary: {
    totalValueUsd: '51250.75',
    assets: [
      { symbol: 'USD', amount: '10000.50', priceUsd: '1', valueUsd: '10000.50' },
      { symbol: 'BTC', amount: '0.15', priceUsd: '275000', valueUsd: '41250.25' },
    ],
  },
  allocation: {
    allocations: [
      { symbol: 'BTC', percentage: 80.5, valueUsd: '41250.25' },
      { symbol: 'USD', percentage: 19.5, valueUsd: '10000.50' },
    ],
  },
} as const;

export const transactions = {
  unified: {
    data: [
      {
        id: 'bt-1',
        userId: '550e8400-e29b-41d4-a716-446655440000',
        type: 'deposit',
        asset: 'USD',
        amount: '500',
        balanceBefore: '9500',
        balanceAfter: '10000',
        refType: 'deposit_fiat',
        refId: 'dd0e8400-e29b-41d4-a716-446655440030',
        createdAt: ISO,
      },
    ],
    total: 1,
    meta: { total: 1, limit: 50, offset: 0 },
  },
  deposits: {
    data: [
      {
        id: 'bt-1',
        userId: '550e8400-e29b-41d4-a716-446655440000',
        type: 'deposit',
        asset: 'USD',
        amount: '500',
        balanceBefore: '9500',
        balanceAfter: '10000',
        refType: 'deposit_fiat',
        refId: 'dd0e8400-e29b-41d4-a716-446655440030',
        createdAt: ISO,
      },
    ],
    total: 1,
    meta: { total: 1, limit: 50, offset: 0 },
  },
  trades: {
    data: [
      {
        id: 'tr-1',
        symbol: 'BTC_USD',
        quantity: '0.01',
        price: '65000',
        side: 'taker',
        takerUserId: '550e8400-e29b-41d4-a716-446655440000',
        makerUserId: '990e8400-e29b-41d4-a716-446655440099',
        createdAt: ISO,
      },
    ],
    total: 1,
    meta: { total: 1, limit: 50, offset: 0 },
  },
  withdrawals: {
    data: [
      {
        id: 'bt-wd-1',
        userId: '550e8400-e29b-41d4-a716-446655440000',
        type: 'withdraw',
        asset: 'USD',
        amount: '-100',
        balanceBefore: '10000',
        balanceAfter: '9900',
        refType: 'withdrawal',
        refId: 'wd-1',
        createdAt: ISO,
      },
    ],
    total: 1,
    meta: { total: 1, limit: 50, offset: 0 },
  },
} as const;

export const cryptos = {
  list: {
    data: [
      {
        id: 'cr-1',
        name: 'Bitcoin',
        symbol: 'BTC',
        price: '65000',
        change24h: '1.25',
        volume24h: '1234567890',
        popular: true,
      },
    ],
    total: 42,
  },
  one: {
    id: 'cr-1',
    name: 'Bitcoin',
    symbol: 'BTC',
    price: '65000',
    change24h: '1.25',
    volume24h: '1234567890',
    popular: true,
  },
  priceHistory: {
    symbol: 'BTC',
    data: [{ timestamp: ISO, price: '65000' }],
  },
} as const;

export const app = {
  root: {
    name: 'Test Exchange API',
    version: '1.0',
    docs: '/api/docs',
    docsJson: '/api/docs-json',
  },
} as const;

export const metrics = {
  sample:
    '# HELP http_requests_total Total HTTP requests\n# TYPE http_requests_total counter\nhttp_requests_total 42\n',
} as const;
