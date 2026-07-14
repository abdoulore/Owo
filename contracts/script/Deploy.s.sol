// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {RemitEscrow} from "../src/RemitEscrow.sol";
import {MockUSDC} from "../src/MockUSDC.sol";

/// @notice Deploys RemitEscrow to Arbitrum Sepolia. Deploys MockUSDC too unless
/// USDC_ADDRESS is already set in the environment (e.g. a real testnet faucet token).
contract Deploy is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("RELAYER_PRIVATE_KEY");
        // The deployer key is also the relayer key, so the deployer address is the
        // relayer that claim() is gated to.
        address relayer = vm.addr(deployerKey);
        vm.startBroadcast(deployerKey);

        address usdc = vm.envOr("USDC_ADDRESS", address(0));
        if (usdc == address(0)) {
            usdc = address(new MockUSDC());
            console.log("MockUSDC deployed:", usdc);
        }

        RemitEscrow escrow = new RemitEscrow(relayer);
        console.log("RemitEscrow deployed:", address(escrow));

        vm.stopBroadcast();
    }
}
