import { NextApiRequest, NextApiResponse } from 'next';

// Health check endpoint to keep the app awake
export default function handler(req: NextApiRequest, res: NextApiResponse) {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
}