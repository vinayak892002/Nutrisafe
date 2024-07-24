document.addEventListener('DOMContentLoaded', () => {
    document.querySelector('#loginForm form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = document.querySelector('#loginForm #username').value;
      const password = document.querySelector('#loginForm #password').value;
  
      try {
        const response = await fetch('/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password }),
        });
  
        const result = await response.json();
  
        if (response.ok) {
          alert('Login successful');
          
          // Redirect to dashboard or desired page
        } else {
          alert(result.message || 'Login failed');
        }
      } catch (error) {
        console.error('Error:', error);
        alert('Login failed');
      }
    });
  
    document.querySelector('#signupForm form').addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!validateForm()) return;
  
      const fullname = document.querySelector('#signupForm #fullname').value;
      const username = document.querySelector('#signupForm #username').value;
      const email = document.querySelector('#signupForm #email').value;
      const password = document.querySelector('#signupForm #password').value;
  
      try {
        const response = await fetch('/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fullname, username, email, password }),
        });
  
        const result = await response.json();
  
        if (response.ok) {
          alert('Sign-up successful');
          toggleForm(); // Show login form after successful sign-up
        } else {
          alert(result.message || 'Sign-up failed');
        }
      } catch (error) {
        console.error('Error:', error);
        alert('Sign-up failed');
      }
    });
  });
  