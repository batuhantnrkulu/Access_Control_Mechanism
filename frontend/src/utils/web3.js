import { ethers } from "ethers";
import AccessControlContract from "../contracts/AccessControlContract.json";
import AccessControlFactory from "../contracts/AccessControlFactory.json";
import RoleBasedAccessControl from "../contracts/RoleBasedAccessControl.json";
import TableAccessControlContract from "../contracts/TableAccessControlContract.json";
import JudgeContract from "../contracts/JudgeContract.json";
import RoleToken from "../contracts/RoleToken.json";
import addresses from "../contracts/addresses.json";
import RegisterContract from "../contracts/RegisterContract.json";
import GovernanceToken from "../contracts/GovernanceToken.json";
import GovernanceTokenContract from "../contracts/GovernanceTokenContract.json";

export const initBlockchain = async () => {
  if (!window.ethereum) {
    alert("MetaMask not detected");
    return;
  }

  const provider = new ethers.BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();

  // Initialize contracts using addresses from addresses.json
  const contracts = {
    signer: signer,

    roleToken: new ethers.Contract(addresses.RoleToken, RoleToken.abi, signer),

    roleBasedAccessControl: new ethers.Contract(
      addresses.RoleBasedAccessControl,
      RoleBasedAccessControl.abi,
      signer
    ),

    registerContract: new ethers.Contract(
      addresses.RegisterContract,
      RegisterContract.abi,
      signer
    ),

    judgeContract: new ethers.Contract(
      addresses.JudgeContract,
      JudgeContract.abi,
      signer
    ),

    accessControlFactory: new ethers.Contract(
      addresses.AccessControlFactory,
      AccessControlFactory.abi,
      signer
    ),

    tableAccessControlContract: new ethers.Contract(
      addresses.TableAccessControlContract,
      TableAccessControlContract.abi,
      signer
    ),

    governanceTokenContract: new ethers.Contract(
      addresses.GovernanceTokenContract,
      GovernanceTokenContract.abi,
      signer
    ),

    governanceERC20: new ethers.Contract(
      addresses.GovernanceERC20,
      GovernanceToken.abi,
      signer
    ),
  };

  return contracts;
};
