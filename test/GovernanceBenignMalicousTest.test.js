const { performance } = require("perf_hooks");
const XLSX = require("xlsx");

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

contract("Benign vs Malicious Scalability Dataset", (accounts) => {
  const admin = accounts[0];
  const NETWORK_SIZES = [5, 10, 20, 30, 50];

  async function deploySystem() {
    const roleToken = await RoleToken.new(admin);
    await roleToken.assignAdminRole(admin, roleToken.address);

    const roleBasedAccessControl = await RoleBasedAccessControl.new(
      roleToken.address,
      admin
    );
    await roleToken.assignAdminRole(admin, roleBasedAccessControl.address);

    const registerContract = await RegisterContract.new(
      admin,
      roleBasedAccessControl.address
    );
    await roleToken.assignAdminRole(admin, registerContract.address);

    const judgeContract = await JudgeContract.new(
      admin,
      roleBasedAccessControl.address
    );
    await roleToken.assignAdminRole(admin, judgeContract.address);

    const accessControlFactory = await AccessControlFactory.new(
      admin,
      roleBasedAccessControl.address,
      registerContract.address,
      judgeContract.address
    );
    await roleToken.assignAdminRole(admin, accessControlFactory.address);

    const govToken = await GovernanceTokenERC20.new();

    const governanceTokenContract = await GovernanceTokenContract.new(
      admin,
      judgeContract.address,
      roleBasedAccessControl.address,
      govToken.address,
      roleToken.address
    );

    return {
      roleToken,
      roleBasedAccessControl,
      registerContract,
      judgeContract,
      accessControlFactory,
      govToken,
      governanceTokenContract,
    };
  }

  function splitPeers(selectedAccounts, peerCount) {
    const primaryCount = Math.max(1, Math.floor(peerCount * 0.2));
    const secondaryCount = Math.max(1, Math.floor(peerCount * 0.2));
    const regularCount = peerCount - primaryCount - secondaryCount;

    return {
      primaryHeads: selectedAccounts.slice(0, primaryCount),
      secondaryHeads: selectedAccounts.slice(
        primaryCount,
        primaryCount + secondaryCount
      ),
      regularMembers: selectedAccounts.slice(
        primaryCount + secondaryCount,
        primaryCount + secondaryCount + regularCount
      ),
    };
  }

  async function assignRoles(roleBasedAccessControl, peers) {
    const { primaryHeads, secondaryHeads, regularMembers } = peers;

    for (let i = 0; i < primaryHeads.length; i++) {
      await roleBasedAccessControl.assignRole(
        primaryHeads[i],
        `primary_head${i + 1}`,
        `type${(i % 5) + 1}`
      );
    }

    for (let i = 0; i < secondaryHeads.length; i++) {
      await roleBasedAccessControl.assignRole(
        secondaryHeads[i],
        `secondary_group_head${i + 1}`,
        `type${(i % 5) + 1}`
      );
    }

    for (let i = 0; i < regularMembers.length; i++) {
      await roleBasedAccessControl.assignRole(
        regularMembers[i],
        `regular_member${i + 1}`,
        `type${(i % 5) + 1}`
      );
    }
  }

  async function setupNetwork(system, peerCount, accountOffset = 1) {
    const selectedAccounts = accounts.slice(
      accountOffset,
      accountOffset + peerCount
    );

    assert.equal(
      selectedAccounts.length,
      peerCount,
      `Not enough accounts. Needed ${peerCount}, got ${selectedAccounts.length}`
    );

    const peers = splitPeers(selectedAccounts, peerCount);
    await assignRoles(system.roleBasedAccessControl, peers);

    return {
      ...peers,
      allPeers: selectedAccounts,
    };
  }

  async function deploySingleValidACC(system, network) {
    const primaryHead = network.primaryHeads[0];
    const secondaryHead = network.secondaryHeads[0];

    const tx = await system.accessControlFactory.deployAccessControlContract(
      primaryHead,
      secondaryHead,
      "resource",
      { from: primaryHead }
    );

    const accAddress = tx.logs[0].args.accAddress;
    const accessControlContract = await AccessControlContract.at(accAddress);

    await system.roleToken.assignAdminRole(admin, accAddress);

    return {
      primaryHead,
      secondaryHead,
      accessControlContract,
    };
  }

  async function runBenignScenario(system, accInfo) {
    const { primaryHead, secondaryHead, accessControlContract } = accInfo;

    const t0 = performance.now();

    const txPolicy = await accessControlContract.policyAdd(
      3,
      "test.jpg",
      "view",
      "allow",
      { from: primaryHead }
    );

    const txAccess = await accessControlContract.accessControl(
      "test.jpg",
      "view",
      { from: secondaryHead }
    );

    const txDist =
      await system.governanceTokenContract.distributeGovernanceTokens({
        from: admin,
      });

    const t1 = performance.now();

    return {
      policyGas: txPolicy.receipt.gasUsed,
      accessGas: txAccess.receipt.gasUsed,
      distributionGas: txDist.receipt.gasUsed,
      totalGas:
        txPolicy.receipt.gasUsed +
        txAccess.receipt.gasUsed +
        txDist.receipt.gasUsed,
      totalTimeMs: Number((t1 - t0).toFixed(2)),
    };
  }

  async function runMaliciousScenario(system, accInfo) {
    const { primaryHead, secondaryHead, accessControlContract } = accInfo;

    const t0 = performance.now();

    const txPolicy = await accessControlContract.policyAdd(
      3,
      "test.jpg",
      "view",
      "disallow",
      { from: primaryHead }
    );

    const txAttack = await accessControlContract.accessControl(
      "test.jpg",
      "view",
      { from: secondaryHead }
    );

    const maliciousEvent = txAttack.logs.find(
      (log) => log.event === "MaliciousActivityReported"
    );
    assert.isDefined(maliciousEvent, "Malicious event should be emitted");

    const txDist =
      await system.governanceTokenContract.distributeGovernanceTokens({
        from: admin,
      });

    const t1 = performance.now();

    return {
      policyGas: txPolicy.receipt.gasUsed,
      accessGas: txAttack.receipt.gasUsed,
      distributionGas: txDist.receipt.gasUsed,
      totalGas:
        txPolicy.receipt.gasUsed +
        txAttack.receipt.gasUsed +
        txDist.receipt.gasUsed,
      totalTimeMs: Number((t1 - t0).toFixed(2)),
    };
  }

  function exportToExcel(results) {
    const worksheetData = [
      [
        "Peers",
        "Benign Policy Gas",
        "Benign Access Gas",
        "Benign Distribution Gas",
        "Benign Total Gas",
        "Malicious Policy Gas",
        "Malicious Access Gas",
        "Malicious Distribution Gas",
        "Malicious Total Gas",
        "Benign Total Time (ms)",
        "Malicious Total Time (ms)",
      ],
    ];

    results.forEach((r) => {
      worksheetData.push([
        r.peers,
        r.benign.policyGas,
        r.benign.accessGas,
        r.benign.distributionGas,
        r.benign.totalGas,
        r.malicious.policyGas,
        r.malicious.accessGas,
        r.malicious.distributionGas,
        r.malicious.totalGas,
        r.benign.totalTimeMs,
        r.malicious.totalTimeMs,
      ]);
    });

    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Benign vs Malicious");
    XLSX.writeFile(workbook, "benign_malicious_scalability.xlsx");

    console.log("Excel file generated: benign_malicious_scalability.xlsx");
  }

  it("should generate benign vs malicious dataset across network sizes", async () => {
    const results = [];

    for (const size of NETWORK_SIZES) {
      console.log(`\n===== ${size} peers =====`);

      // BENIGN
      const benignSystem = await deploySystem();
      const benignNetwork = await setupNetwork(benignSystem, size, 1);
      const benignACC = await deploySingleValidACC(benignSystem, benignNetwork);
      const benignMetrics = await runBenignScenario(benignSystem, benignACC);

      // MALICIOUS
      const maliciousSystem = await deploySystem();
      const maliciousNetwork = await setupNetwork(maliciousSystem, size, 1);
      const maliciousACC = await deploySingleValidACC(
        maliciousSystem,
        maliciousNetwork
      );
      const maliciousMetrics = await runMaliciousScenario(
        maliciousSystem,
        maliciousACC
      );

      results.push({
        peers: size,
        benign: benignMetrics,
        malicious: maliciousMetrics,
      });

      console.log(
        `Peers=${size}, BenignTotalGas=${benignMetrics.totalGas}, MaliciousTotalGas=${maliciousMetrics.totalGas}`
      );
    }

    exportToExcel(results);
    assert.isAbove(results.length, 0, "Dataset should not be empty");
  });
});
