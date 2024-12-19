// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./RoleBasedAccessControl.sol";
import "./JudgeContract.sol";

contract AccessControlContract {
    struct Policy {
        RoleToken.Role role;
        string resource;
        string action;
        string permission;
        uint256 timeOfLastRequest;
    }

    event PolicyAdded(
        uint256 indexed policyId,
        RoleToken.Role role,
        string resource,
        string action,
        string permission
    );
    event PolicyUpdated(
        uint256 indexed policyId,
        RoleToken.Role role,
        string resource,
        string action,
        string permission
    );
    event PolicyDeleted(uint256 indexed policyId);
    event AccessControlChecked(
        address indexed subject,
        RoleToken.Role role,
        string resource,
        string action,
        bool allowed
    );
    event DataTransferred(
        address indexed from,
        address indexed to,
        string data
    );
        
    event ContractActivated();
    event ContractDeactivated();
    event JudgeContractSet(address judgeContract);
    event RoleBasedContractSet(address roleBasedContract);
    event PolicyNotFoundForAccessControl(string resource, string action);
    event FunctionCalled(string functionName);
    event MaliciousActivityReported(address indexed subject, uint256 penaltyAmount, string reason, uint256 blockingEndTime); // New event for malicious activity
    event NonPenalizeMisbehaviorReported(address indexed subject, uint256 rewardAmount, string newStatus); // New event for benign behavior


    Policy[] public policies;
    JudgeContract public judgeContract;
    RoleBasedAccessControl public roleBasedContract;
    uint256 public threshold = 1 minutes; // Example threshold for too frequent access

    /*
    isActive Flag: Added a boolean flag isActive to indicate whether the contract is active or not. Initialized it to true in the constructor.
    onlyWhenActive Modifier: Created a modifier onlyWhenActive to check if the contract is active. This modifier is used in all external functions to prevent any interaction when the contract is deactivated.
    deactivateContract Function: Added a function deactivateContract that allows the owner to deactivate the contract by setting isActive to false. This effectively stops all contract operations without deleting the contract from the blockchain.
    
    why we didn't use selfdestruct:
        there is no contract code, and possibly users believe there is a contract there.
        Any funds sent to such an address will be unrecoverable which is the same as destroyed.
    */
    bool public isActive = true; // Flag to indicate if the contract is active

    address public subjectAddress;
    address public objectAddress;
    string public accType;
    address public creator; // Address of the creator (msg.sender from factory)

    constructor(
        address _subjectAddress,
        address _objectAddress,
        string memory _accType,
        address _roleBasedContract,
        address _creator
    ) {
        roleBasedContract = RoleBasedAccessControl(_roleBasedContract);
        subjectAddress = _subjectAddress;
        objectAddress = _objectAddress;
        accType = _accType;
        creator = _creator;
    }

    // Modifier to restrict access based on creator address with specific penalty
    modifier onlyCreator(string memory penaltyType) {
        if (msg.sender != creator) {
            (uint256 penaltyAmount, string memory reason, uint256 blockingEndTime) = judgeContract.reportMaliciousActivity(msg.sender, penaltyType);
            emit MaliciousActivityReported(msg.sender, penaltyAmount, reason, blockingEndTime); // Emit event for malicious activity
            return;
        }
        _;
    }

    modifier onlyWhenActive() {
        require(isActive, "Contract is not active");
        _;
    }

    modifier onlyPrimaryHead() {
        roleBasedContract.requireRole(msg.sender, RoleToken.Role.PRIMARY_GROUP_HEAD);
        _;
    }

    modifier onlyWhenSubjectMatches() {
        require(
            subjectAddress == msg.sender,
            "Caller is not subject"
        );
        _;
    }

    modifier notBlocked() {
        uint256 blockingEndTime = judgeContract.getBlockingEndTime(msg.sender);
        require(block.timestamp > blockingEndTime, "AccessControlContract: Member is blocked");
        _;
    }

    function setJudgeContract(address _judgeContract) external {
        judgeContract = JudgeContract(_judgeContract);
        emit JudgeContractSet(_judgeContract);
    }

    function policyAdd(
        RoleToken.Role role,
        string memory resource,
        string memory action,
        string memory permission
    ) external onlyWhenActive notBlocked onlyCreator("Unauthorized access attempt") {
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
    ) external onlyWhenActive notBlocked onlyCreator("Unauthorized access attempt") {
        require(policyId < policies.length, "Policy does not exist");
        policies[policyId] = Policy(role, resource, action, permission, 0);
        emit PolicyUpdated(policyId, role, resource, action, permission);
    }

    function policyDelete(uint256 policyId) external onlyWhenActive notBlocked onlyCreator("Unauthorized access attempt") {
        require(policyId < policies.length, "Policy does not exist");
        delete policies[policyId];
        emit PolicyDeleted(policyId);
    }

    uint256 public benignThreshold = 1 days;  // Example threshold duration for benign status reward

    function getTime() external view returns (uint256, bool) {
        //JudgeContract.MisbehaviorRecord memory record = judgeContract.getMisbehaviorRecord(msg.sender);
        uint256 blockingEndTime = judgeContract.getBlockingEndTime(msg.sender);
        bool isBlocked = false;

        if (block.timestamp < blockingEndTime) {
            isBlocked = true;
        }

        return (blockingEndTime, isBlocked);
    }

    function accessControl(string memory resource, string memory action)
        external onlyWhenActive notBlocked onlyWhenSubjectMatches returns (bool)
    {
        RoleToken.Role role = roleBasedContract.getRole(msg.sender);
        
        for (uint256 i = 0; i < policies.length; i++) {
            if (
                policies[i].role == role &&
                keccak256(bytes(policies[i].resource)) ==
                keccak256(bytes(resource)) &&
                keccak256(bytes(policies[i].action)) == keccak256(bytes(action))
            ) {
                if (
                    block.timestamp < policies[i].timeOfLastRequest + threshold
                ) {
                    (uint256 penaltyAmount, string memory reason, uint256 blockingEndTime) = judgeContract.reportMaliciousActivity(msg.sender, "Too frequent access");
                    emit MaliciousActivityReported(subjectAddress, penaltyAmount, reason, blockingEndTime); // Emit event for too frequent access
                    return false;
                }

                policies[i].timeOfLastRequest = block.timestamp;
                emit AccessControlChecked(
                    subjectAddress,
                    role,
                    resource,
                    action,
                    keccak256(bytes(policies[i].permission)) ==
                        keccak256(bytes("allow"))
                );

                bool isAllowed = keccak256(bytes(policies[i].permission)) == keccak256(bytes("allow"));

                if (isAllowed) {
                    (uint256 rewardAmount, string memory newStatus) = judgeContract.reportNonPenalizeMisbehavior(msg.sender);
                    emit NonPenalizeMisbehaviorReported(msg.sender, rewardAmount, newStatus); // Emit event for benign behavior
                } else {
                    if (keccak256(bytes(action)) == keccak256(bytes("edit")) || keccak256(bytes(action)) == keccak256(bytes("delete"))) {
                        (uint256 penaltyAmount, string memory reason, uint256 blockingEndTime) = judgeContract.reportMaliciousActivity(msg.sender, "Tampering with data");
                        emit MaliciousActivityReported(msg.sender, penaltyAmount, reason, blockingEndTime); // Emit event for tampering with data
                    } else if (keccak256(bytes(action)) == keccak256(bytes("view"))) {
                        (uint256 penaltyAmount, string memory reason, uint256 blockingEndTime) = judgeContract.reportMaliciousActivity(msg.sender, "Unauthorized access attempt");
                        emit MaliciousActivityReported(msg.sender, penaltyAmount, reason, blockingEndTime); // Emit event for unauthorized access
                    }
                }

                return isAllowed;
            }
        }

        if (keccak256(bytes(action)) == keccak256(bytes("edit")) || keccak256(bytes(action)) == keccak256(bytes("delete"))) {
            (uint256 penaltyAmount, string memory reason, uint256 blockingEndTime) = judgeContract.reportMaliciousActivity(msg.sender, "Tampering with data");
            emit MaliciousActivityReported(msg.sender, penaltyAmount, reason, blockingEndTime); // Emit event for tampering with data
        } else if (keccak256(bytes(action)) == keccak256(bytes("view"))) {
            (uint256 penaltyAmount, string memory reason, uint256 blockingEndTime) = judgeContract.reportMaliciousActivity(msg.sender, "Unauthorized access attempt");
            emit MaliciousActivityReported(msg.sender, penaltyAmount, reason, blockingEndTime); // Emit event for unauthorized access
        }

        emit PolicyNotFoundForAccessControl(resource, action);
        return false;
    }

    function activateContract() external notBlocked onlyCreator("Denial of Service") {
        isActive = true;
        emit ContractActivated(); 
    }

    function deactivateContract() external notBlocked onlyCreator("Denial of Service") {
        isActive = false;
        emit ContractDeactivated(); 
    }
}
