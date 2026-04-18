/**
 * src/api/admin.api.js
 */

import apiClient from './client';

export const getVerifications = async (role, status = '', page = 1, limit = 50) => {
  const params = { page, limit };
  if (status) params.status = status;
  
  const response = await apiClient.get(`/admin/verifications/${role}`, { params });
  return response.data;
};

export const getVerificationById = async (role, id) => {
  const response = await apiClient.get(`/admin/verifications/${role}/${id}`);
  return response.data;
};

export const updateVerificationStatus = async (role, id, status, rejectionReason = '') => {
  const payload = { status };
  if (rejectionReason) payload.rejectionReason = rejectionReason;
  
  const response = await apiClient.put(`/admin/verifications/${role}/${id}/status`, payload);
  return response.data;
};
export const getDashboardStats = async () => {
  const response = await apiClient.get('/admin/stats');
  return response.data;
};

export const getUsers = async (params = {}) => {
  const response = await apiClient.get('/admin/users', { params });
  return response.data;
};

export const toggleUserStatus = async (id, isActive) => {
  const response = await apiClient.patch(`/admin/users/${id}/status`, { isActive });
  return response.data;
};

export const toggleInvestorPremiumStatus = async (id, premiumStatus) => {
  const response = await apiClient.patch(`/admin/investors/${id}/premium`, { premiumStatus });
  return response.data;
};

export const getCampaignsForReview = async (params = {}) => {
  const response = await apiClient.get('/admin/campaigns', { params });
  return response.data;
};

export const updateCampaignStatus = async (id, status, adminReviewNotes = '') => {
  const response = await apiClient.patch(`/admin/campaigns/${id}/status`, { status, adminReviewNotes });
  return response.data;
};
