const connection = require("../db");

/** =========================
 *  Promise 래퍼
 * ========================= */
function q(sql, params = []) {
  return new Promise((resolve, reject) => {
    connection.query(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

/** =========================
 *  goods_id -> seller_id 조회
 * ========================= */
async function getSellerIdByGoodsId(goodsId) {
  const rows = await q(
    `
    SELECT user_id AS seller_id
    FROM dam_goods_posts
    WHERE goods_id = ?
    LIMIT 1
    `,
    [goodsId]
  );
  return rows?.[0]?.seller_id ?? null;
}

/** =========================
 *  (읽음처리용) 최신 메시지 id
 * ========================= */
async function getLatestMessageId(chat_id) {
  const rows = await q(
    `
    SELECT IFNULL(MAX(message_id), 0) AS maxId
    FROM dam_chat_messages
    WHERE chat_id = ?
    `,
    [chat_id]
  );
  return Number(rows?.[0]?.maxId ?? 0);
}

/** =========================
 *  읽음 처리: last_read_message_id + last_read_at 갱신
 *  - FK 때문에 message가 없으면 NULL 저장
 * ========================= */
async function markReadToLatest(chat_id, user_id) {
  const latestId = await getLatestMessageId(chat_id);
  const newLastRead = latestId > 0 ? latestId : null;

  await q(
    `
    INSERT INTO dam_chat_room_user_state
      (chat_id, user_id, last_read_message_id, last_read_at, created_at)
    VALUES
      (?, ?, ?, NOW(), NOW())
    ON DUPLICATE KEY UPDATE
      last_read_message_id =
        CASE
          WHEN VALUES(last_read_message_id) IS NULL THEN last_read_message_id
          ELSE GREATEST(IFNULL(last_read_message_id, 0), VALUES(last_read_message_id))
        END,
      last_read_at = NOW()
    `,
    [chat_id, user_id, newLastRead]
  );

  return newLastRead; // null or number
}

/** =========================
 * ✅ 1) (방 생성 없이) goods_id + buyer_id 로 방 조회
 * GET /api/chat/room?goods_id=17&buyer_id=29
 * ========================= */
exports.getRoomByGoodsAndBuyer = async (req, res) => {
  const goods_id = Number(req.query.goods_id);
  const buyer_id = Number(req.query.buyer_id);

  if (!goods_id || !buyer_id) {
    return res.status(400).json({
      success: false,
      message: "goods_id, buyer_id가 필요합니다.",
    });
  }

  try {
    const seller_id = await getSellerIdByGoodsId(goods_id);
    if (!seller_id) {
      return res.status(404).json({
        success: false,
        message: "해당 goods_id의 판매자를 찾을 수 없습니다.",
      });
    }

    const roomSql = `
      SELECT chat_id
      FROM dam_chat_rooms
      WHERE goods_id = ? AND buyer_id = ? AND seller_id = ?
      LIMIT 1
    `;
    const rows = await q(roomSql, [goods_id, buyer_id, seller_id]);

    const chat_id = rows?.[0]?.chat_id ?? null;

    return res.json({
      success: true,
      chat_id,
      seller_id,
    });
  } catch (err) {
    console.error("getRoomByGoodsAndBuyer error:", err);
    return res.status(500).json({ success: false, message: "서버 오류" });
  }
};

/** =========================
 * ✅ 2) chat_id 메시지 목록 조회 (+nickname) + 자동 읽음처리
 * GET /api/chat/messages?chat_id=123&user_id=29
 * ========================= */
exports.getMessagesByChatId = async (req, res) => {
  const chat_id = Number(req.query.chat_id);
  const user_id = Number(req.query.user_id);

  if (!chat_id) {
    return res.status(400).json({ success: false, message: "chat_id가 필요합니다." });
  }
  if (!user_id) {
    return res.status(400).json({ success: false, message: "user_id가 필요합니다." });
  }

  try {
    const sql = `
      SELECT
        m.message_id AS id,
        m.user_id,
        u.user_nickname AS nickname,
        m.content AS text,
        m.created_at AS createdAt
      FROM dam_chat_messages m
      JOIN damteul_users u ON u.user_id = m.user_id
      WHERE m.chat_id = ?
      ORDER BY m.message_id ASC
    `;
    const rows = await q(sql, [chat_id]);

    // ✅ 자동 읽음 처리
    const lastReadMessageId = await markReadToLatest(chat_id, user_id);

    return res.json({
      success: true,
      messages: rows || [],
      lastReadMessageId, // null or number
    });
  } catch (err) {
    console.error("getMessagesByChatId error:", err);
    return res.status(500).json({ success: false, message: "서버 오류" });
  }
};

/** =========================
 * ✅ 3) 첫 메시지: 방 생성 + 첫 메시지 저장
 * POST /api/chat/send-first
 * body: { goods_id, buyer_id, content }
 * ========================= */
exports.sendFirstMessage = async (req, res) => {
  const { goods_id, buyer_id, content } = req.body;

  if (!goods_id || !buyer_id || !content?.trim()) {
    return res.status(400).json({
      success: false,
      message: "goods_id, buyer_id, content가 필요합니다.",
    });
  }

  try {
    const seller_id = await getSellerIdByGoodsId(goods_id);
    if (!seller_id) {
      return res.status(404).json({
        success: false,
        message: "해당 goods_id의 판매자를 찾을 수 없습니다.",
      });
    }

    await q("START TRANSACTION");

    // 방 upsert (UNIQUE KEY (goods_id, buyer_id, seller_id) 필요)
    const roomUpsertSql = `
      INSERT INTO dam_chat_rooms (goods_id, buyer_id, seller_id, created_at)
      VALUES (?, ?, ?, NOW())
      ON DUPLICATE KEY UPDATE chat_id = LAST_INSERT_ID(chat_id)
    `;
    const roomResult = await q(roomUpsertSql, [goods_id, buyer_id, seller_id]);
    const chat_id = roomResult.insertId;

    // user_state 준비(최초 1회만)
    const userStateSql = `
      INSERT IGNORE INTO dam_chat_room_user_state (chat_id, user_id, created_at)
      VALUES (?, ?, NOW()), (?, ?, NOW())
    `;
    await q(userStateSql, [chat_id, buyer_id, chat_id, seller_id]);

    // 메시지 저장
    const insertMsgSql = `
      INSERT INTO dam_chat_messages (chat_id, user_id, content, created_at)
      VALUES (?, ?, ?, NOW())
    `;
    const msgResult = await q(insertMsgSql, [chat_id, buyer_id, content.trim()]);
    const message_id = msgResult.insertId;

    // created_at 조회
    const timeRows = await q(
      `SELECT created_at AS createdAt FROM dam_chat_messages WHERE message_id = ? LIMIT 1`,
      [message_id]
    );
    const createdAt = timeRows?.[0]?.createdAt ?? null;

    // last_message 갱신
    const updateRoomLastSql = `
      UPDATE dam_chat_rooms
      SET last_message_id = ?, last_message_at = NOW()
      WHERE chat_id = ?
    `;
    await q(updateRoomLastSql, [message_id, chat_id]);

    // ✅ 보낸 사람(buyer)은 방금 보낸 메시지까지 읽은 상태로 처리
    // (FK 때문에 last_read_message_id는 message_id로 저장)
    await q(
      `
      INSERT INTO dam_chat_room_user_state (chat_id, user_id, last_read_message_id, last_read_at, created_at)
      VALUES (?, ?, ?, NOW(), NOW())
      ON DUPLICATE KEY UPDATE
        last_read_message_id = GREATEST(IFNULL(last_read_message_id, 0), VALUES(last_read_message_id)),
        last_read_at = NOW()
      `,
      [chat_id, buyer_id, message_id]
    );

    await q("COMMIT");

    return res.json({
      success: true,
      chat_id,
      message_id,
      createdAt,
      seller_id,
      message: "첫 메시지 전송 + 채팅방 생성(필요 시) 완료",
    });
  } catch (err) {
    try {
      await q("ROLLBACK");
    } catch (e) {}
    console.error("sendFirstMessage error:", err);
    return res.status(500).json({ success: false, message: "서버 오류" });
  }
};

/** =========================
 * ✅ 4) 두번째 메시지부터: chat_id로 메시지만 저장
 * POST /api/chat/send
 * body: { chat_id, user_id, content }
 * ========================= */
exports.sendMessage = async (req, res) => {
  const { chat_id, user_id, content } = req.body;

  if (!chat_id || !user_id || !content?.trim()) {
    return res.status(400).json({
      success: false,
      message: "chat_id, user_id, content가 필요합니다.",
    });
  }

  try {
    await q("START TRANSACTION");

    // 메시지 저장
    const insertMsgSql = `
      INSERT INTO dam_chat_messages (chat_id, user_id, content, created_at)
      VALUES (?, ?, ?, NOW())
    `;
    const msgResult = await q(insertMsgSql, [chat_id, user_id, content.trim()]);
    const message_id = msgResult.insertId;

    // created_at 조회
    const timeRows = await q(
      `SELECT created_at AS createdAt FROM dam_chat_messages WHERE message_id = ? LIMIT 1`,
      [message_id]
    );
    const createdAt = timeRows?.[0]?.createdAt ?? null;

    // last_message 갱신
    const updateRoomLastSql = `
      UPDATE dam_chat_rooms
      SET last_message_id = ?, last_message_at = NOW()
      WHERE chat_id = ?
    `;
    await q(updateRoomLastSql, [message_id, chat_id]);

    // ✅ 보낸 사람은 방금 보낸 메시지까지 읽은 상태
    await q(
      `
      INSERT INTO dam_chat_room_user_state (chat_id, user_id, last_read_message_id, last_read_at, created_at)
      VALUES (?, ?, ?, NOW(), NOW())
      ON DUPLICATE KEY UPDATE
        last_read_message_id = GREATEST(IFNULL(last_read_message_id, 0), VALUES(last_read_message_id)),
        last_read_at = NOW()
      `,
      [chat_id, user_id, message_id]
    );

    await q("COMMIT");

    return res.json({
      success: true,
      chat_id,
      message_id,
      createdAt,
      message: "메시지 전송 완료",
    });
  } catch (err) {
    try {
      await q("ROLLBACK");
    } catch (e) {}
    console.error("sendMessage error:", err);
    return res.status(500).json({ success: false, message: "서버 오류" });
  }
};

/** =========================
 * ✅ 5) 내 채팅방 목록 + 상대정보 + 마지막대화 + unreadCount
 * GET /api/chat/rooms?user_id=29
 * ========================= */
exports.getMyChatRooms = async (req, res) => {
  const user_id = Number(req.query.user_id);
  if (!user_id) {
    return res.status(400).json({ success: false, message: "user_id가 필요합니다." });
  }

  try {
    const sql = `
      SELECT
        r.chat_id,
        r.goods_id,
        r.buyer_id,
        r.seller_id,
        r.last_message_at AS lastMessageAt,
        lm.content AS lastText,

        -- 상대방(내가 buyer면 seller가 상대, 내가 seller면 buyer가 상대)
        CASE WHEN r.buyer_id = ? THEN u_s.user_id ELSE u_b.user_id END AS otherUserId,
        CASE WHEN r.buyer_id = ? THEN u_s.user_nickname ELSE u_b.user_nickname END AS otherNickname,
        CASE WHEN r.buyer_id = ? THEN u_s.profile ELSE u_b.profile END AS otherProfile,

        IFNULL(us.last_read_message_id, 0) AS lastReadMessageId,

        (
          SELECT COUNT(*)
          FROM dam_chat_messages mm
          WHERE mm.chat_id = r.chat_id
            AND mm.user_id <> ?
            AND mm.message_id > IFNULL(us.last_read_message_id, 0)
        ) AS unreadCount

      FROM dam_chat_rooms r
      LEFT JOIN dam_chat_messages lm
        ON lm.message_id = r.last_message_id

      JOIN damteul_users u_b ON u_b.user_id = r.buyer_id
      JOIN damteul_users u_s ON u_s.user_id = r.seller_id

      LEFT JOIN dam_chat_room_user_state us
        ON us.chat_id = r.chat_id AND us.user_id = ?

      WHERE (r.buyer_id = ? OR r.seller_id = ?)
        AND (us.left_at IS NULL OR us.user_id IS NULL)
      ORDER BY r.last_message_at DESC, r.chat_id DESC
    `;

    const rows = await q(sql, [user_id, user_id, user_id, user_id, user_id, user_id, user_id]);

    return res.json({ success: true, rooms: rows || [] });
  } catch (err) {
    console.error("getMyChatRooms error:", err);
    return res.status(500).json({ success: false, message: "서버 오류" });
  }
};

/** =========================
 * ✅ 6) 읽음 처리 전용(옵션)
 * POST /api/chat/mark-read
 * body: { chat_id, user_id }
 * ========================= */
exports.markChatRead = async (req, res) => {
  const chat_id = Number(req.body.chat_id);
  const user_id = Number(req.body.user_id);

  if (!chat_id || !user_id) {
    return res.status(400).json({ success: false, message: "chat_id, user_id가 필요합니다." });
  }

  try {
    const lastReadMessageId = await markReadToLatest(chat_id, user_id);
    return res.json({ success: true, chat_id, user_id, lastReadMessageId });
  } catch (err) {
    console.error("markChatRead error:", err);
    return res.status(500).json({ success: false, message: "서버 오류" });
  }
};
