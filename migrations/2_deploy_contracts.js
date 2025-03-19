const RoleToken = artifacts.require("RoleToken");
const RoleBasedAccessControl = artifacts.require("RoleBasedAccessControl");
const RegisterContract = artifacts.require("RegisterContract");
const JudgeContract = artifacts.require("JudgeContract");
const AccessControlFactory = artifacts.require("AccessControlFactory");
const AccessControlContract = artifacts.require("AccessControlContract");
const TableAccessControlContract = artifacts.require(
  "TableAccessControlContract"
);

module.exports = async function (deployer, network, accounts) {
  // Use the specified account names
  const [admin] = accounts;

  let roleToken,
    roleBasedAccessControl,
    registerContract,
    judgeContract,
    accessControlFactory,
    tableAccessControlContract;

  // Deploy contracts
  roleToken = await RoleToken.new(admin);
  await roleToken.assignAdminRole(roleToken.address);

  roleBasedAccessControl = await RoleBasedAccessControl.new(
    roleToken.address,
    admin
  );
  await roleToken.assignAdminRole(roleBasedAccessControl.address);

  registerContract = await RegisterContract.new(
    admin,
    roleBasedAccessControl.address
  );
  await roleToken.assignAdminRole(registerContract.address);

  judgeContract = await JudgeContract.new(
    admin,
    roleBasedAccessControl.address
  );
  await roleToken.assignAdminRole(judgeContract.address);

  accessControlFactory = await AccessControlFactory.new(
    admin,
    roleBasedAccessControl.address,
    registerContract.address,
    judgeContract.address
  );
  await roleToken.assignAdminRole(accessControlFactory.address);

  tableAccessControlContract = await TableAccessControlContract.new(
    roleBasedAccessControl.address,
    judgeContract.address,
    registerContract.address,
    admin
  );
  await roleToken.assignAdminRole(tableAccessControlContract.address);

  console.log(`RoleToken deployed at: ${roleToken.address}`);
  console.log(
    `RoleBasedAccessControl deployed at: ${roleBasedAccessControl.address}`
  );
  console.log(`RegisterContract deployed at: ${registerContract.address}`);
  console.log(`JudgeContract deployed at: ${judgeContract.address}`);
  console.log(
    `AccessControlFactory deployed at: ${accessControlFactory.address}`
  );
  console.log(
    `TableAccessControlContract deployed at: ${tableAccessControlContract.address}`
  );
};
