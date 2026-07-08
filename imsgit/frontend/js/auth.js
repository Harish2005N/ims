const API_AUTH = "/api/auth";

document.addEventListener("DOMContentLoaded", () => {
  const tabLogin = document.getElementById("tab-login");
  const tabRegister = document.getElementById("tab-register");
  const loginFields = document.getElementById("login-fields");
  const registerFields = document.getElementById("register-fields");
  const authSubtitle = document.getElementById("auth-subtitle");
  const submitBtn = document.getElementById("submit-btn");
  const authForm = document.getElementById("auth-form");
  const errorBox = document.getElementById("error-box");

  let isLogin = true;

  // Tab Switching
  tabLogin.onclick = () => {
    isLogin = true;
    tabLogin.classList.add("active");
    tabRegister.classList.remove("active");
    loginFields.style.display = "block";
    registerFields.style.display = "none";
    authSubtitle.innerText = "Welcome back! Please login to your account.";
    submitBtn.innerText = "Login Account";
    errorBox.style.display = "none";
  };

  tabRegister.onclick = () => {
    isLogin = false;
    tabRegister.classList.add("active");
    tabLogin.classList.remove("active");
    loginFields.style.display = "none";
    registerFields.style.display = "block";
    authSubtitle.innerText = "Create a new account to join StockSense.";
    submitBtn.innerText = "Create Account";
    errorBox.style.display = "none";
  };

  // Form Submission
  authForm.onsubmit = async (e) => {
    e.preventDefault();
    errorBox.style.display = "none";

    const emailField = isLogin ? document.getElementById("login-email") : document.getElementById("reg-email");
    const passwordField = isLogin ? document.getElementById("login-password") : document.getElementById("reg-password");
    const usernameField = document.getElementById("reg-username");
    
    // Manual Validation
    const email = emailField.value.trim();
    const password = passwordField.value.trim();
    const username = usernameField.value.trim();

    if (!email || !password) {
      errorBox.innerText = "Email and password are required.";
      errorBox.style.display = "block";
      return;
    }

    if (!isLogin && !username) {
      errorBox.innerText = "Full name is required for registration.";
      errorBox.style.display = "block";
      return;
    }

    if (!isLogin && password.length < 6) {
      errorBox.innerText = "Password must be at least 6 characters.";
      errorBox.style.display = "block";
      return;
    }

    submitBtn.disabled = true;
    submitBtn.innerText = "Processing...";

    const payload = isLogin 
      ? { email, password }
      : {
          username,
          email,
          password,
          role: document.getElementById("reg-role").value
        };

    try {
      const endpoint = isLogin ? "/login" : "/register";
      const res = await fetch(API_AUTH + endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Something went wrong");
      }

      // Success! Store token and user data
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));

      // Redirect to dashboard
      window.location.replace("index.html");

    } catch (err) {
      errorBox.innerText = err.message;
      errorBox.style.display = "block";
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerText = isLogin ? "Login Account" : "Create Account";
    }
  };
});
