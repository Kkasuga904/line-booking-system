// 多言語対応ユーティリティ
// 言語検出と翻訳メッセージの管理

// 言語検出関数
export function detectLanguage(text) {
  if (!text) return 'ja';
  
  // 簡易的な言語検出ロジック
  // 日本語文字（ひらがな、カタカナ、漢字）のチェック
  const japaneseRegex = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/;
  // 韓国語文字のチェック
  const koreanRegex = /[\uAC00-\uD7AF]/;
  // 中国語簡体字のチェック（一部の漢字は日本語と共通）
  const chineseRegex = /[\u4E00-\u9FFF]/;
  
  // 英語キーワード
  const englishKeywords = /\b(reservation|booking|cancel|confirm|menu|help)\b/i;
  // 韓国語キーワード
  const koreanKeywords = /예약|취소|확인|메뉴|도움/;
  // 中国語キーワード
  const chineseKeywords = /预订|预约|取消|确认|菜单|帮助/;
  
  if (englishKeywords.test(text) && !japaneseRegex.test(text)) {
    return 'en';
  }
  if (koreanRegex.test(text) || koreanKeywords.test(text)) {
    return 'ko';
  }
  if (chineseKeywords.test(text) && !japaneseRegex.test(text)) {
    return 'zh';
  }
  
  // デフォルトは日本語
  return 'ja';
}

// 多言語メッセージ定義
export const messages = {
  ja: {
    // キーワード
    keywords: {
      reservation: ['予約', 'よやく', 'ヨヤク'],
      cancel: ['キャンセル', 'きゃんせる', '取消'],
      confirm: ['確認', 'かくにん', '状況', '予約状況'],
      menu: ['メニュー', 'めにゅー', '機能', '画面', 'ダッシュボード'],
      help: ['ヘルプ', 'へるぷ', '使い方', '？']
    },
    // システムメッセージ
    system: {
      welcome: '友達追加ありがとうございます！🎉\n\nこちらは高機能予約システムです。',
      reservationMenu: '📅 予約メニュー',
      reservationPrompt: '以下のボタンから予約画面を開いてください',
      confirmPrompt: '予約をキャンセルしますか？「はい」または「いいえ」でお答えください。',
      noReservation: '予約が見つかりませんでした。',
      availableCommands: '「予約」「確認」「キャンセル」「メニュー」のいずれかを入力してください。',
      reservationConfirmed: 'ご予約を承りました。',
      thankYou: 'ご来店をお待ちしております。',
      hint: '💡 ヒント',
      hintMessage: 'LINEアプリ内から予約すると、予約確認通知がLINEに届きます',
      openInLine: '📱 LINEで予約を開く',
      openInBrowser: '🌐 ブラウザで予約',
      systemFunctions: '🎛️ システム機能',
      availableFunctions: '利用可能な機能一覧です',
      dashboard: '📊 ダッシュボード',
      calendar: '📅 カレンダー予約',
      search: '🔍 高度検索',
      monitor: '⚡ システム監視'
    }
  },
  en: {
    keywords: {
      reservation: ['reservation', 'booking', 'reserve', 'book'],
      cancel: ['cancel', 'cancellation'],
      confirm: ['confirm', 'check', 'status', 'confirmation'],
      menu: ['menu', 'functions', 'dashboard', 'options'],
      help: ['help', 'how to', 'guide', '?']
    },
    system: {
      welcome: 'Thank you for adding us! 🎉\n\nThis is an advanced reservation system.',
      reservationMenu: '📅 Reservation Menu',
      reservationPrompt: 'Please open the reservation screen from the button below',
      confirmPrompt: 'Do you want to cancel your reservation? Please answer "yes" or "no".',
      noReservation: 'No reservations found.',
      availableCommands: 'Please enter "reservation", "confirm", "cancel", or "menu".',
      reservationConfirmed: 'Your reservation has been confirmed.',
      thankYou: 'We look forward to your visit.',
      hint: '💡 Hint',
      hintMessage: 'Book from LINE app to receive confirmation notifications',
      openInLine: '📱 Open in LINE',
      openInBrowser: '🌐 Open in Browser',
      systemFunctions: '🎛️ System Functions',
      availableFunctions: 'List of available functions',
      dashboard: '📊 Dashboard',
      calendar: '📅 Calendar Booking',
      search: '🔍 Advanced Search',
      monitor: '⚡ System Monitor'
    }
  },
  ko: {
    keywords: {
      reservation: ['예약', '예약하기'],
      cancel: ['취소', '예약취소'],
      confirm: ['확인', '조회', '상태', '예약확인'],
      menu: ['메뉴', '기능', '대시보드'],
      help: ['도움말', '도움', '가이드', '?']
    },
    system: {
      welcome: '친구 추가 감사합니다! 🎉\n\n고급 예약 시스템입니다.',
      reservationMenu: '📅 예약 메뉴',
      reservationPrompt: '아래 버튼에서 예약 화면을 열어주세요',
      confirmPrompt: '예약을 취소하시겠습니까? "예" 또는 "아니오"로 답해주세요.',
      noReservation: '예약을 찾을 수 없습니다.',
      availableCommands: '"예약", "확인", "취소", "메뉴" 중 하나를 입력해주세요.',
      reservationConfirmed: '예약이 확인되었습니다.',
      thankYou: '방문을 기다리고 있겠습니다.',
      hint: '💡 힌트',
      hintMessage: 'LINE 앱에서 예약하면 확인 알림을 받을 수 있습니다',
      openInLine: '📱 LINE에서 예약 열기',
      openInBrowser: '🌐 브라우저에서 열기',
      systemFunctions: '🎛️ 시스템 기능',
      availableFunctions: '사용 가능한 기능 목록',
      dashboard: '📊 대시보드',
      calendar: '📅 캘린더 예약',
      search: '🔍 고급 검색',
      monitor: '⚡ 시스템 모니터'
    }
  },
  zh: {
    keywords: {
      reservation: ['预订', '预约', '订位'],
      cancel: ['取消', '退订'],
      confirm: ['确认', '查询', '状态', '预约确认'],
      menu: ['菜单', '功能', '仪表板'],
      help: ['帮助', '指南', '？']
    },
    system: {
      welcome: '感谢添加好友！🎉\n\n这是高级预约系统。',
      reservationMenu: '📅 预约菜单',
      reservationPrompt: '请从下面的按钮打开预约画面',
      confirmPrompt: '您要取消预约吗？请回答"是"或"否"。',
      noReservation: '未找到预约。',
      availableCommands: '请输入"预约"、"确认"、"取消"或"菜单"。',
      reservationConfirmed: '您的预约已确认。',
      thankYou: '期待您的光临。',
      hint: '💡 提示',
      hintMessage: '从LINE应用预约可收到确认通知',
      openInLine: '📱 在LINE中打开预约',
      openInBrowser: '🌐 在浏览器中打开',
      systemFunctions: '🎛️ 系统功能',
      availableFunctions: '可用功能列表',
      dashboard: '📊 仪表板',
      calendar: '📅 日历预约',
      search: '🔍 高级搜索',
      monitor: '⚡ 系统监控'
    }
  }
};

// キーワードマッチング関数
export function matchKeyword(text, language = 'ja') {
  const lang = messages[language] || messages.ja;
  
  // 各キーワードタイプをチェック
  for (const [type, keywords] of Object.entries(lang.keywords)) {
    for (const keyword of keywords) {
      if (text.toLowerCase().includes(keyword.toLowerCase())) {
        return type;
      }
    }
  }
  
  return null;
}

// メッセージ取得関数
export function getMessage(key, language = 'ja') {
  const lang = messages[language] || messages.ja;
  return lang.system[key] || messages.ja.system[key] || key;
}

// 予約確認メッセージの生成
export function generateReservationConfirmation(reservation, customerName, language = 'ja') {
  const confirmText = getMessage('reservationConfirmed', language);
  const thankYouText = getMessage('thankYou', language);
  
  const templates = {
    ja: `${confirmText}

${customerName}様

📅 日付: ${reservation.date}
⏰ 時間: ${reservation.time}
👥 人数: ${reservation.people || 1}名

予約番号: #${String(reservation.id).padStart(6, '0')}

${thankYouText}

※キャンセル・変更は「キャンセル」とメッセージをお送りください。`,
    
    en: `${confirmText}

Dear ${customerName}

📅 Date: ${reservation.date}
⏰ Time: ${reservation.time}
👥 People: ${reservation.people || 1}

Reservation ID: #${String(reservation.id).padStart(6, '0')}

${thankYouText}

※To cancel or change, please send "cancel" message.`,
    
    ko: `${confirmText}

${customerName}님

📅 날짜: ${reservation.date}
⏰ 시간: ${reservation.time}
👥 인원: ${reservation.people || 1}명

예약 번호: #${String(reservation.id).padStart(6, '0')}

${thankYouText}

※취소 또는 변경은 "취소" 메시지를 보내주세요.`,
    
    zh: `${confirmText}

${customerName}先生/女士

📅 日期: ${reservation.date}
⏰ 时间: ${reservation.time}
👥 人数: ${reservation.people || 1}位

预约号码: #${String(reservation.id).padStart(6, '0')}

${thankYouText}

※如需取消或更改，请发送"取消"消息。`
  };
  
  return templates[language] || templates.ja;
}