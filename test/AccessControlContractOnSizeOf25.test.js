const RoleToken = artifacts.require("RoleToken");
const RoleBasedAccessControl = artifacts.require("RoleBasedAccessControl");
const RegisterContract = artifacts.require("RegisterContract");
const JudgeContract = artifacts.require("JudgeContract");
const AccessControlFactory = artifacts.require("AccessControlFactory");
const AccessControlContract = artifacts.require("AccessControlContract");

const { expectRevert, time } = require("@openzeppelin/test-helpers");
const { assert } = require("chai");
const { BN } = require("web3-utils"); // Make sure to import BN

contract(
  "AccessControlContract Misbehavior and Access Control Tests",
  (accounts) => {
    const [
      admin,
      primaryHead1,
      primaryHead2,
      primaryHead3,
      primaryHead4,
      primaryHead5,
      secondaryGroupHead1,
      secondaryGroupHead2,
      secondaryGroupHead3,
      secondaryGroupHead4,
      secondaryGroupHead5,
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
      regularMember11,
      regularMember12,
      regularMember13,
      regularMember14,
      regularMember15,
    ] = accounts;

    let roleToken,
      roleBasedAccessControl,
      registerContract,
      judgeContract,
      accessControlFactory;
    let accessControlContract1, accessControlContract2;

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

      accessControlFactory = await AccessControlFactory.new(
        admin,
        roleBasedAccessControl.address,
        registerContract.address,
        judgeContract.address
      );
      await roleToken.assignAdminRole(admin, accessControlFactory.address);

      // Assign roles to members evenly across groups
      const primaryHeads = [
        primaryHead1,
        primaryHead2,
        primaryHead3,
        primaryHead4,
        primaryHead5,
      ];
      const secondaryGroupHeads = [
        secondaryGroupHead1,
        secondaryGroupHead2,
        secondaryGroupHead3,
        secondaryGroupHead4,
        secondaryGroupHead5,
      ];
      const regularMembers = [
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
        regularMember11,
        regularMember12,
        regularMember13,
        regularMember14,
        regularMember15,
      ];

      // Assign roles to members
      // Assign roles to primary heads
      for (let i = 0; i < primaryHeads.length; i++) {
        await roleBasedAccessControl.assignRole(
          primaryHeads[i],
          `primary_head${i + 1}`,
          `type${i + 1}`
        );
      }

      // Assign roles to secondary group heads
      for (let i = 0; i < secondaryGroupHeads.length; i++) {
        await roleBasedAccessControl.assignRole(
          secondaryGroupHeads[i],
          `secondary_group_head${i + 1}`,
          `type${i + 1}`
        );
      }

      // Assign roles to regular members
      for (let i = 0; i < regularMembers.length; i++) {
        await roleBasedAccessControl.assignRole(
          regularMembers[i],
          `regular_member${i + 1}`,
          `type${(i % 5) + 1}` // Alternate types for regular members
        );
      }

      // Deploy AccessControlContract for subjects and objects
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

    it("should reject access control contract creation between members of different types", async () => {
      console.log(
        "TEST 1: should reject access control contract creation between members of different types"
      );
      console.log("Initial Status:");
      await logMemberStatus(primaryHead1);
      await logMemberStatus(regularMember3);

      try {
        // Attempt to create an AccessControlContract between members of different types
        await accessControlFactory.deployAccessControlContract(
          primaryHead2,
          regularMember3,
          "picture",
          {
            from: primaryHead2,
          }
        );
        assert.fail("Expected error not received");
      } catch (error) {
        assert.include(
          error.message,
          "Subject and Object must be in the same group or in global resource table",
          "Error message should contain the expected revert reason"
        );
      }

      console.log("Final Status:");
      await logMemberStatus(primaryHead1);
      await logMemberStatus(regularMember3);
    });

    it("should penalize for too frequent access and track misbehavior", async () => {
      console.log(
        "TEST 2: should penalize for too frequent access and track misbehavior"
      );
      console.log("Initial Status:");
      await logMemberStatus(primaryHead1);
      await logMemberStatus(secondaryGroupHead1);

      let tx;
      // Add a policy for testing
      tx = await measureFunctionExecutionTime(
        accessControlContract1.policyAdd,
        3,
        "test.jpg",
        "view",
        "allow",
        { from: primaryHead1 }
      );

      console.log("Gas Used for policyAdd:", tx.receipt.gasUsed);

      // First valid access
      tx = await measureFunctionExecutionTime(
        accessControlContract1.accessControl,
        "test.jpg",
        "view",
        {
          from: secondaryGroupHead1,
        }
      );

      console.log("Gas Used for first accessControl:", tx.receipt.gasUsed);

      // Trigger too frequent access
      tx = await measureFunctionExecutionTime(
        accessControlContract1.accessControl,
        "test.jpg",
        "view",
        {
          from: secondaryGroupHead1,
        }
      );

      console.log(
        "Gas Used for too frequent accessControl:",
        tx.receipt.gasUsed
      );

      // Check for the MisbehaviorReported event (this event is triggered by too frequent access)
      const misbehaviorReportedEvent = tx.logs.find(
        (log) => log.event === "MaliciousActivityReported"
      );

      assert.isDefined(
        misbehaviorReportedEvent,
        "MaliciousActivityReported event should be emitted"
      );
      assert.equal(
        misbehaviorReportedEvent.args.reason,
        "Too frequent access",
        "Reason should be 'Too frequent access'"
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
      await logMemberStatus(secondaryGroupHead1);
      await logBlockingEndTime(secondaryGroupHead1); // Log blocking end time
    });

    it("should penalize unauthorized access attempts", async () => {
      console.log("TEST 3: should penalize unauthorized access attempts");
      console.log("Initial Status:");
      await logMemberStatus(primaryHead1);
      await logMemberStatus(secondaryGroupHead1);

      // Add a policy for testing
      await accessControlContract1.policyAdd(
        3,
        "test.jpg",
        "view",
        "disallow",
        { from: primaryHead1 }
      );

      // Attempt unauthorized access by regularMember2 (who is not allowed to access)
      const tx = await accessControlContract1.accessControl(
        "test.jpg",
        "view",
        { from: secondaryGroupHead1 }
      );

      // Check for the MaliciousActivityReported event (this event is triggered by unauthorized access)
      const misbehaviorReportedEvent = tx.logs.find(
        (log) => log.event === "MaliciousActivityReported"
      );

      assert.isDefined(
        misbehaviorReportedEvent,
        "MaliciousActivityReported event should be emitted"
      );
      assert.equal(
        misbehaviorReportedEvent.args.reason,
        "Unauthorized access attempt",
        "Reason should be 'Unauthorized access attempt'"
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
      await logMemberStatus(secondaryGroupHead1);
      await logBlockingEndTime(secondaryGroupHead1); // Log blocking end time
    });

    it("should penalize for tampering with data", async () => {
      console.log("TEST 4: should penalize for tampering with data");
      console.log("Initial Status:");
      await logMemberStatus(primaryHead1);
      await logMemberStatus(secondaryGroupHead1);

      // Add a policy for testing
      await accessControlContract1.policyAdd(3, "test.jpg", "view", "allow", {
        from: primaryHead1,
      });

      // Attempt tampering (e.g., delete action)
      const tx = await accessControlContract1.accessControl(
        "test.jpg",
        "delete",
        { from: secondaryGroupHead1 }
      );

      // Check for the MaliciousActivityReported event (this event is triggered by tampering with data)
      const misbehaviorReportedEvent = tx.logs.find(
        (log) => log.event === "MaliciousActivityReported"
      );

      assert.isDefined(
        misbehaviorReportedEvent,
        "MaliciousActivityReported event should be emitted"
      );
      assert.equal(
        misbehaviorReportedEvent.args.reason,
        "Tampering with data",
        "Reason should be 'Tampering with data'"
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
      await logMemberStatus(secondaryGroupHead1);
      await logBlockingEndTime(secondaryGroupHead1); // Log blocking end time
    });

    it("should reward benign behavior after a threshold and log balances", async () => {
      console.log(
        "TEST 5: should reward benign behavior after a threshold and log balances"
      );
      console.log("Initial Status:");
      await logMemberStatus(primaryHead1);
      await logMemberStatus(secondaryGroupHead1);

      // Add a policy
      await accessControlContract1.policyAdd(3, "test.jpg", "view", "allow", {
        from: primaryHead1,
      });

      // Access the resource benignly
      await accessControlContract1.accessControl("test.jpg", "view", {
        from: secondaryGroupHead1,
      });

      // Log balance before reward
      let balanceBefore = await roleToken.balanceOf(secondaryGroupHead1);
      console.log(`Balance before reward: ${balanceBefore.toString()}`);

      // Simulate time passing for benign behavior
      //await time.increase(time.duration.days(2));
      await time.increase(time.duration.days(2));
      await time.advanceBlock(); // Ensure the block timestamp is updated

      // Attempt access again and ensure no penalties are applied
      await accessControlContract1.accessControl("test.jpg", "view", {
        from: secondaryGroupHead1,
      });

      // Log balance after reward
      let balanceAfter = await roleToken.balanceOf(secondaryGroupHead1);
      console.log(`Balance after reward: ${balanceAfter.toString()}`);
      assert(
        balanceAfter.gte(balanceBefore),
        "Balance should increase or remain the same due to reward."
      );

      console.log("Final Status:");
      await logMemberStatus(primaryHead1);
      await logMemberStatus(secondaryGroupHead1);
    });

    it("should block malicious activity and test unblocking after time", async () => {
      console.log(
        "TEST 6: should block malicious activity and test unblocking after time"
      );
      console.log("Initial Status:");
      await logMemberStatus(primaryHead1);
      await logMemberStatus(secondaryGroupHead1);

      // Add a policy
      await accessControlContract1.policyAdd(
        RoleToken.Role.SECONDARY_GROUP_HEAD,
        "resource",
        "view",
        "allow",
        { from: primaryHead1 }
      );

      // Attempt malicious action
      const tx = await accessControlContract1.accessControl(
        "resource",
        "delete",
        { from: secondaryGroupHead1 }
      );

      // Log final member status and blocking end time
      console.log("After Malicious Activity Status:");
      await logMemberStatus(secondaryGroupHead1);
      await logBlockingEndTime(secondaryGroupHead1); // Log blocking end time

      // Simulate time passing for the unblock period
      await time.increase(time.duration.days(2)); // Assuming unblock happens after 2 days
      await time.advanceBlock(); // Ensure the block timestamp is updated

      // Attempt access again
      await accessControlContract1.accessControl("resource", "view", {
        from: secondaryGroupHead1,
      });

      // Log final member status and blocking end time
      console.log("Final Status after 2 days:");
      await logMemberStatus(secondaryGroupHead1);

      // Ensure that the peer is no longer blocked
      const memberProps = await roleBasedAccessControl.getMember(
        secondaryGroupHead1
      );
      assert.equal(
        memberProps.status.toString(),
        "BENIGN", // Assuming '1' is for benign status
        "Member should be considered benign after penalty period"
      );
    });

    it("should assign the roles to users with initial tokens", async () => {
      console.log(
        "TEST 7: should assign the roles to users with initial tokens"
      );
      console.log("Initial Status:");
      await logMemberStatus(primaryHead1);
      await logMemberStatus(secondaryGroupHead1);
      await logMemberStatus(regularMember1);

      const primaryHeadBalance = await roleToken.balanceOf(primaryHead1);
      const secondaryHeadBalance = await roleToken.balanceOf(
        secondaryGroupHead1
      );
      const regularMemberBalance = await roleToken.balanceOf(regularMember1);
      console.log(`Primary Head's balance: ${primaryHeadBalance}`);
      console.log(`Secondary Group Head's balance: ${secondaryHeadBalance}`);
      console.log(`Regular Member's balance: ${regularMemberBalance}`);

      // Create BN instances for expected balances
      const expectedPrimaryHeadBalance = new BN("1000000000000000000000000");
      const expectedSecondaryHeadBalance = new BN("500000000000000000000000");
      const expectedRegularMemberBalance = new BN("100000000000000000000000");

      // Compare balances using .eq for BigNumber
      assert(
        primaryHeadBalance.eq(expectedPrimaryHeadBalance),
        "Balance should be 1000000000000000000000000 for primary head"
      );

      assert(
        secondaryHeadBalance.eq(expectedSecondaryHeadBalance),
        "Balance should be 500000000000000000000000 for secondary group head"
      );

      assert(
        regularMemberBalance.eq(expectedRegularMemberBalance),
        "Balance should be 100000000000000000000000 for regular member"
      );
    });

    it("should block suspicious activity and test unblocking after time", async () => {
      console.log(
        "TEST 8: should block malicious activity and test unblocking after time"
      );
      console.log("Initial Status:");
      await logMemberStatus(primaryHead1);
      await logMemberStatus(secondaryGroupHead1);

      // Add a policy
      await accessControlContract1.policyAdd(
        RoleToken.Role.SECONDARY_GROUP_HEAD,
        "resource",
        "view",
        "allow",
        { from: primaryHead1 }
      );

      await accessControlContract1.accessControl("resource", "view", {
        from: secondaryGroupHead1,
      });

      // Trigger too frequent access
      const tx = await accessControlContract1.accessControl(
        "resource",
        "view",
        { from: secondaryGroupHead1 }
      );

      // Log final member status and blocking end time
      console.log("After Suspicious Activity Status:");
      await logMemberStatus(secondaryGroupHead1);
      await logBlockingEndTime(secondaryGroupHead1); // Log blocking end time

      // Simulate time passing for the unblock period
      await time.increase(time.duration.days(1)); // Assuming unblock happens after 2 days
      await time.advanceBlock(); // Ensure the block timestamp is updated

      // Attempt access again
      await accessControlContract1.accessControl("resource", "view", {
        from: secondaryGroupHead1,
      });

      // Log final member status and blocking end time
      console.log("Final Status after 1 days:");
      await logMemberStatus(secondaryGroupHead1);

      // Ensure that the peer is no longer blocked
      const memberProps = await roleBasedAccessControl.getMember(
        secondaryGroupHead1
      );
      assert.equal(
        memberProps.status.toString(),
        "BENIGN", // Assuming '1' is for benign status
        "Member should be considered benign after penalty period"
      );
    });

    it("should penalize for Denial of Service (DoS) via deactivateContract", async () => {
      console.log(
        "TEST 9: should penalize for Denial of Service (DoS) via deactivateContract"
      );

      console.log("Initial Status:");
      await logMemberStatus(primaryHead1);
      await logMemberStatus(secondaryGroupHead1);

      // Assume a contract is already active and in use
      await accessControlContract1.activateContract({ from: primaryHead1 });

      // Try to call deactivateContract maliciously
      // Assuming the event is emitted when the penalty is reported
      const tx = await accessControlContract1
        .deactivateContract({ from: secondaryGroupHead1 })
        .catch((e) => e);

      // Check for the MaliciousActivityReported event (triggered by the DoS attempt)
      const misbehaviorReportedEvent = tx.logs.find(
        (log) => log.event === "MaliciousActivityReported"
      );

      assert.isDefined(
        misbehaviorReportedEvent,
        "MaliciousActivityReported event should be emitted"
      );
      assert.equal(
        misbehaviorReportedEvent.args.reason,
        "Denial of Service",
        "Reason should be 'Denial of Service'"
      );

      // Ensure a penalty is applied due to the DoS attempt
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
      await logMemberStatus(secondaryGroupHead1);
      await logBlockingEndTime(secondaryGroupHead1); // Log blocking end time
    });

    it("should simulate token balance changes due to benign and malicious activities", async () => {
      console.log(
        "TEST 10: should simulate token balance changes due to benign and malicious activities"
      );

      // Function to log token balance
      const logBalance = async (account, label) => {
        let balance = await roleToken.balanceOf(account);
        console.log(`${label} - Balance: ${balance.toString()}`);
        return balance;
      };

      // Log initial status and balances
      console.log("Initial Status:");
      await logMemberStatus(secondaryGroupHead1);
      await logBalance(
        secondaryGroupHead1,
        "Initial Balance of Secondary Group Head 1"
      );

      await accessControlContract1.policyAdd(
        3,
        `resource0.jpg`,
        "view",
        "allow",
        { from: primaryHead1 }
      );

      await accessControlContract1.policyAdd(
        3,
        `resource1.jpg`,
        "edit",
        "disallow",
        { from: primaryHead1 }
      );

      await accessControlContract1.policyAdd(
        3,
        `resource2.jpg`,
        "delete",
        "disallow",
        { from: primaryHead1 }
      );

      await accessControlContract1.policyAdd(
        3,
        `resource3.jpg`,
        "view",
        "disallow",
        { from: primaryHead1 }
      );

      // 4 Increases (benign behavior)
      console.log("Starting 4 benign activities...");

      for (let i = 0; i < 4; i++) {
        await accessControlContract1.accessControl(`resource0.jpg`, "view", {
          from: secondaryGroupHead1,
        });

        await logBalance(secondaryGroupHead1, `After benign action ${i + 1}`);

        // Simulate time passing
        await time.increase(time.duration.days(1));
        await time.advanceBlock();
      }

      // 4 Decreases (malicious activities)
      console.log("Starting 4 malicious activities...");

      // first malicious activity
      let tx = await accessControlContract1.accessControl(
        `restricted1.jpg`,
        "view",
        { from: secondaryGroupHead1 }
      );

      let misbehaviorReportedEvent = tx.logs.find(
        (log) => log.event === "MaliciousActivityReported"
      );

      assert.isDefined(
        misbehaviorReportedEvent,
        "MaliciousActivityReported event should be emitted"
      );

      let penaltyAmount =
        misbehaviorReportedEvent.args.penaltyAmount.toString();
      console.log(
        `Penalty for malicious action unauthorized access: ${penaltyAmount}`
      );
      assert.isAbove(
        parseInt(penaltyAmount),
        0,
        "Penalty amount should be greater than 0"
      );

      await logBalance(secondaryGroupHead1, `After Unauthorized Access`);

      // Simulate time passing
      await time.increase(time.duration.hours(2));
      await time.advanceBlock();

      // second malicious activity
      tx = await accessControlContract1.accessControl(`resource1.jpg`, "edit", {
        from: secondaryGroupHead1,
      });

      misbehaviorReportedEvent = tx.logs.find(
        (log) => log.event === "MaliciousActivityReported"
      );

      assert.isDefined(
        misbehaviorReportedEvent,
        "MaliciousActivityReported event should be emitted"
      );

      penaltyAmount = misbehaviorReportedEvent.args.penaltyAmount.toString();
      console.log(
        `Penalty for malicious action unauthorized access: ${penaltyAmount}`
      );
      assert.isAbove(
        parseInt(penaltyAmount),
        0,
        "Penalty amount should be greater than 0"
      );

      await logBalance(secondaryGroupHead1, `After Tampering Data`);

      // Simulate time passing
      await time.increase(time.duration.hours(4));
      await time.advanceBlock();

      // third malicious activity too frequent access

      // First valid access
      tx = await accessControlContract1.accessControl("resource0.jpg", "view", {
        from: secondaryGroupHead1,
      });

      // Trigger too frequent access
      tx = await accessControlContract1.accessControl("resource0.jpg", "view", {
        from: secondaryGroupHead1,
      });

      misbehaviorReportedEvent = tx.logs.find(
        (log) => log.event === "MaliciousActivityReported"
      );

      assert.isDefined(
        misbehaviorReportedEvent,
        "MaliciousActivityReported event should be emitted"
      );

      penaltyAmount = misbehaviorReportedEvent.args.penaltyAmount.toString();
      console.log(
        `Penalty for malicious action too frequent access: ${penaltyAmount}`
      );
      assert.isAbove(
        parseInt(penaltyAmount),
        0,
        "Penalty amount should be greater than 0"
      );

      await logBalance(secondaryGroupHead1, `After Too Frequent Access`);

      // Simulate time passing
      await time.increase(time.duration.minutes(45));
      await time.advanceBlock();

      // fourth malicious activity too frequent access

      // Try to call deactivateContract maliciously
      // Assuming the event is emitted when the penalty is reported
      tx = await accessControlContract1
        .deactivateContract({ from: secondaryGroupHead1 })
        .catch((e) => e);

      // Check for the MaliciousActivityReported event (triggered by the DoS attempt)
      misbehaviorReportedEvent = tx.logs.find(
        (log) => log.event === "MaliciousActivityReported"
      );

      assert.isDefined(
        misbehaviorReportedEvent,
        "MaliciousActivityReported event should be emitted"
      );

      penaltyAmount = misbehaviorReportedEvent.args.penaltyAmount.toString();
      console.log(
        `Penalty for malicious action Denial of Service: ${penaltyAmount}`
      );
      assert.isAbove(
        parseInt(penaltyAmount),
        0,
        "Penalty amount should be greater than 0"
      );

      await logBalance(secondaryGroupHead1, `After Denial of Service`);

      // Simulate time passing
      await time.increase(time.duration.days(3));
      await time.advanceBlock();

      // 2 Final Increases (benign behavior)
      console.log("Starting 2 final benign activities...");

      for (let i = 0; i < 2; i++) {
        await accessControlContract1.policyAdd(
          3,
          `benignResource${i + 4}.jpg`,
          "view",
          "allow",
          { from: primaryHead1 }
        );

        await accessControlContract1.accessControl(
          `benignResource${i + 4}.jpg`,
          "view",
          {
            from: secondaryGroupHead1,
          }
        );

        await logBalance(
          secondaryGroupHead1,
          `After final benign action ${i + 1}`
        );

        // Simulate time passing
        await time.increase(time.duration.days(1));
        await time.advanceBlock();
      }

      // Log final status and balances
      console.log("Final Status:");
      await logMemberStatus(secondaryGroupHead1);
      await logBalance(
        secondaryGroupHead1,
        "Final Balance of Secondary Group Head 1"
      );
    });
  }
);

/*
const result = await accessControlContract1.getTime({
        from: secondaryGroupHead1,
      });

      const currentBlockTime = result[0];
      const blockingEndTime = result[1];
      const timeSinceLastUpdate = result[2];
      const benignThreshold = result[3];
      const boolval = result[4];

      console.log("Initial Status Check:");
      console.log(`- Current Block Time: ${currentBlockTime}`);
      console.log(`- Blocking End Time: ${blockingEndTime}`);
      console.log(`- Time Since Last Update: ${timeSinceLastUpdate}`);
      console.log(`- Benign Threshold: ${benignThreshold}`);
      console.log(`- Status: ${boolval ? "Benign" : "Suspicious"}`);
*/
