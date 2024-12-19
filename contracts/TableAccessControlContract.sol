// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./RoleBasedAccessControl.sol";
import "./JudgeContract.sol";
import "./RegisterContract.sol";
import "./AccessControlContract.sol";
import "./RoleToken.sol";

contract TableAccessControlContract is Ownable {
    RoleBasedAccessControl public roleBasedAccessControl;
    JudgeContract public judgeContract;
    RegisterContract public registerContract;

    uint256 public quorumPercentage = 51; // Percentage of primary heads needed for quorum

    struct Policy {
        RoleToken.Role role;
        string resource;
        string action;
        string permission;
        uint256 timeOfLastRequest;
    }

    Policy[] public policies; // Array to store policies

    struct AccessRequest {
        uint id;
        string resource;
        string action;
        uint approvals;
        address requester;
        bool isGlobalRequest; // Indicates if it's a global or local request
        bool isApproved; // Indicates if the request has been approved
        uint256 requiredQuorum; // Required quorum for the request
    }

    AccessRequest[] public accessRequests;
    mapping(uint => mapping(address => bool)) public approvals;

    event AccessRequestCreated(
        uint indexed requestId,  // Added requestId to the event
        address indexed requester,
        string resource,
        address indexed contractAddress
    );

    event AccessGranted(address indexed requester, string funcName, string funcType);
    event AccessDenied(address indexed requester, string reason);
    event ResolveAddressLog(address resolvedAddress, string name);
    event PolicyAdded(uint256 policyId, RoleToken.Role role, string resource, string action, string permission);
    event PolicyUpdated(uint256 policyId, RoleToken.Role role, string resource, string action, string permission);
    event PolicyDeleted(uint256 policyId);
    event MaliciousActivityReported(address indexed subject, uint256 penaltyAmount, string reason, uint256 blockingEndTime); // New event for malicious activity
    event NonPenalizeMisbehaviorReported(address indexed subject, uint256 rewardAmount, string newStatus); // New event for benign behavior
    event GlobalResourceTableViewed(address indexed viewer, RoleToken.Member[] resourceTable);
    event LocalResourceTableViewed(address indexed viewer, RoleToken.Member[] resourceTable);

    constructor(
        address _roleBasedAccessControl,
        address _judgeContract,
        address _registerContract,
        address initialOwner
    ) Ownable(initialOwner) {
        roleBasedAccessControl = RoleBasedAccessControl(_roleBasedAccessControl);
        judgeContract = JudgeContract(_judgeContract);
        registerContract = RegisterContract(_registerContract);
    }

    // Modifier to check if the caller is authorized to view or modify the resource tables
    modifier onlyAuthorizedRequesters(string memory resource, string memory action) {
        bool isApproved = false;
        for (uint i = 0; i < accessRequests.length; i++) {
            if (accessRequests[i].requester == msg.sender && accessRequests[i].isApproved) {
                // Check if the request matches the resource and action
                if (keccak256(bytes(accessRequests[i].resource)) == keccak256(bytes(resource)) &&
                    keccak256(bytes(accessRequests[i].action)) == keccak256(bytes(action))) {
                    isApproved = accessRequests[i].isApproved;
                    break;
                }
            }
        }
        
        // If the request is not approved, report malicious activity and return
        if (!isApproved) {
            if (keccak256(bytes(action)) == keccak256(bytes("delete")) || keccak256(bytes("edit")) == keccak256(bytes(action))) {
                (uint256 penaltyAmount, string memory reason, uint256 blockingEndTime) = judgeContract.reportMaliciousActivity(msg.sender, "Tampering with data");
                emit MaliciousActivityReported(msg.sender, penaltyAmount, reason, blockingEndTime);
            } else if (keccak256(bytes(action)) == keccak256(bytes("view"))) {
                // Report unauthorized access for view attempts
                (uint256 penaltyAmount, string memory reason, uint256 blockingEndTime) = judgeContract.reportMaliciousActivity(msg.sender, "Unauthorized access attempt");
                emit MaliciousActivityReported(msg.sender, penaltyAmount, reason, blockingEndTime);
            }
        }
        else {
            (uint256 rewardAmount, string memory newStatus) = judgeContract.reportNonPenalizeMisbehavior(msg.sender);
            emit NonPenalizeMisbehaviorReported(msg.sender, rewardAmount, newStatus); // Emit event for benign behavior
            _;      
        }
    }

    modifier onlyPrimaryHead() {
        roleBasedAccessControl.requireRole(msg.sender, RoleToken.Role.PRIMARY_GROUP_HEAD);
        _;
    }

    modifier notBlocked() {
        uint256 blockingEndTime = judgeContract.getBlockingEndTime(msg.sender);
        require(block.timestamp > blockingEndTime, "AccessControlContract: Member is blocked");
        _;
    }

    // Functions to manage policies
    function policyAdd(
        RoleToken.Role role,
        string memory resource,
        string memory action,
        string memory permission
    ) external onlyOwner {
        policies.push(Policy(role, resource, action, permission, 0));
        emit PolicyAdded(
            policies.length - 1,
            role,
            resource,
            action,
            permission
        );
    }

    function policyUpdate(
        uint256 policyId,
        RoleToken.Role role,
        string memory resource,
        string memory action,
        string memory permission
    ) external onlyOwner {
        require(policyId < policies.length, "Policy does not exist");
        policies[policyId] = Policy(role, resource, action, permission, 0);
        emit PolicyUpdated(policyId, role, resource, action, permission);
    }

    function policyDelete(uint256 policyId) external onlyOwner {
        require(policyId < policies.length, "Policy does not exist");
        delete policies[policyId];
        emit PolicyDeleted(policyId);
    }

    function getTime() external view returns (uint256, bool) {
        //JudgeContract.MisbehaviorRecord memory record = judgeContract.getMisbehaviorRecord(msg.sender);
        uint256 blockingEndTime = judgeContract.getBlockingEndTime(msg.sender);
        bool isBlocked = false;

        if (block.timestamp < blockingEndTime) {
            isBlocked = true;
        }

        return (blockingEndTime, isBlocked);
    }

    // Function to create an access request
    function createAccessRequest(
        string memory resource,
        string memory action
    ) external notBlocked {
        RoleToken.Role role = roleBasedAccessControl.getRole(msg.sender);

        // Check policies
        bool allowed = checkPolicy(resource, action, role);
        if (!allowed) {
            // Penalize
            if (keccak256(bytes(action)) == keccak256(bytes("edit")) || keccak256(bytes(action)) == keccak256(bytes("delete"))) {
                (uint256 penaltyAmount, string memory reason, uint256 blockingEndTime) = judgeContract.reportMaliciousActivity(msg.sender, "Tampering with data");
                emit MaliciousActivityReported(msg.sender, penaltyAmount, reason, blockingEndTime); // Emit event for tampering with data
            }
            else if (keccak256(bytes(action)) == keccak256(bytes("view"))) {
                (uint256 penaltyAmount, string memory reason, uint256 blockingEndTime) = judgeContract.reportMaliciousActivity(msg.sender, "Unauthorized access attempt");
                emit MaliciousActivityReported(msg.sender, penaltyAmount, reason, blockingEndTime); // Emit event for unauthorized access
            }

            return;
        }

        // Determine if the request is for a global or local resource table
        bool isGlobalRequest = keccak256(bytes(resource)) == keccak256(bytes("GlobalResourceTable"));
        bool isLocalRequestByPrimaryHead = !isGlobalRequest && role == RoleToken.Role.PRIMARY_GROUP_HEAD;

        // Determine required quorum
        uint256 requiredQuorum;
        if (isGlobalRequest) {
            uint256 totalPrimaryHeads = roleBasedAccessControl.getGlobalResourceTable().length;

            if (totalPrimaryHeads != 0) {
                if (role == RoleToken.Role.PRIMARY_GROUP_HEAD) {
                    // we need to decrease amount of totalPrimaryHeads by one because its own is counted too.
                    // Calculate the quorum without decimals, multiplying by 100 to maintain precision
                    uint256 numerator = (totalPrimaryHeads - 1) * quorumPercentage;
                    requiredQuorum = numerator / 100;

                    // If there's a remainder, round up the result
                    if (numerator % 100 > 0) {
                        requiredQuorum += 1;
                    }
                } else {
                    requiredQuorum = (totalPrimaryHeads * quorumPercentage) / 100;
                }
            } else {
                requiredQuorum = 0;
            }

        } else {
            // Local request quorum is just the requester's primary head
            requiredQuorum = 1;
        }

        // Add to access request list
        uint requestId = accessRequests.length;
        accessRequests.push(AccessRequest({
            id: requestId,
            resource: resource,
            action: action,
            approvals: isLocalRequestByPrimaryHead ? 1 : 0, // Automatically approve if it's a local request by primary head
            requester: msg.sender,
            isGlobalRequest: isGlobalRequest,
            isApproved: isLocalRequestByPrimaryHead, // Automatically approve if it's a local request by primary head
            requiredQuorum: requiredQuorum
        }));

        (uint256 rewardAmount, string memory newStatus) = judgeContract.reportNonPenalizeMisbehavior(msg.sender);
        emit NonPenalizeMisbehaviorReported(msg.sender, rewardAmount, newStatus); // Emit event for benign behavior
        emit AccessRequestCreated(requestId, msg.sender, resource, address(this));
    }

    // Function to handle access requests
    function handleAccessRequest(
        uint requestId,
        bool approve
    ) external onlyPrimaryHead notBlocked {
        require(requestId < accessRequests.length, "Invalid request ID");
        AccessRequest storage request = accessRequests[requestId];
        
        // Ensure that the primary group head’s address is different from the requester’s address
        require(msg.sender != request.requester, "Primary group head cannot approve their own request");

        // Check if the requester is a regular member and if the primary head handling the request is the requester's primary head
        if (!request.isGlobalRequest && roleBasedAccessControl.getRole(request.requester) == RoleToken.Role.REGULAR_MEMBER) {
            address requesterPrimaryHead = roleBasedAccessControl.getPrimaryHeadAddress(request.requester);
            require(requesterPrimaryHead == msg.sender, "Primary head handling the request must be the requester's primary head");
        }

        if (approve && !approvals[requestId][msg.sender]) {
            request.approvals++;
            approvals[requestId][msg.sender] = true;

            if (request.approvals >= request.requiredQuorum) {
                // Approve the request if quorum is met
                request.isApproved = true;
                emit AccessGranted(request.requester, "Access Request", "Handle");
            }
        }
    }

    // Function to check if a policy allows the requested resource and action
    function checkPolicy(string memory resource, string memory action, RoleToken.Role role) internal view returns (bool) {
        for (uint i = 0; i < policies.length; i++) {
            if (
                policies[i].role == role &&
                keccak256(bytes(policies[i].resource)) == keccak256(bytes(resource)) &&
                keccak256(bytes(policies[i].action)) == keccak256(bytes(action))
            ) {
                return keccak256(bytes(policies[i].permission)) == keccak256(bytes("allow"));
            }
        }
        return false;
    }

    // Additional functions for global and local resource tables
    function viewGlobalResourceTable() external notBlocked onlyAuthorizedRequesters("GlobalResourceTable", "view") {
        // Retrieve the global resource table
        RoleToken.Member[] memory globalResourceTable = roleBasedAccessControl.getGlobalResourceTable();

        emit AccessGranted(msg.sender, "GlobalResourceTable", "View");
        // Emit the event with the retrieved resource table
        emit GlobalResourceTableViewed(msg.sender, globalResourceTable);
    }

    function editGlobalResourceTable(address account1, address account2) 
        external notBlocked onlyAuthorizedRequesters("GlobalResourceTable", "edit") 
    {
        // Check if both accounts are Primary Group Heads (PGHs) for global resource table operations
        if (roleBasedAccessControl.getRole(account1) != RoleToken.Role.PRIMARY_GROUP_HEAD &&
            roleBasedAccessControl.getRole(account2) != RoleToken.Role.PRIMARY_GROUP_HEAD) {
            // Report malicious activity and emit event
            (uint256 penaltyAmount, string memory reason, uint256 blockingEndTime) = judgeContract.reportMaliciousActivity(msg.sender, "Privilege escalation");
            emit MaliciousActivityReported(msg.sender, penaltyAmount, reason, blockingEndTime);
            return;
        }

        // Proceed with role swapping if both accounts are valid global members
        roleBasedAccessControl.swapRole(account1, account2);
        emit AccessGranted(msg.sender, "GlobalResourceTable", "Edit");
    }

    function deleteGlobalResourceTable(address account) external notBlocked onlyAuthorizedRequesters("GlobalResourceTable", "delete") {
        // Revoke role to effectively remove the member from the global resource table
        if (roleBasedAccessControl.getRole(account) != RoleToken.Role.PRIMARY_GROUP_HEAD) {
                (uint256 penaltyAmount, string memory reason, uint256 blockingEndTime) = judgeContract.reportMaliciousActivity(msg.sender, "Privilege escalation");
                emit MaliciousActivityReported(msg.sender, penaltyAmount, reason, blockingEndTime);
                return;
        }

        roleBasedAccessControl.revokeRole(account);
        emit AccessGranted(msg.sender, "GlobalResourceTable", "Delete");
    }

    function viewLocalResourceTable() external notBlocked onlyAuthorizedRequesters("LocalResourceTable", "view") {
        RoleToken.Member memory member = roleBasedAccessControl.getMember(msg.sender);
        // Retrieve the global resource table
        RoleToken.Member[] memory localResourceTable = roleBasedAccessControl.getLocalResourceTable(member.memberType);

        emit AccessGranted(msg.sender, "GlobalResourceTable", "View");
        // Emit the event with the retrieved resource table
        emit LocalResourceTableViewed(msg.sender, localResourceTable);
    }

    function editLocalResourceTable(address account1, address account2) external notBlocked onlyAuthorizedRequesters("LocalResourceTable", "edit") {
        // Update the local resource table by editing a specific role
        // Check if both accounts are Primary Group Heads (PGHs) for global resource table operations
        if ((roleBasedAccessControl.getRole(account1) != RoleToken.Role.SECONDARY_GROUP_HEAD && roleBasedAccessControl.getRole(account1) != RoleToken.Role.REGULAR_MEMBER) ||
            (roleBasedAccessControl.getRole(account2) != RoleToken.Role.SECONDARY_GROUP_HEAD && roleBasedAccessControl.getRole(account2) != RoleToken.Role.REGULAR_MEMBER)) {
                (uint256 penaltyAmount, string memory reason, uint256 blockingEndTime) = judgeContract.reportMaliciousActivity(msg.sender, "Privilege escalation");
                emit MaliciousActivityReported(msg.sender, penaltyAmount, reason, blockingEndTime);
                return;
        }

        roleBasedAccessControl.swapRole(account1, account2);
        emit AccessGranted(msg.sender, "LocalResourceTable", "Edit");
    }

    function deleteLocalResourceTable(address account) external notBlocked onlyAuthorizedRequesters("LocalResourceTable", "delete") {
        // Revoke role to effectively remove the member from the local resource table
        if (roleBasedAccessControl.getRole(account) != RoleToken.Role.SECONDARY_GROUP_HEAD || roleBasedAccessControl.getRole(account) != RoleToken.Role.REGULAR_MEMBER) {
            (uint256 penaltyAmount, string memory reason, uint256 blockingEndTime) = judgeContract.reportMaliciousActivity(msg.sender, "Privilege escalation");
            emit MaliciousActivityReported(msg.sender, penaltyAmount, reason, blockingEndTime);
            return;
        }
        
        roleBasedAccessControl.revokeRole(account);
        emit AccessGranted(msg.sender, "LocalResourceTable", "Delete");
    }
}
