// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @notice Locks ERC20 funds against a hash of a secret; the secret authorizes the claim.
contract RemitEscrow is ReentrancyGuard {
    using SafeERC20 for IERC20;

    enum Status {
        Pending,
        Claimed,
        Reclaimed
    }

    struct Transfer {
        address sender;
        address token;
        uint256 amount;
        bytes32 claimHash;
        uint256 expiry;
        Status status;
    }

    mapping(uint256 => Transfer) public transfers;
    uint256 public nextClaimId;

    /// @notice The only address allowed to submit claim(). Gating claims to the app's
    /// relayer closes the reverted-calldata window: even if a secret leaks from a failed
    /// claim's calldata, no one can spend it by calling this contract directly.
    address public immutable relayer;

    event Sent(
        uint256 indexed claimId,
        address indexed sender,
        address indexed token,
        uint256 amount,
        bytes32 claimHash,
        uint256 expiry
    );
    event Claimed(uint256 indexed claimId, address indexed recipient);
    event Reclaimed(uint256 indexed claimId);

    error InvalidExpiry();
    error NotPending();
    error WrongSecret();
    error Expired();
    error NotExpired();
    error NotSender();
    error ZeroAmount();
    error InvalidClaimHash();
    error NotRelayer();

    /// @dev keccak256("") is rejected so a client bug that hashes an empty secret cannot
    /// create a transfer claimable by anyone who tries the empty string.
    bytes32 private constant EMPTY_SECRET_HASH = keccak256("");

    constructor(address relayer_) {
        relayer = relayer_;
    }

    function send(address token, uint256 amount, bytes32 claimHash, uint256 expiry)
        external
        returns (uint256 claimId)
    {
        if (expiry <= block.timestamp) revert InvalidExpiry();
        if (amount == 0) revert ZeroAmount();
        if (claimHash == bytes32(0) || claimHash == EMPTY_SECRET_HASH) revert InvalidClaimHash();

        claimId = nextClaimId++;
        transfers[claimId] = Transfer({
            sender: msg.sender,
            token: token,
            amount: amount,
            claimHash: claimHash,
            expiry: expiry,
            status: Status.Pending
        });

        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);

        emit Sent(claimId, msg.sender, token, amount, claimHash, expiry);
    }

    /// @notice Submits a claim on the recipient's behalf. The secret is the authorization
    /// (possession of the link, like a check made out to cash), and the recipient is an
    /// explicit parameter. Gated to `relayer`: this call carries the secret in calldata, so
    /// a reverted claim leaves it readable on-chain while the transfer is still Pending, and
    /// gating closes that window (a leaked secret cannot be spent by calling this contract
    /// directly). The app's relayer additionally locks each link to the first recipient that
    /// attempts a claim, so it will not resubmit a leaked secret to a different recipient.
    function claim(uint256 claimId, bytes calldata secret, address recipient) external nonReentrant {
        if (msg.sender != relayer) revert NotRelayer();

        Transfer storage t = transfers[claimId];

        if (t.status != Status.Pending) revert NotPending();
        if (block.timestamp >= t.expiry) revert Expired();
        if (keccak256(secret) != t.claimHash) revert WrongSecret();

        t.status = Status.Claimed;

        IERC20(t.token).safeTransfer(recipient, t.amount);

        emit Claimed(claimId, recipient);
    }

    function reclaim(uint256 claimId) external nonReentrant {
        Transfer storage t = transfers[claimId];

        if (t.sender != msg.sender) revert NotSender();
        if (t.status != Status.Pending) revert NotPending();
        if (block.timestamp < t.expiry) revert NotExpired();

        t.status = Status.Reclaimed;

        IERC20(t.token).safeTransfer(t.sender, t.amount);

        emit Reclaimed(claimId);
    }
}
