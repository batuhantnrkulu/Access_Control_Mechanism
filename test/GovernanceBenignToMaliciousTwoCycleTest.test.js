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

contract("Governance Benign To Malicious Over Two Cycles Test", (accounts) => {
  const [admin, primaryHead1, peerZ] = accounts;

  let roleToken;
  let roleBasedAccessControl;
  let registerContract;
  let judgeContract;
  let accessControlFactory;
  let governanceTokenContract;
  let govToken;
  let accZ;

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

    await roleBasedAccessControl.assignRole(peerZ, "peerZ", "type1");

    const tx = await accessControlFactory.deployAccessControlContract(
      primaryHead1,
      peerZ,
      "resourceZ",
      { from: primaryHead1 }
    );

    const accAddress = tx.logs[0].args.accAddress;
    accZ = await AccessControlContract.at(accAddress);
    await roleToken.assignAdminRole(admin, accAddress);

    // Allowed policy for benign behavior
    await accZ.policyAdd(4, "doc", "view", "allow", {
      from: primaryHead1,
    });

    // Disallowed policy for malicious behavior
    await accZ.policyAdd(4, "restricted", "view", "disallow", {
      from: primaryHead1,
    });
  });

  async function waitTwoDays() {
    await time.increase(time.duration.days(2));
    await time.advanceBlock();
  }

  async function logState(label) {
    const member = await roleBasedAccessControl.getMember(peerZ);
    const power = await governanceTokenContract.getGovernancePower(peerZ);
    const govBal = await govToken.balanceOf(peerZ);
    const roleBal = await roleToken.balanceOf(peerZ);

    console.log(
      `${label} | status=${
        member.status
      } | roleToken=${roleBal.toString()} | govPower=${power.toString()} | govBal=${web3.utils.fromWei(
        govBal.toString(),
        "ether"
      )}`
    );
  }

  it("should show peer influence dropping from benign in cycle 1 to malicious in cycle 2", async () => {
    console.log("\n=== CYCLE 1: benign behavior ===");

    // Cycle 1 benign behavior
    await accZ.accessControl("doc", "view", { from: peerZ });
    await waitTwoDays();
    await accZ.accessControl("doc", "view", { from: peerZ });

    const roleBalBeforeCycle1 = await roleToken.balanceOf(peerZ);
    const powerBeforeCycle1 = await governanceTokenContract.getGovernancePower(
      peerZ
    );
    const govBeforeCycle1 = await govToken.balanceOf(peerZ);

    const dist1 = await governanceTokenContract.distributeGovernanceTokens({
      from: admin,
    });

    console.log("Cycle 1 distribution gas:", dist1.receipt.gasUsed);
    await logState("After Cycle 1");

    const memberAfterCycle1 = await roleBasedAccessControl.getMember(peerZ);
    const roleBalAfterCycle1 = await roleToken.balanceOf(peerZ);
    const powerAfterCycle1 = await governanceTokenContract.getGovernancePower(
      peerZ
    );
    const govAfterCycle1 = await govToken.balanceOf(peerZ);

    // Cycle 1 should be positive / active
    assert.equal(
      memberAfterCycle1.status,
      "BENIGN",
      "Peer Z should be benign after cycle 1"
    );

    assert(
      roleBalAfterCycle1.gte(roleBalBeforeCycle1),
      "Role token balance should stay same or increase after benign behavior"
    );

    assert(
      powerAfterCycle1.gte(powerBeforeCycle1),
      "Governance power should stay same or increase after benign cycle"
    );

    console.log("\n=== CYCLE 2: malicious behavior ===");

    // Cycle 2 malicious behavior
    const maliciousTx = await accZ.accessControl("restricted", "view", {
      from: peerZ,
    });

    const maliciousEvent = maliciousTx.logs.find(
      (l) => l.event === "MaliciousActivityReported"
    );
    assert.isDefined(
      maliciousEvent,
      "Cycle 2 should report malicious activity"
    );

    const roleBalBeforeCycle2 = await roleToken.balanceOf(peerZ);
    const powerBeforeCycle2 = await governanceTokenContract.getGovernancePower(
      peerZ
    );
    const govBeforeCycle2 = await govToken.balanceOf(peerZ);

    const dist2 = await governanceTokenContract.distributeGovernanceTokens({
      from: admin,
    });

    console.log("Cycle 2 distribution gas:", dist2.receipt.gasUsed);
    await logState("After Cycle 2");

    const memberAfterCycle2 = await roleBasedAccessControl.getMember(peerZ);
    const roleBalAfterCycle2 = await roleToken.balanceOf(peerZ);
    const powerAfterCycle2 = await governanceTokenContract.getGovernancePower(
      peerZ
    );
    const govAfterCycle2 = await govToken.balanceOf(peerZ);

    // Cycle 2 should collapse influence
    assert.equal(
      memberAfterCycle2.status,
      "MALICIOUS",
      "Peer Z should become malicious in cycle 2"
    );
  });
});
