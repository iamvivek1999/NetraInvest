// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// UPDATED FOR BLOCKCHAIN TRANSPARENCY LAYER

/**
 * @title InvestmentLogger
 * @dev A transparency ledger designed STRICTLY to provide an immutable trail for
 *      investments processed off-chain (e.g., via Razorpay). No funds are transferred,
 *      no escrow holds are maintained here.
 */
contract InvestmentLogger {
    address public owner;
    
    struct InvestmentLog {
        uint256 campaignId;
        address investorWallet;   // Zero address if wallet not provided
        string investorRef;       // Backend ID or email hash if external
        uint256 amount;           // The scaled amount
        string paymentId;
        string paymentProvider;
        uint256 timestamp;
    }

    InvestmentLog[] public logs;

    event InvestmentLogged(
        uint256 indexed logIndex,
        uint256 indexed campaignId,
        address investorWallet,
        string investorRef,
        uint256 amount,
        string paymentId,
        string paymentProvider,
        uint256 timestamp
    );

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can log investments");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    /**
     * @dev Log a new investment. Restricted to backend admin/owner.
     */
    function logInvestment(
        uint256 _campaignId,
        address _investorWallet,
        string calldata _investorRef,
        uint256 _amount,
        string calldata _paymentId,
        string calldata _paymentProvider
    ) external onlyOwner {
        uint256 timestamp = block.timestamp;
        
        logs.push(InvestmentLog({
            campaignId: _campaignId,
            investorWallet: _investorWallet,
            investorRef: _investorRef,
            amount: _amount,
            paymentId: _paymentId,
            paymentProvider: _paymentProvider,
            timestamp: timestamp
        }));

        emit InvestmentLogged(
            logs.length - 1,
            _campaignId,
            _investorWallet,
            _investorRef,
            _amount,
            _paymentId,
            _paymentProvider,
            timestamp
        );
    }

    /**
     * @dev Retrieve single log
     */
    function getInvestment(uint256 index) external view returns (InvestmentLog memory) {
        require(index < logs.length, "Index out of bounds");
        return logs[index];
    }
    
    /**
     * @dev Count of strictly registered entries
     */
    function getLogCount() external view returns (uint256) {
        return logs.length;
    }
}
