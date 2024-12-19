// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./RegisterContract.sol";

contract JudgeContractNew is Ownable {
    RoleBasedAccessControl public roleBasedAccessContract;  // Role-based access control contract
    address public admin;

    struct MisbehaviorRecord {
        string[] reasons;
        uint256 lastPenaltyTime;
        uint256 blockingEndTime;
    }

    struct Penalty {
        string level;
        mapping(RoleToken.Role => uint256) tokenDeduction; // Token deduction per role
        uint256 blockingDuration; // in seconds
    }

    mapping(address => MisbehaviorRecord) public misbehaviorHistory;
    mapping(string => Penalty) private penalties;

    uint256 public benignThreshold = 1 days;  // Example threshold duration for benign status reward
    uint256 public benignThresholdForMalicious = 2 days;  // Example threshold duration for benign status reward
    uint256 public misbehaviorThreshold = 10 minutes;  // Time to reset reputativeCount

    event StatusUpdated(address indexed memberAddress, string newStatus);
    event Penalized(address indexed memberAddress, uint256 penaltyAmount, string reason);
    event MemberBlocked(address indexed memberAddress, uint256 blockingEndTime, string reason);
    event RewardIssued(address indexed memberAddress, uint256 rewardAmount);

    constructor(address initialAdmin, address _roleBasedAccessContract) Ownable(initialAdmin) {
        admin = initialAdmin;
        roleBasedAccessContract = RoleBasedAccessControl(_roleBasedAccessContract);

        // Define penalties based on CIA and STRIDE models
        createPenalty("Unauthorized access attempt", "major", [9000, 7000, 5000], 1 hours);
        createPenalty("Too frequent access", "minor", [5000, 3000, 1000], 10 minutes);
        createPenalty("Data leakage attempt", "major", [11000, 9000, 7000], 2 hours);
        createPenalty("Privilege escalation", "major", [14000, 12000, 10000], 5 hours);
        createPenalty("Spoofing attempt", "minor", [6000, 4000, 2000], 20 minutes);
        createPenalty("Repudiation attempt", "minor", [7000, 5000, 3000], 1 hours);
        createPenalty("Tampering with data", "major", [12000, 10000, 8000], 3 hours);
        createPenalty("Denial of Service", "major", [24000, 22000, 20000], 2 days);
    }

    modifier onlyAdmin() {
        require(roleBasedAccessContract.getRole(msg.sender) == RoleToken.Role.ADMIN, "Access denied: Not an Admin");
        _;
    }

    function createPenalty(
        string memory reason,
        string memory level,
        uint16[3] memory deductions, // Array of deductions for each role
        uint256 duration
    ) public onlyAdmin {
        require(deductions.length == 3, "Deductions array must have exactly 3 values.");

        Penalty storage penalty = penalties[reason];
        penalty.level = level;
        penalty.blockingDuration = duration;

        // Set the token deductions for each role
        penalty.tokenDeduction[RoleToken.Role.PRIMARY_GROUP_HEAD] = deductions[0];
        penalty.tokenDeduction[RoleToken.Role.SECONDARY_GROUP_HEAD] = deductions[1];
        penalty.tokenDeduction[RoleToken.Role.REGULAR_MEMBER] = deductions[2];
    }

    function reportMaliciousActivity(address _memberAddress, string memory reason) external onlyAdmin
        returns (uint256 penaltyAmount, string memory reasonString, uint256 blockingEndTime) {
        require(bytes(reason).length > 0, "Reason cannot be empty");

        MisbehaviorRecord storage record = misbehaviorHistory[_memberAddress];
        uint256 currentTime = block.timestamp;

        /*
            in Solidity, each data type has a default value when a new struct is created or when a mapping entry is accessed for the first time. If you haven’t explicitly set any values for the properties of a struct, they will have these default values:
            uint256: Default value is 0.
            int256: Default value is 0.
            bool: Default value is false.
            address: Default value is 0x0000000000000000000000000000000000000000.
            string: Default value is an empty string "".
            bytes: Default value is an empty byte array 0x.
        */
        Penalty storage penalty = penalties[reason];
        uint256 penaltyDuration = penalties[reason].blockingDuration;
        
        record.reasons.push(reason);
        record.lastPenaltyTime = currentTime;
        
        // Update member's status based on the penalty level
        updateMemberStatus(_memberAddress, penalty.level);
        
        uint256 tokenDeductionAmount = penalty.tokenDeduction[roleBasedAccessContract.getRole(msg.sender)];

        penalizeMember(_memberAddress, tokenDeductionAmount, reason);

        if (penaltyDuration > 0) {
            blockMember(_memberAddress, penaltyDuration, reason);
        }

        return (tokenDeductionAmount, reason, record.blockingEndTime);
    }

    function reportNonPenalizeMisbehavior(address _memberAddress) external onlyAdmin returns (uint256 rewardAmount, string memory newStatus) {
        // Get the member's current status and last status update time
        RoleToken.Member memory member = roleBasedAccessContract.getMember(_memberAddress);

        // Check how long it's been since the last status update
        uint256 timeSinceLastUpdate = block.timestamp - member.lastStatusUpdate;

        if (keccak256(abi.encodePacked(member.status)) == keccak256(abi.encodePacked("BENIGN"))) {
            // If status is benign and the threshold has passed, reward the member
            if (timeSinceLastUpdate >= benignThreshold) {
                rewardMember(_memberAddress);  // Reward amount example
                updateMemberStatus(_memberAddress, "nothing");
                return (5000, "BENIGN");
            }
        } else if (
            keccak256(abi.encodePacked(member.status)) == keccak256(abi.encodePacked("SUSPICIOUS"))
        ) {
            // If the member is suspicious or malicious, and threshold passed, reset status to benign without rewarding token
            if (timeSinceLastUpdate >= benignThreshold) {
                updateMemberStatus(_memberAddress, "nothing");
                return (0, "BENIGN");
            }
        } else if (
            keccak256(abi.encodePacked(member.status)) == keccak256(abi.encodePacked("MALICIOUS"))
        ) {
            // If the member is suspicious or malicious, and threshold passed, reset status to benign without rewarding token
            if (timeSinceLastUpdate >= benignThresholdForMalicious) {
                updateMemberStatus(_memberAddress, "nothing");
                return (0, "BENIGN");
            }
        }

        return (0, "not changed");
    }

    function penalizeMember(address _memberAddress, uint256 penaltyAmount, string memory reason) internal {
        if (penaltyAmount > 0) {
            roleBasedAccessContract.penalizeMember(_memberAddress, penaltyAmount);
        }
        emit Penalized(_memberAddress, penaltyAmount, reason);
    }

    function rewardMember(address _memberAddress) internal {
        roleBasedAccessContract.rewardMember(_memberAddress, 5000); // Reward 5000 tokens for staying benign if it was in benign status before
        emit RewardIssued(_memberAddress, 5000);
    }

    function blockMember(address _memberAddress, uint256 blockingDuration, string memory reason) internal {
        MisbehaviorRecord storage record = misbehaviorHistory[_memberAddress];
        record.blockingEndTime = block.timestamp + blockingDuration;

        emit MemberBlocked(_memberAddress, record.blockingEndTime, reason);
    }

    function updateMemberStatus(address _memberAddress, string memory penaltyLevel) internal {
        if (keccak256(abi.encodePacked(penaltyLevel)) == keccak256(abi.encodePacked("major"))) {
            roleBasedAccessContract.updateMemberStatus(_memberAddress, "MALICIOUS");
            emit StatusUpdated(_memberAddress, "MALICIOUS");
        } else if (keccak256(abi.encodePacked(penaltyLevel)) == keccak256(abi.encodePacked("minor"))) {
            roleBasedAccessContract.updateMemberStatus(_memberAddress, "SUSPICIOUS");
            emit StatusUpdated(_memberAddress, "SUSPICIOUS");
        } else if (keccak256(abi.encodePacked(penaltyLevel)) == keccak256(abi.encodePacked("nothing"))) {
            roleBasedAccessContract.updateMemberStatus(_memberAddress, "BENIGN");
            emit StatusUpdated(_memberAddress, "BENIGN");
        }
    }

    // Public function to retrieve the MisbehaviorRecord for a specific address
    function getBlockingEndTime(address _memberAddress) external view returns (uint256) {
        MisbehaviorRecord storage record = misbehaviorHistory[_memberAddress];
        return record.blockingEndTime;
    }
}