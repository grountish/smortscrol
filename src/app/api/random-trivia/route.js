import { NextResponse } from 'next/server';

const TRIVIA_API_URL = 'https://api.apileague.com/retrieve-random-trivia?max-length=150';
const DEFAULT_API_KEY = 'f5594c0d24bd4fa08ace8b9a18b203b4';

export async function GET() {
  const apiKey = process.env.APILEAGUE_API_KEY || DEFAULT_API_KEY;

  if (!apiKey) {
    return NextResponse.json({ error: 'Missing API key for trivia service.' }, { status: 500 });
  }

  try {
    const response = await fetch(TRIVIA_API_URL, {
      method: 'GET',
      headers: {
        'x-api-key': apiKey,
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      const details = await response.text();
      return NextResponse.json(
        {
          error: 'Trivia provider request failed.',
          status: response.status,
          details,
        },
        { status: 502 },
      );
    }

    const data = await response.json();
    return NextResponse.json(data, { status: 200 });
  } catch {
    return NextResponse.json({ error: 'Trivia provider is unavailable.' }, { status: 502 });
  }
}
