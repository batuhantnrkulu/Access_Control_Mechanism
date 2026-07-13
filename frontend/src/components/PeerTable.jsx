import { useEffect, useState } from "react";

export default function PeerTable({
    roleBasedAccessControl,
    roleToken,
    govToken,
    governanceTokenContract
}) {
    const [peers, setPeers] = useState([]);

    const loadPeers = async () => {
        try {
            // getAllMembers returns address[]
            const addresses = await roleToken.getAllMembers();

            if (!addresses || addresses.length === 0) {
                console.log("No peers found.");
                setPeers([]);
                return;
            }

            let list = [];

            for (const addr of addresses) {
                // Fetch full member struct
                const m = await roleBasedAccessControl.getMember(addr);

                const roleBal = await roleToken.balanceOf(addr);
                const govBal = await govToken.balanceOf(addr);
                const gp = await governanceTokenContract.getGovernancePower(addr);

                list.push({
                    name: m.name,
                    address: addr,
                    status: m.status,
                    memberType: m.memberType,
                    roleBal: roleBal.toString(),
                    govBal: govBal.toString(),
                    gp: gp.toString(),
                });
            }

            setPeers(list);
        } catch (error) {
            console.error("Error loading peers:", error);
        }
    };

    useEffect(() => {
        loadPeers();
    }, []);

    return (
        <>
            <h3 className="mt-4">Peer Status Table</h3>

            <table className="table table-bordered">
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Address</th>
                        <th>Type</th>
                        <th>Status</th>
                        <th>RoleToken</th>
                        <th>GOV Token</th>
                        <th>Gov Power</th>
                    </tr>
                </thead>

                <tbody>
                    {peers.map((p) => (
                        <tr key={p.address}>
                            <td>{p.name}</td>
                            <td>{p.address}</td>
                            <td>{p.memberType}</td>
                            <td>{p.status}</td>
                            <td>{p.roleBal}</td>
                            <td>{p.govBal}</td>
                            <td>{p.gp}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </>
    );
}
