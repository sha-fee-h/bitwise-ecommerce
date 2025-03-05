document.addEventListener("DOMContentLoaded", function () {
    let countdown = 10; // Set countdown in seconds
    const timerElement = document.getElementById("timer");
    const resendLink = document.getElementById("resend-otp");
    const otpInputs = document.querySelectorAll(".input-field input");
    const verifyButton = document.querySelector("button");

    // Enable next input on keyup
    otpInputs.forEach((input, index) => {
        input.addEventListener("keyup", function (e) {
            // Check if the input is filled and move to the next input
            if (e.target.value.length === 1 && index < otpInputs.length - 1) {
                otpInputs[index + 1].disabled = false;
                otpInputs[index + 1].focus();
            }

            // Activate the button if all inputs are filled
            if (areAllInputsFilled()) {
                verifyButton.classList.add("active");
                verifyButton.disabled = false;
            } else {
                verifyButton.classList.remove("active");
                verifyButton.disabled = true;
            }

            // Handle backspace key
            if (e.key === "Backspace" && index > 0 && input.value.length === 0) {
                otpInputs[index - 1].focus(); // Move focus to the previous input
                otpInputs[index - 1].value = ""; // Clear the previous input if needed
                verifyButton.classList.remove("active");
                verifyButton.disabled = true;
            }
        });

        // Restrict input to only one digit
        input.addEventListener("input", function (e) {
            const value = e.target.value;
            // Allow only digits (0-9) and limit to 1 character
            if (!/^\d*$/.test(value) || value.length > 1) {
                e.target.value = value.slice(0, 1); // Set the value to the first character if it's too long
            }
        });
    });

    // Function to check if all inputs are filled
    const areAllInputsFilled = () => {
        return Array.from(otpInputs).every((input) => input.value.length === 1);
    };

    // Countdown function
    const startCountdown = () => {
        const countdownInterval = setInterval(() => {
            if (countdown > 0) {
                countdown--;
                timerElement.textContent = countdown;
            } else {
                clearInterval(countdownInterval);
                enableResendLink();
            }
        }, 1000);
    };

    // Enable resend OTP link
    const enableResendLink = () => {
        resendLink.classList.remove("disabled");
        resendLink.style.pointerEvents = "auto";
        resendLink.style.color = "#5C59E8";
        timerElement.textContent = "";
    };

    // Start initial countdown
    startCountdown();

    // Resend OTP function
    resendLink.addEventListener("click", async function (e) {
        e.preventDefault();

        // Disable the resend link while processing
        resendLink.style.pointerEvents = "none";
        resendLink.style.color = "grey";
        timerElement.textContent = countdown;

        try {
            const response = await fetch("/auth/signUp/resend-otp", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
            });

            if (response.ok) {
                const data = await response.text();
                alert("OTP has been resent!"); // Notify the user
            } else {
                alert("Failed to resend OTP. Please try again.");
            }
        } catch (error) {
            console.error("Error resending OTP:", error);
            alert("An error occurred. Please try again later.");
        }

        // Restart the countdown after resending OTP
        countdown = 10;
        startCountdown();
    });
});

//to submit and verify otp
document.getElementById("otpForm").addEventListener("submit", async function(event) {
    event.preventDefault(); // Prevent default form submission

    // Collect OTP from input fields
    let otp = "";
    for (let i = 1; i <= 6; i++) {
        otp += document.getElementById(`otp${i}`).value;
    }    

    // Send OTP to server
    const response = await fetch("/auth/signUp/enter-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ otp })
    });

    const data = await response.json();

    if (data.success) {
        Swal.fire({ icon: "success", title: "OTP Verified!", text: data.message ,showConfirmButton:false , timer:1000})
            .then(() => window.location.href = data.redirectUrl); // Redirect on success
    } else {
        Swal.fire({ icon: "error", title: "OTP Failed", text: data.message });
    }
});


