const { performance } = require("perf_hooks");

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
const XLSX = require("xlsx");
const fs = require("fs");

function exportToExcel(results) {
  const worksheetData = [
    [
      "Peers",
      "Gas Used (With Governance)",
      "Gas Used (Without Governance)",
      "Execution Time With Governance (ms)",
      "Execution Time Without Governance (ms)",
    ],
  ];

  results.forEach((r) => {
    worksheetData.push([
      r.peers,
      r.gasUsedWithGovernance,
      r.gasUsedWithoutGovernance,
      r.executionTimeMsWithGovernance,
      r.executionTimeMsWithoutGovernance,
    ]);
  });

  const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
  const workbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(workbook, worksheet, "Scalability Results");

  XLSX.writeFile(workbook, "governance_scalability_results.xlsx");

  console.log("Excel file generated: governance_scalability_results.xlsx");
}

contract("Governance Token Scalability Analysis", (accounts) => {
  const admin = accounts[0];
  const NETWORK_SIZES = [5, 10, 20, 30, 50];

  /**
   * Deploy fresh system for each experiment run
   */
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

  /**
   * Split selected accounts into:
   * 20% primary, 20% secondary, 60% regular
   */
  function splitPeers(selectedAccounts, peerCount) {
    const primaryCount = Math.max(1, Math.floor(peerCount * 0.2));
    const secondaryCount = Math.max(1, Math.floor(peerCount * 0.2));
    const regularCount = peerCount - primaryCount - secondaryCount;

    const primaryHeads = selectedAccounts.slice(0, primaryCount);
    const secondaryHeads = selectedAccounts.slice(
      primaryCount,
      primaryCount + secondaryCount
    );
    const regularMembers = selectedAccounts.slice(
      primaryCount + secondaryCount,
      primaryCount + secondaryCount + regularCount
    );

    return {
      primaryHeads,
      secondaryHeads,
      regularMembers,
    };
  }

  /**
   * Assign roles dynamically
   */
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

  /**
   * Build a network of given size from Ganache accounts
   */
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

  /**
   * Deploy one valid access control contract
   * using matching type primary + secondary
   */
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

  /**
   * Minimal valid benign behavior
   * Only the registered subject calls accessControl
   */
  async function simulateMinimalBehavior(accInfo) {
    const { primaryHead, secondaryHead, accessControlContract } = accInfo;

    // role 3 = SECONDARY_GROUP_HEAD based on your previous tests
    await accessControlContract.policyAdd(3, "test.jpg", "view", "allow", {
      from: primaryHead,
    });

    await accessControlContract.accessControl("test.jpg", "view", {
      from: secondaryHead,
    });

    // optional time gap to avoid edge-case penalties if needed
    await time.increase(time.duration.days(2));
    await time.advanceBlock();

    await accessControlContract.accessControl("test.jpg", "view", {
      from: secondaryHead,
    });
  }

  /**
   * Measure governance token distribution
   */
  async function measureGovernanceDistribution(governanceTokenContract) {
    const start = performance.now();

    const tx = await governanceTokenContract.distributeGovernanceTokens({
      from: admin,
    });

    const end = performance.now();

    return {
      gasUsed: tx.receipt.gasUsed,
      executionTimeMs: Number((end - start).toFixed(2)),
      tx,
    };
  }
  async function measureWithoutGovernance(accInfo) {
    const { secondaryHead, accessControlContract } = accInfo;

    const start = performance.now();

    const tx = await accessControlContract.accessControl("test.jpg", "view", {
      from: secondaryHead,
    });

    const end = performance.now();

    return {
      gasUsed: tx.receipt.gasUsed,
      executionTimeMs: Number((end - start).toFixed(2)),
    };
  }

  /**
   * Optional helper to log balances after distribution
   */
  async function logGovernanceBalances(govToken, peerAddresses, label) {
    console.log(`\n--- ${label} ---`);
    for (let i = 0; i < peerAddresses.length; i++) {
      const bal = await govToken.balanceOf(peerAddresses[i]);
      console.log(
        `Peer ${i + 1} (${peerAddresses[i]}) => ${web3.utils.fromWei(
          bal.toString(),
          "ether"
        )} GOV`
      );
    }
  }

  it("should generate scalability dataset for governance token distribution", async () => {
    const results = [];

    for (const size of NETWORK_SIZES) {
      console.log(`\n========== Running for ${size} peers ==========`);

      // fresh deployment
      const system = await deploySystem();

      // setup peers
      const network = await setupNetwork(system, size, 1);

      console.log(
        `Network composition => Primary: ${network.primaryHeads.length}, Secondary: ${network.secondaryHeads.length}, Regular: ${network.regularMembers.length}`
      );

      // deploy one valid ACC
      const accInfo = await deploySingleValidACC(system, network);

      // simulate minimal benign activity
      await simulateMinimalBehavior(accInfo);

      // measure governance distribution
      const metrics = await measureGovernanceDistribution(
        system.governanceTokenContract
      );

      // measure without governance
      const baseline = await measureWithoutGovernance(accInfo);

      results.push({
        peers: size,
        gasUsedWithGovernance: metrics.gasUsed,
        gasUsedWithoutGovernance: baseline.gasUsed,
        executionTimeMsWithGovernance: metrics.executionTimeMs,
        executionTimeMsWithoutGovernance: baseline.executionTimeMs,
      });

      console.log(`Peers: ${size}`);
      console.log(`Gas Used: ${metrics.gasUsed}`);
      console.log(`Execution Time: ${metrics.executionTimeMs} ms`);

      // optional: uncomment if you want token balances printed
      // await logGovernanceBalances(system.govToken, network.allPeers, `${size} Peers Distribution`);
    }

    console.log("\n===== FINAL DATASET =====");
    console.log("Peers,GasUsed,ExecutionTimeMs");
    for (const row of results) {
      console.log(`${row.peers},${row.gasUsed},${row.executionTimeMs}`);
    }

    assert.isAtLeast(results.length, 1, "Dataset should not be empty");
    exportToExcel(results);
  });
});
