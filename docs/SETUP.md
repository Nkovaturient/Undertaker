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


## PriceAwareRouter Smart Contract Walkthrough

This document explains the **Undretaker PriceAwareRouter** smart contract for judges and reviewers. It outlines the core logic, the Hedera-specific features, and how it demonstrates Hedera’s unique capabilities.

---

## Purpose

The **PriceAwareRouter** is designed to enable **secure, price-validated token swaps** on Hedera’s EVM-compatible network. It integrates:

* **Chainlink Oracles** for real-time, tamper-resistant price feeds.
* **Hedera Token Service (HTS) Precompile** for native Hedera token transfers via the EVM.
* **Event logging** to surface price queries, deviations, and executed swaps.

This makes the contract a showcase of **hybrid Hedera-native + Ethereum-compatible features.**

---

##  Key Features

### 1. **Oracle Integration (Chainlink)**

* The contract stores and manages references to Chainlink price feeds.
* Prices are queried via `getLatestPrice(symbol)`.
* Validations ensure only positive, up-to-date prices are used.
* Example: retrieving the latest HBAR/USD feed to price a token swap.

**Why it matters:** Demonstrates Hedera’s ability to seamlessly use **Ethereum tooling** (Chainlink, AggregatorV3Interface) through its EVM compatibility.

---

### 2. **HTS Precompile Integration**

* Hedera’s HTS precompile contract is available at address `0x167`.
* The router calls this precompile to transfer native Hedera tokens directly (`transferHederaToken`).
* The call returns Hedera-specific response codes (e.g. `SUCCESS = 22`).
* These codes are explicitly checked, preventing silent failures.

**Why it matters:** This shows how Hedera **extends the EVM** with precompiled system contracts, bridging native Hedera services (HTS) and Ethereum-style contracts.

---

### 3. **Event-Driven Transparency**

* `PriceQueried(feed, price, timestamp)` logs oracle lookups.
* `TokenTransferred(token, sender, recipient, amount)` logs HTS operations.
* These events align with Hedera explorers like **Hashscan**, making activity visible to users and developers.

---

### 4. **Admin & Security Features**

* Only the owner can set price feeds and trigger HTS transfers.
* Ownership can be transferred securely (`transferOwnership`).
* Input validations prevent unsafe calls (e.g., zero addresses, negative amounts).

---

## Functions Overview

### Oracle Functions

* `setPriceFeed(symbol, feed)`: Register a Chainlink oracle feed.
* `getLatestPrice(symbol)`: Retrieve the most recent oracle price.

### HTS Functions

* `transferHederaToken(token, sender, recipient, amount)`: Move native Hedera tokens using the HTS precompile.

### Admin Functions

* `transferOwnership(newOwner)`: Assign contract ownership.

---

## Example Usage Flow

1. **Setup**

   * Deploy `PriceAwareRouter` with the HTS system contract address (`0x167`).
   * Owner sets price feeds (e.g. HBAR/USD).

2. **Price Query**

   * User calls `getLatestPrice("HBAR/USD")` → fetches Chainlink’s secure price.

3. **Token Swap**

   * Router validates pool vs. oracle price.
   * Executes token transfer via HTS precompile.
   * Emits `SwapExecuted` event.

---

## Why Hedera?

This contract highlights:

* **EVM Compatibility** → Solidity contracts run seamlessly.
* **Native Services Access** → HTS precompile (`0x167`) is uniquely Hedera, enabling hybrid logic.
* **Oracles + System Contracts** → External data (Chainlink) + internal services (HTS) = powerful DeFi primitives.

In short: **Undretaker’s PriceAwareRouter** is not just another swap router. It’s a showcase of how **Hedera’s hybrid architecture** (native precompiles + Ethereum compatibility) empowers developers to build advanced, secure DeFi applications.

---

## Events of Interest

* **PriceQueried** → proves oracle lookup integrity.
* **TokenTransferred** → logs Hedera-native token movements.
* **SwapExecuted** → full swap lifecycle event.

These make the contract highly observable on-chain via **Hashscan verification**.

---

## Summary

The **Undretaker PriceAwareRouter** demonstrates:

* Real-time **oracle price feeds** on Hedera EVM.
* Secure **HTS native token transfers** through system contracts.
* Transparent **event logging** for verifiability.
* **Cross-ecosystem integration** (Ethereum tools + Hedera services).

> It’s a proof of how Hedera extends EVM capabilities to create **innovative DeFi apps**.
