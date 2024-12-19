const RoleToken = artifacts.require("RoleToken");
const RoleBasedAccessControl = artifacts.require("RoleBasedAccessControl");
const RegisterContract = artifacts.require("RegisterContract");
const JudgeContract = artifacts.require("JudgeContract");
const TableAccessControlContract = artifacts.require(
  "TableAccessControlContract"
);

const { assert } = require("chai");

contract("TableAccessControlContract", (accounts) => {
  const [
    admin,
    primaryHead1,
    primaryHead2,
    primaryHead3,
    primaryHead4,
    primaryHead5,
    regularMember1,
    regularMember2,
    regularMember3,
    regularMember4,
    regularMember5,
    regularMember6,
    regularMember7,
    regularMember8,
    regularMember9,
    regularMember10,
  ] = accounts;

  let roleToken,
    roleBasedAccessControl,
    registerContract,
    judgeContract,
    tableAccessControlContract;

  beforeEach(async () => {
    // Deploy RoleToken
    roleToken = await RoleToken.new(admin);
    console.log("RoleToken deployed at:", roleToken.address);
    await roleToken.assignRole(roleToken.address, 1, "admin_roletoken");

    // Deploy RoleBasedAccessControl
    roleBasedAccessControl = await RoleBasedAccessControl.new(
      roleToken.address,
      admin
    );
    console.log(
      "RoleBasedAccessControl deployed at:",
      roleBasedAccessControl.address
    );
    await roleToken.assignRole(
      roleBasedAccessControl.address,
      1,
      "admin_rolebasedaccesscontrol"
    );

    // Deploy RegisterContract
    registerContract = await RegisterContract.new(
      admin,
      roleBasedAccessControl.address
    );
    console.log("RegisterContract deployed at:", registerContract.address);
    await roleBasedAccessControl.assignRole(
      registerContract.address,
      1,
      "admin_registercontract"
    );

    // Deploy JudgeContract
    judgeContract = await JudgeContract.new(
      admin,
      roleBasedAccessControl.address
    );
    console.log("JudgeContract deployed at:", judgeContract.address);
    await roleBasedAccessControl.assignRole(
      judgeContract.address,
      1,
      "admin_judgecontract"
    );

    // Deploy TableAccessControlContract
    tableAccessControlContract = await TableAccessControlContract.new(
      roleBasedAccessControl.address,
      judgeContract.address,
      registerContract.address,
      admin
    );
    console.log(
      "TableAccessControlContract deployed at:",
      tableAccessControlContract.address
    );
    await roleBasedAccessControl.assignRole(
      tableAccessControlContract.address,
      1,
      "admin_tableaccesscontrolcontract"
    );

    // Assign roles to accounts
    // Primary Heads
    await roleToken.assignRole(primaryHead1, 2, "primary_head_1");
    await roleToken.assignRole(primaryHead2, 2, "primary_head_2");
    await roleToken.assignRole(primaryHead3, 2, "primary_head_3");
    await roleToken.assignRole(primaryHead4, 2, "primary_head_4");
    await roleToken.assignRole(primaryHead5, 2, "primary_head_5");

    // Regular Members
    await roleToken.assignRole(regularMember1, 3, "regular_member_1");
    await roleToken.assignRole(regularMember2, 3, "regular_member_2");
    await roleToken.assignRole(regularMember3, 3, "regular_member_3");
    await roleToken.assignRole(regularMember4, 3, "regular_member_4");
    await roleToken.assignRole(regularMember5, 3, "regular_member_5");
    await roleToken.assignRole(regularMember6, 3, "regular_member_6");
    await roleToken.assignRole(regularMember7, 3, "regular_member_7");
    await roleToken.assignRole(regularMember8, 3, "regular_member_8");
    await roleToken.assignRole(regularMember9, 3, "regular_member_9");
    await roleToken.assignRole(regularMember10, 3, "regular_member_10");

    // Add policies to allow actions
    await tableAccessControlContract.policyAdd(
      2,
      "GlobalResourceTable",
      "view",
      "allow"
    );
    await tableAccessControlContract.policyAdd(
      2,
      "GlobalResourceTable",
      "edit",
      "disallow"
    );
    await tableAccessControlContract.policyAdd(
      2,
      "GlobalResourceTable",
      "delete",
      "disallow"
    );
    await tableAccessControlContract.policyAdd(
      2,
      "LocalResourceTable",
      "view",
      "allow"
    );
    await tableAccessControlContract.policyAdd(
      2,
      "LocalResourceTable",
      "edit",
      "disallow"
    );
    await tableAccessControlContract.policyAdd(
      2,
      "LocalResourceTable",
      "delete",
      "disallow"
    );
    await tableAccessControlContract.policyAdd(
      3,
      "GlobalResourceTable",
      "edit",
      "disallow"
    );
    await tableAccessControlContract.policyAdd(
      3,
      "GlobalResourceTable",
      "view",
      "disallow"
    );
    await tableAccessControlContract.policyAdd(
      3,
      "GlobalResourceTable",
      "delete",
      "disallow"
    );
    await tableAccessControlContract.policyAdd(
      3,
      "LocalResourceTable",
      "edit",
      "disallow"
    );
    await tableAccessControlContract.policyAdd(
      3,
      "LocalResourceTable",
      "delete",
      "disallow"
    );
    await tableAccessControlContract.policyAdd(
      3,
      "LocalResourceTable",
      "view",
      "allow"
    );
  });

  it("should allow a regular member to create an access request for allowed actions", async () => {
    const resource = "LocalResourceTable";
    const action = "view";

    // Create access request
    const receipt = await tableAccessControlContract.createAccessRequest(
      "regular_member_1",
      resource,
      action,
      { from: regularMember1 }
    );

    const request = await tableAccessControlContract.accessRequests(0);
    assert.equal(request.requester, regularMember1);
    assert.equal(request.resource, resource);
    assert.equal(request.action, action);
    assert.isFalse(request.isApproved); // Approval not handled in this test

    // Check for event emission
    assert.exists(
      receipt.logs.find((log) => log.event === "AccessRequestCreated"),
      "AccessRequestCreated event was not emitted"
    );
  });

  it("should not allow a regular member to create an access request for disallowed actions and emit AccessDenied event", async () => {
    const resource = "GlobalResourceTable";
    const action = "view";

    const receipt = await tableAccessControlContract.createAccessRequest(
      "regular_member_1",
      resource,
      action,
      { from: regularMember1 }
    );

    // Check the AccessDenied event
    const accessDeniedEvent = receipt.logs.find(
      (log) => log.event === "AccessDenied"
    );
    assert.exists(accessDeniedEvent, "AccessDenied event was not emitted");
    assert.include(
      accessDeniedEvent.args.reason,
      "Policy violation: Unauthorized access",
      "AccessDenied event reason mismatch"
    );
  });

  it("should not allow an unregistered user to create an access request", async () => {
    const resource = "GlobalResourceTable";
    const action = "view";
    try {
      await tableAccessControlContract.createAccessRequest(
        "unregistered_member",
        resource,
        action,
        { from: accounts[9] } // Assuming accounts[9] is unregistered
      );
      assert.fail("Expected error not received");
    } catch (error) {
      console.log(`Error message: ${error.message}`);
      assert.include(
        error.message,
        "Member address not found in any resource table"
      );
    }
  });

  it("should not allow a primary head to create an access request to given policies and emit AccessDenied event", async () => {
    const resource = "GlobalResourceTable";
    const action = "edit";

    const receipt = await tableAccessControlContract.createAccessRequest(
      "primary_head_1",
      resource,
      action,
      { from: primaryHead1 }
    );

    // Check the AccessDenied event
    const accessDeniedEvent = receipt.logs.find(
      (log) => log.event === "AccessDenied"
    );
    assert.exists(accessDeniedEvent, "AccessDenied event was not emitted");
    assert.include(
      accessDeniedEvent.args.reason,
      "Policy violation: Unauthorized access",
      "AccessDenied event reason mismatch"
    );
  });

  it("should not allow a regular member to access an undefined resource and emit AccessDenied event", async () => {
    const resource = "UnlistedResource";
    const action = "view";

    const receipt = await tableAccessControlContract.createAccessRequest(
      "regular_member_1",
      resource,
      action,
      { from: regularMember1 }
    );

    // Check the AccessDenied event
    const accessDeniedEvent = receipt.logs.find(
      (log) => log.event === "AccessDenied"
    );
    assert.exists(accessDeniedEvent, "AccessDenied event was not emitted");
    assert.include(
      accessDeniedEvent.args.reason,
      "Policy violation: Unauthorized access",
      "AccessDenied event reason mismatch"
    );
  });

  it("should report misbehavior on unauthorized access attempt and emit MisbehaviorReported event", async () => {
    const resource = "LocalResourceTable";
    const action = "view";

    // Attempt unauthorized access
    const receipt = await tableAccessControlContract.createAccessRequest(
      "primary_head_1", // Assuming regular_member_1 does not have access
      resource,
      action,
      { from: primaryHead1 }
    );

    // Check the MisbehaviorReported event
    const misbehaviorReportedEvent = receipt.logs.find(
      (log) => log.event === "MisbehaviorReported"
    );
    assert.exists(
      misbehaviorReportedEvent,
      "MisbehaviorReported event was not emitted"
    );

    // Verify the details of the MisbehaviorReported event
    assert.equal(
      misbehaviorReportedEvent.args.subject,
      primaryHead1,
      "The subject in the MisbehaviorReported event should match"
    );
    assert.equal(
      misbehaviorReportedEvent.args.misbehavior,
      "Unauthorized access attempt",
      "The misbehavior reason should be 'Unauthorized access attempt'"
    );

    // Check and log the penalty
    const penalty = misbehaviorReportedEvent.args.penalty;
    console.log("Misbehavior reported. Penalty:", penalty);
  });

  it("should handle access request approvals and denials correctly", async () => {
    const resource = "LocalResourceTable";
    const action = "view";

    // Create an access request
    await tableAccessControlContract.createAccessRequest(
      "regular_member_1",
      resource,
      action,
      { from: regularMember1 }
    );

    // Handle the access request by a primary head
    await tableAccessControlContract.handleAccessRequest(0, true, {
      from: primaryHead1,
    });

    // Fetch the updated access request
    const request = await tableAccessControlContract.accessRequests(0);
    assert.isTrue(request.isApproved, "Request should be approved");

    // Ensure that the accessGranted event was emitted
    const events = await tableAccessControlContract.getPastEvents(
      "AccessGranted"
    );
    assert.equal(events.length, 1, "AccessGranted event was not emitted");
    assert.equal(
      events[0].returnValues.requester,
      regularMember1,
      "Requester address mismatch"
    );
  });

  it("should allow primary heads to view GlobalResourceTable after request approval by required quorum", async () => {
    const resource = "GlobalResourceTable";
    const action = "view";

    // Step 1: Create an access request
    const createReceipt = await tableAccessControlContract.createAccessRequest(
      "primary_head_1",
      resource,
      action,
      { from: primaryHead1 }
    );

    // Verify the access request creation
    const request = await tableAccessControlContract.accessRequests(0);
    assert.equal(request.requester, primaryHead1);
    assert.equal(request.resource, resource);
    assert.equal(request.action, action);
    assert.isFalse(request.isApproved);

    assert.exists(
      createReceipt.logs.find((log) => log.event === "AccessRequestCreated"),
      "AccessRequestCreated event was not emitted"
    );

    // Step 2: Approve the access request by multiple primary heads to meet quorum
    // Assuming the quorum is 3 out of 5 primary heads
    await tableAccessControlContract.handleAccessRequest(0, true, {
      from: primaryHead2,
    });
    await tableAccessControlContract.handleAccessRequest(0, true, {
      from: primaryHead3,
    });
    await tableAccessControlContract.handleAccessRequest(0, true, {
      from: primaryHead4,
    });

    // Fetch the updated request
    const updatedRequest = await tableAccessControlContract.accessRequests(0);
    assert.isTrue(updatedRequest.isApproved, "The request should be approved");

    // Step 3: View the GlobalResourceTable after approval
    const globalResourceTable =
      await tableAccessControlContract.viewGlobalResourceTable({
        from: primaryHead1,
      });

    console.log("GlobalResourceTable:", globalResourceTable);

    // Verify that the GlobalResourceTable was returned
    assert.isArray(
      globalResourceTable,
      "GlobalResourceTable should be an array"
    );
    assert.isNotEmpty(
      globalResourceTable,
      "GlobalResourceTable should not be empty"
    );
  });

  it("should revert if a non-primary head tries to approve an access request", async () => {
    const resource = "LocalResourceTable";
    const action = "view";

    // Create an access request
    await tableAccessControlContract.createAccessRequest(
      "regular_member_1",
      resource,
      action,
      { from: regularMember1 }
    );

    // Attempt to approve the access request by a regular member
    try {
      await tableAccessControlContract.handleAccessRequest(0, true, {
        from: regularMember1,
      });
      assert.fail("Expected error not received");
    } catch (error) {
      assert.include(
        error.message,
        "Access denied: incorrect role",
        "Expected error message not received"
      );
    }
  });

  it("should not allow a regular member to view the global resource table", async () => {
    // Simulate access request for the regular member to view the global resource table
    await tableAccessControlContract.createAccessRequest(
      "regular_member_1",
      "LocalResourceTable", // Resource should match exactly
      "view", // Action should match exactly
      { from: regularMember1 }
    );

    // Fetch the first access request to ensure it was created correctly
    const accessRequests = await tableAccessControlContract.accessRequests(0);
    assert(
      accessRequests.requester === regularMember1,
      "Access request not created by regularMember1"
    );
    assert(
      accessRequests.resource === "LocalResourceTable",
      "Access request resource does not match"
    );
    assert(
      accessRequests.action === "view",
      "Access request action does not match"
    );

    try {
      await tableAccessControlContract.viewGlobalResourceTable({
        from: regularMember1,
      });
      assert(
        false,
        "Regular member should not be able to view the GlobalResourceTable"
      );
    } catch (error) {
      assert(
        error.message.includes("Not authorized to access this resource"),
        "Expected unauthorized access error"
      );
    }
  });

  it("should not allow a regular member to view GlobalResourceTable after being approved to view LocalResourceTable", async () => {
    const localResource = "LocalResourceTable";
    const globalResource = "GlobalResourceTable";
    const action = "view";

    // Step 2: Create an access request for the regular member to view the LocalResourceTable
    const createLocalReceipt =
      await tableAccessControlContract.createAccessRequest(
        "regular_member_1",
        localResource,
        action,
        { from: regularMember1 }
      );

    // Verify the local resource access request creation
    const localRequest = await tableAccessControlContract.accessRequests(0);
    assert.equal(
      localRequest.requester,
      regularMember1,
      "Requester address should match"
    );
    assert.equal(
      localRequest.resource,
      localResource,
      "Local resource should match"
    );
    assert.equal(localRequest.action, action, "Action should match");
    assert.isFalse(
      localRequest.isApproved,
      "The local request should not be approved initially"
    );

    assert.exists(
      createLocalReceipt.logs.find(
        (log) => log.event === "AccessRequestCreated"
      ),
      "AccessRequestCreated event for local resource was not emitted"
    );

    // Step 3: Approve the local resource access request by the required quorum of primary heads
    await tableAccessControlContract.handleAccessRequest(0, true, {
      from: primaryHead1,
    });

    // Verify that the local resource access request was approved
    const updatedLocalRequest = await tableAccessControlContract.accessRequests(
      0
    );
    assert.isTrue(
      updatedLocalRequest.isApproved,
      "The local resource request should be approved"
    );

    // Step 4: View the LocalResourceTable after approval
    const localResourceTable =
      await tableAccessControlContract.viewLocalResourceTable({
        from: regularMember1,
      });

    console.log("LocalResourceTable:", localResourceTable);

    // Verify that the LocalResourceTable was returned
    assert.isArray(localResourceTable, "LocalResourceTable should be an array");
    assert.isNotEmpty(
      localResourceTable,
      "LocalResourceTable should not be empty"
    );

    // Step 5: Attempt to view the GlobalResourceTable without an approved request
    try {
      await tableAccessControlContract.viewGlobalResourceTable({
        from: regularMember1,
      });
      assert(
        false,
        "Regular member should not be able to view the GlobalResourceTable"
      );
    } catch (error) {
      assert(
        error.message.includes("Not authorized to access this resource"),
        "Expected unauthorized access error"
      );
    }
  });
});
