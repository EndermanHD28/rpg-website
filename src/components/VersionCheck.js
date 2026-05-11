'use client';

import { useState, useEffect } from 'react';

export default function VersionCheck() {
  const [hasUpdate, setHasUpdate] = useState(false);
  const currentVersion = process.env.NEXT_PUBLIC_VERCEL_DEPLOY_ID;

  useEffect(() => {
    // Only run on production (Vercel)
    if (!currentVersion || currentVersion === 'local') return;

    const checkVersion = async () => {
      try {
        // Fetch the same page with a cache-busting query parameter
        // In Vercel, this usually returns headers or environment variables if we had an API,
        // but a simple way is to check a small metadata file or use the deployment headers.
        // Vercel sets 'x-vercel-id' header which changes per deployment.
        
        const res = await fetch('/?_cache_buster=' + Date.now(), {
          method: 'HEAD',
          cache: 'no-store'
        });

        const latestVersion = res.headers.get('x-vercel-id');
        
        if (latestVersion && currentVersion !== 'local' && !latestVersion.includes(currentVersion)) {
          // If the current deployment ID is not in the latest version ID, we likely have an update
          // x-vercel-id contains the deployment ID among other things.
          setHasUpdate(true);
        }
      } catch (err) {
        console.error('Failed to check for updates:', err);
      }
    };

    // Check every 5 minutes
    const interval = setInterval(checkVersion, 5 * 60 * 1000);
    
    // Initial check after 1 minute (give time for initial load)
    const timeout = setTimeout(checkVersion, 60 * 1000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [currentVersion]);

  if (!hasUpdate) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] bg-blue-600 text-white px-4 py-2 flex justify-center items-center gap-4 shadow-lg animate-in slide-in-from-top duration-500">
      <span className="font-medium text-sm sm:text-base">
        A new version of the website is available.
      </span>
      <button
        onClick={() => window.location.reload()}
        className="bg-white text-blue-600 px-3 py-1 rounded-md text-sm font-bold hover:bg-blue-50 transition-colors shadow-sm cursor-pointer"
      >
        Refresh Now
      </button>
    </div>
  );
}
