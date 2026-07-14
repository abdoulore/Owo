// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {RemitEscrow} from "../src/RemitEscrow.sol";
import {MockUSDC} from "../src/MockUSDC.sol";

contract RemitEscrowTest is Test {
    RemitEscrow escrow;
    MockUSDC usdc;

    address sender = makeAddr("sender");
    address recipient = makeAddr("recipient");
    address stranger = makeAddr("stranger");

    bytes secret = "correct horse battery staple";
    bytes32 claimHash;

    uint256 constant AMOUNT = 25_000_000; // $25 at 6 decimals
    uint256 expiry;

    function setUp() public {
        // This test contract is the relayer, so claim() calls made directly from the
        // test (msg.sender == address(this)) pass the onlyRelayer gate.
        escrow = new RemitEscrow(address(this));
        usdc = new MockUSDC();
        claimHash = keccak256(secret);
        expiry = block.timestamp + 72 hours;

        usdc.mint(sender, AMOUNT);
        vm.prank(sender);
        usdc.approve(address(escrow), AMOUNT);
    }

    function _send() internal returns (uint256 claimId) {
        vm.prank(sender);
        claimId = escrow.send(address(usdc), AMOUNT, claimHash, expiry);
    }

    function test_HappyPath_SendThenClaim() public {
        uint256 claimId = _send();
        assertEq(usdc.balanceOf(address(escrow)), AMOUNT);

        escrow.claim(claimId, secret, recipient);

        assertEq(usdc.balanceOf(recipient), AMOUNT);
        assertEq(usdc.balanceOf(address(escrow)), 0);

        (,,,,, RemitEscrow.Status status) = escrow.transfers(claimId);
        assertEq(uint8(status), uint8(RemitEscrow.Status.Claimed));
    }

    function test_ClaimByNonRelayerReverts() public {
        uint256 claimId = _send();

        // A stranger who somehow learned the secret (e.g. from a reverted claim's
        // calldata) still cannot spend it: claim() is gated to the relayer.
        vm.prank(stranger);
        vm.expectRevert(RemitEscrow.NotRelayer.selector);
        escrow.claim(claimId, secret, recipient);
    }

    function test_WrongSecretReverts() public {
        uint256 claimId = _send();

        vm.expectRevert(RemitEscrow.WrongSecret.selector);
        escrow.claim(claimId, "wrong secret", recipient);
    }

    function test_DoubleClaimReverts() public {
        uint256 claimId = _send();
        escrow.claim(claimId, secret, recipient);

        vm.expectRevert(RemitEscrow.NotPending.selector);
        escrow.claim(claimId, secret, recipient);
    }

    function test_ClaimAfterExpiryReverts() public {
        uint256 claimId = _send();

        vm.warp(expiry);
        vm.expectRevert(RemitEscrow.Expired.selector);
        escrow.claim(claimId, secret, recipient);
    }

    function test_ReclaimBeforeExpiryReverts() public {
        uint256 claimId = _send();

        vm.prank(sender);
        vm.expectRevert(RemitEscrow.NotExpired.selector);
        escrow.reclaim(claimId);
    }

    function test_ReclaimAfterExpirySucceeds() public {
        uint256 claimId = _send();

        vm.warp(expiry);
        vm.prank(sender);
        escrow.reclaim(claimId);

        assertEq(usdc.balanceOf(sender), AMOUNT);

        (,,,,, RemitEscrow.Status status) = escrow.transfers(claimId);
        assertEq(uint8(status), uint8(RemitEscrow.Status.Reclaimed));
    }

    function test_ReclaimByNonSenderReverts() public {
        uint256 claimId = _send();

        vm.warp(expiry);
        vm.prank(stranger);
        vm.expectRevert(RemitEscrow.NotSender.selector);
        escrow.reclaim(claimId);
    }

    function test_NoClaimAfterReclaim() public {
        uint256 claimId = _send();

        vm.warp(expiry);
        vm.prank(sender);
        escrow.reclaim(claimId);

        vm.expectRevert(RemitEscrow.NotPending.selector);
        escrow.claim(claimId, secret, recipient);
    }

    function test_NoReclaimAfterClaim() public {
        uint256 claimId = _send();
        escrow.claim(claimId, secret, recipient);

        vm.warp(expiry);
        vm.prank(sender);
        vm.expectRevert(RemitEscrow.NotPending.selector);
        escrow.reclaim(claimId);
    }

    function test_SendRevertsOnPastExpiry() public {
        vm.prank(sender);
        vm.expectRevert(RemitEscrow.InvalidExpiry.selector);
        escrow.send(address(usdc), AMOUNT, claimHash, block.timestamp);
    }

    function test_SendRevertsOnZeroAmount() public {
        vm.prank(sender);
        vm.expectRevert(RemitEscrow.ZeroAmount.selector);
        escrow.send(address(usdc), 0, claimHash, expiry);
    }

    function test_SendRevertsOnZeroClaimHash() public {
        vm.prank(sender);
        vm.expectRevert(RemitEscrow.InvalidClaimHash.selector);
        escrow.send(address(usdc), AMOUNT, bytes32(0), expiry);
    }

    function test_SendRevertsOnEmptySecretHash() public {
        vm.prank(sender);
        vm.expectRevert(RemitEscrow.InvalidClaimHash.selector);
        escrow.send(address(usdc), AMOUNT, keccak256(""), expiry);
    }

    function testFuzz_SecretHashMatching(bytes memory correctSecret, bytes memory wrongSecret) public {
        vm.assume(correctSecret.length > 0);
        vm.assume(keccak256(correctSecret) != keccak256(wrongSecret));

        bytes32 hash = keccak256(correctSecret);
        vm.prank(sender);
        uint256 claimId = escrow.send(address(usdc), AMOUNT, hash, expiry);

        vm.expectRevert(RemitEscrow.WrongSecret.selector);
        escrow.claim(claimId, wrongSecret, recipient);

        escrow.claim(claimId, correctSecret, recipient);
        assertEq(usdc.balanceOf(recipient), AMOUNT);
    }
}
