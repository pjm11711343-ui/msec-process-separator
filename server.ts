import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { classifyItems } from './api/_lib/classify.js';
import dotenv from 'dotenv';

dotenv.config();

console.log('--- SERVER.TS INITIALIZING ---');
if (!process.env.GEMINI_API_KEY) {
  console.warn('[경고] GEMINI_API_KEY 가 없습니다. AI 분류는 규칙/키워드 기반으로만 동작합니다.');
}

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Request logger
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString(), env: process.env.NODE_ENV });
});

// Client error logger
app.post('/api/log-client-error', (req, res) => {
  console.error('--- CLIENT ERROR REPORTED ---');
  console.error('Message:', req.body.message);
  console.error('Stack:', req.body.stack);
  console.error('Component Stack:', req.body.componentStack);
  console.error('URL:', req.body.url);
  console.error('Time:', req.body.timestamp);
  console.error('-----------------------------');
  res.status(204).send();
});

// API endpoint for classification
app.post('/api/classify', async (req, res) => {
  try {
    const { items, categories, customRules } = req.body;
    if (!items || !Array.isArray(items)) {
      return res.status(400).json({ error: 'Items must be an array' });
    }
    res.json(await classifyItems(items, categories, customRules));
  } catch (error: any) {
    console.error('Classification endpoint error:', error);
    const { items } = req.body || {};
    res.json((items || []).map((i: any) => ({ id: i.id, category: '미분류' })));
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

startServer();
