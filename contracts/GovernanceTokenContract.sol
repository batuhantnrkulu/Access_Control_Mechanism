// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./RegisterContract.sol";
import "./RoleBasedAccessControl.sol";
import "./JudgeContract.sol";
import "./RoleToken.sol";

/// @title Governance Token ERC20
contract GovernanceToken is ERC20 {
    constructor() ERC20("Governance Token", "GOV") {}

    function mint(address to, uint256 amount) external  {
        _mint(to, amount);
    }
}

/// @title GovernanceTokenContract
contract GovernanceTokenContract is Ownable {
    RoleBasedAccessControl public roleBasedAccessContract;
    JudgeContract public judgeContract;
    GovernanceToken public governanceToken;
    RoleToken public roleToken;

    uint256 public totalDistributed;
    uint256 public constant DISTRIBUTION_AMOUNT = 1000 * 1e18;

    constructor(
        address initialAdmin,
        address _judgeContract,
        address _roleBasedAccessContract,
        address _governanceToken,
        address _roleToken
    ) Ownable(initialAdmin){
        roleBasedAccessContract = RoleBasedAccessControl(_roleBasedAccessContract);
        judgeContract = JudgeContract(_judgeContract);
        governanceToken = GovernanceToken(_governanceToken);
        roleToken = RoleToken(_roleToken);
    }

    /// @notice Calculate compliance for a peer
    function getCompliance(address peer) public view returns (uint256) {
        uint256 rewards = judgeContract.getTotalRewards(peer);
        uint256 penalties = judgeContract.getTotalPenalties(peer);

        if (rewards + penalties == 0) return 0.5e18;

        return (rewards * 1e18) / (rewards + penalties);
    }

    /// @notice Status multiplier based on BENIGN / SUSPICIOUS / MALICIOUS
    function getStatusMultiplier(address peer) public view returns (uint256) {
        RoleToken.Member memory member = roleBasedAccessContract.getMemberByAddress(peer);
        bytes32 status = keccak256(bytes(member.status));

        if (status == keccak256("BENIGN")) return 2;
        if (status == keccak256("SUSPICIOUS")) return 1;
        if (status == keccak256("MALICIOUS")) return 0;
        return 0;
    }

    /// @notice Calculate governance power of a peer
    function getGovernancePower(address peer) public view returns (uint256) {
        uint256 compliance = getCompliance(peer);
        uint256 multiplier = getStatusMultiplier(peer);

        // Governance power is purely based on compliance and status (optional: you can include roleToken balance too)
        return (compliance * multiplier) / 1e18;
    }

    /// @notice Distribute governance tokens proportionally
    function distributeGovernanceTokens() external  returns (string memory) {
        RoleToken.Member[] memory allMembers = roleToken.getAllMembers();
        require(allMembers.length > 0, "No members registered");

        uint256 totalPower = 0;
        uint256[] memory powers = new uint256[](allMembers.length);

        // 1️⃣ Calculate governance power for all peers
        for (uint256 i = 0; i < allMembers.length; i++) {
            uint256 power = getGovernancePower(allMembers[i].memberAddress);
            powers[i] = power;
            totalPower += power;
        }

        require(totalPower > 0, "No active governance power");

        // 2️⃣ Mint governance tokens proportionally
        for (uint256 i = 0; i < allMembers.length; i++) {
            uint256 share = (powers[i] * DISTRIBUTION_AMOUNT) / totalPower;
            if (share > 0) {
                governanceToken.mint(allMembers[i].memberAddress, share);
            }
        }

        totalDistributed += DISTRIBUTION_AMOUNT;
    }
}
