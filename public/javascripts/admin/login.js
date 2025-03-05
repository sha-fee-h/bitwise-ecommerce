function validateUsername() {
    const usernameInput = document.getElementById("adminUsername");
    const username = usernameInput.value;
    const usernameError = document.getElementById("usernameError");

    if (username.trim() === "") {
        usernameError.textContent = "Username is required";
        return false;
    } else {
        usernameError.textContent = "";
        return true;
    }
}

function validatePassword() {
    const passwordInput = document.getElementById("adminPassword");
    const password = passwordInput.value;
    const passwordError = document.getElementById("passwordError");

    if (password.length < 6) {
        passwordError.textContent = "Password must be at least 6 characters";
        return false;
    } else {
        passwordError.textContent = "";
        return true;
    }
}

function validateForm(event) {
    if (!validateUsername() || !validatePassword()) {
        event.preventDefault(); // Prevent form submission
        return false;
    }
    return true;
}

document.getElementById("loginForm").addEventListener("submit", validateForm);
