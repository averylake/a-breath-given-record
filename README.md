# A Breath Given: public record backup

Avery Lake's first gathering. This repository verifies the production anchor and preserves a copy of the public record every 15 minutes. It does not collect payments, mint tokens, or use a wallet or Alchemy credential.

Before the anchor is bound, the Pages site reports `awaiting-binding`. It publishes no invented participant record. Once bound, the workflow copies the primary record only after validation. Once sealed, its fingerprint must match the anchor.

- Artwork and invitation: https://being.averylake.art/
- Public backup: https://averylake.github.io/a-breath-given-record/
- Anchor on Ethereum: `0x333184f9Bca63054a9Ee3582609991758f3Fb6e5`
- Primary: https://breath-record.averylake.art

## Reproduce

Use Node 24 and pnpm 11.19.0. Run `pnpm install --frozen-lockfile --ignore-scripts`, then `node scripts/preserve-record.mjs backup`.

A failed verification preserves the previous published snapshot. The workflow writes only to this repository and its Pages deployment. A monthly maintenance commit keeps the scheduled backup active. Raw block data is read by the primary service; this backup copies and verifies its public output.
