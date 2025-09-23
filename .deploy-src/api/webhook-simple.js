
const LINE_API_URL = 'https://api.line.me/v2/bot/message/reply';
const CONFIG_ENDPOINT = '/api/config';

function trimTrailingSlash(value = '') {
  return value ? value.replace(/\/+$/, '') : '';
}

function resolveOrigin() {
  const candidates = [
    process.env.PUBLIC_ORIGIN,
    process.env.BASE_URL,
    process.env.INTERNAL_BASE_URL,
    process.env.INTERNAL_API_BASE,
    process.env.SELF_URL
  ];

  for (const candidate of candidates) {
    if (typeof candidate !== 'string' || candidate.trim() === '') continue;
    const normalized = candidate.trim();
    if (/^https?:\/\//i.test(normalized)) {
      return trimTrailingSlash(normalized);
    }
  }

  const port = process.env.PORT || 8080;
  return 'http://127.0.0.1:' + port;
}

async function resolveLinkData() {
  const origin = resolveOrigin();
  let config = {};

  try {
    const response = await fetch(origin + CONFIG_ENDPOINT, {
      headers: { Accept: 'application/json' }
    });

    if (response.ok) {
      config = await response.json();
    } else {
      const body = await response.text().catch(() => '');
      console.error('Failed to load /api/config', {
        status: response.status,
        statusText: response.statusText,
        body: body.slice(0, 120)
      });
    }
  } catch (error) {
    console.error('Error while loading /api/config', error);
  }

  return buildLinkSet(config, origin);
}

function buildLinkSet(config = {}, origin = '') {
  const baseFromConfig = trimTrailingSlash(config.baseUrl || '');
  const fallbackBase = trimTrailingSlash(origin || '');
  const baseUrl = baseFromConfig || fallbackBase;
  const liffId = (config.liffId || process.env.LIFF_ID || '').toString().trim();
  const liffUrl = liffId ? 'https://liff.line.me/' + liffId : baseUrl ? baseUrl + '/liff-booking.html' : null;
  const webUrl = baseUrl ? baseUrl + '/liff-booking.html' : null;
  const manageUrl = baseUrl ? baseUrl + '/liff-check.html' : null;

  return {
    baseUrl,
    liffId: liffId || null,
    liffUrl,
    webUrl,
    manageUrl
  };
}

function composeReservationMessage(links) {
  if (links?.liffUrl && links?.webUrl) {
    return [
      '📱 LINEで予約（おすすめ）',
      links.liffUrl,
      '',
      '🌐 ブラウザで予約',
      links.webUrl
    ].join('
');
  }

  if (links?.webUrl) {
    return ['🌐 予約ページ', links.webUrl].join('
');
  }

  return '現在、予約ページのURLを取得できませんでした。少し時間をおいてお試しください。';
}

function composeManageMessage(links) {
  if (links?.manageUrl) {
    return [
      '予約の確認・変更・キャンセルはこちらをご利用ください。',
      '',
      '📊 管理ページ',
      links.manageUrl
    ].join('
');
  }

  if (links?.webUrl) {
    return [
      '予約の確認・変更・キャンセルはこちらをご利用ください。',
      '',
      '🌐 ブラウザで予約',
      links.webUrl
    ].join('
');
  }

  return '予約管理ページのURLを取得できませんでした。時間をおいてお試しください。';
}

function composeDefaultMessage(links) {
  const lines = [
    'メニューをお選びください。',
    '',
    '📅 予約する → 「予約」と送信',
    '🛠 予約管理 → 「確認」「変更」「キャンセル」と送信'
  ];

  if (links?.liffUrl) {
    lines.push('📱 LINEで予約');
    lines.push(links.liffUrl);
  }

  if (links?.webUrl) {
    if (links?.liffUrl) {
      lines.push('');
    }
    lines.push('🌐 ブラウザで予約');
    lines.push(links.webUrl);
  }

  return lines.join('
');
}

async function replyMessage(token, replyToken, text) {
  if (!token) {
    console.error('LINE_CHANNEL_ACCESS_TOKEN is not set');
    return;
  }

  try {
    const response = await fetch(LINE_API_URL, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        replyToken,
        messages: [{ type: 'text', text }]
      })
    });

    if (!response.ok) {
      const body = await response.text();
      console.error('LINE reply failed', response.status, body);
    }
  } catch (error) {
    console.error('LINE reply error', error);
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST' || !req.body?.events?.length) {
    res.status(200).json({ ok: true });
    return;
  }

  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  const event = req.body.events[0];
  let linkDataPromise;

  const getLinks = () => {
    if (!linkDataPromise) {
      linkDataPromise = resolveLinkData();
    }
    return linkDataPromise;
  };

  try {
    if (event.type === 'follow' && event.replyToken) {
      const links = await getLinks();
      await replyMessage(token, event.replyToken, composeReservationMessage(links));
    } else if (event.type === 'message' && event.replyToken && event.message?.text) {
      const text = event.message.text.toLowerCase();
      if (text.includes('予約')) {
        const links = await getLinks();
        await replyMessage(token, event.replyToken, composeReservationMessage(links));
      } else if (text.includes('確認') || text.includes('変更') || text.includes('キャンセル')) {
        const links = await getLinks();
        await replyMessage(token, event.replyToken, composeManageMessage(links));
      } else {
        const links = await getLinks();
        await replyMessage(token, event.replyToken, composeDefaultMessage(links));
      }
    }
  } catch (error) {
    console.error('Webhook simple handler error', error);
  }

  res.status(200).json({ ok: true });
}
