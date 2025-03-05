async function toggleUserStatus(userId, currentStatus) {
    const action = currentStatus ? "unblock" : "block"; // Determine the action
    const confirmation = await Swal.fire({
        title: `Are you sure?`,
        text: `Do you want to ${action} this user?`,
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#d33",
        cancelButtonColor: "#3085d6",
        confirmButtonText: `Yes, ${action} user`
    });

    if (!confirmation.isConfirmed) return; // If the user cancels, exit

    try {
        // Send a PATCH request to update the user status
        const response = await fetch(`/admin/update-status/${userId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" }
        });

        const data = await response.json();

        if (data.success) {
            // Update button text and class without reloading the page
            const button = document.getElementById(`status-btn-${userId}`);
            button.textContent = data.newStatus ? "Unblock" : "Block"; 
            button.classList.toggle("block-btn", !data.newStatus);  // Apply "Block" style
            button.classList.toggle("unblock-btn", data.newStatus); // Apply "Unblock" style

            // ✅ Update the "Status" field in the same row
            const row = button.closest("tr");
            const statusCell = row.querySelector("td:nth-child(4)");
            statusCell.textContent = data.newStatus ? "Blocked" : "Active";

            // Show success message
            Swal.fire({
                title: "Updated!",
                text: `User has been ${action}ed successfully.`,
                icon: "success",
                timer: 1500,
                showConfirmButton: false
            });

        } else {
            Swal.fire({
                title: "Failed",
                text: "Failed to update user status.",
                icon: "error"
            });
        }
    } catch (error) {
        console.error("Error updating status:", error);
        Swal.fire({
            title: "Error",
            text: "An error occurred. Please try again.",
            icon: "error"
        });
    }
}
