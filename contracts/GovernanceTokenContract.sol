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
    function burn(address from, uint256 amount) external {
        _burn(from, amount);
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
         uint256 tokenBalance = roleToken.balanceOf(peer);   // assumes 18 decimals
        uint256 compliance = getCompliance(peer);           // scaled 1e18
        uint256 multiplier = getStatusMultiplier(peer);     // scaled 1e18

        if (multiplier == 0 || tokenBalance == 0) return 0;

        return (tokenBalance * compliance * multiplier) / 1e36;
    }

    /// @notice Distribute governance tokens proportionally
    function distributeGovernanceTokens() external returns (string memory) {
    RoleToken.Member[] memory allMembers = roleToken.getAllMembers();
    require(allMembers.length > 0, "No members registered");

    // Step 0: clear previous cycle balances
    for (uint256 i = 0; i < allMembers.length; i++) {
        address peer = allMembers[i].memberAddress;
        uint256 oldBal = governanceToken.balanceOf(peer);
        if (oldBal > 0) {
            governanceToken.burn(peer, oldBal);
        }
    }

    uint256 totalPower = 0;
    uint256[] memory powers = new uint256[](allMembers.length);

    for (uint256 i = 0; i < allMembers.length; i++) {
        uint256 power = getGovernancePower(allMembers[i].memberAddress);
        powers[i] = power;
        totalPower += power;
    }

    require(totalPower > 0, "No active governance power");

    for (uint256 i = 0; i < allMembers.length; i++) {
        uint256 share = (powers[i] * DISTRIBUTION_AMOUNT) / totalPower;
        if (share > 0) {
            governanceToken.mint(allMembers[i].memberAddress, share);
        }
    }

    totalDistributed += DISTRIBUTION_AMOUNT;
    return "Governance tokens distributed";
}
    function measureComplianceGas(address peer) external view returns (uint256) {
        uint256 start = gasleft();
        getCompliance(peer);
        return start - gasleft();
    }
    function measureStatusMultiplierGas(address peer) external view returns (uint256) {
        uint256 start = gasleft();
        getStatusMultiplier(peer);
        return start - gasleft();
    }

    function measureGovernancePowerGas(address peer) external view returns (uint256) {
        uint256 start = gasleft();
        getGovernancePower(peer);
        return start - gasleft();
    }

    function measureMintGas(address peer, uint256 amount) external returns (uint256) {
        uint256 start = gasleft();
        governanceToken.mint(peer, amount);
        return start - gasleft();
    }

    function measureDistributionGas() external returns (uint256) {
        uint256 start = gasleft();
        this.distributeGovernanceTokens();
        return start - gasleft();
    }
    
    
}
