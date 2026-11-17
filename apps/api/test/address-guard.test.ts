import { describe, expect, it, vi } from 'vitest';
import {
  assertPublicHost,
  BlockedAddressError,
  isPrivateAddress,
} from '../src/metadata/address-guard.js';

describe('isPrivateAddress', () => {
  it.each([
    '127.0.0.1',
    '127.255.0.9',
    '10.0.0.1',
    '172.16.0.1',
    '172.31.255.255',
    '192.168.1.1',
    '169.254.169.254',
    '100.64.0.1',
    '0.0.0.0',
    '224.0.0.1',
    '255.255.255.255',
    '::',
    '::1',
    'fe80::1',
    'fc00::1',
    'fd12:3456::1',
    'ff02::1',
    '::ffff:127.0.0.1',
    '::ffff:10.0.0.1',
    'not-an-ip',
  ])('blocks %s', (address) => {
    expect(isPrivateAddress(address)).toBe(true);
  });

  it.each([
    '8.8.8.8',
    '1.1.1.1',
    '172.15.255.255',
    '172.32.0.1',
    '93.184.216.34',
    '2606:4700::1111',
    '::ffff:8.8.8.8',
  ])('allows %s', (address) => {
    expect(isPrivateAddress(address)).toBe(false);
  });
});

describe('assertPublicHost', () => {
  it('checks ip literals without dns', async () => {
    const lookup = vi.fn();
    await expect(assertPublicHost('127.0.0.1', lookup)).rejects.toBeInstanceOf(BlockedAddressError);
    await expect(assertPublicHost('[::1]', lookup)).rejects.toBeInstanceOf(BlockedAddressError);
    await expect(assertPublicHost('8.8.8.8', lookup)).resolves.toBeUndefined();
    expect(lookup).not.toHaveBeenCalled();
  });

  it('blocks hosts that resolve to a private address', async () => {
    const lookup = vi.fn().mockResolvedValue(['93.184.216.34', '10.0.0.5']);
    await expect(assertPublicHost('mixed.example', lookup)).rejects.toThrow('mixed.example');
    expect(lookup).toHaveBeenCalledWith('mixed.example');
  });

  it('allows hosts that resolve to public addresses only', async () => {
    const lookup = vi.fn().mockResolvedValue(['93.184.216.34', '2606:2800:220:1::1']);
    await expect(assertPublicHost('example.com', lookup)).resolves.toBeUndefined();
  });

  it('blocks hosts without addresses', async () => {
    await expect(assertPublicHost('empty.example', vi.fn().mockResolvedValue([]))).rejects.toThrow(
      BlockedAddressError,
    );
  });
});
