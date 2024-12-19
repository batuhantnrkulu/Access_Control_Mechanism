// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./AccessControlContract.sol";
import "./RoleToken.sol";
import "./RegisterContract.sol";

contract AccessControlFactory is Ownable {

    RoleBasedAccessControl public roleBasedAccessControl;
    RegisterContract public registerContract;
    JudgeContract public judgeContract;

    event ACCDeployed(address accAddress, address owner);

    constructor(address initialAdmin, address _roleBasedAccessControl, address _registerContract, address _judgeContract) Ownable(initialAdmin) {
        roleBasedAccessControl = RoleBasedAccessControl(_roleBasedAccessControl);
        registerContract = RegisterContract(_registerContract);
        judgeContract = JudgeContract(_judgeContract);
    }

    function deployAccessControlContract(
        address objectAddress, 
        address subjectAddress, 
        string memory accType
    ) 
        external 
        returns (address) 
    {
        // Check if subject and object are in the same group
        require(roleBasedAccessControl.areSameOrGlobalMembers(subjectAddress, objectAddress), "Subject and Object must be in the same group or in global resource table");

        // Check if an AccessControlContract already exists for the given combination
        require(
            !registerContract.accessControlContractExists(objectAddress, subjectAddress, accType),
            "Error: AccessControlContract already exists for this combination"
        );

        // Deploy the AccessControlContract
        AccessControlContract acc = new AccessControlContract(subjectAddress, objectAddress, accType, address(roleBasedAccessControl), msg.sender);
        acc.setJudgeContract(address(judgeContract));

        // Update the RegisterContract with the deployed contract's address
        registerContract.registerAccessControlContract(objectAddress, subjectAddress, accType, address(acc));

        emit ACCDeployed(address(acc), msg.sender);
        
        return address(acc);
    }
}
