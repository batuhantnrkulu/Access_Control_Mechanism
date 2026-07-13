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

contract("Governance Distribution Table Test", (accounts) => {
  const [admin, primaryHead1, primaryHead2, peerA, peerB, peerC, peerD, peerE] =
    accounts;

  let roleToken;
  let roleBasedAccessControl;
  let registerContract;
  let judgeContract;
  let accessControlFactory;
  let governanceTokenContract;
  let govToken;

  let accA;
  let accB;
  let accC;
  let accD;
  let accE;

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

    // Assign roles
    await roleBasedAccessControl.assignRole(
      primaryHead1,
      "primary_head1",
      "type1"
    );
    await roleBasedAccessControl.assignRole(
      primaryHead2,
      "primary_head2",
      "type1"
    );

    await roleBasedAccessControl.assignRole(peerA, "peerA", "type1");
    await roleBasedAccessControl.assignRole(peerB, "peerB", "type1");
    await roleBasedAccessControl.assignRole(peerC, "peerC", "type1");
    await roleBasedAccessControl.assignRole(peerD, "peerD", "type1");
    await roleBasedAccessControl.assignRole(peerE, "peerE", "type1");
  });

  async function deployACCForPeer(primaryHead, peer, resourceName) {
    const tx = await accessControlFactory.deployAccessControlContract(
      primaryHead,
      peer,
      resourceName,
      { from: primaryHead }
    );

    const accAddress = tx.logs[0].args.accAddress;
    const acc = await AccessControlContract.at(accAddress);
    await roleToken.assignAdminRole(admin, accAddress);

    return acc;
  }

  async function addPolicies() {
    accA = await deployACCForPeer(primaryHead1, peerA, "resourceA");
    accB = await deployACCForPeer(primaryHead1, peerB, "resourceB");
    accC = await deployACCForPeer(primaryHead1, peerC, "resourceC");
    accD = await deployACCForPeer(primaryHead1, peerD, "resourceD");
    accE = await deployACCForPeer(primaryHead1, peerE, "resourceE");

    await accA.policyAdd(4, "doc", "view", "allow", { from: primaryHead1 });
    await accB.policyAdd(4, "doc", "view", "allow", { from: primaryHead1 });
    await accC.policyAdd(4, "doc", "view", "allow", { from: primaryHead1 });
    await accD.policyAdd(4, "doc", "view", "allow", { from: primaryHead1 });
    await accE.policyAdd(4, "doc", "view", "allow", { from: primaryHead1 });

    await accC.policyAdd(4, "restricted", "view", "disallow", {
      from: primaryHead1,
    });
    await accE.policyAdd(4, "restricted", "view", "disallow", {
      from: primaryHead1,
    });
  }

  async function waitTwoDays() {
    await time.increase(time.duration.days(2));
    await time.advanceBlock();
  }

  async function logPeer(label, peer) {
    const govPower = await governanceTokenContract.getGovernancePower(peer);
    const govBal = await govToken.balanceOf(peer);
    const member = await roleBasedAccessControl.getMember(peer);

    console.log(
      `${label} | status=${member.status.toString()} | power=${govPower.toString()} | gov=${web3.utils.fromWei(
        govBal.toString(),
        "ether"
      )}`
    );
  }

  it("should distribute governance tokens according to benign vs suspicious behavior pattern", async () => {
    await addPolicies();

    // Peer A: strongly benign
    await accA.accessControl("doc", "view", { from: peerA });
    await waitTwoDays();
    await accA.accessControl("doc", "view", { from: peerA });
    await waitTwoDays();
    await accA.accessControl("doc", "view", { from: peerA });

    // Peer B: moderately benign
    await accB.accessControl("doc", "view", { from: peerB });
    await waitTwoDays();
    await accB.accessControl("doc", "view", { from: peerB });

    // Peer C: mixed
    await accC.accessControl("doc", "view", { from: peerC });
    await waitTwoDays();
    await accC.accessControl("restricted", "view", { from: peerC });

    // Peer D: one benign access
    await accD.accessControl("doc", "view", { from: peerD });

    // Peer E: malicious / suspicious
    await accE.accessControl("restricted", "view", { from: peerE });

    const tx = await governanceTokenContract.distributeGovernanceTokens({
      from: admin,
    });

    console.log("Distribution gas used:", tx.receipt.gasUsed);

    await logPeer("Peer A", peerA);
    await logPeer("Peer B", peerB);
    await logPeer("Peer C", peerC);
    await logPeer("Peer D", peerD);
    await logPeer("Peer E", peerE);

    const powerA = await governanceTokenContract.getGovernancePower(peerA);
    const powerB = await governanceTokenContract.getGovernancePower(peerB);
    const powerC = await governanceTokenContract.getGovernancePower(peerC);
    const powerD = await governanceTokenContract.getGovernancePower(peerD);
    const powerE = await governanceTokenContract.getGovernancePower(peerE);

    const balA = await govToken.balanceOf(peerA);
    const balB = await govToken.balanceOf(peerB);
    const balC = await govToken.balanceOf(peerC);
    const balD = await govToken.balanceOf(peerD);
    const balE = await govToken.balanceOf(peerE);

    assert(powerA.gte(powerB), "Peer A should be >= Peer B");
    assert(powerB.gte(powerC), "Peer B should be >= Peer C");
    assert(powerC.gte(powerE), "Peer C should be >= Peer E");
    assert(powerD.gte(powerE), "Peer D should be >= Peer E");

    assert(balA.gte(balB), "Peer A should receive >= Peer B");
    assert(balB.gte(balC), "Peer B should receive >= Peer C");
    assert(balC.gte(balE), "Peer C should receive >= Peer E");
    assert(balD.gte(balE), "Peer D should receive >= Peer E");
  });
});
