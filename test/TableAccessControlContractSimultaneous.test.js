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
    primaryHead6,
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
    await roleToken.assignRole(primaryHead5, "primary_head_5", "type5");
    await roleToken.assignRole(primaryHead6, "primary_head_6", "type6");

    // Secondary Group Heads
    await roleToken.assignRole(secondaryHead1, "secondary_head_1", "type1");
    await roleToken.assignRole(secondaryHead2, "secondary_head_2", "type2");
    await roleToken.assignRole(secondaryHead3, "secondary_head_3", "type3");
    await roleToken.assignRole(secondaryHead4, "secondary_head_4", "type4");
    await roleToken.assignRole(secondaryHead5, "secondary_head_5", "type5");

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
    const tx = await measureFunctionExecutionTime(
      roleToken.assignRole,
      regularMember10,
      "regular_member_10",
      "type5"
    );

    console.log("Gas Used for Role Assignment:", tx.receipt.gasUsed);

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

  it("should allow primary heads to view GlobalResourceTable after request approval by required quorum", async () => {
    console.log(
      "TEST 1: should allow primary heads to view GlobalResourceTable after request approval by required quorum"
    );

    let resource = "GlobalResourceTable";
    let action = "view";

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

    // Start timing the entire set of transactions
    let start = performance.now();

    // Step 3: View the GlobalResourceTable after approval
    let tx = await tableAccessControlContract.viewGlobalResourceTable({
      from: primaryHead1,
    });

    // Stop timing after all transactions are done
    let end = performance.now();
    let totalExecutionTime = (end - start).toFixed(2); // Calculate the total execution time

    // Log the total execution time for all transactions
    console.log(
      `Total Execution Time for 1 view global resource table: ${totalExecutionTime} ms`
    );

    console.log(
      "Gas Used for 1 view global resource table:",
      tx.receipt.gasUsed
    );

    // Check the emitted GlobalResourceTableEmitted event
    const events = tx.logs.filter(
      (log) => log.event === "GlobalResourceTableViewed"
    );

    // if (events.length > 0) {
    //   const { viewer, resourceTable } = events[0].args;
    //   console.log("Viewer Address:", viewer);
    //   console.log("Global Resource Table:", resourceTable); // This will show the resource table in the logs

    //   // Verify that the GlobalResourceTable was returned
    //   assert.isArray(resourceTable, "GlobalResourceTable should be an array");
    //   assert.isNotEmpty(
    //     resourceTable,
    //     "GlobalResourceTable should not be empty"
    //   );
    // }

    // Start timing the entire set of transactions
    start = performance.now();

    // First valid access
    tx = txPromises = Promise.all([
      tableAccessControlContract.viewGlobalResourceTable({
        from: primaryHead1,
      }),
      tableAccessControlContract.viewGlobalResourceTable({
        from: primaryHead1,
      }),
      tableAccessControlContract.viewGlobalResourceTable({
        from: primaryHead1,
      }),
    ]);

    results = await txPromises; // Wait for all transactions to complete

    // Stop timing after all transactions are done
    end = performance.now();
    totalExecutionTime = (end - start).toFixed(2); // Calculate the total execution time

    // Log the total execution time for all transactions
    console.log(
      `Total Execution Time for 3 view global resource table: ${totalExecutionTime} ms`
    );

    console.log(
      "Gas Used for 3 view global resource table:",
      results[0].receipt.gasUsed +
        results[1].receipt.gasUsed +
        results[2].receipt.gasUsed
    );

    // Start timing the entire set of transactions
    start = performance.now();

    // First valid access
    tx = txPromises = Promise.all([
      tableAccessControlContract.viewGlobalResourceTable({
        from: primaryHead1,
      }),
      tableAccessControlContract.viewGlobalResourceTable({
        from: primaryHead1,
      }),
      tableAccessControlContract.viewGlobalResourceTable({
        from: primaryHead1,
      }),
      tableAccessControlContract.viewGlobalResourceTable({
        from: primaryHead1,
      }),
      tableAccessControlContract.viewGlobalResourceTable({
        from: primaryHead1,
      }),
    ]);

    results = await txPromises; // Wait for all transactions to complete

    // Stop timing after all transactions are done
    end = performance.now();
    totalExecutionTime = (end - start).toFixed(2); // Calculate the total execution time

    // Log the total execution time for all transactions
    console.log(
      `Total Execution Time for 5 view global resource table: ${totalExecutionTime} ms`
    );

    console.log(
      "Gas Used for 5 view global resource table:",
      results[0].receipt.gasUsed +
        results[1].receipt.gasUsed +
        results[2].receipt.gasUsed +
        results[3].receipt.gasUsed +
        results[4].receipt.gasUsed
    );
  });

  it("should allow primary heads to revoke roles on GlobalResourceTable after request approval by required quorum", async () => {
    console.log(
      "TEST 2: should allow primary heads to revoke roles on GlobalResourceTable after request approval by required quorum"
    );

    let resource = "GlobalResourceTable";
    let action = "delete";

    // Step 1: Create an access request

    let createReceipt = await tableAccessControlContract.createAccessRequest(
      resource,
      action,
      { from: primaryHead1 }
    );

    let tx = await tableAccessControlContract.createAccessRequest(
      resource,
      "view",
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

    await tableAccessControlContract.handleAccessRequest(1, true, {
      from: primaryHead2,
    });
    await tableAccessControlContract.handleAccessRequest(1, true, {
      from: primaryHead3,
    });
    await tableAccessControlContract.handleAccessRequest(1, true, {
      from: primaryHead4,
    });

    // Step 3: View the GlobalResourceTable after approval
    tx = await tableAccessControlContract.viewGlobalResourceTable({
      from: primaryHead1,
    });

    // Check the emitted GlobalResourceTableEmitted event
    let events = tx.logs.filter(
      (log) => log.event === "GlobalResourceTableViewed"
    );

    // if (events.length > 0) {
    //   const { viewer, resourceTable } = events[0].args;
    //   console.log("Viewer Address:", viewer);
    //   console.log("Global Resource Table:", resourceTable); // This will show the resource table in the logs

    //   // Verify that the GlobalResourceTable was returned
    //   assert.isArray(resourceTable, "GlobalResourceTable should be an array");
    //   assert.isNotEmpty(
    //     resourceTable,
    //     "GlobalResourceTable should not be empty"
    //   );
    // }

    // Start timing the entire set of transactions
    start = performance.now();

    // Step 3: View the GlobalResourceTable after approval
    createReceipt = await tableAccessControlContract.deleteGlobalResourceTable(
      primaryHead2,
      {
        from: primaryHead1,
      }
    );

    // Stop timing after all transactions are done
    end = performance.now();
    totalExecutionTime = (end - start).toFixed(2); // Calculate the total execution time

    // Log the total execution time for all transactions
    console.log(
      `Total Execution Time for 1 delete global resource table: ${totalExecutionTime} ms`
    );

    console.log(
      "Gas Used for 1 delete global resource table:",
      createReceipt.receipt.gasUsed
    );

    // Step 3: View the GlobalResourceTable after approval
    tx = await tableAccessControlContract.viewGlobalResourceTable({
      from: primaryHead1,
    });

    // Check the emitted GlobalResourceTableEmitted event
    events = tx.logs.filter((log) => log.event === "GlobalResourceTableViewed");

    // if (events.length > 0) {
    //   const { viewer, resourceTable } = events[0].args;
    //   console.log("Viewer Address:", viewer);
    //   console.log("Global Resource Table:", resourceTable); // This will show the resource table in the logs

    //   // Verify that the GlobalResourceTable was returned
    //   assert.isArray(resourceTable, "GlobalResourceTable should be an array");
    //   assert.isNotEmpty(
    //     resourceTable,
    //     "GlobalResourceTable should not be empty"
    //   );
    // }

    // Start timing the entire set of transactions
    start = performance.now();

    // First valid access
    let txPromises = Promise.all([
      // Step 3: View the GlobalResourceTable after approval
      tableAccessControlContract.deleteGlobalResourceTable(secondaryHead2, {
        from: primaryHead1,
      }),
      // Step 3: View the GlobalResourceTable after approval
      tableAccessControlContract.deleteGlobalResourceTable(primaryHead3, {
        from: primaryHead1,
      }),
      // Step 3: View the GlobalResourceTable after approval
      tableAccessControlContract.deleteGlobalResourceTable(primaryHead4, {
        from: primaryHead1,
      }),
    ]);

    results = await txPromises; // Wait for all transactions to complete

    // Stop timing after all transactions are done
    end = performance.now();
    totalExecutionTime = (end - start).toFixed(2); // Calculate the total execution time

    // Log the total execution time for all transactions
    console.log(
      `Total Execution Time for 3 delete global resource table: ${totalExecutionTime} ms`
    );

    console.log(
      "Gas Used for 3 delete global resource table:",
      results[0].receipt.gasUsed +
        results[1].receipt.gasUsed +
        results[2].receipt.gasUsed
    );

    // Step 3: View the GlobalResourceTable after approval
    tx = await tableAccessControlContract.viewGlobalResourceTable({
      from: primaryHead1,
    });

    // Check the emitted GlobalResourceTableEmitted event
    events = tx.logs.filter((log) => log.event === "GlobalResourceTableViewed");

    // if (events.length > 0) {
    //   const { viewer, resourceTable } = events[0].args;
    //   console.log("Viewer Address:", viewer);
    //   console.log("Global Resource Table:", resourceTable); // This will show the resource table in the logs

    //   // Verify that the GlobalResourceTable was returned
    //   assert.isArray(resourceTable, "GlobalResourceTable should be an array");
    //   assert.isNotEmpty(
    //     resourceTable,
    //     "GlobalResourceTable should not be empty"
    //   );
    // }

    // Start timing the entire set of transactions
    start = performance.now();

    // First valid access
    txPromises = Promise.all([
      // Step 3: View the GlobalResourceTable after approval
      tableAccessControlContract.deleteGlobalResourceTable(secondaryHead4, {
        from: primaryHead1,
      }),
      // Step 3: View the GlobalResourceTable after approval
      tableAccessControlContract.deleteGlobalResourceTable(secondaryHead3, {
        from: primaryHead1,
      }),
      // Step 3: View the GlobalResourceTable after approval
      tableAccessControlContract.deleteGlobalResourceTable(primaryHead5, {
        from: primaryHead1,
      }),
      // Step 3: View the GlobalResourceTable after approval
      tableAccessControlContract.deleteGlobalResourceTable(regularMember4, {
        from: primaryHead1,
      }),
      // Step 3: View the GlobalResourceTable after approval
      tableAccessControlContract.deleteGlobalResourceTable(primaryHead6, {
        from: primaryHead1,
      }),
    ]);

    results = await txPromises; // Wait for all transactions to complete

    // Stop timing after all transactions are done
    end = performance.now();
    totalExecutionTime = (end - start).toFixed(2); // Calculate the total execution time

    // Log the total execution time for all transactions
    console.log(
      `Total Execution Time for 5 delete global resource table: ${totalExecutionTime} ms`
    );

    console.log(
      "Gas Used for 5 delete global resource table:",
      results[0].receipt.gasUsed +
        results[1].receipt.gasUsed +
        results[2].receipt.gasUsed +
        results[3].receipt.gasUsed +
        results[4].receipt.gasUsed
    );

    // Step 3: View the GlobalResourceTable after approval
    tx = await tableAccessControlContract.viewGlobalResourceTable({
      from: primaryHead1,
    });

    // Check the emitted GlobalResourceTableEmitted event
    events = tx.logs.filter((log) => log.event === "GlobalResourceTableViewed");

    // if (events.length > 0) {
    //   const { viewer, resourceTable } = events[0].args;
    //   console.log("Viewer Address:", viewer);
    //   console.log("Global Resource Table:", resourceTable); // This will show the resource table in the logs

    //   // Verify that the GlobalResourceTable was returned
    //   assert.isArray(resourceTable, "GlobalResourceTable should be an array");
    //   assert.isNotEmpty(
    //     resourceTable,
    //     "GlobalResourceTable should not be empty"
    //   );
    // }
  });

  it("should allow primary heads to swap roles on GlobalResourceTable after request approval by required quorum", async () => {
    console.log(
      "TEST 3: should allow primary heads to swap roles on GlobalResourceTable after request approval by required quorum"
    );

    let resource = "GlobalResourceTable";
    let action = "edit";

    // Step 1: Create an access request

    let createReceipt = await tableAccessControlContract.createAccessRequest(
      resource,
      action,
      { from: primaryHead1 }
    );

    let tx = await tableAccessControlContract.createAccessRequest(
      resource,
      "view",
      { from: primaryHead1 }
    );

    // Verify the access request creation
    let request = await tableAccessControlContract.accessRequests(0);
    assert.equal(request.requester, primaryHead1);
    assert.equal(request.resource, resource);
    assert.equal(request.action, action);
    console.log(request.requiredQuorum);
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

    request = await tableAccessControlContract.accessRequests(0);
    console.log(request);
    assert.equal(request.requester, primaryHead1);
    assert.equal(request.resource, resource);
    assert.equal(request.action, action);
    console.log(request.requiredQuorum);
    console.log(request.isApproved);

    await tableAccessControlContract.handleAccessRequest(1, true, {
      from: primaryHead2,
    });
    await tableAccessControlContract.handleAccessRequest(1, true, {
      from: primaryHead3,
    });
    await tableAccessControlContract.handleAccessRequest(1, true, {
      from: primaryHead4,
    });

    request = await tableAccessControlContract.accessRequests(1);
    assert.equal(request.requester, primaryHead1);
    assert.equal(request.resource, resource);
    assert.equal(request.action, "view");
    console.log(request.requiredQuorum);
    console.log(request.isApproved);

    // Step 3: View the GlobalResourceTable after approval
    tx = await tableAccessControlContract.viewGlobalResourceTable({
      from: primaryHead1,
    });

    // Check the emitted GlobalResourceTableEmitted event
    let events = tx.logs.filter(
      (log) => log.event === "GlobalResourceTableViewed"
    );

    // if (events.length > 0) {
    //   const { viewer, resourceTable } = events[0].args;
    //   console.log("Viewer Address:", viewer);
    //   console.log("Global Resource Table:", resourceTable); // This will show the resource table in the logs

    //   // Verify that the GlobalResourceTable was returned
    //   assert.isArray(resourceTable, "GlobalResourceTable should be an array");
    //   assert.isNotEmpty(
    //     resourceTable,
    //     "GlobalResourceTable should not be empty"
    //   );
    // }

    // Start timing the entire set of transactions
    start = performance.now();

    // Step 3: View the GlobalResourceTable after approval
    createReceipt = await tableAccessControlContract.editGlobalResourceTable(
      primaryHead2,
      secondaryHead2,
      {
        from: primaryHead1,
      }
    );

    // Stop timing after all transactions are done
    end = performance.now();
    totalExecutionTime = (end - start).toFixed(2); // Calculate the total execution time

    // Log the total execution time for all transactions
    console.log(
      `Total Execution Time for 1 swap role global resource table: ${totalExecutionTime} ms`
    );

    console.log(createReceipt.logs);
    console.log(
      "Gas Used for 1 swap role global resource table:",
      createReceipt.receipt.gasUsed
    );

    // Step 3: View the GlobalResourceTable after approval
    tx = await tableAccessControlContract.viewGlobalResourceTable({
      from: primaryHead1,
    });

    // Check the emitted GlobalResourceTableEmitted event
    events = tx.logs.filter((log) => log.event === "GlobalResourceTableViewed");

    // if (events.length > 0) {
    //   const { viewer, resourceTable } = events[0].args;
    //   console.log("Viewer Address:", viewer);
    //   console.log("Global Resource Table:", resourceTable); // This will show the resource table in the logs

    //   // Verify that the GlobalResourceTable was returned
    //   assert.isArray(resourceTable, "GlobalResourceTable should be an array");
    //   assert.isNotEmpty(
    //     resourceTable,
    //     "GlobalResourceTable should not be empty"
    //   );
    // }

    // Start timing the entire set of transactions
    start = performance.now();

    // First valid access
    let txPromises = Promise.all([
      // Step 3: View the GlobalResourceTable after approval
      tableAccessControlContract.editGlobalResourceTable(
        primaryHead3,
        secondaryHead3,
        {
          from: primaryHead1,
        }
      ),
      // Step 3: View the GlobalResourceTable after approval
      tableAccessControlContract.editGlobalResourceTable(
        primaryHead4,
        regularMember7,
        {
          from: primaryHead1,
        }
      ),
      // Step 3: View the GlobalResourceTable after approval
      tableAccessControlContract.editGlobalResourceTable(
        primaryHead5,
        secondaryHead5,
        {
          from: primaryHead1,
        }
      ),
    ]);

    results = await txPromises; // Wait for all transactions to complete

    // Stop timing after all transactions are done
    end = performance.now();
    totalExecutionTime = (end - start).toFixed(2); // Calculate the total execution time

    // Log the total execution time for all transactions
    console.log(
      `Total Execution Time for 3 swap role global resource table: ${totalExecutionTime} ms`
    );

    console.log(
      "Gas Used for 3 swap role global resource table:",
      results[0].receipt.gasUsed +
        results[1].receipt.gasUsed +
        results[2].receipt.gasUsed
    );

    // Step 3: View the GlobalResourceTable after approval
    tx = await tableAccessControlContract.viewGlobalResourceTable({
      from: primaryHead1,
    });

    // Check the emitted GlobalResourceTableEmitted event
    events = tx.logs.filter((log) => log.event === "GlobalResourceTableViewed");

    // if (events.length > 0) {
    //   const { viewer, resourceTable } = events[0].args;
    //   console.log("Viewer Address:", viewer);
    //   console.log("Global Resource Table:", resourceTable); // This will show the resource table in the logs

    //   // Verify that the GlobalResourceTable was returned
    //   assert.isArray(resourceTable, "GlobalResourceTable should be an array");
    //   assert.isNotEmpty(
    //     resourceTable,
    //     "GlobalResourceTable should not be empty"
    //   );
    // }

    // Start timing the entire set of transactions
    start = performance.now();

    // First valid access
    txPromises = Promise.all([
      // Step 3: View the GlobalResourceTable after approval
      tableAccessControlContract.editGlobalResourceTable(
        primaryHead2,
        secondaryHead2,
        {
          from: primaryHead1,
        }
      ),
      tableAccessControlContract.editGlobalResourceTable(
        primaryHead3,
        secondaryHead3,
        {
          from: primaryHead1,
        }
      ),
      // Step 3: View the GlobalResourceTable after approval
      tableAccessControlContract.editGlobalResourceTable(
        primaryHead4,
        regularMember7,
        {
          from: primaryHead1,
        }
      ),
      // Step 3: View the GlobalResourceTable after approval
      tableAccessControlContract.editGlobalResourceTable(
        primaryHead5,
        secondaryHead5,
        {
          from: primaryHead1,
        }
      ),
      // Step 3: View the GlobalResourceTable after approval
      tableAccessControlContract.editGlobalResourceTable(
        primaryHead5,
        secondaryHead5,
        {
          from: primaryHead1,
        }
      ),
    ]);

    results = await txPromises; // Wait for all transactions to complete

    // Stop timing after all transactions are done
    end = performance.now();
    totalExecutionTime = (end - start).toFixed(2); // Calculate the total execution time

    // Log the total execution time for all transactions
    console.log(
      `Total Execution Time for 5 swap role global resource table: ${totalExecutionTime} ms`
    );

    console.log(
      "Gas Used for 5 swap role global resource table:",
      results[0].receipt.gasUsed +
        results[1].receipt.gasUsed +
        results[2].receipt.gasUsed +
        results[3].receipt.gasUsed +
        results[4].receipt.gasUsed
    );

    // Step 3: View the GlobalResourceTable after approval
    tx = await tableAccessControlContract.viewGlobalResourceTable({
      from: primaryHead1,
    });

    // Check the emitted GlobalResourceTableEmitted event
    events = tx.logs.filter((log) => log.event === "GlobalResourceTableViewed");

    // if (events.length > 0) {
    //   const { viewer, resourceTable } = events[0].args;
    //   console.log("Viewer Address:", viewer);
    //   console.log("Global Resource Table:", resourceTable); // This will show the resource table in the logs

    //   // Verify that the GlobalResourceTable was returned
    //   assert.isArray(resourceTable, "GlobalResourceTable should be an array");
    //   assert.isNotEmpty(
    //     resourceTable,
    //     "GlobalResourceTable should not be empty"
    //   );
    // }
  });

  it("during and after Privilege escalation", async () => {
    console.log("TEST 4: during and after Privilege escalation");

    let resource = "GlobalResourceTable";
    let action = "edit";

    // Step 1: Create an access request

    let createReceipt = await tableAccessControlContract.createAccessRequest(
      resource,
      action,
      { from: primaryHead1 }
    );

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

    // Start timing the entire set of transactions
    start = performance.now();

    // Step 3: View the GlobalResourceTable after approval
    let tx = await tableAccessControlContract.editGlobalResourceTable(
      regularMember3,
      secondaryHead2,
      {
        from: primaryHead1,
      }
    );

    // Stop timing after all transactions are done
    end = performance.now();
    totalExecutionTime = (end - start).toFixed(2); // Calculate the total execution time

    // Log the total execution time for all transactions
    console.log(
      `Total Execution Time for during attack to edit global resource table: ${totalExecutionTime} ms`
    );

    console.log(
      "Gas Used for during attack to edit global resource table:",
      tx.receipt.gasUsed
    );

    misbehaviorReportedEvent = tx.logs.find(
      (log) => log.event === "MaliciousActivityReported"
    );

    assert.isDefined(
      misbehaviorReportedEvent,
      "MaliciousActivityReported event should be emitted"
    );

    assert.equal(
      misbehaviorReportedEvent.args.reason,
      "Privilege escalation",
      "Reason should be 'Privilege escalation'"
    );

    penaltyAmount = misbehaviorReportedEvent.args.penaltyAmount.toString();
    console.log(
      `Penalty for malicious action Privilege escalation: ${penaltyAmount}`
    );
    assert.isAbove(
      parseInt(penaltyAmount),
      0,
      "Penalty amount should be greater than 0"
    );

    // Simulate time passing
    await time.increase(time.duration.hours(6));
    await time.advanceBlock();

    // Start timing the entire set of transactions
    start = performance.now();

    // Step 3: View the GlobalResourceTable after approval
    tx = await tableAccessControlContract.editGlobalResourceTable(
      primaryHead2,
      secondaryHead2,
      {
        from: primaryHead1,
      }
    );

    // Stop timing after all transactions are done
    end = performance.now();
    totalExecutionTime = (end - start).toFixed(2); // Calculate the total execution time

    // Log the total execution time for all transactions
    console.log(
      `Total Execution Time for after attack to edit global resource table: ${totalExecutionTime} ms`
    );

    console.log(
      "Gas Used for after attack to edit global resource table:",
      tx.receipt.gasUsed
    );
  });
});
