// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./RoleBasedAccessControl.sol";

contract RegisterContract is Ownable {
    RoleBasedAccessControl public roleBasedAccessContract;  // Role-based access control contract

    // Mapping for storing contract addresses based on object, subject, and acc type
    mapping(address => mapping(address => mapping(string => address))) public accessControlRegistry;

    address public judgeContractAddress;  // Address of the JudgeContract

    event AccessControlRegistered(
        address indexed objectAddress,
        address indexed subjectAddress,
        string accType,
        address contractAddress
    );

    constructor(address initialAdmin, address _roleBasedAccessContract) Ownable(initialAdmin) {
        roleBasedAccessContract = RoleBasedAccessControl(_roleBasedAccessContract);
    }

    // Modifier to allow only admin or the object owner to register
    modifier onlyAdmin() {
        require(
            roleBasedAccessContract.getRole(msg.sender) == RoleToken.Role.ADMIN,
            "Access denied: Not an Admin"
        );
        _;
    }

    // Function to set the JudgeContract address
    function setJudgeContractAddress(address _judgeContractAddress) external onlyOwner {
        judgeContractAddress = _judgeContractAddress;
    }

    // Function to register a new AccessControlContract
    function registerAccessControlContract(
        address objectAddress,
        address subjectAddress,
        string memory accType,
        address contractAddress
    ) 
        external 
        onlyAdmin
    {
        require(
            !accessControlContractExists(objectAddress, subjectAddress, accType),
            "Error: Access control contract already registered for this object, subject, and type."
        );

        // Store the contract address in the registry
        accessControlRegistry[objectAddress][subjectAddress][accType] = contractAddress;

        // Emit an event for the registration
        emit AccessControlRegistered(objectAddress, subjectAddress, accType, contractAddress);
    }

    // Function to get the registered AccessControlContract address
    function getAccessControlContract(
        address objectAddress,
        address subjectAddress,
        string memory accType
    ) 
        external 
        view 
        returns (address) 
    {
        return accessControlRegistry[objectAddress][subjectAddress][accType];
    }

    // Function to check if an AccessControlContract exists for a given combination
    function accessControlContractExists(
        address objectAddress,
        address subjectAddress,
        string memory accType
    ) 
        public 
        view 
        returns (bool) 
    {
        return accessControlRegistry[objectAddress][subjectAddress][accType] != address(0);
    }
}
