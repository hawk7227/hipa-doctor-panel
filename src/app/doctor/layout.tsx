08:47:48.683 Running build in Washington, D.C., USA (East) – iad1
08:47:48.684 Build machine configuration: 4 cores, 8 GB
08:47:48.697 Cloning github.com/hawk7227/dropshipping-management (Branch: main, Commit: a0e7a61)
08:47:48.698 Skipping build cache, deployment was triggered without cache.
08:47:50.002 Cloning completed: 1.305s
08:47:50.363 Running "vercel build"
08:47:51.290 Vercel CLI 50.4.10
08:47:51.597 WARNING: You should not upload the `.next` directory.
08:47:51.604 Installing dependencies...
08:47:54.116 npm warn deprecated rimraf@3.0.2: Rimraf versions prior to v4 are no longer supported
08:47:54.224 npm warn deprecated scmp@2.1.0: Just use Node.js's crypto.timingSafeEqual()
08:47:54.749 npm warn deprecated inflight@1.0.6: This module is not supported, and leaks memory. Do not use it. Check out lru-cache if you want a good and tested way to coalesce async requests by a key value, which is much more comprehensive and powerful.
08:47:54.895 npm warn deprecated glob@7.1.7: Glob versions prior to v9 are no longer supported
08:47:55.717 npm warn deprecated @supabase/auth-helpers-shared@0.6.3: This package is now deprecated - please use the @supabase/ssr package instead.
08:47:55.730 npm warn deprecated @humanwhocodes/object-schema@2.0.3: Use @eslint/object-schema instead
08:47:55.730 npm warn deprecated @humanwhocodes/config-array@0.13.0: Use @eslint/config-array instead
08:47:55.972 npm warn deprecated @supabase/auth-helpers-nextjs@0.8.7: This package is now deprecated - please use the @supabase/ssr package instead.
08:47:56.035 npm warn deprecated node-domexception@1.0.0: Use your platform's native DOMException instead
08:47:58.357 npm warn deprecated eslint@8.57.1: This version is no longer supported. Please see https://eslint.org/version-support for other options.
08:48:02.983 npm warn deprecated next@14.0.4: This version has a security vulnerability. Please upgrade to a patched version. See https://nextjs.org/blog/security-update-2025-12-11 for more details.
08:48:03.229 
08:48:03.229 added 435 packages in 11s
08:48:03.229 
08:48:03.230 141 packages are looking for funding
08:48:03.230   run `npm fund` for details
08:48:03.289 Detected Next.js version: 14.0.4
08:48:03.293 Running "npm run build"
08:48:03.395 
08:48:03.395 > dropshipping-platform@1.0.0 build
08:48:03.395 > next build
08:48:03.395 
08:48:03.873 Attention: Next.js now collects completely anonymous telemetry regarding usage.
08:48:03.873 This information is used to shape Next.js' roadmap and prioritize features.
08:48:03.873 You can learn more, including how to opt-out if you'd not like to participate in this anonymous program, by visiting the following URL:
08:48:03.873 https://nextjs.org/telemetry
08:48:03.873 
08:48:03.961    ▲ Next.js 14.0.4
08:48:03.961 
08:48:03.961    Creating an optimized production build ...
08:48:11.186 <w> [webpack.cache.PackFileCacheStrategy] Serializing big strings (102kiB) impacts deserialization performance (consider using Buffer instead and decode when needed)
08:48:11.194 <w> [webpack.cache.PackFileCacheStrategy] Serializing big strings (140kiB) impacts deserialization performance (consider using Buffer instead and decode when needed)
08:48:14.548  ✓ Compiled successfully
08:48:14.549    Linting and checking validity of types ...
08:48:22.812 Failed to compile.
08:48:22.813 
08:48:22.813 ./app/api/cron/price-sync/route.ts:36:30
08:48:22.813 Type error: Property 'total' does not exist on type '{ synced: number; errors: number; results: any[]; updated?: number | undefined; skipped?: number | undefined; }'.
08:48:22.813 
08:48:22.813 [0m [90m 34 |[39m       success[33m:[39m [36mtrue[39m[33m,[39m[0m
08:48:22.813 [0m [90m 35 |[39m       duration_seconds[33m:[39m duration[33m,[39m[0m
08:48:22.813 [0m[31m[1m>[22m[39m[90m 36 |[39m       total_products[33m:[39m result[33m.[39mtotal[33m,[39m[0m
08:48:22.813 [0m [90m    |[39m                              [31m[1m^[22m[39m[0m
08:48:22.813 [0m [90m 37 |[39m       updated[33m:[39m result[33m.[39mupdated[33m,[39m[0m
08:48:22.813 [0m [90m 38 |[39m       skipped[33m:[39m result[33m.[39mskipped[33m,[39m[0m
08:48:22.814 [0m [90m 39 |[39m       errors[33m:[39m result[33m.[39merrors[33m,[39m[0m
08:48:22.894 Error: Command "npm run build" exited with 1