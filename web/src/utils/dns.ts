import { ReadOnlyValues } from './values';

// https://www.iana.org/assignments/dns-parameters/dns-parameters.xhtml#dns-parameters-6
export const dnsRCodes: ReadOnlyValues = [
  { value: 0, name: 'NoError', description: 'No Error' },
  { value: 1, name: 'FormErr', description: 'Format Error' },
  { value: 2, name: 'ServFail', description: 'Server Failure' },
  { value: 3, name: 'NXDomain', description: 'Non-Existent Domain' },
  { value: 4, name: 'NotImp', description: 'Not Implemented' },
  { value: 5, name: 'Refused', description: 'Query Refused' },
  { value: 6, name: 'YXDomain', description: 'Name Exists when it should not' },
  { value: 7, name: 'YXRRSet', description: 'RR Set Exists when it should not' },
  { value: 8, name: 'NXRRSet', description: 'RR Set that should exist does not' },
  //{ value: 9, name: 'NotAuth', description: 'Server Not Authoritative for zone' },
  { value: 9, name: 'NotAuth', description: 'Not Authorized' },
  { value: 10, name: 'NotZone', description: 'Name not contained in zone' },
  //{ value: 11, name: 'DSOTYPENI', description: 'DSO-TYPE Not Implemented' },
  { value: 16, name: 'BADVERS', description: 'Bad OPT Version' },
  //{ value:16, name: 'BADSIG', description: 'TSIG Signature Failure' },
  { value: 17, name: 'BADKEY', description: 'Key not recognized' },
  { value: 18, name: 'BADTIME', description: 'Signature out of time window' },
  { value: 19, name: 'BADMODE', description: 'Bad TKEY Mode' },
  { value: 20, name: 'BADNAME', description: 'Duplicate key name' },
  { value: 21, name: 'BADALG', description: 'Algorithm not supported' },
  { value: 22, name: 'BADTRUNC', description: 'Bad Truncation' },
  { value: 23, name: 'BADCOOKIE', description: 'Bad/missing Server Cookie' }
] as const;

export type dnsRCodesValues = (typeof dnsRCodes)[number]['value'];

export type dnsCodesNames = (typeof dnsRCodes)[number]['name'];

export const getDNSRcodeDescription = (name: dnsCodesNames): string => {
  return dnsRCodes.find(v => v.name === name)?.description || 'Unassigned';
};

// https://elixir.bootlin.com/linux/v4.7/source/include/uapi/asm-generic/errno-base.h
export const dnsErrors: ReadOnlyValues = [
  { value: 1, name: 'EPERM', description: 'Operation not permitted' },
  { value: 2, name: 'ENOENT', description: 'No such file or directory' },
  { value: 3, name: 'ESRCH', description: 'No such process' },
  { value: 4, name: 'EINTR', description: 'Interrupted system call' },
  { value: 5, name: 'EIO', description: 'I/O error' },
  { value: 6, name: 'ENXIO', description: 'No such device or address' },
  { value: 7, name: 'E2BIG', description: 'Argument list too long' },
  { value: 8, name: 'ENOEXEC', description: 'Exec format error' },
  { value: 9, name: 'EBADF', description: 'Bad file number' },
  { value: 10, name: 'ECHILD', description: 'No child processes' },
  { value: 11, name: 'EAGAIN', description: 'Try again' },
  { value: 12, name: 'ENOMEM', description: 'Out of memory' },
  { value: 13, name: 'EACCES', description: 'Permission denied' },
  { value: 14, name: 'EFAULT', description: 'Bad address' },
  { value: 15, name: 'ENOTBLK', description: 'Block device required' },
  { value: 16, name: 'EBUSY', description: 'Device or resource busy' },
  { value: 17, name: 'EEXIST', description: 'File exists' },
  { value: 18, name: 'EXDEV', description: 'Cross-device link' },
  { value: 19, name: 'ENODEV', description: 'No such device' },
  { value: 20, name: 'ENOTDIR', description: 'Not a directory' },
  { value: 21, name: 'EISDIR', description: 'Is a directory' },
  { value: 22, name: 'EINVAL', description: 'Invalid argument' },
  { value: 23, name: 'ENFILE', description: 'File table overflow' },
  { value: 24, name: 'EMFILE', description: 'Too many open files' },
  { value: 25, name: 'ENOTTY', description: 'Not a typewriter' },
  { value: 26, name: 'ETXBSY', description: 'Text file busy' },
  { value: 27, name: 'EFBIG', description: 'File too large' },
  { value: 28, name: 'ENOSPC', description: 'No space left on device' },
  { value: 29, name: 'ESPIPE', description: 'Illegal seek' },
  { value: 30, name: 'EROFS', description: 'Read-only file system' },
  { value: 31, name: 'EMLINK', description: 'Too many links' },
  { value: 32, name: 'EPIPE', description: 'Broken pipe' },
  { value: 33, name: 'EDOM', description: 'Math argument out of domain of func' },
  { value: 34, name: 'ERANGE', description: 'Math result not representable' }
] as const;

const dnsErrorsValues = dnsErrors.map(v => v.value);
export type dnsErrorsValues = (typeof dnsErrorsValues)[number];

const dnsErrorsNames = dnsErrors.map(v => v.name);
export type dnsErrorsNames = (typeof dnsErrorsNames)[number];

export const getDNSErrorDescription = (value: dnsErrorsValues): string => {
  return dnsErrors.find(v => v.value === value)?.description || '';
};
