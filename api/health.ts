// Vercel 서버리스 함수: GET /api/health
export default function handler(_req: any, res: any) {
  res.status(200).json({ status: 'ok', time: new Date().toISOString(), env: 'vercel' });
}
