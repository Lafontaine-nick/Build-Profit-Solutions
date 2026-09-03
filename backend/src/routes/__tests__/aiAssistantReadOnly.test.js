const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');

describe('Central Command read-only enforcement', () => {
  const originalSecret = process.env.JWT_SECRET;
  const originalOpenAiKey = process.env.OPENAI_API_KEY;

  beforeAll(() => {
    process.env.JWT_SECRET = 'central-command-test-secret';
    process.env.OPENAI_API_KEY = 'test-openai-key';
  });

  afterAll(() => {
    if (originalSecret == null) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalSecret;
    if (originalOpenAiKey == null) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalOpenAiKey;
  });

  function createApp() {
    const app = express();
    app.use(express.json());
    app.use('/api/ai-assistant', require('../aiAssistant'));
    return app;
  }

  test.each([
    'Put $450 of lumber on the kitchen job',
    'Send a message to John saying call me',
    'Place an order for $500 from Home Depot',
    'Please schedule an inspection tomorrow',
  ])('blocks Central Command mutation: %s', async (message) => {
    const token = jwt.sign({ userId: 'central-user' }, process.env.JWT_SECRET);
    const response = await request(createApp())
      .post('/api/ai-assistant')
      .set('Authorization', `Bearer ${token}`)
      .send({
        message,
        context: { assistantMode: 'central_command', screen: 'projects' },
      });

    expect(response.status).toBe(200);
    expect(response.body.readOnly).toBe(true);
    expect(response.body.actions).toEqual([]);
    expect(response.body.projectUpdateData).toBeNull();
  });

  test('blocks the same mutation wording on the streaming endpoint', async () => {
    const token = jwt.sign({ userId: 'central-user' }, process.env.JWT_SECRET);
    const response = await request(createApp())
      .post('/api/ai-assistant/stream')
      .set('Authorization', `Bearer ${token}`)
      .send({
        message: 'Place an order for $500 from Home Depot',
        context: { assistantMode: 'central_command', screen: 'projects' },
      });

    expect(response.status).toBe(200);
    expect(response.text).toContain('"readOnly":true');
    expect(response.text).toContain('"type":"done"');
  });
});
