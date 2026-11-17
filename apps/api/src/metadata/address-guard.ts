import { lookup } from 'node:dns/promises';
import { BlockList, isIP } from 'node:net';

const IPV4_BLOCKED_SUBNETS: ReadonlyArray<readonly [string, number]> = [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.88.99.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
];

const IPV6_BLOCKED_SUBNETS: ReadonlyArray<readonly [string, number]> = [
  ['::', 128],
  ['::1', 128],
  ['64:ff9b:1::', 48],
  ['100::', 64],
  ['2001:db8::', 32],
  ['fc00::', 7],
  ['fe80::', 10],
  ['fec0::', 10],
  ['ff00::', 8],
];

const blockList = new BlockList();
for (const [network, prefix] of IPV4_BLOCKED_SUBNETS) {
  blockList.addSubnet(network, prefix, 'ipv4');
}
for (const [network, prefix] of IPV6_BLOCKED_SUBNETS) {
  blockList.addSubnet(network, prefix, 'ipv6');
}

export type HostLookup = (hostname: string) => Promise<string[]>;

export const systemLookup: HostLookup = async (hostname) => {
  const addresses = await lookup(hostname, { all: true, verbatim: true });
  return addresses.map(({ address }) => address);
};

export class BlockedAddressError extends Error {
  constructor(hostname: string) {
    super(`Host ${hostname} resolves to a private or reserved address`);
    this.name = 'BlockedAddressError';
  }
}

function stripBrackets(hostname: string): string {
  return hostname.startsWith('[') && hostname.endsWith(']') ? hostname.slice(1, -1) : hostname;
}

export function isPrivateAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 0) {
    return true;
  }
  return blockList.check(address, family === 4 ? 'ipv4' : 'ipv6');
}

export async function assertPublicHost(
  hostname: string,
  resolve: HostLookup = systemLookup,
): Promise<void> {
  const host = stripBrackets(hostname);
  const addresses = isIP(host) ? [host] : await resolve(host);
  if (addresses.length === 0 || addresses.some(isPrivateAddress)) {
    throw new BlockedAddressError(host);
  }
}
