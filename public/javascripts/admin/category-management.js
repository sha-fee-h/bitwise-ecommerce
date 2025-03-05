// async function toggleCategoryStatus(categoryId, currentStatus) {
//     try {
//         const newStatus = currentStatus === "listed" ? "unlisted" : "listed";

        
//         const button = document.querySelector(`#status-form-${categoryId} button`);
        
        
//         button.disabled = true;

        
//         const response = await axios.patch(`/admin/category-management/update-status/${categoryId}`, { status: newStatus });

//         if (response.status === 200) {
            
//             button.textContent = newStatus === "listed" ? "Unlist" : "List";
//             button.className = newStatus === "listed" ? "status-btn unlist-btn" : "status-btn list-btn";
            
            
//             button.setAttribute("onclick", `toggleCategoryStatus('${categoryId}', '${newStatus}')`);

            
//         } else {
//             throw new Error("Failed to update status.");
//         }
//     } catch (error) {
//         console.error("Error updating category status:", error);

//     } finally {

//         document.querySelector(`#status-form-${categoryId} button`).disabled = false;
//     }
// }

async function toggleCategoryStatus(categoryId, currentStatus) {
    try {
        const newStatus = currentStatus === "listed" ? "unlisted" : "listed";

        // Show confirmation popup before proceeding
        const confirmation = await Swal.fire({
            title: `Are you sure you want to ${newStatus === "listed" ? "List" : "Unlist"} this category?`,
            text: "You will not be able to list it again",
            icon: "warning",
            showCancelButton: true,
            confirmButtonColor: newStatus === "listed" ? "#148800" : "#a40e00",
            cancelButtonColor: "#6c757d",
            confirmButtonText: `Yes, ${newStatus === "listed" ? "List" : "Unlist"} it!`
        });

        if (!confirmation.isConfirmed) {
            return; // Exit function if user cancels
        }

        // Disable button during request
        const button = document.querySelector(`#status-form-${categoryId} button`);
        button.disabled = true;

        // Send request to update status
        const response = await axios.patch(`/admin/category-management/update-status/${categoryId}`, { status: newStatus });

        if (response.status === 200) {
            // Update button text and styling
            // button.textContent = newStatus === "listed" ? "Unlist" : "List";
            // button.className = newStatus === "listed" ? "status-btn unlist-btn" : "status-btn list-btn";

            // // Update onclick attribute with new status
            // button.setAttribute("onclick", `toggleCategoryStatus('${categoryId}', '${newStatus}')`);

            // Show success message
            // Swal.fire({
            //     title: "Success!",
            //     text: `Category unlisted successfully.`,
            //     icon: "success",
            //     timer: 1500,
            //     showConfirmButton: false
            // });
            location.reload()
            
        } else {
            throw new Error("Failed to update status.");
        }
    } catch (error) {
        console.error("Error updating category status:", error);
        Swal.fire({
            title: "Error!",
            text: "Something went wrong. Please try again.",
            icon: "error"
        });
    } finally {
        // Re-enable the button
        document.querySelector(`#status-form-${categoryId} button`).disabled = false;
    }
}



const modal = document.getElementById("addCategoryModal");
const btn = document.getElementById("addCategoryBtn");
const span = document.getElementById("closeAddModal");
const urlParams = new URLSearchParams(window.location.search);
const addCatmsg = urlParams.get("addCatmsg");

btn.onclick = function () {
    modal.style.display = "block";
};

span.onclick = function () {
    modal.style.display = "none";
};

window.onclick = function (event) {
    if (event.target == modal) {
        modal.style.display = "none";
    }
};

const error = document.getElementById("error");
if (error) {
    setTimeout(() => {
        error.style.display = "none";
    }, 3000);
}

document.addEventListener("DOMContentLoaded", function () {
    const editModal = document.getElementById("editCategoryModal");
    const editButtons = document.querySelectorAll(".edit-btn");
    const closeEditModal = document.getElementById("closeEditModal");

    editButtons.forEach((btn) => {
        btn.onclick = function () {
            const categoryId = this.getAttribute("data-id");
            const categoryName = this.getAttribute("data-name");
            const categoryDescription = this.getAttribute("data-description");

            console.log("input datas : ", categoryId, categoryName, categoryDescription);

            document.getElementById("edit-cat-id").value = categoryId;
            document.getElementById("edit-cat-name").value = categoryName;
            document.getElementById("edit-cat-description").value = categoryDescription;

            editModal.style.display = "block";
        };
    });

    
    closeEditModal.onclick = function () {
        editModal.style.display = "none";
    };

    
    window.onclick = function (event) {
        if (event.target === editModal) {
            editModal.style.display = "none";
        }
    };
});

document.getElementById("editCategoryForm").addEventListener("submit", function (event) {
    event.preventDefault(); // Prevent default form submission

    Swal.fire({
        title: "Are you sure?",
        text: "Do you want to update this category?",
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#3085d6",
        cancelButtonColor: "#d33",
        confirmButtonText: "Yes, update it!"
    }).then((result) => {
        if (result.isConfirmed) {
            event.target.submit(); // Submit the form if confirmed
        }
    });
});

