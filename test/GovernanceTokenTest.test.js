const RoleToken = artifacts.require("RoleToken");
const RoleBasedAccessControl = artifacts.require("RoleBasedAccessControl");
const RegisterContract = artifacts.require("RegisterContract");
const JudgeContract = artifacts.require("JudgeContract");
const AccessControlFactory = artifacts.require("AccessControlFactory");
const AccessControlContract = artifacts.require("AccessControlContract");
const GovernanceToken = artifacts.require("GovernanceTokenContract");
const GovernanceTokenERC20 = artifacts.require("GovernanceToken");

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
    let accessControlContract1, accessControlContract2, governanceTokenContract;

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

      // deploy the ERC20 governance token
      govToken = await GovernanceTokenERC20.new();
      governanceTokenContract = await GovernanceToken.new(
        admin,
        judgeContract.address,
        roleBasedAccessControl.address,
        govToken.address,
        roleToken.address
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
      const totalAfter = await judgeContract.getTotalPenalties(
        secondaryGroupHead1
      );
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

    it("should update governance power after benign and malicious behaviors", async () => {
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

      // Simulate time passing
      await time.increase(time.duration.days(2));
      await time.advanceBlock();

      // Access again (benign)
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

      // 🔹 Distribute governance tokens (must be done by admin)
      const tx = await governanceTokenContract.distributeGovernanceTokens({
        from: primaryHead1,
      });
      console.log(`Governance tokens distributed successfully`, tx);
      console.log(
        "Governance token distribution gas used:",
        tx.receipt.gasUsed
      );

      // 🔹 Log each peer’s governance power
      async function logGovPower(peer) {
        const power = await governanceTokenContract.getGovernancePower(peer);
        console.log(`Governance Power of ${peer}: ${power.toString()}`);
        return power;
      }

      const gp1 = await logGovPower(secondaryGroupHead1);
      const gp2 = await logGovPower(secondaryGroupHead2);
      console.log(`→ Governance powers logged successfully`);

      // get members again (however you stored them)
      const members = await roleToken.getAllMembers(); // returns struct[]
      // each has .memberAddress

      console.log("\n--- Governance distributions ---");

      for (let i = 0; i < members.length; i++) {
        const addr = members[i].memberAddress;
        const name = members[i].name;
        const bal = await govToken.balanceOf(addr);
        console.log(
          `${name} => ${web3.utils.fromWei(bal.toString(), "ether")} GOV`
        );
      }
    });
    it("should give higher governance power to a benign peer than a malicious peer", async () => {
      console.log("TEST: Governance Power Comparison - BENIGN > MALICIOUS");

      // Pick two peers: secondaryGroupHead1 (will act benign) and secondaryGroupHead2 (will act malicious)
      const benignPeer = secondaryGroupHead1;
      const maliciousPeer = secondaryGroupHead2;

      // 1️⃣ Simulate benign behavior for benignPeer
      await accessControlContract1.policyAdd(3, "benign.jpg", "view", "allow", {
        from: primaryHead1,
      });
      await accessControlContract1.accessControl("benign.jpg", "view", {
        from: benignPeer,
      });

      // Simulate time passing to avoid "too frequent access" penalties
      await time.increase(time.duration.days(2));
      await time.advanceBlock();

      // 2️⃣ Simulate malicious behavior for maliciousPeer
      await accessControlContract2.policyAdd(
        3,
        "restricted.jpg",
        "view",
        "disallow",
        {
          from: primaryHead2,
        }
      );

      const txMalicious = await accessControlContract2.accessControl(
        "restricted.jpg",
        "view",
        { from: maliciousPeer }
      );

      // Ensure malicious activity was reported
      const event = txMalicious.logs.find(
        (log) => log.event === "MaliciousActivityReported"
      );
      assert.isDefined(event, "Malicious activity should be reported");

      // 3️⃣ Get governance power
      const benignPower = await governanceTokenContract.getGovernancePower(
        benignPeer
      );
      const maliciousPower = await governanceTokenContract.getGovernancePower(
        maliciousPeer
      );

      console.log(
        `Governance Power - BENIGN: ${benignPower.toString()}, MALICIOUS: ${maliciousPower.toString()}`
      );

      // 4️⃣ Assert that benignPeer has higher governance power
      assert(
        benignPower.gt(maliciousPower),
        "Benign peer should have higher governance power than malicious peer"
      );
    });
    it("should measure gas for each internal component", async () => {
      const peer = accounts[1];

      const gasCompliance =
        await governanceTokenContract.measureComplianceGas.call(peer);
      console.log("Gas – Compliance Calculation:", gasCompliance.toString());

      const gasStatus =
        await governanceTokenContract.measureStatusMultiplierGas.call(peer);
      console.log("Gas – Status Multiplier:", gasStatus.toString());

      const gasGovPower =
        await governanceTokenContract.measureGovernancePowerGas.call(peer);
      console.log(
        "Gas – Governance Power Calculation:",
        gasGovPower.toString()
      );

      const gasMint = await governanceTokenContract.measureMintGas.call(
        peer,
        web3.utils.toWei("1")
      );
      console.log("Gas – Minting:", gasMint.toString());

      const gasDistribution =
        await governanceTokenContract.measureDistributionGas.call();
      console.log("Gas – Full Distribution:", gasDistribution.toString());
    });
    it("should update governance power after malicious behaviors", async () => {
      console.log("\n=== MALICIOUS BEHAVIOR TEST ===");

      // Initial statuses
      console.log("Initial Status:");
      await logMemberStatus(primaryHead1);
      await logMemberStatus(secondaryGroupHead2);

      // Add policy first
      await accessControlContract1.policyAdd(
        3,
        "attack.jpg",
        "view",
        "disallow",
        {
          from: primaryHead1,
        }
      );

      // 1️⃣ Attempt malicious access (disallowed policy → triggers MaliciousActivityReported)
      const maliciousTx = await accessControlContract1.accessControl(
        "attack.jpg",
        "view",
        { from: secondaryGroupHead1 }
      );

      console.log("Malicious access gas used:", maliciousTx.receipt.gasUsed);

      // Verify event
      const event = maliciousTx.logs.find(
        (l) => l.event === "MaliciousActivityReported"
      );
      assert.isDefined(event, "Malicious activity should be reported");

      console.log(
        `Malicious Event → Reason: ${
          event.args.reason
        }, Penalty: ${event.args.penaltyAmount.toString()}`
      );

      // 2️⃣ Log updated status after malicious activity
      console.log("\nStatus AFTER malicious behavior:");
      await logMemberStatus(secondaryGroupHead1);

      // 3️⃣ Distribute governance tokens
      const tx = await governanceTokenContract.distributeGovernanceTokens({
        from: primaryHead2,
      });
      console.log("Governance token distribution gas:", tx.receipt.gasUsed);

      // 4️⃣ Compute governance power
      async function logGovPower(peer) {
        const power = await governanceTokenContract.getGovernancePower(peer);
        console.log(`Governance Power for ${peer}: ${power.toString()}`);
        return power;
      }

      const benignPower = await logGovPower(secondaryGroupHead1); // from earlier tests
      const maliciousPower = await logGovPower(secondaryGroupHead2);

      console.log(
        `Governance Comparison → Benign: ${benignPower}, Malicious: ${maliciousPower}`
      );

      // 5️⃣ Print distributions
      const members = await roleToken.getAllMembers();

      console.log(
        "\n--- Governance distributions after malicious behavior ---"
      );
      for (let m of members) {
        const bal = await govToken.balanceOf(m.memberAddress);
        console.log(
          `${m.name} => ${web3.utils.fromWei(bal.toString(), "ether")} GOV`
        );
      }
    });
    it("Execution time for governance mechanism functions", async () => {
      console.log("\n--- EXECUTION TIME MEASUREMENT ---");
      benignPeer = secondaryGroupHead1;

      // 1. Compliance Calc
      await measureFunctionExecutionTime(
        governanceTokenContract.measureComplianceGas,
        benignPeer,
        { from: admin }
      );

      // 2. Status Multiplier
      await measureFunctionExecutionTime(
        governanceTokenContract.measureStatusMultiplierGas,
        benignPeer,
        { from: admin }
      );

      // 3. Governance Power
      await measureFunctionExecutionTime(
        governanceTokenContract.measureGovernancePowerGas,
        benignPeer,
        { from: admin }
      );

      // 4. Minting Cost
      await measureFunctionExecutionTime(
        governanceTokenContract.measureMintGas,
        benignPeer,
        web3.utils.toWei("1", "ether"),
        { from: admin }
      );

      // 5. Full Distribution
      await measureFunctionExecutionTime(
        governanceTokenContract.distributeGovernanceTokens,
        { from: admin }
      );
    });
  }
);
