// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title  InvestmentPlatform
 * @author Enigma
 * @notice Single global milestone-escrow contract for the Enigma transparent
 *         investment platform.
 *
 * ── Architecture ──────────────────────────────────────────────────────────────
 *   One contract holds escrow for ALL campaigns, keyed by a bytes32 campaignKey
 *   generated off-chain by the backend (random 32-byte hex).
 *
 *   Access Control (RBAC):
 *     · DEFAULT_ADMIN_ROLE : High-level admin (create/pause/cancel campaigns).
 *     · OPERATOR_ROLE      : Backend automated tasks (anchoring evidence).
 *     · REVIEWER_ROLE      : Manual review tasks (approve/reject/release funds).
 *
 *   Only appropriate roles can:
 *     · create campaigns (ADMIN)
 *     · anchor evidence (OPERATOR)
 *     · approve / reject milestone evidence (REVIEWER)
 *     · release milestone tranches (REVIEWER)
 *     · pause / cancel campaigns (ADMIN)
 *     · pause the entire platform (ADMIN)
 *
 *   Startup founders submit evidence hashes off-chain via the backend, which
 *   then calls submitMilestoneEvidenceHash() on their behalf using the OPERATOR signer.
 *   Any EOA can invest in an Active, non-paused campaign.
 *
 * ── Milestone flow ────────────────────────────────────────────────────────────
 *   1. Admin calls createCampaign() → status: Active
 *   2. Investors call invest() any time before deadline while Active/not Paused
 *   3. For each milestone (0 → milestoneCount-1):
 *      a. Operator calls submitMilestoneEvidenceHash() (usually automated backend)
 *         → milestone status: Submitted
 *      b. Reviewer calls approveMilestoneEvidence()
 *         → milestone status: Approved
 *         OR reviewer calls rejectMilestoneEvidence() → Rejected (can resubmit)
 *      c. Reviewer calls releaseMilestone()
 *         → milestone status: Released
 *         → tranche sent to startupWallet
 *   4. After last milestone released → campaign status: Completed
 *
 * ── Refund logic ─────────────────────────────────────────────────────────────
 *   · Campaign must be Cancelled (irreversible admin action).
 *   · Each investor calls refundInvestor() to claim their full contribution.
 *   · CEI pattern strictly followed; ReentrancyGuard provides belt-and-suspenders.
 *
 * ── Native token transfer safety ─────────────────────────────────────────────
 *   · All native POL/MATIC sends use low-level call{value}("") with success check.
 *   · transfer() and send() are never used (2300-gas stipend fails for contract
 *     wallets such as Gnosis Safe).
 *
 * ── OZ integrations ──────────────────────────────────────────────────────────
 *   · ReentrancyGuard — invest, releaseMilestone, refundInvestor
 *   · AccessControl    — granular role-based permissions
 *   · Pausable        — global emergency stop on invest() (platform-level)
 */
contract InvestmentPlatform is ReentrancyGuard, AccessControl, Pausable {

    // ─── Roles ────────────────────────────────────────────────────────────────

    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant REVIEWER_ROLE = keccak256("REVIEWER_ROLE");

    // ─── Enums ────────────────────────────────────────────────────────────────

    /**
     * @notice Overall lifecycle status of a campaign.
     *
     * Pending   — created, not yet accepting investments (reserved for future use)
     * Active    — open for investment
     * Paused    — temporarily halted by admin; investments blocked
     * Cancelled — irreversible; investors may claim refunds
     * Completed — all milestones released; campaign is closed
     */
    enum CampaignStatus { Pending, Active, Paused, Cancelled, Completed }

    /**
     * @notice Per-milestone evidence and release status.
     *
     * NotSubmitted — evidence not yet anchored (initial state)
     * Submitted    — startup submitted evidence hash; awaiting admin review
     * Approved     — admin approved evidence; eligible for fund release
     * Rejected     — admin rejected; startup may resubmit (resets to NotSubmitted)
     * Released     — funds for this milestone already transferred to startup
     */
    enum MilestoneStatus { NotSubmitted, Submitted, Approved, Rejected, Released }

    // ─── Structs ──────────────────────────────────────────────────────────────

    /**
     * @dev Compact on-chain anchor for off-chain milestone evidence.
     *      Raw files are NEVER stored on-chain — only their keccak256 hashes.
     *
     * evidenceHash  — keccak256 of the off-chain evidence file or zip.
     * summaryHash   — keccak256 of the milestone summary JSON.
     * submittedAt   — block.timestamp when evidence was first submitted.
     * releasedAt    — block.timestamp when funds were released (0 = not released).
     * status        — current MilestoneStatus.
     */
    struct MilestoneAnchor {
        bytes32         evidenceHash;
        bytes32         summaryHash;
        uint256         submittedAt;
        uint256         releasedAt;
        MilestoneStatus status;
    }

    /**
     * @dev Campaign escrow configuration and current state.
     *
     * Storage-packing note:
     *   milestoneCount (uint8) + currentMilestoneIndex (uint8) +
     *   milestonePercentages (5 × uint8) + status (uint8) = 8 bytes in one slot.
     */
    struct Campaign {
        address        startupWallet;         // receives released milestone funds
        uint256        fundingGoal;           // target in wei (informational)
        uint256        deadline;              // Unix timestamp — no new investments after this
        uint256        totalRaised;           // cumulative investment in wei
        uint8          milestoneCount;        // number of active milestones (1–5)
        uint8          currentMilestoneIndex; // next milestone index to release (0-based)
        uint8[5]       milestonePercentages;  // fixed-size; unused slots must be 0
        CampaignStatus status;                // replaces bool isOpen + bool exists
        MilestoneAnchor[5] milestones;        // per-milestone evidence anchors
    }

    // ─── State ────────────────────────────────────────────────────────────────

    /// @notice Campaign registry. Key = bytes32 campaignKey (backend-generated).
    mapping(bytes32 => Campaign) public campaigns;

    /**
     * @notice Per-investor contribution amounts (wei).
     * investments[campaignKey][investorAddress] = total wei contributed.
     * Used for refunds on Cancelled campaigns.
     */
    mapping(bytes32 => mapping(address => uint256)) public investments;

    // ─── Events ───────────────────────────────────────────────────────────────

    /// @notice Emitted when a campaign is registered on-chain and opened.
    event CampaignCreated(
        bytes32 indexed campaignKey,
        address indexed startupWallet,
        uint256         fundingGoal,
        uint256         deadline,
        uint8           milestoneCount
    );

    /// @notice Emitted on every successful investment.
    event InvestmentReceived(
        bytes32 indexed campaignKey,
        address indexed investor,
        uint256         amount,
        uint256         totalRaised
    );

    /**
     * @notice Emitted when milestone evidence hashes are anchored on-chain.
     * @param evidenceHash  keccak256 of off-chain evidence file(s).
     * @param summaryHash   keccak256 of off-chain milestone summary JSON.
     */
    event MilestoneEvidenceSubmitted(
        bytes32 indexed campaignKey,
        uint8           milestoneIndex,
        bytes32         evidenceHash,
        bytes32         summaryHash
    );

    /// @notice Emitted when admin approves submitted milestone evidence.
    event MilestoneEvidenceApproved(
        bytes32 indexed campaignKey,
        uint8           milestoneIndex
    );

    /**
     * @notice Emitted when admin rejects submitted evidence.
     * @param reason  Short human-readable rejection reason (not stored on-chain).
     */
    event MilestoneEvidenceRejected(
        bytes32 indexed campaignKey,
        uint8           milestoneIndex,
        string          reason
    );

    /// @notice Emitted when a milestone tranche is transferred to the startup.
    event MilestoneReleased(
        bytes32 indexed campaignKey,
        uint8           milestoneIndex,
        uint256         amount,
        address indexed recipient
    );

    /// @notice Emitted after the last milestone is released.
    event CampaignCompleted(
        bytes32 indexed campaignKey,
        uint256         totalRaised
    );

    /// @notice Emitted when a campaign is paused by admin.
    event CampaignPaused(bytes32 indexed campaignKey);

    /// @notice Emitted when a paused campaign is resumed by admin.
    event CampaignUnpaused(bytes32 indexed campaignKey);

    /// @notice Emitted when a campaign is permanently cancelled by admin.
    event CampaignCancelled(bytes32 indexed campaignKey);

    /// @notice Emitted when an investor claims a refund on a cancelled campaign.
    event InvestorRefunded(
        bytes32 indexed campaignKey,
        address indexed investor,
        uint256         amount
    );

    // ─── Modifiers ────────────────────────────────────────────────────────────

    /**
     * @dev Reverts if the campaignKey does not correspond to a registered campaign.
     * A campaign is "registered" when its status is anything other than the
     * zero-value of the enum. We use a separate `exists` check via status:
     * Pending is index 0 so we cannot use status == 0 as "not found".
     * Instead, we store a separate boolean in the struct to avoid ambiguity.
     *
     * Implementation choice: We embed `exists` semantics in the status field
     * by setting status to Active (not Pending) on creation in this MVP.
     * The Pending state is reserved for future pre-launch window use.
     * A campaign "exists" iff its fundingGoal > 0 (zero is the default uint256).
     */
    modifier campaignExists(bytes32 campaignKey) {
        require(
            campaigns[campaignKey].fundingGoal > 0,
            "InvestmentPlatform: Campaign not found"
        );
        _;
    }

    /// @dev Reverts if campaign is not in Active status.
    modifier campaignActive(bytes32 campaignKey) {
        require(
            campaigns[campaignKey].status == CampaignStatus.Active,
            "InvestmentPlatform: Campaign is not active"
        );
        _;
    }

    /**
     * @notice Deploys the contract and sets msg.sender as the initial admin and reviewer.
     * @dev In production, grant roles to separate accounts as needed.
     */
    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(REVIEWER_ROLE, msg.sender);
    }

    // ─── Admin: Campaign Lifecycle ────────────────────────────────────────────

    /**
     * @notice Register a new campaign on-chain and open it immediately for investment.
     *
     * @param campaignKey           Random bytes32 identifier generated by the backend.
     * @param startupWallet         EOA or multisig that receives released milestone funds.
     * @param fundingGoal           Target amount in wei (informational — no hard cap enforced).
     * @param deadline              Unix timestamp after which no new investment is accepted.
     * @param milestoneCount        Number of active milestones (1–5 inclusive).
     * @param milestonePercentages  Fixed 5-element array.
     *                              Indices [0, milestoneCount) must each be > 0 and sum to 100.
     *                              Indices [milestoneCount, 5) must be exactly 0.
     *
     * @dev Backend must validate all parameters before calling (deadline > now, etc.).
     * Emits {CampaignCreated}.
     */
    function createCampaign(
        bytes32       campaignKey,
        address       startupWallet,
        uint256       fundingGoal,
        uint256       deadline,
        uint8         milestoneCount,
        uint8[5] calldata milestonePercentages
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(
            campaigns[campaignKey].fundingGoal == 0,
            "InvestmentPlatform: Campaign already exists"
        );
        require(
            startupWallet != address(0),
            "InvestmentPlatform: Invalid startup wallet"
        );
        require(
            fundingGoal > 0,
            "InvestmentPlatform: Funding goal must be > 0"
        );
        require(
            deadline > block.timestamp,
            "InvestmentPlatform: Deadline must be in the future"
        );
        require(
            milestoneCount >= 1 && milestoneCount <= 5,
            "InvestmentPlatform: milestoneCount must be 1-5"
        );

        // Validate active milestone percentages sum exactly to 100
        uint256 total = 0;
        for (uint8 i = 0; i < milestoneCount; i++) {
            require(
                milestonePercentages[i] > 0,
                "InvestmentPlatform: Active milestone percentage must be > 0"
            );
            total += milestonePercentages[i];
        }
        require(total == 100, "InvestmentPlatform: Milestone percentages must sum to 100");

        // Enforce unused slots are zero (keeps data clean for view functions)
        for (uint8 i = milestoneCount; i < 5; i++) {
            require(
                milestonePercentages[i] == 0,
                "InvestmentPlatform: Unused milestone slots must be 0"
            );
        }

        // Write to storage field-by-field (avoids calldata-to-storage array copy issues)
        Campaign storage c = campaigns[campaignKey];
        c.startupWallet         = startupWallet;
        c.fundingGoal           = fundingGoal;
        c.deadline              = deadline;
        c.totalRaised           = 0;
        c.milestoneCount        = milestoneCount;
        c.currentMilestoneIndex = 0;
        c.status                = CampaignStatus.Active;

        for (uint8 i = 0; i < 5; i++) {
            c.milestonePercentages[i] = milestonePercentages[i];
            // MilestoneAnchor fields default to zero / NotSubmitted automatically
        }

        emit CampaignCreated(campaignKey, startupWallet, fundingGoal, deadline, milestoneCount);
    }

    /**
     * @notice Pause an Active campaign, blocking new investments.
     * @dev Only valid for Active campaigns. Does not affect existing investments.
     * Emits {CampaignPaused}.
     *
     * @param campaignKey  The campaign to pause.
     */
    function pauseCampaign(bytes32 campaignKey)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
        campaignExists(campaignKey)
    {
        require(
            campaigns[campaignKey].status == CampaignStatus.Active,
            "InvestmentPlatform: Can only pause an Active campaign"
        );
        campaigns[campaignKey].status = CampaignStatus.Paused;
        emit CampaignPaused(campaignKey);
    }

    /**
     * @notice Resume a Paused campaign, re-enabling investment.
     * @dev Only valid for Paused campaigns.
     * Emits {CampaignUnpaused}.
     *
     * @param campaignKey  The campaign to resume.
     */
    function unpauseCampaign(bytes32 campaignKey)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
        campaignExists(campaignKey)
    {
        require(
            campaigns[campaignKey].status == CampaignStatus.Paused,
            "InvestmentPlatform: Campaign is not paused"
        );
        campaigns[campaignKey].status = CampaignStatus.Active;
        emit CampaignUnpaused(campaignKey);
    }

    /**
     * @notice Permanently cancel a campaign. Investors become eligible for refunds.
     * @dev Cancelled status is IRREVERSIBLE — cannot be reopened.
     *      Campaign must be Active or Paused (not already Completed or Cancelled).
     * Emits {CampaignCancelled}.
     *
     * @param campaignKey  The campaign to cancel.
     */
    function cancelCampaign(bytes32 campaignKey)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
        campaignExists(campaignKey)
    {
        CampaignStatus s = campaigns[campaignKey].status;
        require(
            s == CampaignStatus.Active || s == CampaignStatus.Paused,
            "InvestmentPlatform: Can only cancel an Active or Paused campaign"
        );
        campaigns[campaignKey].status = CampaignStatus.Cancelled;
        emit CampaignCancelled(campaignKey);
    }

    // ─── Admin: Milestone Evidence Workflow ───────────────────────────────────

    /**
     * @notice Anchor the keccak256 hashes of off-chain milestone evidence on-chain.
     *
     * Raw evidence files are NEVER stored on-chain.
     * Only their keccak256 hashes are anchored here, creating an immutable
     * proof of existence and integrity for the off-chain evidence.
     *
     * Milestones must be submitted in order (index must equal currentMilestoneIndex).
     * A previously Rejected milestone can be resubmitted (status resets to Submitted).
     *
     * @param campaignKey    The campaign this milestone belongs to.
     * @param milestoneIndex Must equal campaign.currentMilestoneIndex.
     * @param evidenceHash   keccak256(off-chain evidence file bytes).
     * @param summaryHash    keccak256(off-chain milestone summary JSON bytes).
     *
     * Emits {MilestoneEvidenceSubmitted}.
     */
    function submitMilestoneEvidenceHash(
        bytes32 campaignKey,
        uint8   milestoneIndex,
        bytes32 evidenceHash,
        bytes32 summaryHash
    ) external onlyRole(OPERATOR_ROLE) campaignExists(campaignKey) {
        Campaign storage c = campaigns[campaignKey];

        require(
            c.status == CampaignStatus.Active || c.status == CampaignStatus.Paused,
            "InvestmentPlatform: Campaign must be Active or Paused to submit evidence"
        );
        require(
            milestoneIndex == c.currentMilestoneIndex,
            "InvestmentPlatform: Must submit evidence for current milestone index"
        );
        require(
            milestoneIndex < c.milestoneCount,
            "InvestmentPlatform: milestoneIndex out of range"
        );
        require(
            evidenceHash != bytes32(0),
            "InvestmentPlatform: evidenceHash must not be zero"
        );
        require(
            summaryHash != bytes32(0),
            "InvestmentPlatform: summaryHash must not be zero"
        );

        MilestoneAnchor storage anchor = c.milestones[milestoneIndex];

        // Allow resubmission only if Rejected or NotSubmitted (not Approved/Released)
        require(
            anchor.status == MilestoneStatus.NotSubmitted ||
            anchor.status == MilestoneStatus.Rejected,
            "InvestmentPlatform: Evidence already submitted or released"
        );

        anchor.evidenceHash = evidenceHash;
        anchor.summaryHash  = summaryHash;
        anchor.submittedAt  = block.timestamp;
        anchor.status       = MilestoneStatus.Submitted;

        emit MilestoneEvidenceSubmitted(campaignKey, milestoneIndex, evidenceHash, summaryHash);
    }

    /**
     * @notice Approve the submitted evidence for the current milestone.
     *
     * Approval gates fund release — releaseMilestone() will revert unless
     * the milestone status is Approved.
     *
     * @param campaignKey    The campaign to approve milestone for.
     * @param milestoneIndex Must equal campaign.currentMilestoneIndex.
     *
     * Emits {MilestoneEvidenceApproved}.
     */
    function approveMilestoneEvidence(
        bytes32 campaignKey,
        uint8   milestoneIndex
    ) external onlyRole(REVIEWER_ROLE) campaignExists(campaignKey) {
        Campaign storage c = campaigns[campaignKey];

        require(
            milestoneIndex == c.currentMilestoneIndex,
            "InvestmentPlatform: milestoneIndex does not match current"
        );
        require(
            milestoneIndex < c.milestoneCount,
            "InvestmentPlatform: milestoneIndex out of range"
        );
        require(
            c.milestones[milestoneIndex].status == MilestoneStatus.Submitted,
            "InvestmentPlatform: Milestone evidence is not in Submitted state"
        );

        c.milestones[milestoneIndex].status = MilestoneStatus.Approved;

        emit MilestoneEvidenceApproved(campaignKey, milestoneIndex);
    }

    /**
     * @notice Reject submitted milestone evidence. Startup may resubmit.
     *
     * Sets milestone status back to Rejected. The startup can call
     * submitMilestoneEvidenceHash() again with corrected evidence.
     *
     * @param campaignKey    The campaign.
     * @param milestoneIndex Milestone index to reject.
     * @param reason         Short human-readable rejection reason.
     *                       Emitted in event; NOT stored on-chain (saves gas).
     *
     * Emits {MilestoneEvidenceRejected}.
     */
    function rejectMilestoneEvidence(
        bytes32 campaignKey,
        uint8   milestoneIndex,
        string calldata reason
    ) external onlyRole(REVIEWER_ROLE) campaignExists(campaignKey) {
        Campaign storage c = campaigns[campaignKey];

        require(
            milestoneIndex == c.currentMilestoneIndex,
            "InvestmentPlatform: milestoneIndex does not match current"
        );
        require(
            c.milestones[milestoneIndex].status == MilestoneStatus.Submitted,
            "InvestmentPlatform: Milestone evidence is not in Submitted state"
        );

        c.milestones[milestoneIndex].status = MilestoneStatus.Rejected;

        emit MilestoneEvidenceRejected(campaignKey, milestoneIndex, reason);
    }

    /**
     * @notice Release the next milestone tranche to the startup wallet.
     *
     * Requirements (all must hold):
     *   · Campaign is Active or Paused (not Cancelled / Completed)
     *   · milestoneIndex == campaign.currentMilestoneIndex (sequential enforcement)
     *   · milestone status is Approved (evidence must be approved first)
     *   · totalRaised > 0 (nothing to release otherwise)
     *   · computed release amount > 0
     *   · contract holds sufficient balance
     *
     * CEI pattern: all state updates happen BEFORE the external transfer.
     * ReentrancyGuard provides belt-and-suspenders protection.
     *
     * Release amount = totalRaised × milestonePercentages[index] / 100
     * (based on actual raised amount, not the funding goal)
     *
     * @param campaignKey    The campaign to release funds for.
     * @param milestoneIndex Must equal campaign.currentMilestoneIndex.
     *
     * Emits {MilestoneReleased}.
     * Emits {CampaignCompleted} if this was the final milestone.
     */
    function releaseMilestone(
        bytes32 campaignKey,
        uint8   milestoneIndex
    ) external onlyRole(REVIEWER_ROLE) nonReentrant campaignExists(campaignKey) {
        Campaign storage c = campaigns[campaignKey];

        CampaignStatus s = c.status;
        require(
            s == CampaignStatus.Active || s == CampaignStatus.Paused,
            "InvestmentPlatform: Campaign must be Active or Paused to release funds"
        );
        require(
            milestoneIndex == c.currentMilestoneIndex,
            "InvestmentPlatform: milestoneIndex does not match current"
        );
        require(
            milestoneIndex < c.milestoneCount,
            "InvestmentPlatform: All milestones already released"
        );
        require(
            c.milestones[milestoneIndex].status == MilestoneStatus.Approved,
            "InvestmentPlatform: Evidence must be Approved before release"
        );
        require(
            c.totalRaised > 0,
            "InvestmentPlatform: No funds raised"
        );

        uint256 releaseAmount =
            (c.totalRaised * uint256(c.milestonePercentages[milestoneIndex])) / 100;

        require(releaseAmount > 0, "InvestmentPlatform: Computed release amount is zero");
        require(
            address(this).balance >= releaseAmount,
            "InvestmentPlatform: Insufficient contract balance"
        );

        // ── Effects (before external call — CEI pattern) ──────────────────────
        c.milestones[milestoneIndex].status     = MilestoneStatus.Released;
        c.milestones[milestoneIndex].releasedAt = block.timestamp;
        c.currentMilestoneIndex += 1;

        bool isFinal = (c.currentMilestoneIndex == c.milestoneCount);
        if (isFinal) {
            c.status = CampaignStatus.Completed;
            emit CampaignCompleted(campaignKey, c.totalRaised);
        }

        emit MilestoneReleased(campaignKey, milestoneIndex, releaseAmount, c.startupWallet);

        // ── Interaction (after all state changes) ─────────────────────────────
        // Low-level call forwards all gas — works for contract wallets (Gnosis Safe).
        (bool success, ) = c.startupWallet.call{ value: releaseAmount }("");
        require(success, "InvestmentPlatform: Transfer to startup wallet failed");
    }

    // ─── Investor Functions ───────────────────────────────────────────────────

    /**
     * @notice Invest native POL in an Active campaign.
     *
     * The investor calls this directly from MetaMask.  The backend does NOT proxy
     * this transaction. After the tx confirms, the frontend POSTs:
     *   { txHash, campaignKey, investorAddress }
     * to the backend, which verifies the InvestmentReceived event and syncs MongoDB.
     *
     * Blocked when:
     *   · The contract-level emergency pause is active (global Pausable)
     *   · The campaign status is not Active
     *   · The campaign deadline has passed
     *   · msg.value is 0
     *
     * @param campaignKey  The campaign to invest in.
     *
     * Emits {InvestmentReceived}.
     */
    function invest(
        bytes32 campaignKey
    ) external payable nonReentrant whenNotPaused campaignExists(campaignKey) {
        Campaign storage c = campaigns[campaignKey];

        require(
            c.status == CampaignStatus.Active,
            "InvestmentPlatform: Campaign is not accepting investments"
        );
        require(
            block.timestamp < c.deadline,
            "InvestmentPlatform: Campaign deadline has passed"
        );
        require(
            msg.value > 0,
            "InvestmentPlatform: Investment amount must be > 0"
        );

        // Record contribution (enables refunds without state migration)
        investments[campaignKey][msg.sender] += msg.value;
        c.totalRaised += msg.value;

        emit InvestmentReceived(campaignKey, msg.sender, msg.value, c.totalRaised);
    }

    /**
     * @notice Claim a full refund for a cancelled campaign.
     *
     * Only available when campaign status is Cancelled.
     * CEI pattern: zero out contribution BEFORE transferring funds.
     *
     * @param campaignKey  The cancelled campaign to claim a refund from.
     *
     * Emits {InvestorRefunded}.
     */
    function refundInvestor(
        bytes32 campaignKey
    ) external nonReentrant campaignExists(campaignKey) {
        require(
            campaigns[campaignKey].status == CampaignStatus.Cancelled,
            "InvestmentPlatform: Refunds only available for Cancelled campaigns"
        );

        uint256 amount = investments[campaignKey][msg.sender];
        require(amount > 0, "InvestmentPlatform: No investment to refund");

        // ── Effects (before external call — CEI pattern) ──────────────────────
        investments[campaignKey][msg.sender] = 0;

        emit InvestorRefunded(campaignKey, msg.sender, amount);

        // ── Interaction (after state changes) ─────────────────────────────────
        (bool success, ) = msg.sender.call{ value: amount }("");
        require(success, "InvestmentPlatform: Refund transfer failed");
    }

    // ─── Admin: Global Emergency Pause ───────────────────────────────────────

    /**
     * @notice Pause all invest() calls platform-wide (emergency stop).
     * @dev Does not affect milestone releases or refunds.
     *      Uses OZ Pausable — emits {Paused}.
     */
    function emergencyPause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    /**
     * @notice Resume invest() calls after emergency pause.
     * @dev Uses OZ Pausable — emits {Unpaused}.
     */
    function emergencyUnpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    // ─── View Functions ───────────────────────────────────────────────────────

    /**
     * @notice Return the full Campaign struct for a given key.
     * @dev Backend uses this to verify on-chain state matches MongoDB.
     *
     * @param campaignKey  The campaign to retrieve.
     * @return             Full Campaign memory struct.
     */
    function getCampaignDetails(
        bytes32 campaignKey
    ) external view campaignExists(campaignKey) returns (Campaign memory) {
        return campaigns[campaignKey];
    }

    /**
     * @notice Return a single MilestoneAnchor for a campaign.
     *
     * @param campaignKey    The campaign.
     * @param milestoneIndex 0-based index (must be < milestoneCount).
     * @return               MilestoneAnchor memory struct.
     */
    function getMilestoneDetails(
        bytes32 campaignKey,
        uint8   milestoneIndex
    ) external view campaignExists(campaignKey) returns (MilestoneAnchor memory) {
        require(
            milestoneIndex < campaigns[campaignKey].milestoneCount,
            "InvestmentPlatform: milestoneIndex out of range"
        );
        return campaigns[campaignKey].milestones[milestoneIndex];
    }

    /**
     * @notice Return a specific investor's total contribution to a campaign (wei).
     * Returns 0 if the investor has not contributed or the campaign does not exist.
     *
     * @param campaignKey  The campaign.
     * @param investor     The investor address.
     * @return             Wei contributed.
     */
    function getInvestorContribution(
        bytes32 campaignKey,
        address investor
    ) external view returns (uint256) {
        return investments[campaignKey][investor];
    }

    /**
     * @notice Return total POL raised for a campaign (wei).
     *
     * @param campaignKey  The campaign.
     * @return             Total raised in wei.
     */
    function getTotalRaised(
        bytes32 campaignKey
    ) external view campaignExists(campaignKey) returns (uint256) {
        return campaigns[campaignKey].totalRaised;
    }

    /**
     * @notice Return the current status of a campaign as a uint8.
     * 0=Pending, 1=Active, 2=Paused, 3=Cancelled, 4=Completed
     *
     * @param campaignKey  The campaign.
     * @return             uint8 status value.
     */
    function getCampaignStatus(
        bytes32 campaignKey
    ) external view campaignExists(campaignKey) returns (uint8) {
        return uint8(campaigns[campaignKey].status);
    }

    // ─── Backward Compatibility Aliases ──────────────────────────────────────

    /**
     * @notice v1 alias: returns investor contribution amount.
     * @dev Kept for backward compatibility with any off-chain tools using v1 ABI.
     *      Prefer getInvestorContribution() in new code.
     */
    function getInvestment(
        bytes32 campaignKey,
        address investor
    ) external view returns (uint256) {
        return investments[campaignKey][investor];
    }

    /**
     * @notice v1 alias: returns full campaign struct.
     * @dev Kept for backward compatibility. Prefer getCampaignDetails() in new code.
     */
    function getCampaign(
        bytes32 campaignKey
    ) external view campaignExists(campaignKey) returns (Campaign memory) {
        return campaigns[campaignKey];
    }

    // ─── Safety ───────────────────────────────────────────────────────────────

    /**
     * @dev Reject accidental direct POL sends to the contract address.
     * POL must only enter via invest().
     */
    receive() external payable {
        revert("InvestmentPlatform: Use invest() to send POL");
    }
}
