const imageInput = document.getElementById("images");
const form = document.getElementById("product-form");

imageInput.addEventListener("change", function (event) {
    const files = event.target.files;

    if (files.length > 0) {
        const file = files[0]; // Get the first selected image
        const reader = new FileReader();

        reader.onload = function (e) {
            const image = new Image();
            image.src = e.target.result;

            const cropper = new Cropper(image, {
                aspectRatio: 1,
                viewMode: 1,
                autoCropArea: 1,
                ready: function () {
                    // Here you can crop the image
                },
            });

            // Handle image cropping logic here

            // For demo purposes, just display the cropped image
            cropper.getCroppedCanvas().toBlob((blob) => {
                const newFile = new File([blob], file.name, { type: file.type });
                // Do something with the cropped file, e.g., add it to form data
            });
        };

        reader.readAsDataURL(file);
    }
});
