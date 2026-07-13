import { useState } from "react";

export default function AddPeer({ roleBasedAccessControl, refreshPeers }) {
    const [addr, setAddr] = useState("");
    const [name, setName] = useState("");
    const [type, setType] = useState("");

    const addPeer = async () => {
        try {
            const tx = await roleBasedAccessControl.assignRole(
                addr,
                name,
                type
            );
            await tx.wait();

            alert("Peer added successfully!");

            if (refreshPeers) refreshPeers();  // If PeerTable provided a refresh fn
        } catch (err) {
            console.error(err);
            alert("Failed to add peer. Check console for details.");
        }
    };

    return (
        <div className="card p-3 mb-4">
            <h3>Add Peer</h3>

            <input
                className="form-control my-2"
                placeholder="Wallet Address"
                value={addr}
                onChange={(e) => setAddr(e.target.value)}
            />

            <input
                className="form-control my-2"
                placeholder="Name (e.g., secondary_head1)"
                value={name}
                onChange={(e) => setName(e.target.value)}
            />

            <input
                className="form-control my-2"
                placeholder="Type (e.g., type1)"
                value={type}
                onChange={(e) => setType(e.target.value)}
            />

            <button className="btn btn-primary mt-2" onClick={addPeer}>
                Add Peer
            </button>
        </div>
    );
}
