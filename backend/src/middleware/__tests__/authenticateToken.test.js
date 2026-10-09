const jwt = require('jsonwebtoken');

jest.mock('@clerk/backend', () => ({
  verifyToken: jest.fn(),
}));

const { verifyToken } = require('@clerk/backend');
const { authenticateToken } = require('../authenticateToken');

function runMiddleware(token) {
  const req = { headers: { authorization: `Bearer ${token}` } };
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
  let nextCalled = false;
  return new Promise((resolve) => {
    authenticateToken(req, res, () => {
      nextCalled = true;
      resolve({ req, res, nextCalled });
    }).then(() => {
      if (!nextCalled) resolve({ req, res, nextCalled });
    });
  });
}

describe('authenticateToken', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.JWT_SECRET = 'app-secret';
    process.env.CLERK_SECRET_KEY = 'sk_test_real';
    delete process.env.RENDER;
    verifyToken.mockReset();
    verifyToken.mockRejectedValue(new Error('invalid signature'));
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('rejects an unverified Clerk token in production', async () => {
    process.env.NODE_ENV = 'production';
    const token = jwt.sign({ sub: 'user_victim' }, 'not-the-app-secret');
    const { res, nextCalled } = await runMiddleware(token);
    expect(nextCalled).toBe(false);
    expect(res.statusCode).toBe(403);
  });

  it('rejects an unverified Clerk token on Render even outside production mode', async () => {
    process.env.NODE_ENV = 'development';
    process.env.RENDER = 'true';
    const token = jwt.sign({ sub: 'user_victim' }, 'not-the-app-secret');
    const { res, nextCalled } = await runMiddleware(token);
    expect(nextCalled).toBe(false);
    expect(res.statusCode).toBe(403);
  });

  it('accepts a verified Clerk token', async () => {
    process.env.NODE_ENV = 'production';
    verifyToken.mockResolvedValue({ sub: 'user_real', email: 'owner@example.com' });
    const token = jwt.sign({ sub: 'user_real' }, 'not-the-app-secret');
    const { req, nextCalled } = await runMiddleware(token);
    expect(nextCalled).toBe(true);
    expect(req.user.userId).toBe('user_real');
    expect(req.user.email).toBe('owner@example.com');
  });

  it('allows an unverified decode only for local development', async () => {
    process.env.NODE_ENV = 'development';
    const token = jwt.sign({ sub: 'user_local' }, 'not-the-app-secret');
    const { req, nextCalled } = await runMiddleware(token);
    expect(nextCalled).toBe(true);
    expect(req.user.userId).toBe('user_local');
  });
});
