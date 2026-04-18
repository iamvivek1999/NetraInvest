import client from './client';

/**
 * Fetch the authenticated investor's dashboard summary.
 * 
 * @returns {{ totalInvested: number, numberOfCampaigns: number, activeInvestments: number, recentInvestments: object[] }}
 */
export const getInvestorDashboard = async () => {
  const { data } = await client.get('/investors/dashboard');
  return data.data;
};

/**
 * Create or get profile is handled via /auth/me ?
 * Actually /investors routes:
 */
export const createInvestorProfile = async (payload) => {
  const { data } = await client.post('/investors', payload);
  return data.data;
};

export const getMyInvestorProfile = async () => {
  const { data } = await client.get('/investors/me');
  return data.data;
};

export const updateInvestorProfile = async (payload) => {
  const { data } = await client.patch('/investors/me', payload);
  return data.data;
};

export const getInvestorProfile = async (id) => {
  const { data } = await client.get(`/investors/${id}`);
  return data.data;
};
