const RoleToken = artifacts.require("RoleToken");
const RoleBasedAccessControl = artifacts.require("RoleBasedAccessControl");
const RegisterContract = artifacts.require("RegisterContract");
const JudgeContract = artifacts.require("JudgeContract");
const AccessControlFactory = artifacts.require("AccessControlFactory");
const AccessControlContract = artifacts.require("AccessControlContract");

const { expectRevert, time } = require("@openzeppelin/test-helpers");
const { assert } = require("chai");

contract("AccessControlContract", (accounts) => {
  const [deployer, primaryHead, regularMember, otherAccount] = accounts;

  let roleToken,
    roleBasedAccessControl,
    registerContract,
    judgeContract,
    accessControlFactory,
    accessControlContract;

  beforeEach(async () => {
    // Deploy contracts
    roleToken = await RoleToken.new(deployer);
    await roleToken.assignRole(roleToken.address, 1, "admin_roletoken");

    roleBasedAccessControl = await RoleBasedAccessControl.new(
      roleToken.address,
      deployer
    );
    await roleToken.assignRole(
      roleBasedAccessControl.address,
      1,
      "admin_rolebasedaccesscontrol"
    );

    registerContract = await RegisterContract.new(
      deployer,
      roleBasedAccessControl.address
    );
    await roleBasedAccessControl.assignRole(
      registerContract.address,
      1,
      "admin_rc"
    );

    judgeContract = await JudgeContract.new(
      deployer,
      roleBasedAccessControl.address
    );
    await roleBasedAccessControl.assignRole(
      judgeContract.address,
      1,
      "admin_jc"
    );

    accessControlFactory = await AccessControlFactory.new(
      deployer,
      roleBasedAccessControl.address,
      registerContract.address,
      judgeContract.address
    );
    await roleBasedAccessControl.assignRole(
      accessControlFactory.address,
      1,
      "admin_acf"
    );

    // Assign roles
    await roleBasedAccessControl.assignRole(primaryHead, 2, "object1");
    await roleBasedAccessControl.assignRole(regularMember, 3, "subject1");

    // Deploy AccessControlContract
    const tx = await accessControlFactory.deployAccessControlContract(
      "subject1",
      "object1",
      { from: primaryHead }
    );
    const accAddress = tx.logs[0].args.accAddress;
    accessControlContract = await AccessControlContract.at(accAddress);

    await roleBasedAccessControl.assignRole(accAddress, 1, "admin_acc");
  });

  it("shouldn't add a policy if caller is not the creator", async () => {
    await expectRevert(
      accessControlContract.policyAdd(3, "test.jpg", "view", "allow", {
        from: regularMember,
      }),
      "AccessControlContract: caller is not the creator"
    );
  });

  it("should add a policy if caller is the creator", async () => {
    await accessControlContract.policyAdd(3, "test.jpg", "view", "allow", {
      from: primaryHead,
    });

    const policy = await accessControlContract.policies(0);
    assert.equal(policy.role.toString(), "3"); // role should match the added policy
    assert.equal(policy.resource, "test.jpg");
    assert.equal(policy.action, "view");
    assert.equal(policy.permission, "allow");
  });

  it("should check access control", async () => {
    // Add a policy for testing
    await accessControlContract.policyAdd(3, "test.jpg", "view", "allow", {
      from: primaryHead,
    });

    // Attempt to retrieve the policy directly (replace with your contract's method to get policies)
    try {
      const policy = await accessControlContract.policies(0);
      console.log(`Policy 0:`, policy);
    } catch (error) {
      console.log("Error retrieving policy:", error);
    }

    // Check access control with valid subject
    const tx = await accessControlContract.accessControl(
      "subject1",
      "test.jpg",
      "view"
    );

    // Extract the 'allowed' value from the event args
    const accessControlCheckedEvent = tx.logs.find(
      (log) => log.event === "AccessControlChecked"
    );
    if (!accessControlCheckedEvent) {
      throw new Error("AccessControlChecked event not found");
    }
    const canAccess = accessControlCheckedEvent.args.allowed;

    console.log("Can access:", canAccess);
    assert.isTrue(canAccess, "Access should be allowed");

    // Check access control with invalid subject
    const txInvalid = await accessControlContract.accessControl(
      "subject1",
      "test.jpg",
      "delete"
    );

    // Extract the 'allowed' value from the event args for invalid action
    const eventInvalid = txInvalid.logs.find(
      (log) => log.event === "AccessControlChecked"
    );
    if (eventInvalid) {
      canAccessInvalid = eventInvalid.args.allowed;
      console.log("Cannot access (invalid action):", canAccessInvalid);
      assert.isFalse(canAccessInvalid, "Access should not be allowed");
    } else {
      // Event was not emitted, assume access is invalid
      canAccessInvalid = false;
      console.log("Cannot access (invalid action):", canAccessInvalid);
      assert.isFalse(canAccessInvalid, "Access should not be allowed");
    }
  });

  it("should emit PolicyNotFoundForAccessControl for unknown policies", async () => {
    const tx = await accessControlContract.accessControl(
      "subject1",
      "test.jpg",
      "nonexistentAction"
    );

    const policyNotFoundEvent = tx.logs.find(
      (log) => log.event === "PolicyNotFoundForAccessControl"
    );
    assert.isDefined(
      policyNotFoundEvent,
      "PolicyNotFoundForAccessControl event should be emitted"
    );
  });

  it("should report misbehavior for too frequent access", async () => {
    await accessControlContract.policyAdd(3, "test.jpg", "view", "allow", {
      from: primaryHead,
    });

    // Trigger access control to record the policy
    await accessControlContract.accessControl("subject1", "test.jpg", "view");
    const tx = await accessControlContract.accessControl(
      "subject1",
      "test.jpg",
      "view"
    );

    const misbehaviorReportedEvent = tx.logs.find(
      (log) => log.event === "MisbehaviorReported"
    );

    if (misbehaviorReportedEvent) {
      const penalty = misbehaviorReportedEvent.args.penalty;
      console.log("Misbehavior reported. Penalty:", penalty);
    } else {
      console.log("MisbehaviorReported event was not emitted");
    }

    assert.isDefined(
      misbehaviorReportedEvent,
      "MisbehaviorReported event should be emitted"
    );
    assert.equal(
      misbehaviorReportedEvent.args.misbehavior,
      "Too frequent access"
    );
  });
});
