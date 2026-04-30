// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
    function transfer(address recipient, uint256 amount) external returns (bool);
}

contract CelopayerEscrow {
    address public treasury;
    IERC20 public usdc;
    uint256 public constant FEE_PERCENTAGE = 5; // 0.5% (represented as 5/1000)
    
    enum EscrowState { Created, Locked, Disputed, Released, Refunded }
    
    struct Escrow {
        address buyer;
        address seller;
        uint256 amount;
        uint256 lockedUntil;
        EscrowState state;
    }
    
    mapping(uint256 => Escrow) public escrows;
    uint256 public nextEscrowId;
    
    event EscrowCreated(uint256 indexed escrowId, address indexed buyer, address indexed seller, uint256 amount, uint256 lockedUntil);
    event FundsReleased(uint256 indexed escrowId);
    event DisputeOpened(uint256 indexed escrowId);
    event DisputeResolved(uint256 indexed escrowId, EscrowState finalState);

    constructor(address _usdc, address _treasury) {
        usdc = IERC20(_usdc);
        treasury = _treasury;
    }
    
    // Buyer calls this to lock funds
    // timeLockDuration is in seconds (e.g., 3600 for 1h)
    function createEscrow(address seller, uint256 amount, uint256 timeLockDuration) external returns (uint256) {
        require(timeLockDuration >= 1 hours, "Time-lock must be at least 1 hour");
        require(amount > 0, "Amount must be greater than 0");
        
        uint256 fee = (amount * FEE_PERCENTAGE) / 1000;
        
        // Transfer USDC from buyer to contract (amount) and treasury (fee)
        require(usdc.transferFrom(msg.sender, address(this), amount), "Transfer to escrow failed");
        if (fee > 0) {
            require(usdc.transferFrom(msg.sender, treasury, fee), "Fee transfer failed");
        }
        
        uint256 escrowId = nextEscrowId++;
        escrows[escrowId] = Escrow({
            buyer: msg.sender,
            seller: seller,
            amount: amount,
            lockedUntil: block.timestamp + timeLockDuration,
            state: EscrowState.Locked
        });
        
        emit EscrowCreated(escrowId, msg.sender, seller, amount, escrows[escrowId].lockedUntil);
        return escrowId;
    }
    
    // Buyer can release funds early (Confirm Delivery)
    function releaseFunds(uint256 escrowId) external {
        Escrow storage escrow = escrows[escrowId];
        require(escrow.state == EscrowState.Locked, "Escrow is not locked");
        require(msg.sender == escrow.buyer, "Only buyer can release early");
        
        escrow.state = EscrowState.Released;
        require(usdc.transfer(escrow.seller, escrow.amount), "Transfer failed");
        
        emit FundsReleased(escrowId);
    }
    
    // Seller can claim funds after time-lock expires if no dispute
    function claimFunds(uint256 escrowId) external {
        Escrow storage escrow = escrows[escrowId];
        require(escrow.state == EscrowState.Locked, "Escrow is not locked");
        require(block.timestamp >= escrow.lockedUntil, "Time-lock active");
        require(msg.sender == escrow.seller, "Only seller can claim");
        
        escrow.state = EscrowState.Released;
        require(usdc.transfer(escrow.seller, escrow.amount), "Transfer failed");
        
        emit FundsReleased(escrowId);
    }
    
    // Buyer or Seller can open a dispute before funds are released/claimed
    function openDispute(uint256 escrowId) external {
        Escrow storage escrow = escrows[escrowId];
        require(escrow.state == EscrowState.Locked, "Escrow not locked or already resolved");
        require(msg.sender == escrow.buyer || msg.sender == escrow.seller, "Not authorized");
        
        escrow.state = EscrowState.Disputed;
        emit DisputeOpened(escrowId);
    }
    
    // Treasury (admin) resolves dispute
    function resolveDispute(uint256 escrowId, bool refundBuyer) external {
        require(msg.sender == treasury, "Only treasury can resolve");
        Escrow storage escrow = escrows[escrowId];
        require(escrow.state == EscrowState.Disputed, "Escrow not in dispute");
        
        if (refundBuyer) {
            escrow.state = EscrowState.Refunded;
            require(usdc.transfer(escrow.buyer, escrow.amount), "Transfer failed");
        } else {
            escrow.state = EscrowState.Released;
            require(usdc.transfer(escrow.seller, escrow.amount), "Transfer failed");
        }
        
        emit DisputeResolved(escrowId, escrow.state);
    }
}
