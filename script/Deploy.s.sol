// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../contracts/PriceAwareRouter.sol";

contract Deploy is Script {
    function run() external {
        // Load deployer key
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerKey);

        // HTS precompile address on Hedera is 0x167
        address htsAddress = address(0x167);

        // Deploy
        PriceAwareRouter router = new PriceAwareRouter(htsAddress);
        console.log("Deployed PriceAwareRouter at:", address(router));

        vm.stopBroadcast();
    }
}


/**
  [Success] Hash: 0x633583c1bfcf294dd6496edf9fc606ba3d63c02117dd4f6c4cd0ba67fb51dc30
Contract Address: 0x5d9EB54Cd25CCF09dFC1796628776d2ee003a5fC
Block: 25488518
Paid: 0.5541484 ETH (1385371 gas * 400 gwei)

✅ Sequence #1 on 296 | Total Paid: 0.5541484 ETH (1385371 gas * avg 400 gwei)

 */