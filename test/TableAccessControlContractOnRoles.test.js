const RoleToken = artifacts.require("RoleToken");
const RoleBasedAccessControl = artifacts.require("RoleBasedAccessControl");
const RegisterContract = artifacts.require("RegisterContract");
const JudgeContract = artifacts.require("JudgeContract");
const TableAccessControlContract = artifacts.require(
  "TableAccessControlContract"
);

const { expectRevert, time } = require("@openzeppelin/test-helpers");
const { assert } = require("chai");

contract("TableAccessControlContract", (accounts) => {
  const [
    admin,
    primaryHead1,
    primaryHead2,
    primaryHead3,
    primaryHead4,
    primaryHead5,
    secondaryHead1,
    secondaryHead2,
    secondaryHead3,
    secondaryHead4,
    secondaryHead5,
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
    // Deploy contracts
    roleToken = await RoleToken.new(admin);
    await roleToken.assignAdminRole(admin, roleToken.address);

    roleBasedAccessControl = await RoleBasedAccessControl.new(
      roleToken.address,
      admin
    );
    await roleToken.assignAdminRole(admin, roleBasedAccessControl.address);

    registerContract = await RegisterContract.new(
      admin,
      roleBasedAccessControl.address
    );
    await roleToken.assignAdminRole(admin, registerContract.address);

    judgeContract = await JudgeContract.new(
      admin,
      roleBasedAccessControl.address
    );
    await roleToken.assignAdminRole(admin, judgeContract.address);

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
    await roleToken.assignAdminRole(admin, tableAccessControlContract.address);

    // Assign roles to accounts
    // Primary Heads
    await roleToken.assignRole(primaryHead1, "primary_head_1", "type1");
    await roleToken.assignRole(primaryHead2, "primary_head_2", "type2");
    await roleToken.assignRole(primaryHead3, "primary_head_3", "type3");
    await roleToken.assignRole(primaryHead4, "primary_head_4", "type4");

    let tx = await measureFunctionExecutionTime(
      roleToken.assignRole,
      primaryHead5,
      "primary_head_5",
      "type5"
    );

    console.log(
      "Gas Used for Role Assignment for primaryHead5:",
      tx.receipt.gasUsed
    );

    // Secondary Group Heads
    await roleToken.assignRole(secondaryHead1, "secondary_head_1", "type1");
    await roleToken.assignRole(secondaryHead2, "secondary_head_2", "type2");
    await roleToken.assignRole(secondaryHead3, "secondary_head_3", "type3");
    await roleToken.assignRole(secondaryHead4, "secondary_head_4", "type4");

    tx = await measureFunctionExecutionTime(
      roleToken.assignRole,
      secondaryHead5,
      "secondary_head_5",
      "type5"
    );

    console.log(
      "Gas Used for Role Assignment for secondaryHead5:",
      tx.receipt.gasUsed
    );

    // Regular Members
    await roleToken.assignRole(regularMember1, "regular_member_1", "type1");
    await roleToken.assignRole(regularMember2, "regular_member_2", "type1");
    await roleToken.assignRole(regularMember3, "regular_member_3", "type2");
    await roleToken.assignRole(regularMember4, "regular_member_4", "type2");
    await roleToken.assignRole(regularMember5, "regular_member_5", "type3");
    await roleToken.assignRole(regularMember6, "regular_member_6", "type3");
    await roleToken.assignRole(regularMember7, "regular_member_7", "type4");
    await roleToken.assignRole(regularMember8, "regular_member_8", "type4");
    await roleToken.assignRole(regularMember9, "regular_member_9", "type5");

    tx = await measureFunctionExecutionTime(
      roleToken.assignRole,
      regularMember10,
      "regular_member_10",
      "type5"
    );

    console.log(
      "Gas Used for Role Assignment for regularMember10:",
      tx.receipt.gasUsed
    );

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
    await tableAccessControlContract.policyAdd(
      4,
      "GlobalResourceTable",
      "edit",
      "disallow"
    );
    await tableAccessControlContract.policyAdd(
      4,
      "GlobalResourceTable",
      "view",
      "disallow"
    );
    await tableAccessControlContract.policyAdd(
      4,
      "GlobalResourceTable",
      "delete",
      "disallow"
    );
    await tableAccessControlContract.policyAdd(
      4,
      "LocalResourceTable",
      "edit",
      "disallow"
    );
    await tableAccessControlContract.policyAdd(
      4,
      "LocalResourceTable",
      "delete",
      "disallow"
    );
    await tableAccessControlContract.policyAdd(
      4,
      "LocalResourceTable",
      "view",
      "allow"
    );
  });

  async function logMemberStatus(member) {
    const memberProps = await roleBasedAccessControl.getMember(member);
    const roleValue = memberProps.role.toString(); // Convert Role enum to string

    console.log(`Member Address: ${member}`);
    console.log(`- Name: ${memberProps.name}`);
    console.log(`- Type: ${memberProps.memberType}`);
    console.log(`- Status: ${memberProps.status}`);
    console.log(
      `- Last Status Update: ${new Date(
        memberProps.lastStatusUpdate * 1000
      ).toLocaleString()}`
    );
    var roleName;

    if (roleValue === "2") {
      roleName = "PRIMARY_GROUP_HEAD";
    } else if (roleValue === "3") {
      roleName = "SECONDARY_GROUP_HEAD";
    } else if (roleValue === "4") {
      roleName = "REGULAR_MEMBER";
    } else roleName = "UNDEFINED";

    console.log(`- Role: ${roleName}`); // Log the Role enum value
  }

  async function logBlockingEndTime(member) {
    const result = await tableAccessControlContract.getTime({
      from: member,
    });

    const blockingEndTimeVal = result[0];
    const boolval = result[1];

    if (boolval) {
      const blockingEndTime = new Date(blockingEndTimeVal * 1000);
      console.log(
        `Blocking End Time for ${member}: ${blockingEndTime.toLocaleString()}`
      );
    }
  }

  async function measureFunctionExecutionTime(fn, ...args) {
    const start = performance.now();
    const tx = await fn(...args);
    const end = performance.now();
    const gasUsed = tx.receipt.gasUsed;

    console.log(`Gas Used: ${gasUsed}`);
    console.log(`Execution Time: ${(end - start).toFixed(2)} ms`);
    return tx;
  }

  it("should allow a regular member to create an access request for allowed actions", async () => {
    console.log(
      "TEST 1: should allow a regular member to create an access request for allowed actions"
    );
    await logMemberStatus(regularMember1);

    const resource = "LocalResourceTable";
    const action = "view";

    // Create access request
    let receipt = await measureFunctionExecutionTime(
      tableAccessControlContract.createAccessRequest,
      resource,
      action,
      { from: primaryHead1 }
    );

    console.log(
      "Gas Used for Create Access Request from primaryHead1:",
      receipt.receipt.gasUsed
    );

    // Create access request
    receipt = await measureFunctionExecutionTime(
      tableAccessControlContract.createAccessRequest,
      resource,
      action,
      { from: secondaryHead1 }
    );

    console.log(
      "Gas Used for Create Access Request from secondaryHead1:",
      receipt.receipt.gasUsed
    );

    // Create access request
    receipt = await measureFunctionExecutionTime(
      tableAccessControlContract.createAccessRequest,
      resource,
      action,
      { from: regularMember1 }
    );

    console.log(
      "Gas Used for Create Access Request from regularMember1:",
      receipt.receipt.gasUsed
    );

    const request = await tableAccessControlContract.accessRequests(2);

    // Log the request details
    console.log("Access Request Created:");
    console.log("Requester:", request.requester);
    console.log("Resource:", request.resource);
    console.log("Action:", request.action);
    console.log("Is Approved:", request.isApproved);

    assert.equal(request.requester, regularMember1);
    assert.equal(request.resource, resource);
    assert.equal(request.action, action);
    assert.isFalse(request.isApproved); // Approval not handled in this test

    // Check for event emission
    assert.exists(
      receipt.logs.find((log) => log.event === "AccessRequestCreated"),
      "AccessRequestCreated event was not emitted"
    );

    console.log("Final Status:");
    await logMemberStatus(regularMember1);
  });

  it("should not allow a regular member to create an access request for disallowed actions and emit MaliciousActivityReported event", async () => {
    console.log(
      "TEST 2: should not allow a regular member to create an access request for disallowed actions and emit MaliciousActivityReported event"
    );
    await logMemberStatus(regularMember1);

    const resource = "GlobalResourceTable";
    const action = "view";

    const receipt = await tableAccessControlContract.createAccessRequest(
      resource,
      action,
      { from: regularMember1 }
    );

    // Check the AccessDenied event
    const accessDeniedEvent = receipt.logs.find(
      (log) => log.event === "MaliciousActivityReported"
    );
    assert.exists(
      accessDeniedEvent,
      "MaliciousActivityReported event was not emitted"
    );
    assert.include(
      accessDeniedEvent.args.reason,
      "Unauthorized access attempt",
      "AccessDenied event reason mismatch"
    );

    console.log("Final Status:");
    await logMemberStatus(regularMember1);
  });

  it("should not allow an unregistered user to create an access request", async () => {
    console.log(
      "TEST 3: should not allow an unregistered user to create an access request"
    );

    const resource = "GlobalResourceTable";
    const action = "view";
    try {
      await tableAccessControlContract.createAccessRequest(
        resource,
        action,
        { from: accounts[21] } // Assuming accounts[9] is unregistered
      );
      assert.fail("Expected error not received");
    } catch (error) {
      console.log(`Error message: ${error.message}`);
    }
  });

  it("should not allow a primary head to create an access request to given policies and emit AccessDenied event", async () => {
    console.log(
      "TEST 4: should not allow a primary head to create an access request to given policies and emit AccessDenied event"
    );
    await logMemberStatus(primaryHead1);

    const resource = "GlobalResourceTable";
    const action = "edit";

    const receipt = await tableAccessControlContract.createAccessRequest(
      resource,
      action,
      { from: primaryHead1 }
    );

    // Check the AccessDenied event
    const accessDeniedEvent = receipt.logs.find(
      (log) => log.event === "MaliciousActivityReported"
    );
    assert.exists(
      accessDeniedEvent,
      "MaliciousActivityReported event was not emitted"
    );
    assert.include(
      accessDeniedEvent.args.reason,
      "Tampering with data",
      "AccessDenied event reason mismatch"
    );

    console.log("Final Status:");
    await logMemberStatus(primaryHead1);
  });

  it("should not allow a regular member to access an undefined resource and emit MaliciousActivityReported event", async () => {
    console.log(
      "TEST 5: should not allow a regular member to access an undefined resource and emit MaliciousActivityReported event"
    );
    await logMemberStatus(regularMember1);

    const resource = "UnlistedResource";
    const action = "view";

    const receipt = await tableAccessControlContract.createAccessRequest(
      resource,
      action,
      { from: regularMember1 }
    );

    // Check the AccessDenied event
    const accessDeniedEvent = receipt.logs.find(
      (log) => log.event === "MaliciousActivityReported"
    );
    assert.exists(
      accessDeniedEvent,
      "MaliciousActivityReported event was not emitted"
    );
    assert.include(
      accessDeniedEvent.args.reason,
      "Unauthorized access attempt",
      "AccessDenied event reason mismatch"
    );

    console.log("Final Status:");
    await logMemberStatus(regularMember1);
  });

  it("should allow primary head to create an access request for a global resource", async () => {
    console.log(
      "TEST 6: should allow primary head to create an access request for a global resource"
    );
    await logMemberStatus(primaryHead1);

    // Create access request
    const resource = "GlobalResourceTable";
    const action = "view";

    const tx = await tableAccessControlContract.createAccessRequest(
      resource,
      action,
      { from: primaryHead1 }
    );

    const event = tx.logs[1].args;

    assert.equal(
      event.requester,
      primaryHead1,
      "Requester should be the primary head"
    );
    assert.equal(event.resource, resource, "Resource should match");

    console.log("Final Status:");
    await logMemberStatus(primaryHead1);
  });

  it("should report misbehavior on unauthorized access attempt and emit MisbehaviorReported event", async () => {
    console.log(
      "TEST 7: should report misbehavior on unauthorized access attempt and emit MisbehaviorReported event"
    );
    await logMemberStatus(secondaryHead1);

    const resource = "LocalResourceTable";
    const action = "edit";

    // Attempt unauthorized access
    let tx = await measureFunctionExecutionTime(
      tableAccessControlContract.createAccessRequest,
      resource,
      action,
      { from: primaryHead1 }
    );

    console.log(
      "Gas Used for Create Access Request with Misbehavior from primaryHead1:",
      tx.receipt.gasUsed
    );

    // Attempt unauthorized access
    tx = await measureFunctionExecutionTime(
      tableAccessControlContract.createAccessRequest,
      resource,
      action,
      { from: regularMember1 }
    );

    console.log(
      "Gas Used for Create Access Request with Misbehavior from regularMember1:",
      tx.receipt.gasUsed
    );

    // Attempt unauthorized access
    tx = await measureFunctionExecutionTime(
      tableAccessControlContract.createAccessRequest,
      resource,
      action,
      { from: secondaryHead1 }
    );

    console.log(
      "Gas Used for Create Access Request with Misbehavior from secondaryHead1:",
      tx.receipt.gasUsed
    );

    // Check for the MisbehaviorReported event (this event is triggered by too frequent access)
    const misbehaviorReportedEvent = tx.logs.find(
      (log) => log.event === "MaliciousActivityReported"
    );

    assert.include(
      misbehaviorReportedEvent.args.reason,
      "Tampering with data",
      "misbehaviorReportedEvent event reason mismatch"
    );

    // Ensure the penalty is applied correctly
    const penaltyAmount =
      misbehaviorReportedEvent.args.penaltyAmount.toString();
    console.log(`Penalty Amount: ${penaltyAmount}`);
    assert.isAbove(
      parseInt(penaltyAmount),
      0,
      "Penalty amount should be greater than 0"
    );

    // Log final member status and blocking end time
    console.log("Final Status:");
    await logMemberStatus(secondaryHead1);
    await logBlockingEndTime(secondaryHead1); // Log blocking end time
  });

  it("should handle access request approvals and denials correctly", async () => {
    console.log(
      "TEST 8: should handle access request approvals and denials correctly"
    );
    await logMemberStatus(regularMember1);
    const resource = "LocalResourceTable";
    const action = "view";

    // Create an access request
    await tableAccessControlContract.createAccessRequest(resource, action, {
      from: regularMember1,
    });

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

    // Log final member status and blocking end time
    console.log("Final Status:");
    await logMemberStatus(regularMember1);
  });

  it("should allow primary heads to view GlobalResourceTable after request approval by required quorum", async () => {
    console.log(
      "TEST 9: should allow primary heads to view GlobalResourceTable after request approval by required quorum"
    );
    const resource = "GlobalResourceTable";
    const action = "view";

    // Step 1: Create an access request
    const createReceipt = await tableAccessControlContract.createAccessRequest(
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
    const result = await tableAccessControlContract.viewGlobalResourceTable({
      from: primaryHead1,
    });

    // Check the emitted GlobalResourceTableEmitted event
    const events = result.logs.filter(
      (log) => log.event === "GlobalResourceTableViewed"
    );

    if (events.length > 0) {
      const { viewer, resourceTable } = events[0].args;
      console.log("Viewer Address:", viewer);
      console.log("Global Resource Table:", resourceTable); // This will show the resource table in the logs

      // Verify that the GlobalResourceTable was returned
      assert.isArray(resourceTable, "GlobalResourceTable should be an array");
      assert.isNotEmpty(
        resourceTable,
        "GlobalResourceTable should not be empty"
      );
    }
  });

  it("should revert if a non-primary head tries to approve an access request", async () => {
    console.log(
      "TEST 10: should revert if a non-primary head tries to approve an access request"
    );

    const resource = "LocalResourceTable";
    const action = "view";

    // Create an access request
    await tableAccessControlContract.createAccessRequest(resource, action, {
      from: regularMember1,
    });

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
    console.log(
      "TEST 11: should not allow a regular member to view the global resource table"
    );
    await logMemberStatus(regularMember1);

    // Simulate access request for the regular member to view the global resource table
    await tableAccessControlContract.createAccessRequest(
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

    const tx = await tableAccessControlContract.viewGlobalResourceTable({
      from: regularMember1,
    });

    // Check for the MisbehaviorReported event (this event is triggered by too frequent access)
    const misbehaviorReportedEvent = tx.logs.find(
      (log) => log.event === "MaliciousActivityReported"
    );

    assert.include(
      misbehaviorReportedEvent.args.reason,
      "Unauthorized access attempt",
      "misbehaviorReportedEvent event reason mismatch"
    );

    // Ensure the penalty is applied correctly
    const penaltyAmount =
      misbehaviorReportedEvent.args.penaltyAmount.toString();
    console.log(`Penalty Amount: ${penaltyAmount}`);
    assert.isAbove(
      parseInt(penaltyAmount),
      0,
      "Penalty amount should be greater than 0"
    );

    // Log final member status and blocking end time
    console.log("Final Status:");
    await logMemberStatus(regularMember1);
    await logBlockingEndTime(regularMember1); // Log blocking end time
  });

  it("should not allow a regular member to view GlobalResourceTable after being approved to view LocalResourceTable", async () => {
    console.log(
      "TEST 12: should not allow a regular member to view GlobalResourceTable after being approved to view LocalResourceTable"
    );
    await logMemberStatus(secondaryHead1);

    const localResource = "LocalResourceTable";
    const action = "view";

    // Step 2: Create an access request for the regular member to view the LocalResourceTable
    let createLocalReceipt =
      await tableAccessControlContract.createAccessRequest(
        localResource,
        action,
        { from: regularMember1 }
      );

    createLocalReceipt = await tableAccessControlContract.createAccessRequest(
      localResource,
      action,
      { from: primaryHead1 }
    );

    createLocalReceipt = await tableAccessControlContract.createAccessRequest(
      localResource,
      action,
      { from: secondaryHead1 }
    );

    // Verify the local resource access request creation
    const localRequest = await tableAccessControlContract.accessRequests(2);
    assert.equal(
      localRequest.requester,
      secondaryHead1,
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

    await tableAccessControlContract.handleAccessRequest(2, true, {
      from: primaryHead1,
    });

    // Verify that the local resource access request was approved
    const updatedLocalRequest = await tableAccessControlContract.accessRequests(
      2
    );
    assert.isTrue(
      updatedLocalRequest.isApproved,
      "The local resource request should be approved"
    );

    // Log balance before reward
    let balanceBefore = await roleToken.balanceOf(secondaryHead1);
    console.log(`Balance before reward: ${balanceBefore.toString()}`);

    // Simulate time passing for benign behavior
    //await time.increase(time.duration.days(2));
    await time.increase(time.duration.days(2));
    await time.advanceBlock(); // Ensure the block timestamp is updated

    // Step 4: View the LocalResourceTable after approval
    let result = await measureFunctionExecutionTime(
      tableAccessControlContract.viewLocalResourceTable,
      {
        from: regularMember1,
      }
    );

    console.log(
      "Gas Used for View Local Resource Table from regularMember1:",
      result.receipt.gasUsed
    );

    // Step 4: View the LocalResourceTable after approval
    result = await measureFunctionExecutionTime(
      tableAccessControlContract.viewLocalResourceTable,
      {
        from: primaryHead1,
      }
    );

    console.log(
      "Gas Used for View Local Resource Table from primaryHead1:",
      result.receipt.gasUsed
    );

    // Step 4: View the LocalResourceTable after approval
    result = await measureFunctionExecutionTime(
      tableAccessControlContract.viewLocalResourceTable,
      {
        from: secondaryHead1,
      }
    );

    console.log(
      "Gas Used for View Local Resource Table from secondaryGroupHead1:",
      result.receipt.gasUsed
    );

    // Log balance after reward
    let balanceAfter = await roleToken.balanceOf(secondaryHead1);
    console.log(`Balance after reward: ${balanceAfter.toString()}`);
    assert(
      balanceAfter.gte(balanceBefore),
      "Balance should increase or remain the same due to reward."
    );

    // Log final member status and blocking end time
    console.log("After 2 days without malicious activity:");
    await logMemberStatus(secondaryHead1);

    // Check the emitted GlobalResourceTableEmitted event
    const events = result.logs.filter(
      (log) => log.event === "LocalResourceTableViewed"
    );

    if (events.length > 0) {
      const { viewer, resourceTable } = events[0].args;
      console.log("Viewer Address:", viewer);
      console.log("Local Resource Table:", resourceTable); // This will show the resource table in the logs

      // Verify that the GlobalResourceTable was returned
      assert.isArray(resourceTable, "LocalResourceTable should be an array");
      assert.isNotEmpty(
        resourceTable,
        "LocalResourceTable should not be empty"
      );
    }

    // Step 5: Attempt to view the GlobalResourceTable without an approved request
    result = await measureFunctionExecutionTime(
      tableAccessControlContract.viewGlobalResourceTable,
      {
        from: secondaryHead1,
      }
    );

    console.log(
      "Gas Used for View Global Resource Table:",
      result.receipt.gasUsed
    );

    // Check for the MisbehaviorReported event (this event is triggered by too frequent access)
    const misbehaviorReportedEvent = result.logs.find(
      (log) => log.event === "MaliciousActivityReported"
    );

    assert.include(
      misbehaviorReportedEvent.args.reason,
      "Unauthorized access attempt",
      "misbehaviorReportedEvent event reason mismatch"
    );

    // Ensure the penalty is applied correctly
    const penaltyAmount =
      misbehaviorReportedEvent.args.penaltyAmount.toString();
    console.log(`Penalty Amount: ${penaltyAmount}`);
    assert.isAbove(
      parseInt(penaltyAmount),
      0,
      "Penalty amount should be greater than 0"
    );

    // Log final member status and blocking end time
    console.log("Final Status:");
    await logMemberStatus(secondaryHead1);
    await logBlockingEndTime(secondaryHead1); // Log blocking end time
  });
});
