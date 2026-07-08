const http = require('http');

const loginData = JSON.stringify({
  email: 'buyer_test@example.com',
  password: 'password123'
});

const loginOptions = {
  hostname: 'localhost',
  port: 5000,
  path: '/api/auth/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': loginData.length
  }
};

const req = http.request(loginOptions, (res) => {
  let body = '';
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => {
    const data = JSON.parse(body);
    if (data.success) {
      console.log("Token:", data.token);
      testBuy(data.token);
    } else {
      console.log("Login failed:", data.message);
    }
  });
});

req.on('error', (e) => console.error(e));
req.write(loginData);
req.end();

function testBuy(token) {
  const productId = '69b5349933502b1c861c4b98e';
  const buyOptions = {
    hostname: 'localhost',
    port: 5000,
    path: `/api/products/${productId}/buy`,
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  };

  const buyReq = http.request(buyOptions, (res) => {
    let body = '';
    console.log("Status:", res.statusCode);
    res.on('data', (chunk) => body += chunk);
    res.on('end', () => {
      console.log("Body:", body);
    });
  });

  buyReq.on('error', (e) => console.error(e));
  buyReq.end();
}
