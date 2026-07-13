const fs = require("fs");
const path = require("path");

function saveFrontendFiles(addresses) {
  const contractsDir = path.join(__dirname, "../frontend/src/contracts");

  if (!fs.existsSync(contractsDir)) {
    fs.mkdirSync(contractsDir, { recursive: true });
  }

  fs.writeFileSync(
    path.join(contractsDir, "addresses.json"),
    JSON.stringify(addresses, null, 2)
  );

  console.log(
    "✓ Contract addresses saved to frontend/src/contracts/addresses.json"
  );
}

module.exports = saveFrontendFiles;
