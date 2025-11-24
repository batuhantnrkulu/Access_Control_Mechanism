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
      secondaryGroupHead1,
      secondaryGroupHead2,
      regularMember1,
      regularMember2,
      regularMember3, // Will be used to test wrong type
      regularMember4, // Will be used to test wrong type
      otherAccount,
    ] = accounts;

    let roleToken,
      roleBasedAccessControl,
      registerContract,
      judgeContract,
      accessControlFactory;
    let accessControlContract1, accessControlContract2;
    let snapshotId;

    before(async () => {
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
      ); // Different type
      await roleBasedAccessControl.assignRole(
        regularMember4,
        "regular_member4",
        "type2"
      ); // Different type

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
    beforeEach(async () => {
      snapshotId = await new Promise((resolve, reject) => {
        web3.currentProvider.send(
          { jsonrpc: "2.0", method: "evm_snapshot", id: new Date().getTime() },
          (err, result) => {
            if (err) return reject(err);
            resolve(result.result); // <-- snapshotId is in result.result
          }
        );
      });
    });

    // ✅ Revert snapshot after each test
    afterEach(async () => {
      await new Promise((resolve, reject) => {
        web3.currentProvider.send(
          {
            jsonrpc: "2.0",
            method: "evm_revert",
            params: [snapshotId], // use the captured snapshotId
            id: new Date().getTime(),
          },
          (err, result) => {
            if (err) return reject(err);
            resolve(result.result);
          }
        );
      });
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
      const totalAfter = await judgeContract.getTotalPenalties(member);
      console.log(`Total penalty AFTER trigger: ${totalAfter}`);
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
    it("should accumulate penalties across multiple misbehaviors", async () => {
      let totalBefore = await judgeContract.getTotalPenalties(
        secondaryGroupHead1
      );
      console.log("Total penalty before tampering:", totalBefore.toString());
      assert.equal(totalBefore.toString(), "0");

      // Tampering with data, resulting in a penalty
      let tx = await accessControlContract1.accessControl(
        "test.jpg",
        "delete",
        { from: secondaryGroupHead1 }
      );
      let penalty1 = tx.logs
        .find((log) => log.event === "MaliciousActivityReported")
        .args.penaltyAmount.toString();
      console.log("Penalty from tampering:", penalty1);

      let afterTampering = await judgeContract.getTotalPenalties(
        secondaryGroupHead1
      );
      assert.equal(afterTampering.toString(), "10000");
      await time.increase(time.duration.days(2));
      await time.advanceBlock();
      // Unauthorized access, resulting in penalty
      let tx2 = await accessControlContract1.accessControl("test.jpg", "view", {
        from: secondaryGroupHead1,
      });
      let penalty2 = tx2.logs
        .find((log) => log.event === "MaliciousActivityReported")
        .args.penaltyAmount.toString();
      console.log("Penalty from unauthorized access:", penalty2);

      let finalTotal = await judgeContract.getTotalPenalties(
        secondaryGroupHead1
      );
      console.log("Final accumulated penalty:", finalTotal.toString());

      assert.equal(finalTotal.toString(), "17000"); // 10000 + 7000
    });
    it("should update governance power after benign and malicious behaviors", async () => {
      console.log("TEST: Governance Power updates");

      // Pick a test peer
      const peer = secondaryGroupHead1;
      console.log(`Peer: ${peer}`);
      await logMemberStatus(peer);

      // Helper to log governance power
      const logGovPower = async (label) => {
        const power = await governanceTokenContract.getGovernancePower(peer); // adjust if different name
        console.log(`${label} Governance Power: ${power.toString()}`);
        return power;
      };

      // Initial governance power
      let initialPower = await logGovPower("Initial");

      // --- Benign behavior 1 ---
      await accessControlContract1.policyAdd(
        3,
        "benign1.jpg",
        "view",
        "allow",
        { from: primaryHead1 }
      );
      await accessControlContract1.accessControl("benign1.jpg", "view", {
        from: peer,
      });
      await time.increase(time.duration.days(1));
      await time.advanceBlock();
      let afterGood1 = await logGovPower("After 1st benign action");

      // --- Benign behavior 2 ---
      await accessControlContract1.policyAdd(
        3,
        "benign2.jpg",
        "view",
        "allow",
        { from: primaryHead1 }
      );
      await accessControlContract1.accessControl("benign2.jpg", "view", {
        from: peer,
      });
      await time.increase(time.duration.days(1));
      await time.advanceBlock();
      let afterGood2 = await logGovPower("After 2nd benign action");

      // --- Malicious behavior (tampering) ---
      const tx = await accessControlContract1.accessControl(
        "benign2.jpg",
        "delete", // not allowed, triggers malicious activity
        { from: peer }
      );
      const misbehaviorReportedEvent = tx.logs.find(
        (log) => log.event === "MaliciousActivityReported"
      );
      assert.isDefined(
        misbehaviorReportedEvent,
        "MaliciousActivityReported should be emitted"
      );
      console.log(
        "Penalty Applied:",
        misbehaviorReportedEvent.args.penaltyAmount.toString()
      );
      let afterBad = await logGovPower("After malicious action");

      // --- Assertions ---
      assert(
        afterGood1.gt(initialPower),
        "Governance power should increase after benign action"
      );
      assert(
        afterGood2.gt(afterGood1),
        "Governance power should increase again after second benign action"
      );
      assert(
        afterBad.lt(afterGood2),
        "Governance power should decrease after malicious action"
      );
    });
  }
);
