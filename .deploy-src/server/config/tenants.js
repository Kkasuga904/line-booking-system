// テナント設定（LINEアカウントごとの分離）
export const TENANTS = {
  // 正準ID（Channel ID） → エイリアスと表示名
  'booking-account1': { 
    alias: 'account1-store', 
    name: 'アカウント1',
    channelId: '1657000001', // LINE Channel ID（例）
    channelSecret: process.env.LINE_CHANNEL_SECRET_1
  },
  'booking-account2': { 
    alias: 'account2-store', 
    name: 'アカウント2',
    channelId: '1657000002', // LINE Channel ID（例）
    channelSecret: process.env.LINE_CHANNEL_SECRET_2
  },
  'line-booking-api': {
    alias: 'default-store',
    name: 'デフォルト店舗',
    channelId: '2006487876', // 既存のLIFF ID から
    channelSecret: process.env.LINE_CHANNEL_SECRET
  }
};

// ホスト名からテナントを取得
export function getTenantByHost(hostname) {
  const sub = hostname.split('.')[0].toLowerCase();
  
  // booking-account1.xxx.run.app → booking-account1
  if (TENANTS[sub]) {
    return TENANTS[sub];
  }
  
  // 完全一致チェック
  for (const [key, tenant] of Object.entries(TENANTS)) {
    if (hostname.includes(key)) {
      return tenant;
    }
  }
  
  return null;
}

// エイリアスから正準IDを取得
export function getTenantByAlias(alias) {
  for (const [key, tenant] of Object.entries(TENANTS)) {
    if (tenant.alias === alias) {
      return { id: key, ...tenant };
    }
  }
  return null;
}

// APIキーのマッピング（環境変数から読み込み）
export function getApiKeyMapping() {
  if (process.env.ADMIN_API_KEYS) {
    try {
      return JSON.parse(process.env.ADMIN_API_KEYS);
    } catch (e) {
      console.error('Failed to parse ADMIN_API_KEYS:', e);
    }
  }
  
  // デフォルトマッピング
  return {
    'account1-store': process.env.ADMIN_API_KEY_1 || process.env.ADMIN_API_KEY,
    'account2-store': process.env.ADMIN_API_KEY_2 || process.env.ADMIN_API_KEY,
    'default-store': process.env.ADMIN_API_KEY
  };
}