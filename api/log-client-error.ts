// Vercel 서버리스 함수: POST /api/log-client-error (Vercel 로그에 기록)
export default function handler(req: any, res: any) {
  const b = req.body || {};
  console.error('--- CLIENT ERROR REPORTED ---', b.message, b.url, b.timestamp, '\n', b.stack, '\n', b.componentStack);
  res.status(204).end();
}
