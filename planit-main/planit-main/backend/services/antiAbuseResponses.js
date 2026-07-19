'use strict';

const RESPONSES = Object.freeze({
  verificationRequired: {
    status: 428,
    code: 'VERIFICATION_REQUIRED',
    message: 'We couldn’t complete your request at this time. Please complete the verification step and try again.',
    userMessage: 'Please complete the verification step to continue.',
  },
  invalidVerification: {
    status: 400,
    code: 'INVALID_VERIFICATION',
    message: 'We couldn’t verify your request. Please try again.',
    userMessage: 'We couldn’t verify your request. Please try again.',
  },
  tryAgainLater: {
    status: 429,
    code: 'TRY_AGAIN_LATER',
    message: 'We’re unable to process additional requests right now. Please try again later.',
    userMessage: 'We couldn’t complete your request right now. Please try again shortly.',
  },
  additionalReview: {
    status: 202,
    code: 'ADDITIONAL_REVIEW_REQUIRED',
    message: 'We need to perform additional checks before completing this request.',
    userMessage: 'Your submission requires additional processing before completion.',
  },
  submissionReceived: {
    status: 202,
    code: 'SUBMISSION_RECEIVED',
    message: 'Your submission has been received and is being processed.',
    userMessage: 'Your submission has been received.',
  },
});

function antiAbusePayload(type, extra = {}) {
  const response = RESPONSES[type] || RESPONSES.tryAgainLater;
  return {
    ok: false,
    code: response.code,
    message: response.message,
    userMessage: response.userMessage,
    ...extra,
  };
}

function sendAntiAbuse(res, type, extra = {}) {
  const response = RESPONSES[type] || RESPONSES.tryAgainLater;
  return res.status(response.status).json(antiAbusePayload(type, extra));
}

module.exports = { RESPONSES, antiAbusePayload, sendAntiAbuse };
