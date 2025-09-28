# SETUP — Foundry + Hedera deployment for Undertaker

This doc explains how to get Foundry running, configure Hedera networks, build, test and deploy `PriceAwareRouter`.

> TL;DR: Fill `.env` from `.env.example`, run `forge build`, run `forge test`, then `forge script script/Deploy.s.sol:Deploy --broadcast --legacy --private-key ...`

---

## 1. Prerequisites

- Foundry (forge + cast).
  ```bash
  curl -L https://foundry.paradigm.xyz | bash
  foundryup
```

- Node/npm (for front-end integration), optional.

- A Hedera testnet/previewnet account + an RPC URL (e.g., https://testnet.hashio.io/api).

- A private key for deployment (use ephemeral keys in CI).


## 2.  Build & Test
# build
`forge build`

# run tests
`forge test -vv`

## 3. Deploy

```
forge script script/Deploy.s.sol \
  --rpc-url $HEDERA_TESTNET_RPC_URL \
  --broadcast \
  --legacy \
  --private-key $PRIVATE_KEY
```

Get HEX Encoded Pvt key [Account ECDSA] from [Hedera Portal](https://portal.hedera.com/dashboard)