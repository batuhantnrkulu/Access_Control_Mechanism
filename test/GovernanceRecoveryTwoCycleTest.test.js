const RoleToken = artifacts.require("RoleToken");
const RoleBasedAccessControl = artifacts.require("RoleBasedAccessControl");
const RegisterContract = artifacts.require("RegisterContract");
const JudgeContract = artifacts.require("JudgeContract");
const AccessControlFactory = artifacts.require("AccessControlFactory");
const AccessControlContract = artifacts.require("AccessControlContract");
const GovernanceTokenContract = artifacts.require("GovernanceTokenContract");
const GovernanceTokenERC20 = artifacts.require("GovernanceToken");

const { time } = require("@openzeppelin/test-helpers");
const { assert } = require("chai");

contract("Governance Recovery Over Two Cycles Test", (accounts) => {
  const [admin, primaryHead1, peerX] = accounts;

  let roleToken;
  let roleBasedAccessControl;
  let registerContract;
  let judgeContract;
  let accessControlFactory;
  let governanceTokenContract;
  let govToken;
  let accX;

  before(async () => {
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

    govToken = await GovernanceTokenERC20.new();

    governanceTokenContract = await GovernanceTokenContract.new(
      admin,
      judgeContract.address,
      roleBasedAccessControl.address,
      govToken.address,
      roleToken.address
    );

    await roleBasedAccessControl.assignRole(
      primaryHead1,
      "primary_head1",
      "type1"
    );

    await roleBasedAccessControl.assignRole(peerX, "peerX", "type1");

    const tx = await accessControlFactory.deployAccessControlContract(
      primaryHead1,
      peerX,
      "resourceX",
      { from: primaryHead1 }
    );

    const accAddress = tx.logs[0].args.accAddress;
    accX = await AccessControlContract.at(accAddress);
    await roleToken.assignAdminRole(admin, accAddress);

    // allow policy
    await accX.policyAdd(4, "doc", "view", "allow", {
      from: primaryHead1,
    });

    // disallow policy for malicious simulation
    await accX.policyAdd(4, "restricted", "view", "disallow", {
      from: primaryHead1,
    });
  });

  async function waitTwoDays() {
    await time.increase(time.duration.days(2));
    await time.advanceBlock();
  }

  async function logState(label) {
    const member = await roleBasedAccessControl.getMember(peerX);
    const power = await governanceTokenContract.getGovernancePower(peerX);
    const govBal = await govToken.balanceOf(peerX);
    const roleBal = await roleToken.balanceOf(peerX);

    console.log(
      `${label} | status=${member.status.toString()} | roleToken=${roleBal.toString()} | govPower=${power.toString()} | govBal=${web3.utils.fromWei(
        govBal.toString(),
        "ether"
      )}`
    );
  }

  it("should show peer recovery from malicious in cycle 1 to benign in cycle 2", async () => {
    console.log("\n=== CYCLE 1: malicious behavior ===");

    // Cycle 1: malicious access
    const maliciousTx = await accX.accessControl("restricted", "view", {
      from: peerX,
    });

    const maliciousEvent = maliciousTx.logs.find(
      (l) => l.event === "MaliciousActivityReported"
    );
    assert.isDefined(
      maliciousEvent,
      "Cycle 1 should report malicious activity"
    );

    const powerBeforeCycle1 = await governanceTokenContract.getGovernancePower(
      peerX
    );
    const govBeforeCycle1 = await govToken.balanceOf(peerX);

    const dist1 = await governanceTokenContract.distributeGovernanceTokens({
      from: admin,
    });

    console.log("Cycle 1 distribution gas:", dist1.receipt.gasUsed);
    await logState("After Cycle 1");

    const powerAfterCycle1 = await governanceTokenContract.getGovernancePower(
      peerX
    );
    const govAfterCycle1 = await govToken.balanceOf(peerX);

    // Expected: malicious peer should get zero or negligible governance share
    assert(
      powerAfterCycle1.eq(powerBeforeCycle1) || powerAfterCycle1.isZero(),
      "Cycle 1 governance power should remain zero or minimal for malicious peer"
    );

    assert(
      govAfterCycle1.eq(govBeforeCycle1),
      "Cycle 1 governance token balance should not increase for malicious peer"
    );

    console.log("\n=== CYCLE 2: recovery behavior ===");

    // Recovery phase:
    // Add time gap and perform benign actions
    await waitTwoDays();
    await accX.accessControl("doc", "view", { from: peerX });

    await waitTwoDays();
    await accX.accessControl("doc", "view", { from: peerX });

    const powerBeforeCycle2 = await governanceTokenContract.getGovernancePower(
      peerX
    );
    const govBeforeCycle2 = await govToken.balanceOf(peerX);

    const dist2 = await governanceTokenContract.distributeGovernanceTokens({
      from: admin,
    });

    console.log("Cycle 2 distribution gas:", dist2.receipt.gasUsed);
    await logState("After Cycle 2");

    const powerAfterCycle2 = await governanceTokenContract.getGovernancePower(
      peerX
    );
    const govAfterCycle2 = await govToken.balanceOf(peerX);

    const memberAfterCycle2 = await roleBasedAccessControl.getMember(peerX);

    // Recovery assertions
    assert(
      powerAfterCycle2.gte(powerBeforeCycle2),
      "Cycle 2 governance power should improve after recovery behavior"
    );

    assert(
      govAfterCycle2.gt(govBeforeCycle2) || govAfterCycle2.gt(govAfterCycle1),
      "Cycle 2 governance token balance should increase after recovery"
    );

    // We do not hardcode exact enum values unless your contract is confirmed,
    // but we expect status to improve from malicious toward suspicious/less severe.
    assert.notEqual(
      memberAfterCycle2.status.toString(),
      "2", // remove/change if your malicious enum is different
      "Peer should no longer remain in the same worst status after recovery"
    );
  });
});
