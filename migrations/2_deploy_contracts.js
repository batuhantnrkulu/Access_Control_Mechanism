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
  const [
    admin,
    primaryHead1, // ph1
    primaryHead2, // ph2
    secondaryGroupHead1, // sh1
    secondaryGroupHead2, // sh2
    regularMember1, // rm1
    regularMember2, // rm2
    regularMember3, // rm3
    regularMember4, // rm4
    otherAccount,
  ] = accounts;

  let roleToken,
    roleBasedAccessControl,
    registerContract,
    judgeContract,
    accessControlFactory,
    accessControlContract1,
    accessControlContract2;

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

  // Assign roles to primary heads and regular members using assignRole
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
    "type1"
  );
  await roleBasedAccessControl.assignRole(
    regularMember3,
    "regular_member3",
    "type3"
  );
  await roleBasedAccessControl.assignRole(
    regularMember4,
    "regular_member4",
    "type4"
  );

  // Deploy AccessControlContract for different subjects and objects
  const tx1 = await accessControlFactory.deployAccessControlContract(
    primaryHead1,
    secondaryGroupHead1,
    "picture"
  );
  const accAddress1 = tx1.logs[0].args.accAddress;
  accessControlContract1 = await AccessControlContract.at(accAddress1);

  // Assign admin role to the first AccessControlContract
  await roleToken.assignAdminRole(admin, accAddress1);

  const tx2 = await accessControlFactory.deployAccessControlContract(
    primaryHead2,
    secondaryGroupHead2,
    "movie"
  );
  const accAddress2 = tx2.logs[0].args.accAddress;
  accessControlContract2 = await AccessControlContract.at(accAddress2);

  // Assign admin role to the second AccessControlContract
  await roleToken.assignAdminRole(admin, accAddress2);

  // Verification: Check if the registered contracts match the deployed addresses
  const registeredAddress1 = await registerContract.getAccessControlContract(
    primaryHead1,
    secondaryGroupHead1,
    "picture"
  );
  console.log(`Registered Address 1: ${registeredAddress1}`);
  console.log(`Deployed Address 1: ${accAddress1}`);
  console.assert(
    registeredAddress1 === accAddress1,
    "Error: Address 1 does not match!"
  );

  const registeredAddress2 = await registerContract.getAccessControlContract(
    primaryHead2,
    secondaryGroupHead2,
    "movie"
  );
  console.log(`Registered Address 2: ${registeredAddress2}`);
  console.log(`Deployed Address 2: ${accAddress2}`);
  console.assert(
    registeredAddress2 === accAddress2,
    "Error: Address 2 does not match!"
  );
};
