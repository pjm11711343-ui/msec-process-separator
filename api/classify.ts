// Vercel 서버리스 함수: POST /api/classify
import { classifyItems } from './_lib/classify.js';

export const config = { maxDuration: 60 };

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  const { items, categories, customRules } = req.body || {};
  if (!items || !Array.isArray(items)) {
    res.status(400).json({ error: 'Items must be an array' });
    return;
  }
  try {
    res.status(200).json(await classifyItems(items, categories, customRules));
  } catch (error) {
    console.error('Classification endpoint error:', error);
    res.status(200).json(items.map((i: any) => ({ id: i.id, category: '미분류' })));
  }
}
