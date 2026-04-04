const fs = require('fs');
const { exec } = require('child_process');

// Get current IP address
exec('ipconfig', (error, stdout, stderr) => {
  if (error) {
    console.error('Error getting IP:', error);
    return;
  }
  
  // Extract Wi-Fi IPv4 address
  const wifiMatch = stdout.match(/Wireless LAN adapter Wi-Fi:.*?IPv4 Address[^\d]*([\d.]+)/s);
  if (!wifiMatch) {
    console.error('Wi-Fi IP not found');
    return;
  }
  
  const currentIP = wifiMatch[1];
  const newBaseUrl = `http://${currentIP}:8081/api`;
  
  console.log(`Updating API URL to: ${newBaseUrl}`);
  
  // Update api.ts
  const apiFile = './artifacts/smartspend/services/api.ts';
  let apiContent = fs.readFileSync(apiFile, 'utf8');
  apiContent = apiContent.replace(/export const BASE_URL = ".*?";/, `export const BASE_URL = "${newBaseUrl}";`);
  fs.writeFileSync(apiFile, apiContent);
  
  // Update network-config.ts
  const networkFile = './artifacts/smartspend/services/network-config.ts';
  let networkContent = fs.readFileSync(networkFile, 'utf8');
  networkContent = networkContent.replace(/return ".*?";/, `return "${newBaseUrl}";`);
  fs.writeFileSync(networkFile, networkContent);
  
  console.log('✅ API URLs updated successfully!');
  console.log(`New IP: ${currentIP}`);
});
