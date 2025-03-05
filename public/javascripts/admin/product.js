function toggleProductStatus(productId, currentStatus) {
    // console.log("Function invoked");
    // console.log("Category ID:", productId);
    // console.log("Current Status:", currentStatus);

    const newStatus = currentStatus === "listed" ? "unlisted" : "listed";
    // console.log("New Status:", newStatus);

    axios
        .patch(`/admin/product-management/update-status/${productId}`, { status: newStatus })
        .then((response) => {
            console.log("Response from server:", response);
            if (response.data.success) {
                const button = document.querySelector(`#status-form-${productId} button`);
                button.textContent = newStatus === "listed" ? "Unlist" : "List";
                button.className = newStatus === "listed" ? "status-btn unlist-btn" : "status-btn list-btn";

                button.setAttribute("onclick", `toggleProductStatus('${productId}', '${newStatus}')`);
                location.reload();
            } else {
                console.error("Failed to update status.");
            }
        })
        .catch((error) => {
            console.error("Error updating product status:", error);
        });
}

const error = document.getElementById("error");
if (error) {
    setTimeout(() => {
        error.style.display = "none";
    }, 3000);
}
