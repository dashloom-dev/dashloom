export type PaddleEnvironment = 'production' | 'sandbox';

export function paddleApiOrigin(environment: PaddleEnvironment) { return environment === 'sandbox' ? 'https://sandbox-api.paddle.com' : 'https://api.paddle.com'; }
export function safePaddleApiUrl(environment: PaddleEnvironment, target: string, allowedPath: '/transactions' | '/adjustments') {
  const base = paddleApiOrigin(environment); const url = new URL(target, base);
  if (url.origin !== base || url.pathname !== allowedPath || url.username || url.password) throw new Error('Paddle pagination returned an unexpected URL.');
  return url.toString();
}
