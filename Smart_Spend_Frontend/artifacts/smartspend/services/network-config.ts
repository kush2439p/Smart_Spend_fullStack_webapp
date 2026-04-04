// Network detection utility
export const getLocalBaseUrl = () => {
  // For development, return your local IP
  return "http://10.11.213.10:8081/api";
  
  // For production, you would use your actual server URL
  // return "https://your-production-server.com/api";
};

export const BASE_URL = getLocalBaseUrl();
