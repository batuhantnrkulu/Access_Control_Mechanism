import { useEffect, useState } from "react";
import { initBlockchain } from "./utils/web3";
import PeerTable from "./components/PeerTable";
import ActionButtons from "./components/ActionButtons";
import AddPeer from "./components/AddPeer";

function App() {
  const [contracts, setContracts] = useState(null);

  useEffect(() => {
    const load = async () => {
      const c = await initBlockchain();
      setContracts(c);
    };
    load();
  }, []);

  if (!contracts) return <h2>Connecting to blockchain...</h2>;

  return (
    <div className="container mt-4">
      <h1>Governance Token Demo Dashboard</h1>
      <hr />

      {/* Add Peer UI */}
      <AddPeer
        roleBasedAccessControl={contracts.roleBasedAccessControl}
      />

      {/* Benign / Malicious Buttons */}
      <ActionButtons
        roleBasedAccessControl={contracts.roleBasedAccessControl}
        tableAccess={contracts.tableAccessControlContract}
      />

      {/* Peer Table */}
      <PeerTable
        roleBasedAccessControl={contracts.roleBasedAccessControl}
        roleToken={contracts.roleToken}
        govToken={contracts.governanceERC20}
        governanceTokenContract={contracts.governanceTokenContract}
      />
    </div>
  );
}

export default App;
