const library = globalThis.ethers || (await import('../scripts/deps.mjs')).require('ethers');
export const {Interface,Contract,JsonRpcProvider,FetchRequest,sha256,toUtf8Bytes}=library;
