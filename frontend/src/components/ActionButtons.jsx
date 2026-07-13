export default function ActionButtons({ accessControl }) {
    const benign = async () => {
        await accessControl.accessControl("test.jpg", "view");
        alert("Benign Activity Simulated");
    };

    const malicious = async () => {
        await accessControl.accessControl("restricted.jpg", "view");
        alert("Malicious Activity Triggered");
    };

    return (
        <div className="mt-3">
            <button className="btn btn-success me-2" onClick={benign}>
                Benign Access
            </button>
            <button className="btn btn-danger" onClick={malicious}>
                Malicious Access
            </button>
        </div>
    );
}
