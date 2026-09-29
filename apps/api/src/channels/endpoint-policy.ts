import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import type { ChannelConnectionInput } from '@vynor/contracts';
import { apiError } from '../common/errors/api-error.js';

/**
 * Admin-supplied endpoints (IMAP/SMTP hosts, Custom API callback URLs) are called from inside
 * our network. In staging and production they must resolve to public addresses so a channel
 * cannot be used to probe internal services (SSRF).
 */

function ipv4ToInt(ip: string): number {
  return ip.split('.').reduce((acc, octet) => (acc << 8) + Number(octet), 0) >>> 0;
}

const PRIVATE_V4_RANGES: [string, number][] = [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['224.0.0.0', 4],
];

export function isPrivateAddress(ip: string): boolean {
  if (isIP(ip) === 4) {
    const value = ipv4ToInt(ip);
    return PRIVATE_V4_RANGES.some(([base, bits]) => {
      const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
      return (value & mask) === (ipv4ToInt(base) & mask);
    });
  }
  if (isIP(ip) === 6) {
    const normalized = ip.toLowerCase();
    if (normalized === '::1' || normalized === '::') return true;
    if (normalized.startsWith('::ffff:')) return isPrivateAddress(normalized.slice(7));
    return /^f[cd]/.test(normalized) || /^fe[89ab]/.test(normalized);
  }
  return false;
}

export function isPrivateHostname(host: string): boolean {
  const name = host.toLowerCase().replace(/^\[|\]$/g, '');
  if (isIP(name)) return isPrivateAddress(name);
  return (
    name === 'localhost' ||
    name.endsWith('.localhost') ||
    name.endsWith('.local') ||
    name.endsWith('.internal') ||
    !name.includes('.')
  );
}

async function assertPublicHost(host: string, label: string): Promise<void> {
  const reject = () =>
    apiError(
      422,
      'CHANNEL_ENDPOINT_NOT_ALLOWED',
      `${label} "${host}" points to a private network address, which is not allowed.`,
    );
  if (isPrivateHostname(host)) throw reject();
  if (isIP(host)) return;
  const addresses = await lookup(host, { all: true }).catch(() => []);
  if (addresses.some((entry) => isPrivateAddress(entry.address))) throw reject();
}

export async function assertConnectionEndpointsAllowed(
  connection: ChannelConnectionInput,
  enforce: boolean,
): Promise<void> {
  if (!enforce) return;
  if (connection.provider === 'EMAIL_SMTP_IMAP') {
    await assertPublicHost(connection.credentials.imap.host, 'IMAP server');
    await assertPublicHost(connection.credentials.smtp.host, 'SMTP server');
  }
  if (connection.provider === 'CUSTOM_WEBHOOK') {
    const url = new URL(connection.credentials.outboundUrl);
    if (url.protocol !== 'https:') {
      throw apiError(422, 'CHANNEL_ENDPOINT_NOT_ALLOWED', 'The reply endpoint must use https://.');
    }
    await assertPublicHost(url.hostname, 'Reply endpoint');
  }
}
