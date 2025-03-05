const signUpButton = document.getElementById("signUp");
const signInButton = document.getElementById("signIn");
const container = document.getElementById("container");

signUpButton.addEventListener("click", () => {
    container.classList.add("right-panel-active");
});

signInButton.addEventListener("click", () => {
    container.classList.remove("right-panel-active");
});
let userName
// Function for validating username
function validateUsername() {
    const username = document.getElementById("username").value;
    const usernameError = document.getElementById("usernameError");
    userName=username;
    if (username.trim().length === 0) {
        usernameError.textContent = "Username cannot be empty or contain only spaces";
        return false;
    } else if (username.length < 3) {
        usernameError.textContent = "Username must be at least 3 characters long";
        return false;
    } else {
        usernameError.textContent = "";
        return true;
    }
}

// Function for validating email
function validateEmail() {
    const email = document.getElementById("email").value || document.getElementById("signinEmail").value;
    const emailError = document.getElementById("emailError") || document.getElementById("signinEmailError");
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (email.trim().length === 0) {
        emailError.textContent = "Email cannot be empty or contain only spaces";
        return false;
    } else if (email.includes(" ")) {
        emailError.textContent = "Email cannot contain spaces";
        return false;
    } else if (!emailRegex.test(email)) {
        emailError.textContent = "Please enter a valid email address";
        return false;
    } else {
        emailError.textContent = "";
        return true;
    }
}

// Function for validating password
function validatePassword() {
    const password = document.getElementById("password")?.value || document.getElementById("signinPassword")?.value;
    const passwordError = document.getElementById("passwordError") || document.getElementById("signinPasswordError");
    const userName = document.getElementById("username")?.value || ""; // Ensure username exists

    // Regular expression for strong password
    const passwordRegex = /^(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

    if (!password) {
        passwordError.textContent = "Password cannot be empty";
        return false;
    } else if (password.includes(" ")) {
        passwordError.textContent = "Password cannot contain spaces";
        return false;
    } else if (password.length < 8) {
        passwordError.textContent = "Password must be at least 8 characters long";
        return false;
    } else if (password.toLowerCase() === userName.toLowerCase()) {
        passwordError.textContent = "Username and password should not match";
        return false;
    } else if (!/[A-Z]/.test(password)) {
        passwordError.textContent = "Password must contain at least one uppercase letter";
        return false;
    } else if (!/\d/.test(password)) {
        passwordError.textContent = "Password must contain at least one number";
        return false;
    } else if (!/[@$!%*?&]/.test(password)) {
        passwordError.textContent = "Password must contain at least one special character (@, $, !, %, *, ?, &)";
        return false;
    } else if (!passwordRegex.test(password)) {
        passwordError.textContent = "Password does not meet security requirements";
        return false;
    } else {
        passwordError.textContent = "";
        return true;
    }
}


// Function for validating confirm password
function validateConfirmPassword() {
    const password = document.getElementById("password").value;
    const confirmPassword = document.getElementById("confirmPassword").value;
    const confirmPasswordError = document.getElementById("confirmPasswordError");

    if (!confirmPassword) {
        confirmPasswordError.textContent = "Confirm password cannot be empty";
        return false;
    } else if (password !== confirmPassword) {
        confirmPasswordError.textContent = "Passwords do not match";
        return false;
    } else {
        confirmPasswordError.textContent = "";
        return true;
    }
}


// Function for validating the signup form
function validateSignupForm() {
    const isUsernameValid = validateUsername();
    const isEmailValid = validateEmail();
    const isPasswordValid = validatePassword();
    const isConfirmPasswordValid = validateConfirmPassword();

    return isUsernameValid && isEmailValid && isPasswordValid && isConfirmPasswordValid;
}

// Attach dynamic validation to the sign-in form fields
document.getElementById("signinEmail").addEventListener("keyup", validateEmail);
document.getElementById("signinPassword").addEventListener("keyup", validatePassword);

// Function for validating the sign-in form
function validateSignInForm(event) {
    const isEmailValid = validateEmail();
    const isPasswordValid = validatePassword();

    return isEmailValid && isPasswordValid;
}

// Attach the validate function to the sign-in form submit event
document.getElementById("signinForm").addEventListener("submit", validateSignInForm);

const error = document.getElementById("error");
if (error) {
    setTimeout(() => {
        error.style.display = "none";
    }, 3000);
}

//----------------------------------------------------- sign in validation -----------------------------------------//

function checkEmailInput() {
    const emailInput = document.getElementById("signinEmail");
    const emailError = document.getElementById("signinEmailError");
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (emailInput.value.trim() === "") {
        emailError.textContent = "Email cannot be empty.";
        emailError.style.color = "red";
    } else if (emailInput.value.includes(" ")) {
        emailError.textContent = "Email cannot contain spaces.";
        emailError.style.color = "red";
    } else if (!emailPattern.test(emailInput.value.trim())) {
        emailError.textContent = "Please enter a valid email address.";
        emailError.style.color = "red";
    } else {
        emailError.textContent = "";
    }
}

function checkPasswordInput() {
    const passwordInput = document.getElementById("signinPassword");
    const passwordError = document.getElementById("signinPasswordError");

    if (passwordInput.value.trim() === "") {
        passwordError.textContent = "Password cannot be empty.";
        passwordError.style.color = "red";
    } else if (passwordInput.value.includes(" ")) {
        passwordError.textContent = "Password cannot contain spaces.";
        passwordError.style.color = "red";
    } else if (passwordInput.value.length < 6) {
        passwordError.textContent = "Password must be at least 6 characters long.";
        passwordError.style.color = "red";
    } else {
        passwordError.textContent = "";
    }
}

function validateSignInForm() {
    checkEmailInput(); // Validate email before submission
    checkPasswordInput(); // Validate password before submission

    // Check if there are any error messages
    const emailError = document.getElementById("signinEmailError").textContent;
    const passwordError = document.getElementById("signinPasswordError").textContent;

    if (emailError || passwordError) {
        return false; // Prevent form submission
    }
    return true; // Allow form submission
}
