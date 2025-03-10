const fs = require("fs");
const path = require("path");

const buildDir = path.join(__dirname, "build", "contracts");

fs.readdir(buildDir, (err, files) => {
  if (err) {
    console.error("Error reading build directory:", err);
    return;
  }

  files.forEach((file) => {
    if (file.endsWith(".json")) {
      const filePath = path.join(buildDir, file);
      const contract = JSON.parse(fs.readFileSync(filePath, "utf8"));

      const abi = JSON.stringify(contract.abi, null, 2);
      const bin = contract.bytecode;

      const baseName = path.basename(file, ".json");
      const abiPath = path.join(__dirname, `${baseName}.abi`);
      const binPath = path.join(__dirname, `${baseName}.bin`);

      fs.writeFileSync(abiPath, abi);
      fs.writeFileSync(binPath, bin);

      console.log(`Extracted ABI and bytecode for ${baseName}`);
    }
  });
});
