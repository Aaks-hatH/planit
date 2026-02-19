export const validateEmail = (email) => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
};

export const validateSubdomain = (subdomain) => {
  const re = /^[a-z0-9-]{3,50}$/;
  return re.test(subdomain);
};

export const validatePassword = (password) => {
  return password.length >= 6;
};

export const validateUsername = (username) => {
  return username.trim().length >= 1 && username.length <= 100;
};

export const validateMessage = (message) => {
  return message.trim().length >= 1 && message.length <= 5000;
};

export const validatePollQuestion = (question) => {
  return question.trim().length >= 1 && question.length <= 500;
};

export const validatePollOption = (option) => {
  return option.trim().length >= 1 && option.length <= 200;
};

export const validateFileSize = (size) => {
  return size <= 10 * 1024 * 1024; // 10MB
};

export const validateFileType = (type) => {
  const allowed = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg',
    'image/png',
    'image/gif',
    'text/plain',
    'application/zip'
  ];
  return allowed.includes(type);
};
