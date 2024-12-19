const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("RoleToken Contract", function () {
  let RoleToken, roleToken, owner, addr1, addr2, addr3;

  beforeEach(async function () {
    // Get the ContractFactory and Signers
    RoleToken = await ethers.getContractFactory("RoleToken");
    [owner, addr1, addr2, addr3] = await ethers.getSigners();

    // Deploy the contract
    roleToken = await RoleToken.deploy(owner.address);
    await roleToken.deployed();
  });

  describe("Deployment", function () {
    it("Should assign the deployer as the Admin", async function () {
      expect(await roleToken.getRole(owner.address)).to.equal(1); // Role.ADMIN = 1
    });

    it("Should mint initial tokens to the admin", async function () {
      const adminBalance = await roleToken.balanceOf(owner.address);
      expect(adminBalance).to.equal(ethers.utils.parseEther("10000000"));
    });
  });

  describe("Role Assignment", function () {
    it("Should assign Primary Group Head role when no Primary Head exists", async function () {
      await roleToken
        .connect(owner)
        .assignRole(addr1.address, "Alice", "Type1");
      const role = await roleToken.getRole(addr1.address);
      expect(role).to.equal(2); // Role.PRIMARY_GROUP_HEAD = 2
    });

    it("Should assign Secondary Group Head when Primary exists", async function () {
      await roleToken
        .connect(owner)
        .assignRole(addr1.address, "Alice", "Type1");
      await roleToken.connect(owner).assignRole(addr2.address, "Bob", "Type1");
      const role = await roleToken.getRole(addr2.address);
      expect(role).to.equal(3); // Role.SECONDARY_GROUP_HEAD = 3
    });

    it("Should assign Regular Member when Primary and Secondary exist", async function () {
      await roleToken
        .connect(owner)
        .assignRole(addr1.address, "Alice", "Type1");
      await roleToken.connect(owner).assignRole(addr2.address, "Bob", "Type1");
      await roleToken
        .connect(owner)
        .assignRole(addr3.address, "Charlie", "Type1");
      const role = await roleToken.getRole(addr3.address);
      expect(role).to.equal(4); // Role.REGULAR_MEMBER = 4
    });

    it("Should mint correct token amount upon role assignment", async function () {
      await roleToken
        .connect(owner)
        .assignRole(addr1.address, "Alice", "Type1");
      const primaryHeadBalance = await roleToken.balanceOf(addr1.address);
      expect(primaryHeadBalance).to.equal(ethers.utils.parseEther("1000000"));

      await roleToken.connect(owner).assignRole(addr2.address, "Bob", "Type1");
      const secondaryHeadBalance = await roleToken.balanceOf(addr2.address);
      expect(secondaryHeadBalance).to.equal(ethers.utils.parseEther("500000"));

      await roleToken
        .connect(owner)
        .assignRole(addr3.address, "Charlie", "Type1");
      const regularMemberBalance = await roleToken.balanceOf(addr3.address);
      expect(regularMemberBalance).to.equal(ethers.utils.parseEther("100000"));
    });
  });

  describe("Admin Role and Permissions", function () {
    it("Should allow only Admin to assign Admin role", async function () {
      await expect(
        roleToken.connect(addr1).assignAdminRole(owner.address, addr1.address)
      ).to.be.revertedWith("Access denied: Not an Admin");

      await roleToken
        .connect(owner)
        .assignAdminRole(owner.address, addr1.address);
      expect(await roleToken.getRole(addr1.address)).to.equal(1); // Role.ADMIN = 1
    });

    it("Should enable and disable the contract only by Admin", async function () {
      await roleToken.connect(owner).disableContract();
      expect(await roleToken.contractEnabled()).to.equal(false);

      await expect(
        roleToken.connect(addr1).enableContract()
      ).to.be.revertedWith("Access denied: Not an Admin");

      await roleToken.connect(owner).enableContract();
      expect(await roleToken.contractEnabled()).to.equal(true);
    });
  });

  describe("Role Swapping and Revocation", function () {
    beforeEach(async function () {
      await roleToken
        .connect(owner)
        .assignRole(addr1.address, "Alice", "Type1");
      await roleToken.connect(owner).assignRole(addr2.address, "Bob", "Type1");
    });

    it("Should allow swapping roles between two accounts", async function () {
      const role1Before = await roleToken.getRole(addr1.address);
      const role2Before = await roleToken.getRole(addr2.address);

      await roleToken.connect(owner).swapRole(addr1.address, addr2.address);

      const role1After = await roleToken.getRole(addr1.address);
      const role2After = await roleToken.getRole(addr2.address);

      expect(role1Before).to.not.equal(role1After);
      expect(role2Before).to.not.equal(role2After);
    });

    it("Should revoke roles and burn tokens", async function () {
      await roleToken.connect(owner).revokeRole(addr2.address);
      expect(await roleToken.getRole(addr2.address)).to.equal(0); // Role.NONE = 0
      expect(await roleToken.balanceOf(addr2.address)).to.equal(0); // Tokens should be burned
    });
  });
});
