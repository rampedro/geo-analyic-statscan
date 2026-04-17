import axios from 'axios';

const POWER_BI_API_URL = 'https://api.powerbi.com/v1.0/myorg';
const AZURE_CLIENT_ID = process.env.AZURE_CLIENT_ID || '';
const AZURE_CLIENT_SECRET = process.env.AZURE_CLIENT_SECRET || '';
const AZURE_TENANT_ID = process.env.AZURE_TENANT_ID || '';

export class PowerBIService {
  private accessToken: string | null = null;

  async authenticate() {
    const response = await axios.post(
      `https://login.microsoftonline.com/${AZURE_TENANT_ID}/oauth2/v2.0/token`,
      new URLSearchParams({
        client_id: AZURE_CLIENT_ID,
        client_secret: AZURE_CLIENT_SECRET,
        scope: 'https://analysis.windows.net/powerbi/api/.default',
        grant_type: 'client_credentials',
      })
    );
    this.accessToken = response.data.access_token;
  }

  async pushData(datasetId: string, data: any) {
    if (!this.accessToken) await this.authenticate();

    await axios.post(
      `${POWER_BI_API_URL}/datasets/${datasetId}/rows`,
      data,
      {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );
  }

  async getReports() {
    if (!this.accessToken) await this.authenticate();

    const response = await axios.get(
      `${POWER_BI_API_URL}/reports`,
      {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      }
    );
    return response.data.value;
  }
}