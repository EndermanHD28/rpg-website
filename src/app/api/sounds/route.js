import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    const publicDir = path.join(process.cwd(), 'public');
    const sfxDir = path.join(publicDir, 'sound_effects');
    const playableDir = path.join(sfxDir, 'playable');

    const getFiles = (dir) => {
      if (!fs.existsSync(dir)) return [];
      return fs.readdirSync(dir)
        .filter(file => {
          const ext = path.extname(file).toLowerCase();
          return ['.mp3', '.wav', '.ogg', '.m4a'].includes(ext);
        });
    };

    const builtIn = getFiles(sfxDir);
    const soundEffects = getFiles(playableDir);

    return NextResponse.json({
      builtIn,
      soundEffects
    });
  } catch (error) {
    console.error('Error listing sound effects:', error);
    return NextResponse.json({ builtIn: [], soundEffects: [] }, { status: 500 });
  }
}
