/** @type import('hardhat/config').HardhatUserConfig */
require("@nomicfoundation/hardhat-ethers");
require("hardhat-gas-reporter"); // If you need gas reporting

module.exports = {
  solidity: "0.8.21",
  gasReporter: {
    enabled: true,
    currency: "USD", // You can also change the currency to ETH or any other
    gasPrice: 20, // Gas price in Gwei
  },
};
