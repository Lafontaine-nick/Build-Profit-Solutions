const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');

jest.mock('../../services/aiDashboardService', () => ({
  buildAiDashboardForUser: jest.fn(async (userId) => ({
    userId,
    insights: [],
    nextSteps: [],
  })),
}));

describe('AI dashboard authentication', () => {
  const originalSecret = process.env.JWT_SECRET;

  beforeEach(() => {
    process.env.JWT_SECRET = 'ai-dashboard-test-secret';
    jest.resetModules();
  });

  afterAll(() => {
    if (originalSecret == null) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalSecret;
  });

  function createApp() {
    const app = express();
    app.use(express.json());
    app.use('/api/ai', require('../aiDashboard'));
    return app;
  }

  test.each([
    ['missing', undefined],
    ['empty', ''],
    ['invalid', 'Bearer definitely-not-a-token'],
  ])('rejects %s authorization', async (_label, authorization) => {
    const response = await request(createApp())
      .post('/api/ai/dashboard-insights')
      .set(authorization === undefined ? {} : { Authorization: authorization })
      .send({ userId: 'body-user' });

    expect([401, 403, 503]).toContain(response.status);
  });

  test('accepts a valid token and scopes the request to its subject', async () => {
    const token = jwt.sign({ sub: 'jwt-user', email: 'user@example.com' }, process.env.JWT_SECRET);
    const response = await request(createApp())
      .post('/api/ai/dashboard-insights')
      .set('Authorization', `Bearer ${token}`)
      .send({ userId: 'body-user' });

    expect(response.status).toBe(200);
    expect(response.body.userId).toBe('jwt-user');
  });
});
