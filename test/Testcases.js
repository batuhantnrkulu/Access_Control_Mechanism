const { assert } = require("chai");
const RoleToken = artifacts.require("RoleToken");
const RoleBasedAccessControl = artifacts.require("RoleBasedAccessControl");
const RegisterContract = artifacts.require("RegisterContract");
const JudgeContract = artifacts.require("JudgeContract");
const AccessControlFactory = artifacts.require("AccessControlFactory");
const AccessControlContract = artifacts.require("AccessControlContract");
const { ensureLogFileExists, writeLogToCSV } = require("./Helper/CsvHelper");
const TableAccessControlContract = artifacts.require(
  "TableAccessControlContract"
);
const { expectRevert, time } = require("@openzeppelin/test-helpers");

let roleToken,
  roleBasedAccessControl,
  registerContract,
  judgeContract,
  accessControlFactory,
  tableAccessControlContract;

let accessControlContract1, accessControlContract2;

async function logMemberStatus(member) {
  const memberProps = await roleBasedAccessControl.getMember(member);
  const roleName = getRoleName(memberProps.role);

  const logData = `
    Member Address: ${member}
    - Name: ${memberProps.name}
    - Type: ${memberProps.memberType}
    - Status: ${memberProps.status}
    - Last Status Update: ${new Date(
      memberProps.lastStatusUpdate * 1000
    ).toLocaleString()}
    - Role: ${roleName}
  `;

  console.log(logData);
  return {
    timestamp: new Date().toISOString(),
    member: member,
    name: memberProps.name,
    type: memberProps.memberType,
    role: roleName,
    status: memberProps.status,
    lastStatusUpdate: new Date(
      memberProps.lastStatusUpdate * 1000
    ).toLocaleString(),
  };
}

// Get role name based on role value
function getRoleName(roleValue) {
  switch (roleValue.toString()) {
    case "2":
      return "PRIMARY_GROUP_HEAD";
    case "3":
      return "SECONDARY_GROUP_HEAD";
    case "4":
      return "REGULAR_MEMBER";
    default:
      return "UNDEFINED";
  }
}

// Measure function execution time and gas used
async function measureFunctionExecutionTime(fn, ...args) {
  const start = performance.now();
  const tx = await fn(...args);
  const end = performance.now();
  const gasUsed = tx.receipt.gasUsed;

  console.log(`Gas Used: ${gasUsed}`);
  console.log(`Execution Time: ${(end - start).toFixed(2)} ms`);
  tx.exec = (end - start).toFixed(2);

  return tx;
}
async function logBlockingEndTime(member) {
  const result = await accessControlContract1.getTime({
    from: member,
  });

  const blockingEndTimeVal = result[0];
  const boolval = result[1];

  if (boolval) {
    const blockingEndTime = new Date(blockingEndTimeVal * 1000);
    console.log(
      `Blocking End Time for ${member}: ${blockingEndTime.toLocaleString()}`
    );
    return blockingEndTime.toLocaleString();
  }
}
ensureLogFileExists();

// Contract Test Cases
contract(
  "AccessControlContract Misbehavior and Access Control Tests",
  (accounts) => {
    const [
      admin,
      primaryHead1,
      primaryHead2,
      primaryHead3,
      primaryHead4,
      secondaryGroupHead1,
      secondaryGroupHead2,
      regularMember1,
      regularMember2,
      regularMember3,
      regularMember4,
    ] = accounts;

    beforeEach(async () => {
      // Deploy contracts and assign roles
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

      accessControlFactory = await AccessControlFactory.new(
        admin,
        roleBasedAccessControl.address,
        registerContract.address,
        judgeContract.address
      );
      await roleToken.assignAdminRole(admin, accessControlFactory.address);

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
      await roleToken.assignAdminRole(
        admin,
        tableAccessControlContract.address
      );

      // Assign roles to members
      await roleBasedAccessControl.assignRole(
        primaryHead1,
        "primary_head1",
        "type1"
      );
      await roleBasedAccessControl.assignRole(
        primaryHead2,
        "primary_head2",
        "type2"
      );
      await roleBasedAccessControl.assignRole(
        primaryHead3,
        "primary_head3",
        "type3"
      );
      await roleBasedAccessControl.assignRole(
        primaryHead4,
        "primary_head4",
        "type4"
      );
      await roleBasedAccessControl.assignRole(
        secondaryGroupHead1,
        "secondary_group_head1",
        "type1"
      );
      await roleBasedAccessControl.assignRole(
        secondaryGroupHead2,
        "secondary_group_head2",
        "type2"
      );
      await roleBasedAccessControl.assignRole(
        regularMember1,
        "regular_member1",
        "type1"
      );
      await roleBasedAccessControl.assignRole(
        regularMember2,
        "regular_member2",
        "type2"
      );
      await roleBasedAccessControl.assignRole(
        regularMember3,
        "regular_member3",
        "type1"
      );
      await roleBasedAccessControl.assignRole(
        regularMember4,
        "regular_member4",
        "type2"
      );
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
        "allow"
      );
      await tableAccessControlContract.policyAdd(
        2,
        "GlobalResourceTable",
        "delete",
        "allow"
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
        "allow"
      );
      await tableAccessControlContract.policyAdd(
        2,
        "LocalResourceTable",
        "delete",
        "allow"
      );
      await tableAccessControlContract.policyAdd(
        3,
        "GlobalResourceTable",
        "edit",
        "allow"
      );
      await tableAccessControlContract.policyAdd(
        3,
        "GlobalResourceTable",
        "view",
        "allow"
      );
      await tableAccessControlContract.policyAdd(
        3,
        "GlobalResourceTable",
        "delete",
        "allow"
      );
      await tableAccessControlContract.policyAdd(
        3,
        "LocalResourceTable",
        "edit",
        "allow"
      );
      await tableAccessControlContract.policyAdd(
        3,
        "LocalResourceTable",
        "delete",
        "allow"
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
        "disallow"
      );

      // Deploy AccessControlContracts
      const tx1 = await accessControlFactory.deployAccessControlContract(
        primaryHead1,
        secondaryGroupHead1,
        "picture",
        { from: primaryHead1 }
      );
      const accAddress1 = tx1.logs[0].args.accAddress;
      accessControlContract1 = await AccessControlContract.at(accAddress1);
      await roleToken.assignAdminRole(admin, accAddress1);

      const tx2 = await accessControlFactory.deployAccessControlContract(
        primaryHead2,
        secondaryGroupHead2,
        "movie",
        { from: primaryHead2 }
      );
      const accAddress2 = tx2.logs[0].args.accAddress;
      accessControlContract2 = await AccessControlContract.at(accAddress2);
      await roleToken.assignAdminRole(admin, accAddress2);
    });

    
    // Test case for SGH edit GlobalResourceTable - Good Behavior
    it("should allow secondary head group to edit GlobalResourceTable after approval and reward benign behavior", async () => {
      console.log("TEST: Secondary head group tries to edit GlobalResourceTable with approved request and gets rewarded");
      const resource = "GlobalResourceTable";
      const action = "edit";
      const initialStatus = await logMemberStatus(secondaryGroupHead1);
  
      // Step 1: Create access request
      const createReceipt = await measureFunctionExecutionTime(
        tableAccessControlContract.createAccessRequest,
        resource,
        action,
        { from: secondaryGroupHead1 }
      );
  
      // Verify request creation
      const request = await tableAccessControlContract.accessRequests(0);
      assert.equal(request.requester, secondaryGroupHead1);
      assert.equal(request.resource, resource);
      assert.equal(request.action, action);
      assert.isFalse(request.isApproved);
      assert.exists(
        createReceipt.logs.find((log) => log.event === "AccessRequestCreated"),
        "AccessRequestCreated event was not emitted"
      );
  
      // Log initial balance
      const balanceBefore = await roleToken.balanceOf(secondaryGroupHead1);
      console.log(`Balance before reward: ${balanceBefore.toString()}`);
  
      // Step 2: Approve request by PGHs
      await tableAccessControlContract.handleAccessRequest(0, true, { from: primaryHead1 });
      await tableAccessControlContract.handleAccessRequest(0, true, { from: primaryHead2 });
  
      const updatedRequest = await tableAccessControlContract.accessRequests(0);
      assert.isTrue(updatedRequest.isApproved, "Request should be approved");
  
      // Step 3: Edit GlobalResourceTable by swapping roles
      const editResult = await measureFunctionExecutionTime(
        tableAccessControlContract.editGlobalResourceTable,
        primaryHead1, // Swapping PGH
        secondaryGroupHead1, // with SGH (self)
        { from: secondaryGroupHead1 }
      );
  
      // Verify edit
      const accessGrantedEvent = editResult.logs.find((log) => log.event === "AccessGranted");
      assert.isDefined(accessGrantedEvent, "AccessGranted event should be emitted");
  
      // Check role swap
      const role1After = await roleBasedAccessControl.getRole(primaryHead1);
      const role2After = await roleBasedAccessControl.getRole(secondaryGroupHead1);
      assert.equal(role1After.toString(), "3", "primaryHead1 should now be SGH");
      assert.equal(role2After.toString(), "2", "secondaryGroupHead1 should now be PGH");
  
      // Step 4: Simulate time and reward
      await time.increase(time.duration.days(2));
      await time.advanceBlock();
      await judgeContract.reportNonPenalizeMisbehavior(secondaryGroupHead1, { from: admin });
  
      // Log final balance and status
      const balanceAfter = await roleToken.balanceOf(secondaryGroupHead1);
      console.log(`Balance after reward: ${balanceAfter.toString()}`);
      assert(balanceAfter.gt(balanceBefore), "Balance should increase due to reward");
  
      const finalStatus = await logMemberStatus(secondaryGroupHead1);
      const isStateTransitioned = finalStatus.status !== initialStatus.status;
      const measurements = {
        delay: 0,
        isStatusChanged: isStateTransitioned,
        latency: editResult.exec,
        blockingEndTime: await logBlockingEndTime(secondaryGroupHead1),
        tokenBalance: balanceAfter.toString(),
        reward: balanceAfter.sub(balanceBefore).toString(),
      };
  
      await writeLogToCSV(
        initialStatus,
        finalStatus,
        "approved_edit_global_resource_table_sgh",
        editResult.receipt.gasUsed,
        0,
        measurements
      );
    });
    // Test case for PGH delete GlobalResourceTable - Good Behavior
    it("should allow primary head group to delete GlobalResourceTable after approval and reward benign behavior", async () => {
      console.log(
        "TEST: Primary head group tries to delete GlobalResourceTable with approved request and gets rewarded"
      );
      const resource = "GlobalResourceTable";
      const action = "delete";
      const initialStatus = await logMemberStatus(primaryHead1);
  
      // Step 1: Create an access request to delete GlobalResourceTable
      const createReceipt = await measureFunctionExecutionTime(
        tableAccessControlContract.createAccessRequest,
        resource,
        action,
        { from: primaryHead1 }
      );
  
      // Verify the access request creation
      const request = await tableAccessControlContract.accessRequests(0);
      assert.equal(request.requester, primaryHead1, "Requester should be primaryHead1");
      assert.equal(request.resource, resource, "Resource should match");
      assert.equal(request.action, action, "Action should match");
      assert.isFalse(request.isApproved, "Request should not be approved yet");
      assert.exists(
        createReceipt.logs.find((log) => log.event === "AccessRequestCreated"),
        "AccessRequestCreated event was not emitted"
      );
  
      // Log initial balance
      const balanceBefore = await roleToken.balanceOf(primaryHead1);
      console.log(`Balance before reward: ${balanceBefore.toString()}`);
  
      // Step 2: Approve the request by other PGHs to meet quorum
      await tableAccessControlContract.handleAccessRequest(0, true, { from: primaryHead2 });
      await tableAccessControlContract.handleAccessRequest(0, true, { from: primaryHead3 });
  
      const updatedRequest = await tableAccessControlContract.accessRequests(0);
      assert.isTrue(updatedRequest.isApproved, "Request should be approved after quorum");
  
      // Step 3: Delete a member from GlobalResourceTable after approval
      const deleteResult = await measureFunctionExecutionTime(
        tableAccessControlContract.deleteGlobalResourceTable,
        primaryHead4, // Deleting primaryHead4 as an example
        { from: primaryHead1 }
      );
  
      // Check AccessGranted event
      const accessGrantedEvent = deleteResult.logs.find((log) => log.event === "AccessGranted");
      assert.isDefined(accessGrantedEvent, "AccessGranted event should be emitted");
  
      // Verify the member is removed from GlobalResourceTable
      const globalTable = await roleBasedAccessControl.getGlobalResourceTable({ from: primaryHead2 });
      const isMemberPresent = globalTable.some((member) => member.memberAddress === primaryHead4);
      assert.isFalse(isMemberPresent, "primaryHead4 should be removed from GlobalResourceTable");
  
      // Step 4: Simulate time passing and check for reward
      await time.increase(time.duration.days(2)); // Exceed benignThreshold (1 day)
      await time.advanceBlock();
  
      // Explicitly call reportNonPenalizeMisbehavior to trigger reward
      await judgeContract.reportNonPenalizeMisbehavior(primaryHead1, { from: admin });
  
      // Log final balance and status
      const balanceAfter = await roleToken.balanceOf(primaryHead1);
      console.log(`Balance after reward: ${balanceAfter.toString()}`);
      assert(balanceAfter.gt(balanceBefore), "Balance should increase due to reward");
  
      const finalStatus = await logMemberStatus(primaryHead1);
      const isStateTransitioned = finalStatus.status !== initialStatus.status;
      const measurements = {
        delay: 0,
        isStatusChanged: isStateTransitioned,
        latency: deleteResult.exec,
        blockingEndTime: await logBlockingEndTime(primaryHead1),
        tokenBalance: balanceAfter.toString(),
        reward: balanceAfter.sub(balanceBefore).toString(),
      };
  
      // Write results to CSV
      await writeLogToCSV(
        initialStatus,
        finalStatus,
        "approved_delete_global_resource_table_pgh",
        deleteResult.receipt.gasUsed,
        0,
        measurements
      );
    });
    // Test case for SGH delete GlobalResourceTable - Good Behavior
    it("should allow secondary head group to delete GlobalResourceTable after request approval and reward behavior", async () => {
      console.log("TEST: Secondary head group deletes GlobalResourceTable with approved request and gets rewarded");
      const resource = "GlobalResourceTable";
      const action = "delete";
      const initialStatus = await logMemberStatus(secondaryGroupHead1);
    
      // Step 1: Create an access request
      const createReceipt = await measureFunctionExecutionTime(
        tableAccessControlContract.createAccessRequest,
        resource,
        action,
        { from: secondaryGroupHead1 }
      );
    
      const request = await tableAccessControlContract.accessRequests(0);
      assert.equal(request.requester, secondaryGroupHead1);
      assert.equal(request.resource, resource);
      assert.equal(request.action, action);
      assert.isFalse(request.isApproved);
    
      assert.exists(
        createReceipt.logs.find((log) => log.event === "AccessRequestCreated"),
        "AccessRequestCreated event was not emitted"
      );
    
      // Step 2: Approve the request by primary heads to meet quorum
      await tableAccessControlContract.handleAccessRequest(0, true, { from: primaryHead1 });
      await tableAccessControlContract.handleAccessRequest(0, true, { from: primaryHead2 });
      await tableAccessControlContract.handleAccessRequest(0, true, { from: primaryHead3 });
    
      const updatedRequest = await tableAccessControlContract.accessRequests(0);
      assert.isTrue(updatedRequest.isApproved, "The request should be approved");
    
      // Step 3: Delete from GlobalResourceTable after approval
      const balanceBefore = await roleToken.balanceOf(secondaryGroupHead1);
      console.log(`Balance before reward: ${balanceBefore.toString()}`);
    
      const result = await measureFunctionExecutionTime(
        tableAccessControlContract.deleteGlobalResourceTable,
        primaryHead1, // Deleting a PGH as an example
        { from: secondaryGroupHead1 }
      );
    
      // Check AccessGranted event
      const accessGrantedEvent = result.logs.find((log) => log.event === "AccessGranted");
      assert.isDefined(accessGrantedEvent, "AccessGranted event should be emitted");
    
      // Simulate time passing for benign behavior
      await time.increase(time.duration.days(2));
      await time.advanceBlock();
    
      // Explicitly call reportNonPenalizeMisbehavior to grant reward
      await judgeContract.reportNonPenalizeMisbehavior(secondaryGroupHead1, { from: admin });
    
      // Log balance after reward
      const balanceAfter = await roleToken.balanceOf(secondaryGroupHead1);
      console.log(`Balance after reward: ${balanceAfter.toString()}`);
      assert(balanceAfter.gte(balanceBefore), "Balance should increase or remain the same due to reward");
    
      // Verify the member is removed from GlobalResourceTable
      const globalTable = await roleBasedAccessControl.getGlobalResourceTable({ from: primaryHead2 });
      const isMemberPresent = globalTable.some(member => member.memberAddress === primaryHead1);
      assert.isFalse(isMemberPresent, "primaryHead1 should be removed from GlobalResourceTable");
    
      // Log final status and measurements
      const finalStatus = await logMemberStatus(secondaryGroupHead1);
      const isStateTransitioned = finalStatus.status !== initialStatus.status;
      const measurements = {
        delay: 0,
        isStatusChanged: isStateTransitioned,
        latency: result.exec,
        blockingEndTime: await logBlockingEndTime(secondaryGroupHead1),
        tokenBalance: balanceAfter,
        reward: balanceAfter.sub(balanceBefore).toString(),
      };
    
      await writeLogToCSV(
        initialStatus,
        finalStatus,
        "approved_delete_global_resource_table_sgh",
        result.receipt.gasUsed,
        0,
        measurements
      );
    });
    // Test case for RM Attempting to view GlobalResourceTable - Malicious Behavior
    it("should penalize regular member for attempting to view GlobalResourceTable and set status to MALICIOUS", async () => {
      console.log("TEST: Regular member tries to view GlobalResourceTable and gets penalized");
      const resource = "GlobalResourceTable";
      const action = "view";
      const initialStatus = await logMemberStatus(regularMember1);
  
      // Log initial balance and status
      const balanceBefore = await roleToken.balanceOf(regularMember1);
      console.log(`Balance before penalty: ${balanceBefore.toString()}`);
      console.log(`Initial Status: ${initialStatus.status}`);
  
      // Step 1: RM creates access request (should trigger penalty)
      const createReceipt = await measureFunctionExecutionTime(
        tableAccessControlContract.createAccessRequest,
        resource,
        action,
        { from: regularMember1 }
      );
  
      // Verify penalty event
      const maliciousEvent = createReceipt.logs.find((log) => log.event === "MaliciousActivityReported");
      assert.isDefined(maliciousEvent, "MaliciousActivityReported event should be emitted");
      const penaltyAmount = maliciousEvent.args.penaltyAmount;
      const reason = maliciousEvent.args.reason;
      const blockingEndTime = maliciousEvent.args.blockingEndTime;
      assert.equal(reason, "Unauthorized access attempt", "Reason should be unauthorized access");
      assert.equal(penaltyAmount.toString(), "5000", "Penalty should be 5000 tokens for RM"); // From JudgeContract
  
      // Verify no request was created due to policy denial
      const requestCount = await tableAccessControlContract.accessRequests.length;
      assert.equal(requestCount, 0, "No access request should be created");
  
      // Step 2: Check updated balance and status
      const balanceAfter = await roleToken.balanceOf(regularMember1);
      console.log(`Balance after penalty: ${balanceAfter.toString()}`);
      assert(balanceAfter.lt(balanceBefore), "Balance should decrease due to penalty");
  
      const finalStatus = await logMemberStatus(regularMember1);
      assert.equal(finalStatus.status, "MALICIOUS", "Status should be MALICIOUS after penalty");
  
      // Step 3: Check blocking time
      const blockingEndTimeStr = await logBlockingEndTime(regularMember1);
      assert.notEqual(blockingEndTimeStr, "Not Blocked", "RM should be blocked");
  
      // Log measurements
      const measurements = {
        delay: 0,
        isStatusChanged: finalStatus.status !== initialStatus.status,
        latency: createReceipt.exec,
        blockingEndTime: blockingEndTimeStr,
        tokenBalance: balanceAfter.toString(),
        reward: 0
      };
  
      await writeLogToCSV(
        initialStatus,
        finalStatus,
        "unauthorized_view_global_resource_table_rm",
        createReceipt.receipt.gasUsed,
        balanceBefore.sub(balanceAfter),
        measurements
      );
    });
  }
);
