// file created by Abir Saha

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
        "edit",
        "allow"
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
        "allow"
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

    // it("should penalize for too frequent access and track misbehavior", async () => {
    //   console.log(
    //     "TEST 2: should penalize for too frequent access and track misbehavior"
    //   );
    //   const initialStatus = await logMemberStatus(secondaryGroupHead1);
    //   let tx;
    //   // Add a policy for testing
    //   tx = await measureFunctionExecutionTime(
    //     accessControlContract1.policyAdd,
    //     3,
    //     "test.jpg",
    //     "view",
    //     "allow",
    //     { from: primaryHead1 }
    //   );
    //   // First valid access
    //   tx = await measureFunctionExecutionTime(
    //     accessControlContract1.accessControl,
    //     "test.jpg",
    //     "view",
    //     {
    //       from: secondaryGroupHead1,
    //     }
    //   );

    //   const successTime = tx.exec; //for valid access
    //   const gasUsed1 = tx.receipt.gasUsed;

    //   // Trigger too frequent access
    //   tx = await measureFunctionExecutionTime(
    //     accessControlContract1.accessControl,
    //     "test.jpg",
    //     "view",
    //     {
    //       from: secondaryGroupHead1,
    //     }
    //   );
    //   blockTime = tx.exec; //time taken for too frequent access
    //   console.log("delay", blockTime - successTime); //actual delay
    //   const gasUsed2 = tx.receipt.gasUsed;
    //   const totalGasUsed = gasUsed1 + gasUsed2;

    //   // Check for the MisbehaviorReported event (this event is triggered by too frequent access)
    //   const misbehaviorReportedEvent = tx.logs.find(
    //     (log) => log.event === "MaliciousActivityReported"
    //   );

    //   assert.isDefined(
    //     misbehaviorReportedEvent,
    //     "MaliciousActivityReported event should be emitted"
    //   );
    //   assert.equal(
    //     misbehaviorReportedEvent.args.reason,
    //     "Too frequent access",
    //     "Reason should be 'Too frequent access'"
    //   );

    //   // Ensure the penalty is applied correctly
    //   const penaltyAmount =
    //     misbehaviorReportedEvent.args.penaltyAmount.toString();
    //   const penalty = parseInt(penaltyAmount);
    //   assert.isAbove(
    //     parseInt(penaltyAmount),
    //     0,
    //     "Penalty amount should be greater than 0"
    //   );

    //   // Log final member status and blocking end time
    //   const finalStatus = await logMemberStatus(secondaryGroupHead1);
    //   await logBlockingEndTime(secondaryGroupHead1); // Log blocking end time
    //   const isStateTransitioned = finalStatus.status !== initialStatus.status;
    //   const measurments = {
    //     delay: blockTime - successTime,
    //     isStatusChanged: isStateTransitioned,
    //     latency: tx.exec,
    //     blockingEndTime: await logBlockingEndTime(secondaryGroupHead1),
    //     tokenBalance: await roleToken.balanceOf(secondaryGroupHead1),
    //   };

    //   await writeLogToCSV(
    //     initialStatus,
    //     finalStatus,
    //     "too_frequent_access",
    //     totalGasUsed,
    //     penalty,
    //     measurments
    //   );
    // });
    // it("should penalize for Denial of Service (DoS) via deactivateContract", async () => {
    //   console.log(
    //     "TEST 9: should penalize for Denial of Service (DoS) via deactivateContract"
    //   );
    //   // Assume a contract is already active and in use
    //   const tx1 = await measureFunctionExecutionTime(
    //     accessControlContract1.activateContract,
    //     { from: primaryHead1 }
    //   );

    //   const gasUsed1 = tx1.receipt.gasUsed;

    //   const initialStatus = await logMemberStatus(secondaryGroupHead1);

    //   // Try to call deactivateContract maliciously
    //   // Assuming the event is emitted when the penalty is reported
    //   const tx = await measureFunctionExecutionTime(
    //     accessControlContract1.deactivateContract,
    //     { from: secondaryGroupHead1 }
    //   );

    //   const gasUsed2 = tx.receipt.gasUsed;
    //   const totalGasUsed = gasUsed1 + gasUsed2;

    //   // Check for the MaliciousActivityReported event (triggered by the DoS attempt)
    //   const misbehaviorReportedEvent = tx.logs.find(
    //     (log) => log.event === "MaliciousActivityReported"
    //   );

    //   assert.isDefined(
    //     misbehaviorReportedEvent,
    //     "MaliciousActivityReported event should be emitted"
    //   );
    //   assert.equal(
    //     misbehaviorReportedEvent.args.reason,
    //     "Denial of Service",
    //     "Reason should be 'Denial of Service'"
    //   );
    //   // Ensure a penalty is applied due to the DoS attempt
    //   const penaltyAmount =
    //     misbehaviorReportedEvent.args.penaltyAmount.toString();

    //   assert.isAbove(
    //     parseInt(penaltyAmount),
    //     0,
    //     "Penalty amount should be greater than 0"
    //   );

    //   // Log final member status and blocking end time
    //   const finalStatus = await logMemberStatus(secondaryGroupHead1);
    //   await logMemberStatus(secondaryGroupHead1);
    //   await logBlockingEndTime(secondaryGroupHead1);
    //   const isStateTransitioned = finalStatus.status !== initialStatus.status;
    //   const measurments = {
    //     delay: tx1.exec - tx.exec,
    //     isStatusChanged: isStateTransitioned,
    //     latency: tx.exec,
    //     blockingEndTime: await logBlockingEndTime(secondaryGroupHead1),
    //     tokenBalance: await roleToken.balanceOf(secondaryGroupHead1),
    //   };
    //   await writeLogToCSV(
    //     initialStatus,
    //     finalStatus,
    //     "dos_attack",
    //     totalGasUsed,
    //     penaltyAmount,
    //     measurments
    //   ); // Log blocking end time
    // });
    // it("should allow a regular member to create an access request for allowed actions", async () => {
    //   console.log(
    //     "TEST 1: should allow a regular member to create an access request for allowed actions"
    //   );
    //   initialStatus = await logMemberStatus(regularMember1);

    //   const resource = "LocalResourceTable";
    //   const action = "view";

    //   // Create access request
    //   const receipt = await measureFunctionExecutionTime(
    //     tableAccessControlContract.createAccessRequest,
    //     resource,
    //     action,
    //     { from: regularMember1 }
    //   );

    //   console.log(
    //     "Gas Used for Create Access Request:",
    //     receipt.receipt.gasUsed
    //   );

    //   const request = await tableAccessControlContract.accessRequests(0);

    //   // Log the request details
    //   console.log("Access Request Created:");
    //   console.log("Requester:", request.requester);
    //   console.log("Resource:", request.resource);
    //   console.log("Action:", request.action);
    //   console.log("Is Approved:", request.isApproved);

    //   assert.equal(request.requester, regularMember1);
    //   assert.equal(request.resource, resource);
    //   assert.equal(request.action, action);
    //   assert.isFalse(request.isApproved); // Approval not handled in this test

    //   // Check for event emission
    //   assert.exists(
    //     receipt.logs.find((log) => log.event === "AccessRequestCreated"),
    //     "AccessRequestCreated event was not emitted"
    //   );
    //   // Step 3: Approve the local resource access request by the required quorum of primary heads
    //   await tableAccessControlContract.handleAccessRequest(0, true, {
    //     from: primaryHead1,
    //   });

    //   // Verify that the local resource access request was approved
    //   const updatedLocalRequest =
    //     await tableAccessControlContract.accessRequests(0);
    //   assert.isTrue(
    //     updatedLocalRequest.isApproved,
    //     "The local resource request should be approved"
    //   );

    //   // Log balance before reward
    //   let balanceBefore = await roleToken.balanceOf(regularMember1);
    //   console.log(`Balance before reward: ${balanceBefore.toString()}`);

    //   // Simulate time passing for benign behavior
    //   //await time.increase(time.duration.days(2));
    //   await time.increase(time.duration.days(2));
    //   await time.advanceBlock(); // Ensure the block timestamp is updated

    //   // Step 4: View the LocalResourceTable after approval
    //   let result = await measureFunctionExecutionTime(
    //     tableAccessControlContract.viewLocalResourceTable,
    //     {
    //       from: regularMember1,
    //     }
    //   );

    //   console.log(
    //     "Gas Used for View Local Resource Table:",
    //     result.receipt.gasUsed
    //   );

    //   // Log balance after reward
    //   let balanceAfter = await roleToken.balanceOf(regularMember1);
    //   console.log(`Balance after reward: ${balanceAfter.toString()}`);
    //   assert(
    //     balanceAfter.gte(balanceBefore),
    //     "Balance should increase or remain the same due to reward."
    //   );

    //   // Log final member status and blocking end time
    //   console.log("After 2 days without malicious activity:");
    //   console.log(`Balance after reward: ${balanceAfter.toString()}`);
    //   assert(
    //     balanceAfter.gte(balanceBefore),
    //     "Balance should increase or remain the same due to reward."
    //   );

    //   console.log("Final Status:");
    //   finalStatus = await logMemberStatus(regularMember1);
    //   const isStateTransitioned = finalStatus.status !== initialStatus.status;
    //   const measurments = {
    //     delay: 0,
    //     isStatusChanged: isStateTransitioned,
    //     latency: receipt.exec,
    //     blockingEndTime: await logBlockingEndTime(secondaryGroupHead1),
    //     tokenBalance: await roleToken.balanceOf(regularMember1),
    //     reward: balanceAfter.toString() - balanceBefore.toString(),
    //   };
    //   await writeLogToCSV(
    //     initialStatus,
    //     finalStatus,
    //     "access_local_resource",
    //     receipt.receipt.gasUsed,
    //     0,
    //     measurments
    //   );
    // });
    // it("should allow primary heads to view GlobalResourceTable after request approval by required quorum", async () => {
    //   console.log(
    //     "TEST 9: should allow primary heads to view GlobalResourceTable after request approval by required quorum"
    //   );
    //   const resource = "GlobalResourceTable";
    //   const action = "view";
    //   initialStatus = await logMemberStatus(primaryHead1);
    //   console.log("Initial Status:", initialStatus.status);

    //   // Step 1: Create an access request
    //   const createReceipt =
    //     await tableAccessControlContract.createAccessRequest(resource, action, {
    //       from: primaryHead1,
    //     });

    //   // Verify the access request creation
    //   const request = await tableAccessControlContract.accessRequests(0);
    //   assert.equal(request.requester, primaryHead1);
    //   assert.equal(request.resource, resource);
    //   assert.equal(request.action, action);
    //   assert.isFalse(request.isApproved);

    //   assert.exists(
    //     createReceipt.logs.find((log) => log.event === "AccessRequestCreated"),
    //     "AccessRequestCreated event was not emitted"
    //   );
    //   // Log balance before reward
    //   let balanceBefore = await roleToken.balanceOf(regularMember1);
    //   console.log(`Balance before reward: ${balanceBefore.toString()}`);
    //   // Step 2: Approve the access request by multiple primary heads to meet quorum
    //   // Assuming the quorum is 3 out of 5 primary heads
    //   await tableAccessControlContract.handleAccessRequest(0, true, {
    //     from: primaryHead2,
    //   });
    //   await tableAccessControlContract.handleAccessRequest(0, true, {
    //     from: primaryHead3,
    //   });
    //   await tableAccessControlContract.handleAccessRequest(0, true, {
    //     from: primaryHead4,
    //   });

    //   // Fetch the updated request
    //   const updatedRequest = await tableAccessControlContract.accessRequests(0);
    //   assert.isTrue(
    //     updatedRequest.isApproved,
    //     "The request should be approved"
    //   );

    //   // Step 3: View the GlobalResourceTable after approval
    //   let result = await measureFunctionExecutionTime(
    //     tableAccessControlContract.viewGlobalResourceTable,
    //     {
    //       from: primaryHead1,
    //     }
    //   );

    //   // Check the emitted GlobalResourceTableEmitted event
    //   const events = result.logs.filter(
    //     (log) => log.event === "GlobalResourceTableViewed"
    //   );
    //   // Simulate time passing for benign behavior
    //   //await time.increase(time.duration.days(2));
    //   await time.increase(time.duration.days(2));
    //   await time.advanceBlock();
    //   // Log balance before reward
    //   let balanceAfter = await roleToken.balanceOf(primaryHead1);
    //   console.log(`Balance after reward: ${balanceAfter.toString()}`);

    //   if (events.length > 0) {
    //     const { viewer, resourceTable } = events[0].args;
    //     console.log("Viewer Address:", viewer);
    //     console.log("Global Resource Table:", resourceTable); // This will show the resource table in the logs

    //     // Verify that the GlobalResourceTable was returned
    //     assert.isArray(resourceTable, "GlobalResourceTable should be an array");
    //     assert.isNotEmpty(
    //       resourceTable,
    //       "GlobalResourceTable should not be empty"
    //     );
    //     finalStatus = await logMemberStatus(primaryHead1);
    //     const isStateTransitioned = finalStatus.status !== initialStatus.status;
    //     const measurments = {
    //       delay: 0,
    //       isStatusChanged: isStateTransitioned,
    //       latency: 0,
    //       blockingEndTime: await logBlockingEndTime(primaryHead1),
    //       tokenBalance: await roleToken.balanceOf(primaryHead1),
    //       reward: balanceAfter.toString() - balanceBefore.toString(),
    //     };
    //     await writeLogToCSV(
    //       initialStatus,
    //       finalStatus,
    //       "access_local_resource",
    //       result.receipt.gasUsed,
    //       0,
    //       measurments
    //     );
    //   }
    // });
    // it("should reward benign behavior after a threshold and log balances", async () => {
    //   console.log(
    //     "TEST 5: should reward benign behavior after a threshold and log balances"
    //   );
    //   console.log("Initial Status:");
    //   await logMemberStatus(primaryHead1);
    //   initialStatus = await logMemberStatus(secondaryGroupHead1);

    //   // Add a policy
    //   const policyAddReceipt = await accessControlContract1.policyAdd(
    //     3,
    //     "test.jpg",
    //     "view",
    //     "allow",
    //     {
    //       from: primaryHead1,
    //     }
    //   );

    //   // Access the resource benignly
    //   const accessControlReceipt = await accessControlContract1.accessControl(
    //     "test.jpg",
    //     "view",
    //     {
    //       from: secondaryGroupHead1,
    //     }
    //   );

    //   // Log balance before reward
    //   let balanceBefore = await roleToken.balanceOf(secondaryGroupHead1);
    //   console.log(`Balance before reward: ${balanceBefore.toString()}`);

    //   // Simulate time passing for benign behavior
    //   //await time.increase(time.duration.days(2));
    //   await time.increase(time.duration.days(2));
    //   await time.advanceBlock(); // Ensure the block timestamp is updated

    //   // Attempt access again and ensure no penalties are applied
    //   await accessControlContract1.accessControl("test.jpg", "view", {
    //     from: secondaryGroupHead1,
    //   });

    //   // Log balance after reward
    //   let balanceAfter = await roleToken.balanceOf(secondaryGroupHead1);
    //   console.log(`Balance after reward: ${balanceAfter.toString()}`);
    //   assert(
    //     balanceAfter.gte(balanceBefore),
    //     "Balance should increase or remain the same due to reward."
    //   );
    //   console.log("reward", balanceAfter.toString() - balanceBefore.toString());

    //   console.log("Final Status:");
    //   await logMemberStatus(primaryHead1);
    //   finalStatus = await logMemberStatus(secondaryGroupHead1);
    //   const isStateTransitioned = finalStatus.status !== initialStatus.status;
    //   const measurments = {
    //     delay: 0,
    //     isStatusChanged: isStateTransitioned,
    //     latency: 0,
    //     blockingEndTime: await logBlockingEndTime(secondaryGroupHead1),
    //     tokenBalance: await roleToken.balanceOf(secondaryGroupHead1),
    //     reward: balanceAfter.toString() - balanceBefore.toString(),
    //   };
    //   await writeLogToCSV(
    //     initialStatus,
    //     finalStatus,
    //     "access_allowed_resources",
    //     0,
    //     0,
    //     measurments
    //   );
    // });

    it("should allow primary heads to view LocalResourceTable after request approval by required quorum", async () => {
      console.log(
        "TEST 9: should allow primary heads to view LocalResourceTable after request approval by required quorum"
      );
      const resource = "LocalResourceTable";
      const action = "view";
      initialStatus = await logMemberStatus(primaryHead1);
      console.log("Initial Status:", initialStatus.status);

      // Step 1: Create an access request
      const createReceipt =
        await tableAccessControlContract.createAccessRequest(resource, action, {
          from: primaryHead1,
        });

      // Verify the access request creation
      const request = await tableAccessControlContract.accessRequests(0);
      assert.equal(request.requester, primaryHead1);
      assert.equal(request.resource, resource);
      assert.equal(request.action, action);
      // assert.isFalse(request.isApproved);

      assert.exists(
        createReceipt.logs.find((log) => log.event === "AccessRequestCreated"),
        "AccessRequestCreated event was not emitted"
      );
      // Log balance before reward
      let balanceBefore = await roleToken.balanceOf(regularMember1);
      console.log(`Balance before reward: ${balanceBefore.toString()}`);
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
      assert.isTrue(
        updatedRequest.isApproved,
        "The request should be approved"
      );

      // Step 3: View the GlobalResourceTable after approval
      let result = await measureFunctionExecutionTime(
        tableAccessControlContract.viewLocalResourceTable,
        {
          from: primaryHead1,
        }
      );

      // Check the emitted GlobalResourceTableEmitted event
      const events = result.logs.filter(
        (log) => log.event === "GlobalResourceTableViewed"
      );
      // Simulate time passing for benign behavior
      //await time.increase(time.duration.days(2));
      await time.increase(time.duration.days(2));
      await time.advanceBlock();
      // Log balance before reward
      let balanceAfter = await roleToken.balanceOf(primaryHead1);
      console.log(`Balance after reward: ${balanceAfter.toString()}`);

      if (events.length > 0) {
        const { viewer, resourceTable } = events[0].args;
        console.log("Viewer Address:", viewer);
        console.log("LocalResourceTable:", resourceTable); // This will show the resource table in the logs

        // Verify that the LocalResourceTable was returned
        assert.isArray(resourceTable, "LocalResourceTable should be an array");
        assert.isNotEmpty(
          resourceTable,
          "LocalResourceTable should not be empty"
        );
        finalStatus = await logMemberStatus(primaryHead1);
        const isStateTransitioned = finalStatus.status !== initialStatus.status;
        const measurments = {
          delay: 0,
          isStatusChanged: isStateTransitioned,
          latency: 0,
          blockingEndTime: await logBlockingEndTime(primaryHead1),
          tokenBalance: await roleToken.balanceOf(primaryHead1),
          reward: balanceAfter.toString() - balanceBefore.toString(),
        };
        await writeLogToCSV(
          initialStatus,
          finalStatus,
          "access_local_resource",
          result.receipt.gasUsed,
          0,
          measurments
        );
      }
    });

    it("should allow Secondary heads to view LocalResourceTable after request approval by required quorum", async () => {
      console.log(
        "TEST 11: should allow secondary group heads to view LocalResource after request approval by required quorum"
      );
      const resource = "LocalResourceTable";
      const action = "view";
      initialStatus = await logMemberStatus(secondaryGroupHead1);
      console.log("Initial Status:", initialStatus.status);

      // Step 1: Create an access request
      const createReceipt =
        await tableAccessControlContract.createAccessRequest(resource, action, {
          from: secondaryGroupHead1,
        });

      // Verify the access request creation
      const request = await tableAccessControlContract.accessRequests(0);
      assert.equal(request.requester, secondaryGroupHead1);
      assert.equal(request.resource, resource);
      assert.equal(request.action, action);
      assert.isFalse(request.isApproved);

      assert.exists(
        createReceipt.logs.find((log) => log.event === "AccessRequestCreated"),
        "AccessRequestCreated event was not emitted"
      );
      // Log balance before reward
      let balanceBefore = await roleToken.balanceOf(secondaryGroupHead1); //need to check this line
      console.log(`Balance before reward: ${balanceBefore.toString()}`);
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
      assert.isTrue(
        updatedRequest.isApproved,
        "The request should be approved"
      );

      // Step 3: View the GlobalResourceTable after approval
      let result = await measureFunctionExecutionTime(
        tableAccessControlContract.viewLocalResourceTable,
        {
          from: secondaryGroupHead1,
        }
      );

      // Check the emitted GlobalResourceTableEmitted event
      const events = result.logs.filter(
        (log) => log.event === "LocalResourceTableViewed"
      );
      // Simulate time passing for benign behavior
      //await time.increase(time.duration.days(2));
      await time.increase(time.duration.days(2));
      await time.advanceBlock();
      // Log balance before reward
      let balanceAfter = await roleToken.balanceOf(secondaryGroupHead1);
      console.log(`Balance after reward: ${balanceAfter.toString()}`);

      if (events.length > 0) {
        const { viewer, resourceTable } = events[0].args;
        console.log("Viewer Address:", viewer);
        console.log("Local Resource Table:", resourceTable); // This will show the resource table in the logs

        // Verify that the GlobalResourceTable was returned
        assert.isArray(resourceTable, "GlobalResourceTable should be an array");
        assert.isNotEmpty(
          resourceTable,
          "GlobalResourceTable should not be empty"
        );
        finalStatus = await logMemberStatus(secondaryGroupHead1);
        const isStateTransitioned = finalStatus.status !== initialStatus.status;
        const measurments = {
          delay: 0,
          isStatusChanged: isStateTransitioned,
          latency: 0,
          blockingEndTime: await logBlockingEndTime(secondaryGroupHead1),
          tokenBalance: await roleToken.balanceOf(secondaryGroupHead1),
          reward: balanceAfter.toString() - balanceBefore.toString(),
        };
        await writeLogToCSV(
          initialStatus,
          finalStatus,
          "access_local_resource",
          result.receipt.gasUsed,
          0,
          measurments
        );
      }
    });

    it("should allow secondary heads to view GlobalResourceTable after request approval by required quorum", async () => {
      console.log(
        "TEST 9: should allow secondary heads to view GlobalResourceTable after request approval by required quorum"
      );
      const resource = "GlobalResourceTable";
      const action = "view";

      initialStatus = await logMemberStatus(secondaryGroupHead1);
      console.log("Initial Status:", initialStatus.status);

      // Step 1: Create an access request
      const createReceipt =
        await tableAccessControlContract.createAccessRequest(resource, action, {
          from: secondaryGroupHead1,
        });

      // Verify the access request creation
      const request = await tableAccessControlContract.accessRequests(0);
      // assert.equal(request.requester, secondaryGroupHead1);
      // assert.equal(request.resource, resource);
      // assert.equal(request.action, action);
      // assert.isFalse(request.isApproved);

      assert.exists(
        createReceipt.logs.find((log) => log.event === "AccessRequestCreated"),
        "AccessRequestCreated event was not emitted"
      );
      // Log balance before reward
      let balanceBefore = await roleToken.balanceOf(secondaryGroupHead1);
      console.log(`Balance before reward: ${balanceBefore.toString()}`);
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
      assert.isTrue(
        updatedRequest.isApproved,
        "The request should be approved"
      );

      // Step 3: View the GlobalResourceTable after approval
      let result = await measureFunctionExecutionTime(
        tableAccessControlContract.viewGlobalResourceTable,
        {
          from: secondaryGroupHead1,
        }
      );

      // Check the emitted GlobalResourceTableEmitted event
      const events = result.logs.filter(
        (log) => log.event === "GlobalResourceTableViewed"
      );
      // Simulate time passing for benign behavior
      //await time.increase(time.duration.days(2));
      await time.increase(time.duration.days(2));
      await time.advanceBlock();
      // Log balance before reward
      let balanceAfter = await roleToken.balanceOf(secondaryGroupHead1);
      console.log(`Balance after reward: ${balanceAfter.toString()}`);

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
        finalStatus = await logMemberStatus(secondaryGroupHead1);
        const isStateTransitioned = finalStatus.status !== initialStatus.status;
        const measurments = {
          delay: 0,
          isStatusChanged: isStateTransitioned,
          latency: 0,
          blockingEndTime: await logBlockingEndTime(secondaryGroupHead1),
          tokenBalance: await roleToken.balanceOf(secondaryGroupHead1),
          reward: balanceAfter.toString() - balanceBefore.toString(),
        };
        await writeLogToCSV(
          initialStatus,
          finalStatus,
          "access_local_resource",
          result.receipt.gasUsed,
          0,
          measurments
        );
      }
    });

    it("should allow primary group heads to edit GlobalResourceTable after request approval by required quorum", async () => {
      console.log(
        "TEST 12: should allow primary group heads to edit GlobalResourceTable after request approval by required quorum"
      );
      const resource = "GlobalResourceTable";
      const action = "edit";

      initialStatus = await logMemberStatus(primaryHead1);
      console.log("Initial Status:", initialStatus.status);

      // Step 1: Create an access request
      const createReceipt =
        await tableAccessControlContract.createAccessRequest(resource, action, {
          from: primaryHead1,
        });

      // Verify the access request creation
      const request = await tableAccessControlContract.accessRequests(0);
      // assert.equal(request.requester, secondaryGroupHead1);
      // assert.equal(request.resource, resource);
      // assert.equal(request.action, action);
      // assert.isFalse(request.isApproved);

      assert.exists(
        createReceipt.logs.find((log) => log.event === "AccessRequestCreated"),
        "AccessRequestCreated event was not emitted"
      );
      // Log balance before reward
      let balanceBefore = await roleToken.balanceOf(secondaryGroupHead1);
      console.log(`Balance before reward: ${balanceBefore.toString()}`);
      // Step 2: Approve the access request by multiple primary heads to meet quorum
      // Assuming the quorum is 3 out of 5 primary heads
      // await tableAccessControlContract.handleAccessRequest(0, true, {
      //   from: primaryHead2,
      // });
      await tableAccessControlContract.handleAccessRequest(0, true, {
        from: primaryHead3,
      });
      await tableAccessControlContract.handleAccessRequest(0, true, {
        from: primaryHead4,
      });

      // Fetch the updated request
      const updatedRequest = await tableAccessControlContract.accessRequests(0);
      assert.isTrue(
        updatedRequest.isApproved,
        "The request should be approved"
      );

      // Step 3: View the GlobalResourceTable after approval
      let result = await tableAccessControlContract.editGlobalResourceTable(
        primaryHead1,
        primaryHead2
      );

      // Check the emitted GlobalResourceTableEmitted event
      const events = result.logs.filter(
        (log) => log.event === "GlobalResourceTableEdit"
      );
      // Simulate time passing for benign behavior
      //await time.increase(time.duration.days(2));
      await time.increase(time.duration.days(2));
      await time.advanceBlock();
      // Log balance before reward
      let balanceAfter = await roleToken.balanceOf(secondaryGroupHead1);
      console.log(`Balance after reward: ${balanceAfter.toString()}`);

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
        finalStatus = await logMemberStatus(secondaryGroupHead1);
        const isStateTransitioned = finalStatus.status !== initialStatus.status;
        const measurments = {
          delay: 0,
          isStatusChanged: isStateTransitioned,
          latency: 0,
          blockingEndTime: await logBlockingEndTime(secondaryGroupHead1),
          tokenBalance: await roleToken.balanceOf(secondaryGroupHead1),
          reward: balanceAfter.toString() - balanceBefore.toString(),
        };
        await writeLogToCSV(
          initialStatus,
          finalStatus,
          "access_local_resource",
          result.receipt.gasUsed,
          0,
          measurments
        );
      }
    });
  }
);
