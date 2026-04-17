import axios from 'axios';

const FABRIC_API_URL = 'https://api.fabric.microsoft.com/v1';
const AZURE_CLIENT_ID = process.env.AZURE_CLIENT_ID || '';
const AZURE_CLIENT_SECRET = process.env.AZURE_CLIENT_SECRET || '';
const AZURE_TENANT_ID = process.env.AZURE_TENANT_ID || '';

export class FabricService {
  private accessToken: string | null = null;

  async authenticate() {
    const response = await axios.post(
      `https://login.microsoftonline.com/${AZURE_TENANT_ID}/oauth2/v2.0/token`,
      new URLSearchParams({
        client_id: AZURE_CLIENT_ID,
        client_secret: AZURE_CLIENT_SECRET,
        scope: 'https://api.fabric.microsoft.com/.default',
        grant_type: 'client_credentials',
      })
    );
    this.accessToken = response.data.access_token;
  }

  async createLakehouse(name: string, workspaceId: string) {
    if (!this.accessToken) await this.authenticate();

    const response = await axios.post(
      `${FABRIC_API_URL}/workspaces/${workspaceId}/lakehouses`,
      { displayName: name },
      {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );
    return response.data;
  }

  async uploadData(lakehouseId: string, tableName: string, data: any) {
    if (!this.accessToken) await this.authenticate();

    await axios.post(
      `${FABRIC_API_URL}/lakehouses/${lakehouseId}/tables/${tableName}/load`,
      data,
      {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );
  }
}